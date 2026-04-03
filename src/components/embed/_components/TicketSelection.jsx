import React, { useEffect, useRef } from 'react';
import { Form, Row, Col, Badge } from 'react-bootstrap';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { handleTicketChange, handleScaleUpTicketChange } from '@src/components/embed/_helpers/eventForm.events';

export default function TicketSelection() {
  const { form, tickets, selectedTickets } = $embed.value;
  const hasAutoSelectedRef = useRef(false);

  useEffect(() => {
    if (!tickets || tickets.length === 0) return;
    if (!$embed.value.form?.solo_ticket) return;
    if (hasAutoSelectedRef.current) return;

    const hasSelection = Object.values(selectedTickets || {}).some((qty) => Number(qty) > 0);
    if (hasSelection) {
      hasAutoSelectedRef.current = true;
      return;
    }

    const firstAvailableTicket = tickets.find((ticket) => (ticket.quantity - (ticket.sold || 0)) > 0);
    if (firstAvailableTicket) {
      hasAutoSelectedRef.current = true;
      handleScaleUpTicketChange(firstAvailableTicket.id, 1, { skipOrderSync: true });
    }
  }, [tickets, selectedTickets]);

  if (!tickets || tickets.length === 0) {
    return null;
  }

  return (
    <div className="p-16">
      {tickets.map((ticket, index) => {
        const available = ticket.quantity - (ticket.sold || 0);
        const selectedQty = selectedTickets[ticket.id] || 0;
        const isSelected = selectedQty > 0;
        const showAvailability = form?.show_tickets_remaining !== false;
        const showSoldOutBadge = form?.show_tickets_remaining === false && available === 0;
        return (
          <Row className={`align-items-center mb-16 ${isSelected ? 'selected' : ''} ${available === 0 ? 'sold-out' : ''}`} key={ticket.id} style={{ animationDelay: `${index * 0.1}s` }}>
            <Col md={showAvailability || showSoldOutBadge ? 6 : 9}>
              <div className="d-flex align-items-start">
                <div className="flex-grow-1">
                  <h6 className="mb-8">{ticket.name}</h6>
                  {ticket.description && (
                    <p className="text-muted small mb-8">{ticket.description}</p>
                  )}
                  {ticket.benefits && (
                    <div className="mb-8">
                      <span className="benefits-text">{ticket.benefits}</span>
                    </div>
                  )}
                  <div className="fw-bold" style={{ fontSize: '1rem' }}>
                    <span className="price-currency">$</span>
                    <span className="price-amount">{parseFloat(ticket.price).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </Col>
            {showAvailability && (
              <Col md={3} className="text-center">
                {available > 0 ? (
                  <Badge bg="primary">
                    {available} available
                  </Badge>
                ) : (
                  <Badge bg="danger">Sold out</Badge>
                )}
              </Col>
            )}
            {showSoldOutBadge && (
              <Col md={3} className="text-center">
                <Badge bg="danger">Sold out</Badge>
              </Col>
            )}
            <Col md={3}>
              <Form.Label className="small fw-semibold mb-8">Quantity</Form.Label>
              <UniversalInput
                as="select"
                name={`ticket_${ticket.id}`}
                value={selectedQty}
                customOnChange={e => {
                  if ($embed.value.form?.solo_ticket) {
                    handleScaleUpTicketChange(ticket.id, Number(e.target.value));
                    return;
                  }
                  handleTicketChange(ticket.id, Number(e.target.value));
                }}
                disabled={available === 0 || $embed.value.form?.solo_ticket}
              >
                {($embed.value.form?.solo_ticket ? [0, 1].filter((n) => n <= available) : [...Array(available + 1).keys()]).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </UniversalInput>
            </Col>
          </Row>
        );
      })}
    </div>
  );
}
