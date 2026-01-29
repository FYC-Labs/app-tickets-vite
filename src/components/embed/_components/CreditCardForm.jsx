import { Form, Row, Col } from 'react-bootstrap';
import { form } from 'accru-pay-react';
import CardLoader from '@src/components/global/CardLoader';
import { isProcessingPayment } from '../_helpers/checkout.consts';
import * as events from '../_helpers/checkout.events';

const PAYMENT_PROCESSOR = 'nuvei';

function CreditCardForm({ order, onPaymentSuccess, submitDisabled = false }) {
  const AccruPaymentForm = form(PAYMENT_PROCESSOR);

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
        <Form>
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

          <div className="d-grid">
            <AccruPaymentForm.SubmitBtn
              className="btn btn-primary btn-lg"
              text={`Pay Now $${parseFloat(order.total).toFixed(2)}`}
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
        </Form>
      </div>
    </div>
  );
}

export default CreditCardForm;
