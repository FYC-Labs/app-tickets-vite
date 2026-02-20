import { Card } from 'react-bootstrap';
import { $embed } from '@src/signals';

function OrderSummary({ order }) {
  if (!order) return null;

  const { tickets = [], upsellings = [] } = $embed.value || {};

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
          <strong>Items:</strong>
          {order.order_items?.map((item, index) => {
            if (item.upsellings) {
              const name = item.upsellings.item ?? item.upsellings.name ?? 'Upselling';
              return (
                <div key={index} className="d-flex justify-content-between mt-8">
                  <span>
                    {name} x {item.quantity}
                  </span>
                  <span>${parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              );
            }

            if (item.ticket_types) {
              const name = item.ticket_types.name ?? 'Ticket';
              return (
                <div key={index} className="d-flex justify-content-between mt-8">
                  <span>
                    {name} x {item.quantity}
                  </span>
                  <span>${parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              );
            }

            if (item.upselling_id) {
              const upselling = upsellings.find((u) => u.id === item.upselling_id);
              const name = upselling?.item ?? upselling?.name ?? 'Upselling';
              return (
                <div key={index} className="d-flex justify-content-between mt-8">
                  <span>
                    {name} x {item.quantity}
                  </span>
                  <span>${parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              );
            }

            if (item.ticket_type_id) {
              const ticket = tickets.find((t) => t.id === item.ticket_type_id);
              const name = ticket?.name ?? 'Ticket';
              return (
                <div key={index} className="d-flex justify-content-between mt-8">
                  <span>
                    {name} x {item.quantity}
                  </span>
                  <span>${parseFloat(item.subtotal).toFixed(2)}</span>
                </div>
              );
            }

            return (
              <div key={index} className="d-flex justify-content-between mt-8">
                <span>
                  Item x {item.quantity}
                </span>
                <span>${parseFloat(item.subtotal).toFixed(2)}</span>
              </div>
            );
          })}
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
