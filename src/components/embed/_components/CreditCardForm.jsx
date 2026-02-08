/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo, memo, useEffect } from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import { form } from 'accru-pay-react';
import CardLoader from '@src/components/global/CardLoader';
import { isProcessingPayment, paymentSubmitBtnRef } from '../_helpers/checkout.consts';
import * as events from '../_helpers/checkout.events';

const PAYMENT_PROCESSOR = 'nuvei';

const CreditCardForm = memo(({ order, onPaymentSuccess, submitDisabled = false, showSubmitButton = false, showCardFields = true }) => {
  // Keep the same form instance across renders to preserve AccruPay state
  const AccruPaymentForm = useMemo(() => form(PAYMENT_PROCESSOR), []);
  const submitButtonText = useMemo(
    () => `Pay Now $${parseFloat(order?.total ?? 0).toFixed(2)}`,
    [order?.total],
  );

  const handleSuccess = async (paymentData) => {
    // Keep isProcessingPayment true until redirect completes
    // This prevents showing components briefly before redirect
    try {
      if (onPaymentSuccess) {
        await onPaymentSuccess(paymentData);
      } else {
        await events.handlePaymentSuccess(paymentData);
      }
      // Don't set isProcessingPayment to false here - let the redirect happen first
      // It will be reset when the page unloads or if there's an error
    } catch (error) {
      // Only set to false on error
      isProcessingPayment.value = false;
      throw error;
    }
  };

  useEffect(() => {
    const buttonElement = document.querySelector('[data-accrupay-submit-btn] button');
    paymentSubmitBtnRef.value = buttonElement;

    return () => {
      paymentSubmitBtnRef.value = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {/* Overlay skeleton loader while payment is processing */}
      {isProcessingPayment.value && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'white',
            zIndex: 10,
          }}
        >
          <CardLoader
            variant="skeleton"
            message="Processing payment..."
          />
        </div>
      )}

      {/* Keep form mounted but hidden during processing */}
      <div style={{ opacity: isProcessingPayment.value ? 0 : 1 }}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {/* Fields always mounted in DOM but visually hidden from step 2 onwards */}
          {/* useMemo preserves form instance so state persists - fields stay accessible to AccruPay */}
          <div
            style={
              showCardFields
                ? {}
                : {
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  borderWidth: 0,
                }
            }
          >
            <Form.Group className="mb-24" controlId="cardholderName">
              <Form.Label>Cardholder Name</Form.Label>
              <AccruPaymentForm.CardHolderName
                className="form-control"
                placeholder="Enter cardholder name"
              />
            </Form.Group>

            <Form.Group className="mb-24" controlId="cardNumber">
              <Form.Label>Credit Card Number</Form.Label>
              <div className="form-control">
                <AccruPaymentForm.CreditCardNumber />
              </div>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-24" controlId="cardExpiration">
                  <Form.Label>Expiration Date</Form.Label>
                  <div className="form-control">
                    <AccruPaymentForm.CreditCardExpiration />
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-24" controlId="cardCvc">
                  <Form.Label>CVV</Form.Label>
                  <div className="form-control">
                    <AccruPaymentForm.CreditCardCvc />
                  </div>
                </Form.Group>
              </Col>
            </Row>
          </div>

          <div className="d-grid" data-accrupay-submit-btn style={{ display: showSubmitButton ? 'block' : 'none' }}>
            <AccruPaymentForm.SubmitBtn
              className="btn btn-dark btn-lg d-none"
              text={submitButtonText}
              onSubmit={() => {
                isProcessingPayment.value = true;
              }}
              onSuccess={handleSuccess}
              onError={(error) => {
                isProcessingPayment.value = false;
                events.handlePaymentError(error);
              }}
              onComplete={() => {
                // Only set to false if payment wasn't successful (error case)
                // For successful payments, keep it true until redirect completes
                // This prevents showing components briefly before redirect
              }}
              disabled={isProcessingPayment.value || submitDisabled}
            />
          </div>
        </Form>
      </div>
    </div>
  );
});

export default CreditCardForm;
