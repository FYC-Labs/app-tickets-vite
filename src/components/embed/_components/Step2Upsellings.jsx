/* eslint-disable no-nested-ternary */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Row, Col, Form, Alert, Button } from 'react-bootstrap';
import { AccruPay } from 'accru-pay-react';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import ordersAPI from '@src/api/orders.api';
import paymentsAPI from '@src/api/payments.api';
import CreditCardForm from './CreditCardForm';
import OrderSummary from './OrderSummary';
import {
  handleUpsellingChange,
  handleUpsellingCustomFieldChange,
  handlePaymentSuccess,
  handleFreeOrderComplete,
  getUpsellingDiscountAmount,
} from '../_helpers/eventForm.events';

function Step2Upsellings({ onGoBack }) {
  const [searchParams] = useSearchParams();
  const { form, upsellings } = $embed.value;
  const { selectedTickets, selectedUpsellings, upsellingCustomFields, order, paymentSession } = $embed.value;

  const totalTicketsSelected = Object.values(selectedTickets || {}).reduce((sum, qty) => sum + (qty || 0), 0);

  const orderTotal = order != null ? parseFloat(order.total) : null;
  const isFreeOrder = orderTotal !== null && orderTotal <= 0;

  const [paymentError, setPaymentError] = useState(null);
  const [isCompletingFree, setIsCompletingFree] = useState(false);

  const confirmationUrlOverride = searchParams.get('confirmationUrl');

  const providers = paymentSession?.preSessionData
    ? [
      {
        name: 'nuvei',
        config: paymentSession.preSessionData,
      },
    ]
    : null;

  const ticketsKey = JSON.stringify(selectedTickets || {});
  useEffectAsync(async () => {
    const { selectedUpsellings: currentSelectedUpsellings, upsellings: currentUpsellings } = $embed.value;
    const currentTotalTickets = Object.values(selectedTickets || {}).reduce((sum, qty) => sum + (qty || 0), 0);

    let needsUpdate = false;
    const updatedSelectedUpsellings = { ...currentSelectedUpsellings };

    Object.entries(currentSelectedUpsellings || {}).forEach(([upsellingId, quantity]) => {
      if (quantity > 0) {
        const upselling = currentUpsellings.find((u) => u.id === upsellingId);
        if (upselling && upselling.quantity_rule === 'MATCHES_TICKET_COUNT' && quantity > currentTotalTickets) {
          updatedSelectedUpsellings[upsellingId] = currentTotalTickets;
          needsUpdate = true;
        }
      }
    });

    if (needsUpdate) {
      $embed.update({ selectedUpsellings: updatedSelectedUpsellings });
    }
  }, [ticketsKey]);

  // When order total becomes > 0 (e.g. user added upsellings) and we have no session yet, create one
  useEffectAsync(async () => {
    const { order: currentOrder, paymentSession: currentSession } = $embed.value;
    if (!currentOrder || currentOrder.status === 'PAID') return;
    if (parseFloat(currentOrder.total) <= 0) return;
    if (currentSession?.sessionToken) return;
    try {
      const session = await paymentsAPI.createPaymentSession(currentOrder.id);
      if (session?.sessionToken) {
        $embed.update({ paymentSession: session });
      }
    } catch {
      // Session creation can fail; paymentError will show when user tries to pay
    }
  }, [order?.id, order?.total]);

  const upsellingsKey = JSON.stringify($embed.value.selectedUpsellings || {});
  const customFieldsKey = JSON.stringify($embed.value.upsellingCustomFields || {});
  useEffectAsync(async () => {
    const {
      order: currentOrder,
      selectedUpsellings: currentSelectedUpsellings,
      upsellingCustomFields: currentUpsellingCustomFields,
      upsellings: currentUpsellings,
    } = $embed.value;

    if (!currentOrder) {
      return;
    }

    if (currentOrder.status === 'PAID') {
      return;
    }

    try {
      const upsellingEntries = Object.entries(currentSelectedUpsellings || {});

      const upsellingOrderItems = upsellingEntries
        .filter(([, quantity]) => quantity > 0)
        .map(([upsellingId, quantity]) => {
          const upselling = currentUpsellings.find((u) => u.id === upsellingId);
          if (!upselling) {
            return null;
          }

          const customFieldValues = (currentUpsellingCustomFields && currentUpsellingCustomFields[upsellingId]) || {};

          const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;
          if (hasCustomFields) {
            const allFieldsComplete = upselling.custom_fields.every(field => {
              const value = customFieldValues[field.label];
              return value !== undefined && value !== null && value !== '';
            });

            if (!allFieldsComplete) {
              return null;
            }
          }

          const unitPrice = parseFloat(upselling.amount ?? upselling.price);

          return {
            upselling_id: upsellingId,
            quantity,
            unit_price: unitPrice,
            custom_fields: customFieldValues,
          };
        })
        .filter(Boolean);

      const upsellingDiscountAmount = getUpsellingDiscountAmount();
      const updatedOrder = await ordersAPI.updatePendingItems(
        currentOrder.id,
        upsellingOrderItems,
        upsellingDiscountAmount,
      );
      $embed.update({ order: updatedOrder });
    } catch (err) {
      setPaymentError(err.message || 'Error updating order with upsellings. Please try again.');
    }
  }, [order?.id, upsellingsKey, customFieldsKey]);

  const renderUpsellingCustomField = (field, upsellingId, index) => {
    const fieldKey = `${upsellingId}_${field.label}`;
    const value = upsellingCustomFields[upsellingId]?.[field.label] || '';

    return (
      <FormDynamicField
        key={index}
        field={field}
        index={index}
        name={fieldKey}
        value={value}
        groupClassName="mb-16"
        labelClassName="small"
        selectPlaceholder={field.placeholder || 'Select...'}
        onChange={(newValue) => handleUpsellingCustomFieldChange(upsellingId, field.label, newValue)}
      />
    );
  };

  const preCheckoutUpsellings = upsellings.filter(u => u.upselling_strategy === 'PRE-CHECKOUT');

  return (
    <>
      <div className="mb-32">
        <div className="d-flex justify-content-between align-items-center mb-16">
          <div>
            <h3 className="mb-4">You might also like...</h3>
            <p className="text-muted mb-0">Add these items to your order</p>
          </div>
          {onGoBack && (
            <Button
              type="button"
              variant="link"
              className="p-0 text-muted small"
              onClick={onGoBack}
            >
              ← Back to tickets
            </Button>
          )}
        </div>
      </div>

      {preCheckoutUpsellings.map((upselling, index) => {
        const available = upselling.quantity - (upselling.sold || 0);
        const selectedQty = selectedUpsellings[upselling.id] || 0;
        const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;
        const isSelected = selectedQty > 0;
        const isOnlyOne = upselling.quantity_rule === 'ONLY_ONE';
        const matchesTicketCount = upselling.quantity_rule === 'MATCHES_TICKET_COUNT';

        let maxQuantity = available;
        if (isOnlyOne) {
          maxQuantity = Math.min(1, available);
        } else if (matchesTicketCount) {
          maxQuantity = Math.min(totalTicketsSelected, available);
        }

        let quantityOptions;
        if (isOnlyOne) {
          quantityOptions = maxQuantity > 0 ? [0, 1] : [0];
        } else if (matchesTicketCount) {
          if (maxQuantity <= 0) {
            quantityOptions = [0];
          } else {
            quantityOptions = [0, maxQuantity];
          }
        } else {
          quantityOptions = [...Array(maxQuantity + 1).keys()];
        }

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
                    {quantityOptions.map((n) => (
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

      {order && (
        <div className="mt-32">
          <OrderSummary order={order} />
        </div>
      )}

      <div className="mt-32">
        <h4 className="mb-16">Complete your order</h4>

        {paymentError && (
          <Alert variant="danger" className="mb-16">
            {paymentError}
          </Alert>
        )}

        {order && isFreeOrder && (
          <Card>
            <Card.Body>
              <p className="text-muted mb-16">
                Your order total is $0. No payment required.
              </p>
              <Button
                variant="dark"
                size="lg"
                className="w-100"
                disabled={isCompletingFree}
                onClick={async () => {
                  try {
                    setIsCompletingFree(true);
                    setPaymentError(null);
                    await handleFreeOrderComplete(confirmationUrlOverride);
                  } catch (err) {
                    setPaymentError(err.message || 'Unable to complete order. Please try again.');
                  } finally {
                    setIsCompletingFree(false);
                  }
                }}
              >
                {isCompletingFree ? 'Completing...' : 'Complete order'}
              </Button>
            </Card.Body>
          </Card>
        )}

        {order && !isFreeOrder && providers && paymentSession && (
          <Card>
            <Card.Body>
              <AccruPay
                sessionToken={paymentSession.sessionToken}
                preferredProvider="nuvei"
                preReleaseGetProviders={() => providers || []}
              >
                <CreditCardForm
                  order={order}
                  onPaymentSuccess={async (paymentData) => {
                    try {
                      await handlePaymentSuccess(paymentData, confirmationUrlOverride);
                    } catch (err) {
                      setPaymentError(err.message || 'Error processing payment. Please try again.');
                    }
                  }}
                />
              </AccruPay>
            </Card.Body>
          </Card>
        )}
      </div>
    </>
  );
}

export default Step2Upsellings;
