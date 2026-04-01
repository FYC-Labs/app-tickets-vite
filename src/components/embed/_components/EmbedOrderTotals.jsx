import { $embed } from '@src/signals';
import { Col, Row } from 'react-bootstrap';

const EmbedOrderTotals = ({ theme }) => (
  <Row className="my-24 border-top pt-24">
    <Col>
      {!theme === 'scale-up' && (
        <div>Items</div>
      )}
      {!theme === 'scale-up' && (
        <div>Discount</div>
      )}
      <h6 className="fw-bold mt-8">Order Total</h6>
    </Col>
    <Col className="text-end">
      {!theme === 'scale-up' && (
        <div>${$embed.value.totals.subtotal}</div>
      )}
      {!theme === 'scale-up' && (
        <div>${$embed.value.totals.discount_amount}</div>
      )}
      <h6 className="fw-bold mt-8">${$embed.value.totals.total}</h6>
    </Col>
  </Row>
);

export default EmbedOrderTotals;
