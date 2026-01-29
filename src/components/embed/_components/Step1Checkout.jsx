import { useState } from 'react';
import { Form, Button, Row, Col, Alert, Badge, Card } from 'react-bootstrap';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import paymentsAPI from '@src/api/payments.api';
import {
  handleFieldChange,
  handleTicketChange,
  handleApplyDiscount,
  updateDiscountCode,
  createOrderForPayment,
} from '../_helpers/eventForm.events';

function Step1Checkout({ formId, eventId, onPlaceOrder }) {
  const { form } = $embed.value;
  const { tickets } = $embed.value;
  const {
    error,
    formData,
    selectedTickets,
    discountCode,
    appliedDiscount,
    totals,
    isFormValid,
  } = $embed.value;

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [localError, setLocalError] = useState(null);

  const hasContactInfo = Boolean(formData.email && formData.name);
  const hasTicketsSelected = Object.values(selectedTickets || {}).some((qty) => qty > 0);

  const handlePlaceOrderClick = async () => {
    if (!isFormValid || !hasContactInfo || !hasTicketsSelected) {
      return;
    }

    try {
      setIsPlacingOrder(true);
      setLocalError(null);

      const order = await createOrderForPayment(formId, eventId);
      if (!order) {
        setLocalError('Unable to create order. Please try again.');
        return;
      }

      const orderTotal = parseFloat(order.total);
      if (orderTotal > 0) {
        const session = await paymentsAPI.createPaymentSession(order.id);
        if (!session || !session.sessionToken) {
          setLocalError('Payment session could not be initialized. Please try again.');
          return;
        }
        $embed.update({ paymentSession: session });
      } else {
        $embed.update({ paymentSession: null });
      }

      if (onPlaceOrder) {
        onPlaceOrder();
      }
    } catch (err) {
      setLocalError(err.message || 'Error creating order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const renderField = (field, index) => {
    const key =
      field.field_id_string !== null && field.field_id_string !== undefined
        ? field.field_id_string
        : field.label;
    const value = formData[key] || '';

    return (
      <FormDynamicField
        key={index}
        field={field}
        index={index}
        value={value}
        onChange={(newValue) => handleFieldChange(field.label, newValue, field.field_id_string)}
      />
    );
  };

  return (
    <>
      {form && (
        <div className="mb-32">
          {form.show_title !== false && <h3>{form.name}</h3>}
          {form.show_description !== false && form.description && <p className="text-muted">{form.description}</p>}
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}
      {localError && <Alert variant="danger">{localError}</Alert>}

      <Form>
        <Form.Group className="mb-24">
          <Row>
            <Col md={6} className="mb-16 mb-md-0">
              <Form.Label>Email *</Form.Label>
              <UniversalInput
                type="email"
                name="email"
                placeholder="your@email.com"
                value={formData.email || ''}
                customOnChange={(e) => handleFieldChange('email', e.target.value)}
                required
              />
            </Col>
            <Col md={6}>
              <Form.Label>Full Name *</Form.Label>
              <UniversalInput
                type="text"
                name="name"
                placeholder="Your name"
                value={formData.name || ''}
                customOnChange={(e) => handleFieldChange('name', e.target.value)}
                required
              />
            </Col>
          </Row>
        </Form.Group>

        {form?.schema?.map((field, index) => renderField(field, index))}

        {tickets.length > 0 && (
          <div className="mb-32 mt-32">
            <h5 className="mb-24 mt-32">Select Tickets</h5>
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
                            <Badge bg="success">
                              {available} available
                            </Badge>
                          ) : (
                            <Badge bg="danger">Sold out</Badge>
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

        {/* Paso 1: Place Order crea la orden base y avanza el flujo */}
        <Button
          type="button"
          variant="dark"
          size="lg"
          className="w-100"
          disabled={isPlacingOrder || !isFormValid || !hasContactInfo || !hasTicketsSelected}
          onClick={handlePlaceOrderClick}
        >
          {isPlacingOrder ? 'Preparing order...' : 'Place Order'}
        </Button>
      </Form>
    </>
  );
}

export default Step1Checkout;
