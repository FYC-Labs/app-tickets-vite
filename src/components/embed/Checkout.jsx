import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Alert, Container, Row, Col } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { AccruPay } from 'accru-pay-react';
import { $checkout } from '@src/signals';
import Loader from '@src/components/global/Loader';
import CardLoader from '@src/components/global/CardLoader';
import * as resolvers from './_helpers/checkout.resolvers';
import { sessionInitError } from './_helpers/checkout.consts';
import CreditCardForm from './_components/CreditCardForm';
import OrderSummary from './_components/OrderSummary';
import PaymentStatus from './_components/PaymentStatus';
import TestCards from './_components/TestCards';
// import PostCheckoutUpsellings from './_components/PostCheckoutUpsellings';

const PAYMENT_PROCESSOR = 'nuvei';

function Checkout() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const { order, error, paymentStatus, paymentSession } = $checkout.value;
  const { isLoading } = $checkout.value;
  const theme = $checkout.value.form?.theme || 'light';

  // Format preSessionData from payment session into providers format
  const providers = paymentSession?.preSessionData ? [{
    name: PAYMENT_PROCESSOR,
    config: paymentSession.preSessionData,
  }] : null;

  useEffectAsync(() => {
    const confirmationUrlOverride = searchParams.get('confirmationUrl');
    const isEmbedded = searchParams.get('embed') === 'true';

    if (confirmationUrlOverride) {
      // Decode the URL in case it was encoded
      const decodedUrl = decodeURIComponent(confirmationUrlOverride);
      $checkout.update({ confirmationUrlOverride: decodedUrl });
    }

    if (isEmbedded) {
      $checkout.update({ isEmbedded: true });
    }
  }, [searchParams]);

  useEffectAsync(async () => {
    if (orderId) {
      await resolvers.loadOrderData(orderId);
    }
  }, [orderId]);

  useEffectAsync(async () => {
    const { order: orderData, form: formData } = $checkout.value;
    if (orderData && orderData.status === 'PAID' && orderData.event_id) {
      await resolvers.loadPostCheckoutUpsellings(orderData.event_id, formData ?? null);
    }
  }, [order]);

  useEffectAsync(async () => {
    const { order: orderData, paymentSession: currentSession } = $checkout.value;
    const orderTotal = parseFloat(orderData?.total) || 0;
    const isFreeOrder = orderTotal === 0;

    if (orderData && orderData.status === 'PENDING' && !currentSession && !isFreeOrder) {
      try {
        let session = await resolvers.fetchPaymentSession(orderId);
        if (!session) {
          session = await resolvers.initializePaymentSession(orderId);
        }
        // Only update if we got a valid session to avoid loops
        if (session) {
          $checkout.update({ paymentSession: session });
        }
      } catch (err) {
        // Error is handled in resolver
      }
    }
  }, [order, orderId]);

  if (isLoading) {
    return (
      <div className="min-vh-100 w-100 d-flex justify-content-center align-items-center">
        <Loader className="text-center" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (order?.status === 'PAID') {
    return (
      <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
        <Alert variant="success">
          <Alert.Heading>Order Confirmed</Alert.Heading>
          <p>Your order has been successfully paid. Thank you for your purchase!</p>
        </Alert>
        <OrderSummary order={order} />
        {/* <PostCheckoutUpsellings order={order} /> */}
      </Container>
    );
  }

  return (
    <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
      {/* Show session initialization errors */}
      {sessionInitError.value && (
        <Alert variant="danger" className="mb-24">
          <Alert.Heading>Payment Session Error</Alert.Heading>
          <p>{sessionInitError.value}</p>
        </Alert>
      )}

      {/* Show general errors that aren't session related */}
      {error && !sessionInitError.value && (
        <Alert variant="danger" className="mb-24">{error}</Alert>
      )}

      <PaymentStatus paymentStatus={paymentStatus} error={error} order={order} />

      <Row>
        <Col md={12}>
          <OrderSummary order={order} />

          {/* Check if order is free (100% discount) */}
          {order && parseFloat(order.total) === 0 && order.status === 'PENDING' && (
            <Alert variant="success" className="mb-24">
              <Alert.Heading>No Payment Required</Alert.Heading>
              <p>Your order has a 100% discount applied. No payment is required. Your order will be automatically confirmed.</p>
            </Alert>
          )}

          {/* Show loader when payment session is loading (and no errors) */}
          {order && order.status === 'PENDING' && parseFloat(order.total) > 0 && !paymentStatus && !sessionInitError.value && !paymentSession && (
            <CardLoader message="Initializing payment form..." />
          )}

          {/* Show payment form when everything is ready and no critical errors */}
          {order && parseFloat(order.total) > 0 && providers && paymentSession && !paymentStatus && !sessionInitError.value && (
            <Card>
              <Card.Body>
                <Row>
                  <Col md={4}>
                    <h5 className="mb-24">Payment Information</h5>
                  </Col>
                  <Col md={8} className="text-end">
                    <TestCards providers={providers} />
                  </Col>
                </Row>
                {paymentSession.sessionToken ? (
                  <AccruPay
                    sessionToken={paymentSession.sessionToken}
                    preferredProvider={PAYMENT_PROCESSOR}
                    preReleaseGetProviders={() => providers || []}
                  >
                    <CreditCardForm order={order} />
                  </AccruPay>
                ) : (
                  <Alert variant="warning">
                    <Alert.Heading>Session Error</Alert.Heading>
                    <p>Payment session could not be initialized. Please refresh the page or contact support if the problem persists.</p>
                  </Alert>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default Checkout;
