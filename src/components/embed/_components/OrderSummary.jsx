import { Card } from 'react-bootstrap';

function OrderSummary({ order }) {
  console.log('order', order);
  if (!order) return null;

  return (
    <Card className="mb-24">
      <Card.Body>
        <h5 className="mb-24">Order Summary</h5>

        <div className="mb-24">
          <strong>Event:</strong> {order.events?.title || 'N/A'}
        </div>

        <div className="mb-24">
          <strong>Customer:</strong>
          <div>{order.customer_name || 'Guest'}</div>
          <div className="text-muted">{order.customer_email}</div>
        </div>

        <div className="mb-24">
          <strong>Tickets:</strong>
          {order.order_items?.map((item, index) => (
            <div key={index} className="d-flex justify-content-between mt-8">
              <span>
                {item.upsellings ? (item.upsellings?.item ?? item.upsellings?.name) : item.ticket_types?.name || 'Ticket'} x {item.quantity}
              </span>
              <span>${parseFloat(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-top pt-16 mt-16">
          <div className="d-flex justify-content-between mb-8">
            <span>Subtotal:</span>
            <strong>${parseFloat(order.subtotal).toFixed(2)}</strong>
          </div>

          {order.discount_amount > 0 && (
            <div className="d-flex justify-content-between mb-8 text-success">
              <span>Discount ({order.discount_codes?.code}):</span>
              <strong>-${parseFloat(order.discount_amount).toFixed(2)}</strong>
            </div>
          )}

          <div className="d-flex justify-content-between pt-16 border-top">
            <strong>Total:</strong>
            <strong className="text-primary">
              ${parseFloat(order.total).toFixed(2)}
            </strong>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

export default OrderSummary;
