import { Form } from 'react-bootstrap';
import { form } from 'accru-pay-react';
import CardLoader from '@src/components/global/CardLoader';
import { isProcessingPayment } from '../_helpers/checkout.consts';
import * as events from '../_helpers/checkout.events';

const PAYMENT_PROCESSOR = 'nuvei';

function CreditCardSubmit({ order }) {
  const AccruPaymentForm = form(PAYMENT_PROCESSOR);

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
          <div className="d-grid">
            <AccruPaymentForm.SubmitBtn
              className="btn btn-primary btn-lg"
              text={`Place Order $${parseFloat(order.total).toFixed(2)}`}
              onSubmit={() => {
                isProcessingPayment.value = true;
              }}
              onSuccess={events.handlePaymentSuccess}
              onError={events.handlePaymentError}
              onComplete={() => {
                isProcessingPayment.value = false;
              }}
              disabled={isProcessingPayment.value}
            />
          </div>
        </Form>
      </div>
    </div>
  );
}

export default CreditCardSubmit;
