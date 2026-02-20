import { $embed } from '@src/signals';
import { Col, Row } from 'react-bootstrap';

const EmbedOrderTotals = () => (
  <Row className="my-24 border-top pt-24">
    <Col>
      <div>Items</div>
      <div>Discount</div>
      <h6 className="fw-bold mt-8">Order Total</h6>
    </Col>
    <Col className="text-end">
      <div>${$embed.value.totals.subtotal}</div>
      <div>${$embed.value.totals.discount_amount}</div>
      <h6 className="fw-bold mt-8">${$embed.value.totals.total}</h6>
    </Col>
  </Row>
);

export default EmbedOrderTotals;
