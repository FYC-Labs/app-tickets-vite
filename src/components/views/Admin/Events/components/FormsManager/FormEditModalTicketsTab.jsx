import { Table, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { $formManagerForm, handleTicketSelection } from '../../_helpers/formsManager.events';

function FormEditModalTicketsTab({ tickets }) {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-16">
        <Form.Label className="mb-0">{' '}</Form.Label>
      </div>

      <div>
        <Table responsive size="sm" className="form-edit-inline-table table-bordered mb-0 align-middle">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>Include</th>
              <th style={{ width: '18%' }}>Name</th>
              <th style={{ width: '18%' }}>Description</th>
              <th style={{ width: '18%' }}>Benefits</th>
              <th style={{ width: '10%' }}>Price</th>
              <th style={{ width: '8%' }}>Qty</th>
              <th style={{ width: '11%' }}>Sales Start</th>
              <th style={{ width: '11%' }}>Sales End</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-4 text-muted small">
                  No ticket types yet.
                </td>
              </tr>
            )}
            {tickets.map((ticket) => {
              const selectedIds = ($formManagerForm.value.available_ticket_ids || []).map(String);
              const isSelected = selectedIds.includes(String(ticket.id));

              return (
                <tr key={ticket.id}>
                  <td className="p-8 text-center align-middle">
                    <button
                      type="button"
                      className={`upselling-include-toggle ${isSelected ? 'is-checked' : ''}`}
                      onClick={() => handleTicketSelection(ticket.id)}
                      aria-label="Include ticket in form"
                    >
                      {isSelected && <FontAwesomeIcon icon={faCheck} size="xs" />}
                    </button>
                  </td>
                  <td><strong>{ticket.name}</strong></td>
                  <td className="small text-muted">{ticket.description || '—'}</td>
                  <td className="small text-muted">{ticket.benefits || '—'}</td>
                  <td>${parseFloat(ticket.price).toFixed(2)}</td>
                  <td>{ticket.sold || 0} / {ticket.quantity}</td>
                  <td className="small">{format(new Date(ticket.sales_start), 'MMM d')}</td>
                  <td className="small">{format(new Date(ticket.sales_end), 'MMM d')}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default FormEditModalTicketsTab;
