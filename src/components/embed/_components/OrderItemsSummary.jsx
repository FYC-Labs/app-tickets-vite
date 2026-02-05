import { $embed } from '@src/signals';

function OrderItemsSummary({ order }) {
  if (!order || !order.order_items || order.order_items.length === 0) return null;

  const { tickets = [], upsellings = [] } = $embed.value || {};

  return (
    <div className="mb-16">
      <strong className="small">Items:</strong>
      {order.order_items.map((item, index) => {
        if (item.upsellings) {
          const name = item.upsellings.item ?? item.upsellings.name ?? 'Upselling';
          return (
            <div key={index} className="d-flex justify-content-between mt-8 small">
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
            <div key={index} className="d-flex justify-content-between mt-8 small">
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
            <div key={index} className="d-flex justify-content-between mt-8 small">
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
            <div key={index} className="d-flex justify-content-between mt-8 small">
              <span>
                {name} x {item.quantity}
              </span>
              <span>${parseFloat(item.subtotal).toFixed(2)}</span>
            </div>
          );
        }

        return (
          <div key={index} className="d-flex justify-content-between mt-8 small">
            <span>
              Item x {item.quantity}
            </span>
            <span>${parseFloat(item.subtotal).toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default OrderItemsSummary;
