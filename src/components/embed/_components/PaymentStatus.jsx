import { Alert } from 'react-bootstrap';

function PaymentStatus({ paymentStatus, error, order }) {
  if (paymentStatus === 'completed') {
    return (
      <Alert variant="success">
        <Alert.Heading>Payment Successful!</Alert.Heading>
        <p>
          Your payment has been processed successfully. You will receive a confirmation
          email shortly at {order?.customer_email}.
        </p>
        <p className="mb-0">Redirecting to confirmation page...</p>
      </Alert>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <Alert variant="danger">
        <Alert.Heading>Payment Failed</Alert.Heading>
        <p>{error || 'There was an error processing your payment. Please check your payment details and try again.'}</p>
      </Alert>
    );
  }

  if (paymentStatus === 'cancelled') {
    return (
      <Alert variant="warning">
        <Alert.Heading>Payment Cancelled</Alert.Heading>
        <p>The payment process was cancelled. Please try again when you're ready to complete your order.</p>
      </Alert>
    );
  }

  return null;
}

export default PaymentStatus;
