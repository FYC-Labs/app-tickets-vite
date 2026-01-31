import { useMemo, memo } from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import { form } from 'accru-pay-react';
import CardLoader from '@src/components/global/CardLoader';
import { isProcessingPayment } from '../_helpers/checkout.consts';
import * as events from '../_helpers/checkout.events';

const PAYMENT_PROCESSOR = 'nuvei';

const CreditCardForm = memo(({ order, onPaymentSuccess, submitDisabled = false, showSubmitButton = true, showCardFields = true }) => {
  // Keep the same form instance across renders to preserve AccruPay state
  const AccruPaymentForm = useMemo(() => form(PAYMENT_PROCESSOR), []);
  const submitButtonText = useMemo(
    () => `Pay Now $${parseFloat(order?.total ?? 0).toFixed(2)}`,
    [order?.total],
  );

  const handleSuccess = async (paymentData) => {
    if (onPaymentSuccess) {
      await onPaymentSuccess(paymentData);
    } else {
      await events.handlePaymentSuccess(paymentData);
    }
  };

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

          {showSubmitButton && (
            <div className="d-grid">
              <AccruPaymentForm.SubmitBtn
                className="btn btn-primary btn-lg"
                text={submitButtonText}
                onSubmit={() => {
                  isProcessingPayment.value = true;
                }}
                onSuccess={handleSuccess}
                onError={events.handlePaymentError}
                onComplete={() => {
                  isProcessingPayment.value = false;
                }}
                disabled={isProcessingPayment.value || submitDisabled}
              />
            </div>
          )}
        </Form>
      </div>
    </div>
  );
});

export default CreditCardForm;
