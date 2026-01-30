import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Alert, Container, Button } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { Signal } from '@fyclabs/tools-fyc-react/signals';
import ordersAPI from '@src/api/orders.api';
import Loader from '@src/components/global/Loader';
import * as checkoutResolvers from './_helpers/checkout.resolvers';

const $orderConfirmation = Signal({
  order: null,
  error: null,
});

function OrderConfirmation() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const { order, error } = $orderConfirmation.value;
  const { isLoading } = $orderConfirmation.value;
  const theme = searchParams.get('theme') || 'light';

  useEffectAsync(async () => {
    try {
      $orderConfirmation.loadingStart();
      const orderData = await ordersAPI.getById(orderId);

      if (!orderData) {
        throw new Error('Order not found. Please check your order link.');
      }

      $orderConfirmation.update({ order: orderData, error: null });

      const eventId = orderData.event_id || orderData.events?.id;
      const formData = orderData.form_submissions?.forms || null;
      if (eventId) {
        await checkoutResolvers.loadPostCheckoutUpsellings(eventId, formData);
      }
    } catch (err) {
      let errorMessage = err.message || 'Unable to load order confirmation.';

      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.isTimeout) {
        errorMessage = 'Request timed out. Please refresh the page and try again.';
      } else if (err.status === 404) {
        errorMessage = 'Order not found. Please check your order link.';
      }

      $orderConfirmation.update({
        error: errorMessage,
      });
    } finally {
      $orderConfirmation.update({ isLoading: false });
    }
  }, [orderId]);

  if (isLoading) return <Loader />;

  if (error) {
    return (
      <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
        <Alert variant="danger">
          <Alert.Heading>Unable to Load Order</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
        <Alert variant="warning">
          <Alert.Heading>Order Not Found</Alert.Heading>
          <p>We couldn't find this order. Please check your order link and try again.</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
      <Alert variant="success" className="mb-32">
        <Alert.Heading>
          <i className="fas fa-check-circle me-2" />
          Payment Successful!
        </Alert.Heading>
        <p className="mb-0">
          Your order has been confirmed. A confirmation email has been sent to{' '}
          <strong>{order.customer_email}</strong>.
        </p>
      </Alert>

      <Card className="mb-24">
        <Card.Body>
          <h5 className="mb-24">Order Details</h5>

          <div className="mb-16">
            <small className="text-muted">Order ID</small>
            <div className="font-monospace">{order.id}</div>
          </div>

          <div className="mb-24">
            <small className="text-muted">Event</small>
            <div><strong>{order.events?.title || 'N/A'}</strong></div>
          </div>

          <div className="mb-24">
            <small className="text-muted">Customer</small>
            <div>{order.customer_name || 'Guest'}</div>
            <div className="text-muted">{order.customer_email}</div>
          </div>

          <div className="mb-24">
            <small className="text-muted">Items</small>
            {order.order_items?.map((item, index) => (
              <div key={index} className="d-flex justify-content-between mt-8">
                <span>
                  {item.ticket_types?.name || item.upsellings?.item || item.upsellings?.name || 'Item'} x {item.quantity}
                </span>
                <span>${parseFloat(item.subtotal).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-top pt-16">
            <div className="d-flex justify-content-between mb-8">
              <span>Subtotal:</span>
              <span>${parseFloat(order.subtotal).toFixed(2)}</span>
            </div>

            {order.discount_amount > 0 && (
              <div className="d-flex justify-content-between mb-8 text-success">
                <span>Discount ({order.discount_codes?.code}):</span>
                <span>-${parseFloat(order.discount_amount).toFixed(2)}</span>
              </div>
            )}

            <div className="d-flex justify-content-between pt-8 border-top">
              <strong>Total Paid:</strong>
              <strong className="text-success">
                ${parseFloat(order.total).toFixed(2)}
              </strong>
            </div>
          </div>
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 mb-24">
        <Button
          variant="outline-primary"
          onClick={() => window.print()}
        >
          <i className="fas fa-print me-2" />
          Print Receipt
        </Button>
      </div>

    </Container>
  );
}

export default OrderConfirmation;
