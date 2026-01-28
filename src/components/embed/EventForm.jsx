import { Card, Form, Button, Row, Col, Alert, Badge } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import Loader from '@src/components/global/Loader';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { formatPhone } from '@src/components/global/Inputs/UniversalInput/_helpers/universalinput.events';
import {
  loadFormData,
  handleFieldChange,
  handleTicketChange,
  handleUpsellingChange,
  handleUpsellingCustomFieldChange,
  handleApplyDiscount,
  handleSubmit,
  updateDiscountCode,
} from './_helpers/eventForm.events';

function EventForm({ formId, eventId, onSubmitSuccess, theme = 'light' }) {
  const { form } = $embed.value;
  const { tickets, upsellings } = $embed.value;
  const { isLoading } = $embed.value;
  const { error, formData, selectedTickets, selectedUpsellings, upsellingCustomFields, discountCode, appliedDiscount, totals, isFormValid } = $embed.value;

  useEffectAsync(async () => {
    await loadFormData(formId, eventId);
  }, [formId, eventId]);

  const renderUpsellingCustomField = (field, upsellingId, index) => {
    const fieldKey = `${upsellingId}_${field.label}`;
    const value = upsellingCustomFields[upsellingId]?.[field.label] || '';

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
              customOnChange={(e) => handleUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
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
              customOnChange={(e) => handleUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
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
              customOnChange={(e) => handleUpsellingCustomFieldChange(upsellingId, field.label, e.target.checked)}
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
                onChange={(e) => handleUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
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
              customOnChange={(e) => handleUpsellingCustomFieldChange(upsellingId, field.label, e.target.value)}
              required={field.required}
            />
          </Form.Group>
        );
    }
  };

  const renderField = (field, index) => {
    const key = field.field_id_string !== null && field.field_id_string !== undefined ? field.field_id_string : field.label;
    const value = formData[key] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label >
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              as="textarea"
              rows={3}
              name={`field_${index}`}
              placeholder={field.placeholder}
              value={value}
              customOnChange={(e) => handleFieldChange(field.label, e.target.value, field.field_id_string)}
              required={field.required}
            />
            {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      case 'select':
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label >
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              as="select"
              name={`field_${index}`}
              value={value}
              customOnChange={(e) => handleFieldChange(field.label, e.target.value, field.field_id_string)}
              required={field.required}
            >
              <option value="">Select...</option>
              {field.options?.map((option, i) => (
                <option key={i} value={option}>
                  {option}
                </option>
              ))}
            </UniversalInput>
            {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      case 'checkbox':
        return (
          <Form.Group key={index} className="mb-24">
            <UniversalInput
              type="checkbox"
              name={`field_${index}`}
              label={field.label}
              checked={!!value}
              customOnChange={(e) => handleFieldChange(field.label, e.target.checked, field.field_id_string)}
              required={field.required}
            />
            {field.instructions && <Form.Text className="text-muted d-block">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      case 'radio':
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label >
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <div >
              {field.options?.map((option, i) => (
                <Form.Check
                  key={i}
                  type="radio"
                  label={option}
                  name={field.label}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleFieldChange(field.label, e.target.value, field.field_id_string)}
                  required={field.required}
                />
              ))}
            </div>
            {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      case 'tel':
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label >
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              type="tel"
              name={`field_${index}`}
              placeholder={field.placeholder || '(123) 456-7890'}
              value={value}
              customOnChange={(e) => {
                const inputValue = e.target.value;
                const digitsOnly = inputValue.replace(/\D/g, '');
                const limitedDigits = digitsOnly.slice(0, 10);
                const formatted = formatPhone(limitedDigits);
                handleFieldChange(field.label, formatted, field.field_id_string);
              }}
              required={field.required}
              maxLength={14}
            />
            {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      default:
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label >
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              type={field.type}
              name={`field_${index}`}
              placeholder={field.placeholder}
              value={value}
              customOnChange={(e) => handleFieldChange(field.label, e.target.value, field.field_id_string)}
              required={field.required}
            />
            {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
          </Form.Group>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-vh-100 w-100 d-flex justify-content-center align-items-center">
        <Loader className="text-center" />
      </div>
    );
  }

  return (
    <Card className={`${theme} border-0`}>
      <Card.Body>
        {form && (
          <div className="mb-32">
            {form.show_title !== false && <h3>{form.name}</h3>}
            {form.show_description !== false && form.description && <p className="text-muted">{form.description}</p>}
          </div>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={(e) => handleSubmit(e, formId, eventId, onSubmitSuccess)} >
          <Form.Group className="mb-24">
            <Form.Label >Email *</Form.Label>
            <UniversalInput
              type="email"
              name="email"
              placeholder="your@email.com"
              value={formData.email || ''}
              customOnChange={(e) => handleFieldChange('email', e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-24">
            <Form.Label >Name *</Form.Label>
            <UniversalInput
              type="text"
              name="name"
              placeholder="Your name"
              value={formData.name || ''}
              customOnChange={(e) => handleFieldChange('name', e.target.value)}
              required
            />
          </Form.Group>

          {form?.schema?.map((field, index) => renderField(field, index))}

          {tickets.length > 0 && (
            <div className="mb-32">
              <h5 className="mb-24">Select Tickets</h5>
              {tickets.map((ticket, index) => {
                const available = ticket.quantity - (ticket.sold || 0);
                const selectedQty = selectedTickets[ticket.id] || 0;
                const isSelected = selectedQty > 0;
                return (
                  <Card key={ticket.id} className={`mb-16 border-0 ${isSelected ? 'selected' : ''} ${available === 0 ? 'sold-out' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
                    <Card.Body className="p-24">
                      <Row className="align-items-center">
                        <Col md={form?.show_tickets_remaining !== false ? 6 : 9}>
                          <div className="d-flex align-items-start">
                            <div className="me-16">
                              <span className="icon-ticket">🎫</span>
                            </div>
                            <div className="flex-grow-1">
                              <h6 className="mb-8">{ticket.name}</h6>
                              {ticket.description && (
                                <p className="text-muted small mb-8">{ticket.description}</p>
                              )}
                              {ticket.benefits && (
                                <div className="mb-8">
                                  <span className="benefits-label">Benefits:</span>
                                  <span className="benefits-text">{ticket.benefits}</span>
                                </div>
                              )}
                              <div>
                                <span className="price-currency">$</span>
                                <span className="price-amount">{parseFloat(ticket.price).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </Col>
                        {form?.show_tickets_remaining !== false && (
                          <Col md={3} className="text-center">
                            {available > 0 ? (
                              <Badge bg="success" >
                                {available} available
                              </Badge>
                            ) : (
                              <Badge bg="danger" >Sold out</Badge>
                            )}
                          </Col>
                        )}
                        <Col md={3}>
                          <Form.Label className="small fw-semibold mb-8">Quantity</Form.Label>
                          <UniversalInput
                            as="select"
                            name={`ticket_${ticket.id}`}
                            value={selectedQty}
                            customOnChange={e => handleTicketChange(ticket.id, Number(e.target.value))}
                            disabled={available === 0}
                          >
                            {[...Array(available + 1).keys()].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </UniversalInput>
                          {selectedQty > 0 && (
                            <div className="mt-8">
                              <small className="text-muted">Subtotal: </small>
                              <strong className="text-primary">
                                ${(parseFloat(ticket.price) * selectedQty).toFixed(2)}
                              </strong>
                            </div>
                          )}
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                );
              })}

              {form?.show_discount_code !== false && (
                <div className="mb-24">
                  <Form.Label>Discount Code</Form.Label>
                  <UniversalInput
                    type="text"
                    name="discountCode"
                    placeholder="Enter code"
                    value={discountCode}
                    customOnChange={(e) => updateDiscountCode(e.target.value.toUpperCase())}
                    className="flex-grow-1"
                    style={{ minWidth: 0 }}
                  />
                  <div className="mt-8">
                    <Button
                      variant="dark"
                      onClick={() => handleApplyDiscount(formId, eventId)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Apply
                    </Button>
                  </div>
                  {appliedDiscount && (
                    <small className="text-success">
                      Discount applied: {appliedDiscount.code}
                    </small>
                  )}
                </div>
              )}

              {upsellings.filter(u => u.upselling_strategy === 'PRE-CHECKOUT').length > 0 && (
              <div className="mb-32">
                <h5 className="mb-24">You might also like...</h5>
                {upsellings
                  .filter(u => u.upselling_strategy === 'PRE-CHECKOUT')
                  .map((upselling, index) => {
                    const available = upselling.quantity - (upselling.sold || 0);
                    const selectedQty = selectedUpsellings[upselling.id] || 0;
                    const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;
                    const isSelected = selectedQty > 0;
                    return (
                      <Card key={upselling.id} className={`mb-16 border-0 ${isSelected ? 'selected' : ''} ${available === 0 ? 'sold-out' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
                        <Card.Body className="p-24">
                          <Row className="align-items-center">
                            <Col md={form?.show_tickets_remaining !== false ? 6 : 9}>
                              <div className="d-flex align-items-start">
                                <div className="me-16">
                                  <span className="icon-sparkle">⭐</span>
                                </div>
                                <div className="flex-grow-1">
                                  <h6 className="mb-8">{upselling.item ?? upselling.name}</h6>
                                  {upselling.description && (
                                  <p className="text-muted small mb-8">{upselling.description}</p>
                                  )}
                                  {upselling.benefits && (
                                  <div className="mb-8">
                                    <span className="benefits-label">Benefits:</span>
                                    <span className="benefits-text">{upselling.benefits}</span>
                                  </div>
                                  )}
                                  <div>
                                    <span className="price-currency">$</span>
                                    <span className="price-amount">{parseFloat(upselling.amount ?? upselling.price).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </Col>
                            <Col md={3}>
                              <Form.Label className="small fw-semibold mb-8">Quantity</Form.Label>
                              <UniversalInput
                                as="select"
                                name={`upselling_${upselling.id}`}
                                value={selectedQty}
                                customOnChange={e => handleUpsellingChange(upselling.id, Number(e.target.value))}
                                disabled={available === 0}
                              >
                                {[...Array(available + 1).keys()].map(n => (
                                  <option key={n} value={n}>{n}</option>
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
                            </Col>
                          </Row>
                          {selectedQty > 0 && hasCustomFields && (
                            <Row className="mt-16">
                              <Col md={12}>
                                <div className="border-top pt-16 mt-16">
                                  <h6 className="small mb-16 fw-semibold">Additional Information</h6>
                                  {upselling.custom_fields.map((field, idx) => renderUpsellingCustomField(field, upselling.id, idx))}
                                </div>
                              </Col>
                            </Row>
                          )}
                        </Card.Body>
                      </Card>
                    );
                  })}
              </div>
              )}

              {totals.subtotal > 0 && (
                <Card className="bg-transparent border-0">
                  <Card.Body className="p-24">
                    <div className="d-flex justify-content-between mb-16">
                      <span>Subtotal:</span>
                      <strong>${totals.subtotal.toFixed(2)}</strong>
                    </div>
                    {totals.discount_amount > 0 && (
                      <div className="d-flex justify-content-between mb-16 text-success">
                        <span>Discount:</span>
                        <strong>-${totals.discount_amount.toFixed(2)}</strong>
                      </div>
                    )}
                    <div className="d-flex justify-content-between pt-16 border-top">
                      <strong>Total:</strong>
                      <strong>${totals.total.toFixed(2)}</strong>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="dark"
            size="lg"
            className="w-100"
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? 'Submitting...' : 'Proceed to Payment'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
}

export default EventForm;
