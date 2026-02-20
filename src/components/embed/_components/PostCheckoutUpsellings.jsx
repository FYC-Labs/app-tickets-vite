import { Card, Row, Col, Button, Form, Badge } from 'react-bootstrap';
import UniversalInput from '@src/components/global/Inputs/UniversalInput/UniversalInput';
import { postCheckoutUpsellings, selectedPostCheckoutUpsellings, postCheckoutUpsellingCustomFields, isAddingUpsellings } from '../_helpers/checkout.consts';
import { handlePostCheckoutUpsellingChange, handlePostCheckoutUpsellingCustomFieldChange, handleAddUpsellingsToOrder } from '../_helpers/checkout.events';

function PostCheckoutUpsellings({ order }) {
  const upsellings = postCheckoutUpsellings.value;
  const selected = selectedPostCheckoutUpsellings.value;
  const customFields = postCheckoutUpsellingCustomFields.value;
  const isLoading = isAddingUpsellings.value;

  if (!upsellings || upsellings.length === 0) {
    return null;
  }

  const hasSelection = Object.values(selected).some((qty) => qty > 0);

  const renderCustomField = (field, upsellingId, index) => {
    const fieldKey = `${upsellingId}_${field.label}`;
    const value = customFields[upsellingId]?.[field.label] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Form.Group key={index} className="mb-16">
            <Form.Label className="small">
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              as="textarea"
              rows={2}
              name={fieldKey}
              placeholder={field.placeholder}
              value={value}
              customOnChange={(e) => handlePostCheckoutUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
              required={field.required}
            />
          </Form.Group>
        );

      case 'select':
        return (
          <Form.Group key={index} className="mb-16">
            <Form.Label className="small">
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              as="select"
              name={fieldKey}
              value={value}
              customOnChange={(e) => handlePostCheckoutUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
              required={field.required}
            >
              <option value="">{field.placeholder || 'Select...'}</option>
              {(field.options || []).map((option, i) => (
                <option key={i} value={option}>
                  {option}
                </option>
              ))}
            </UniversalInput>
          </Form.Group>
        );

      case 'checkbox':
        return (
          <Form.Group key={index} className="mb-16">
            <UniversalInput
              type="checkbox"
              name={fieldKey}
              label={field.label}
              checked={!!value}
              customOnChange={(e) => handlePostCheckoutUpsellingCustomFieldChange(upsellingId, field.label, e.target.checked)}
              required={field.required}
            />
          </Form.Group>
        );

      case 'radio':
        return (
          <Form.Group key={index} className="mb-16">
            <Form.Label className="small">
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            {(field.options || []).map((option, i) => (
              <Form.Check
                key={i}
                type="radio"
                label={option}
                name={fieldKey}
                value={option}
                checked={value === option}
                onChange={(e) => handlePostCheckoutUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
                required={field.required}
              />
            ))}
          </Form.Group>
        );

      default:
        return (
          <Form.Group key={index} className="mb-16">
            <Form.Label className="small">
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              type={field.type}
              name={fieldKey}
              placeholder={field.placeholder}
              value={value}
              customOnChange={(e) => handlePostCheckoutUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
              required={field.required}
            />
          </Form.Group>
        );
    }
  };

  const handleAddToOrder = async () => {
    try {
      await handleAddUpsellingsToOrder(order.id);
    } catch (err) {
      // Error is handled in the event handler
    }
  };

  const calculateTotal = () => upsellings.reduce((total, upselling) => {
    const qty = selected[upselling.id] || 0;
    return total + (parseFloat(upselling.amount ?? upselling.price) * qty);
  }, 0);

  return (
    <div className="mb-24">
      <Card className="mb-24 border-0 shadow-sm">
        <Card.Header className="bg-light">
          <h4 className="mb-8">Enhance Your Experience</h4>
          <p className="text-muted mb-0 small">
            Add these exclusive options to make your event even better
          </p>
        </Card.Header>
        <Card.Body className="p-24">
          <div>
            {upsellings.map((upselling, index) => {
              const available = upselling.quantity - (upselling.sold || 0);
              const selectedQty = selected[upselling.id] || 0;
              const isSelected = selectedQty > 0;
              const isSoldOut = available === 0;
              const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;

              return (
                <Card
                  key={upselling.id}
                  className={`mb-16 border-0 ${isSelected ? 'selected' : ''} ${isSoldOut ? 'sold-out' : ''}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <Card.Body className="p-24">
                    <Row className="align-items-start">
                      <Col md={8}>
                        <div className="d-flex align-items-start mb-16">
                          <div className="me-16 flex-shrink-0">
                            {upselling.images?.length > 0 ? (
                              <img
                                src={upselling.images[0]}
                                alt=""
                                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
                              />
                            ) : (
                              <span className="icon-sparkle">⭐</span>
                            )}
                          </div>
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-8">
                              <h6 className="mb-0 me-8">
                                {upselling.item ?? upselling.name}
                              </h6>
                              {isSoldOut && (
                                <Badge bg="danger" className="ms-8">Sold Out</Badge>
                              )}
                              {isSelected && !isSoldOut && (
                                <Badge bg="success" className="ms-8">Selected</Badge>
                              )}
                            </div>
                            {upselling.description && (
                              <p className="mb-12 text-muted small">
                                {upselling.description}
                              </p>
                            )}
                            {upselling.benefits && (
                              <div>
                                <span className="benefits-label">Benefits:</span>
                                <span className="benefits-text">{upselling.benefits}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div>
                          <div className="mb-16">
                            <span className="price-currency">$</span>
                            <span className="price-amount">
                              {parseFloat(upselling.amount ?? upselling.price).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <Form.Label className="small fw-semibold mb-8">Quantity</Form.Label>
                            <UniversalInput
                              as="select"
                              name={`post_checkout_upselling_${upselling.id}`}
                              value={selectedQty}
                              customOnChange={(e) => handlePostCheckoutUpsellingChange(upselling.id, Number(e.target.value))}
                              disabled={isSoldOut || isLoading}
                            >
                              {[...Array(Math.min(available, 10) + 1).keys()].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </UniversalInput>
                            {selectedQty > 0 && (
                              <div className="mt-8">
                                <small className="text-muted">Subtotal: </small>
                                <strong className="text-primary">
                                  ${(parseFloat(upselling.amount ?? upselling.price) * selectedQty).toFixed(2)}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </Col>
                    </Row>
                    {selectedQty > 0 && hasCustomFields && (
                      <Row className="mt-16">
                        <Col md={12}>
                          <div className="border-top pt-16 mt-16">
                            <h6 className="small mb-16">Additional Information</h6>
                            {upselling.custom_fields.map((field, idx) => renderCustomField(field, upselling.id, idx))}
                          </div>
                        </Col>
                      </Row>
                    )}
                  </Card.Body>
                </Card>
              );
            })}
          </div>

          {hasSelection && (
            <div className="mt-24 pt-24 border-top">
              <div className="d-flex justify-content-between align-items-center mb-16">
                <div>
                  <h6 className="mb-0">Total Additional Items</h6>
                  <small className="text-muted">Add these items to your order</small>
                </div>
                <div className="text-end">
                  <div>
                    <span className="total-label">Total:</span>
                    <span className="total-amount">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={handleAddToOrder}
                disabled={isLoading}
                className="w-100"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-8" role="status" aria-hidden="true" />
                    Adding to Order...
                  </>
                ) : (
                  <>
                    <span className="me-8">✨</span>
                    Add to Order
                  </>
                )}
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default PostCheckoutUpsellings;
