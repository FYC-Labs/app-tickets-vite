import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import Loader from '@src/components/global/Loader';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import {
  loadFormData,
  handleFieldChange,
  handleTicketChange,
  handleApplyDiscount,
  handleSubmit,
  updateDiscountCode,
} from './_helpers/eventForm.events';

function EventForm({ formId, eventId, onSubmitSuccess, theme = 'light' }) {
  const { form } = $embed.value;
  const { tickets } = $embed.value;
  const { isLoading } = $embed.value;
  const { error, formData, selectedTickets, discountCode, appliedDiscount, totals, isFormValid } = $embed.value;

  useEffectAsync(async () => {
    await loadFormData(formId, eventId);
  }, [formId, eventId]);

  const renderField = (field, index) => {
    const value = formData[field.label] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label>
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              as="textarea"
              rows={3}
              name={`field_${index}`}
              placeholder={field.placeholder}
              value={value}
              customOnChange={(e) => handleFieldChange(field.label, e.target.value)}
              required={field.required}
            />
            {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      case 'select':
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label>
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              as="select"
              name={`field_${index}`}
              value={value}
              customOnChange={(e) => handleFieldChange(field.label, e.target.value)}
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
              customOnChange={(e) => handleFieldChange(field.label, e.target.checked)}
              required={field.required}
            />
            {field.instructions && <Form.Text className="text-muted d-block">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      case 'radio':
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label>
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            {field.options?.map((option, i) => (
              <Form.Check
                key={i}
                type="radio"
                label={option}
                name={field.label}
                value={option}
                checked={value === option}
                onChange={(e) => handleFieldChange(field.label, e.target.value)}
                required={field.required}
              />
            ))}
            {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
          </Form.Group>
        );

      default:
        return (
          <Form.Group key={index} className="mb-24">
            <Form.Label>
              {field.label} {field.required && <span className="text-danger">*</span>}
            </Form.Label>
            <UniversalInput
              type={field.type}
              name={`field_${index}`}
              placeholder={field.placeholder}
              value={value}
              customOnChange={(e) => handleFieldChange(field.label, e.target.value)}
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
    <Card className={`event-form-embed ${theme} border-0`}>
      <Card.Body>
        {form && (
          <div className="mb-32">
            {form.show_title !== false && <h3>{form.name}</h3>}
            {form.show_description !== false && form.description && <p className="text-muted">{form.description}</p>}
          </div>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={(e) => handleSubmit(e, formId, eventId, onSubmitSuccess)}>
          <Form.Group className="mb-24">
            <Form.Label>Email *</Form.Label>
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
            <Form.Label>Name</Form.Label>
            <UniversalInput
              type="text"
              name="name"
              placeholder="Your name"
              value={formData.name || ''}
              customOnChange={(e) => handleFieldChange('name', e.target.value)}
            />
          </Form.Group>

          {form?.schema?.map((field, index) => renderField(field, index))}

          {tickets.length > 0 && (
            <div className="mb-32">
              <h5 className="mb-24">Select Tickets</h5>
              {tickets.map((ticket) => {
                const available = ticket.quantity - (ticket.sold || 0);
                return (
                  <Card key={ticket.id} className="mb-24 border-0 shadow-none bg-transparent">
                    <Card.Body>
                      <Row className="align-items-center">
                        <Col md={form?.show_tickets_remaining !== false ? 6 : 9}>
                          <h6 className="mb-8">{ticket.name}</h6>
                          {ticket.description && (
                            <p className="text-muted small mb-0">{ticket.description}</p>
                          )}
                          {ticket.benefits && (
                            <p className="text-muted small mb-0">{ticket.benefits}</p>
                          )}
                          <strong>
                            ${parseFloat(ticket.price).toFixed(2)}
                          </strong>
                        </Col>
                        {form?.show_tickets_remaining !== false && (
                          <Col md={3} className="text-muted small">
                            {available > 0 ? `${available} available` : 'Sold out'}
                          </Col>
                        )}
                        <Col md={3}>
                          <Form.Label>Quantity</Form.Label>
                          <UniversalInput
                            as="select"
                            name={`ticket_${ticket.id}`}
                            value={selectedTickets[ticket.id] || 0}
                            customOnChange={e => handleTicketChange(ticket.id, Number(e.target.value))}
                            disabled={available === 0}
                          >
                            {[...Array(available + 1).keys()].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </UniversalInput>
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

              {totals.subtotal > 0 && (
                <Card className="bg-transparent">
                  <Card.Body>
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
                    <div className="d-flex justify-content-between pt-2 border-top">
                      <strong>Total:</strong>
                      <strong className="text-primary">${totals.total.toFixed(2)}</strong>
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
