import { useState } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faTrash, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import ExpandableTextCell from './ExpandableTextCell';
import {
  $formManagerForm,
  handleTicketSelection,
} from '../../_helpers/formsManager.events';
import {
  $ticketForm,
  $ticketUI,
  loadTicketFormForInline,
  handleSubmit,
  handleDelete,
  addCustomField,
  updateCustomField,
  removeCustomField,
} from '../../_helpers/ticketsManager.events';

function FormEditModalTicketsTab({ tickets, eventId, onUpdate }) {
  const [editorOpen, setEditorOpen] = useState(false);
  // const { editingTicket } = $ticketUI.value;
  const formData = $ticketForm.value;

  const openEditor = (ticket = null) => {
    loadTicketFormForInline(ticket);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    $ticketForm.reset();
    $ticketUI.update({ editingTicket: null });
  };

  const onFormSubmit = async (e) => {
    e?.preventDefault?.();
    await handleSubmit(e, eventId, onUpdate);
    setEditorOpen(false);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-16">
        <Form.Label className="mb-0">{' '}</Form.Label>
        <Button size="sm" variant="primary" onClick={() => openEditor()}>
          <FontAwesomeIcon icon={faPlus} className="me-2" />
          Add Ticket
        </Button>
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
              <th style={{ width: '10%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {editorOpen && (
              <>
                <tr className="inline-edit-row">
                  <td className="p-8 text-center align-middle">
                    {$ticketUI.value.editingTicket && (
                      <button
                        type="button"
                        className={
                          `upselling-include-toggle ${
                            ($formManagerForm.value.available_ticket_ids || [])
                              .map(String)
                              .includes(String($ticketUI.value.editingTicket.id))
                              ? 'is-checked'
                              : ''
                          }`
                        }
                        onClick={() => handleTicketSelection($ticketUI.value.editingTicket.id)}
                        aria-label="Include ticket in form"
                      >
                        {($formManagerForm.value.available_ticket_ids || [])
                          .map(String)
                          .includes(String($ticketUI.value.editingTicket.id)) && (
                          <FontAwesomeIcon icon={faCheck} size="xs" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="text"
                      name="name"
                      signal={$ticketForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Name"
                    />
                  </td>
                  <td className="p-8">
                    <ExpandableTextCell
                      value={formData.description}
                      onApply={(v) => $ticketForm.update({ description: v })}
                      label="Description"
                    />
                  </td>
                  <td className="p-8">
                    <ExpandableTextCell
                      value={formData.benefits}
                      onApply={(v) => $ticketForm.update({ benefits: v })}
                      label="Benefits"
                      placeholder="Early entry, reserved seating…"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="number"
                      step="0.01"
                      min="0"
                      name="price"
                      signal={$ticketForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Price"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="number"
                      min="1"
                      name="quantity"
                      signal={$ticketForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Quantity"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="datetime-local"
                      name="sales_start"
                      signal={$ticketForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Sales Start"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="datetime-local"
                      name="sales_end"
                      signal={$ticketForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Sales End"
                    />
                  </td>
                  <td className="p-8">
                    <div className="form-edit-inline-actions d-flex gap-1">
                      <Button size="sm" variant="outline-secondary" type="button" onClick={closeEditor} aria-label="Cancel">
                        <FontAwesomeIcon icon={faTimes} />
                      </Button>
                      <Button size="sm" variant="primary" type="button" onClick={onFormSubmit} aria-label="Save">
                        <FontAwesomeIcon icon={faCheck} />
                      </Button>
                    </div>
                  </td>
                </tr>
                {formData.custom_fields?.length > 0 && (
                  <tr className="inline-edit-custom-fields-row">
                    <td colSpan={9} className="p-8">
                      <div className="form-edit-custom-fields-label small mb-8">Custom Fields</div>
                      <Table size="sm" className="mb-0 table-bordered">
                        <tbody>
                          {formData.custom_fields.map((field, idx) => (
                            <tr key={idx}>
                              <td className="p-4" style={{ width: '18%' }}>
                                <UniversalInput
                                  type="text"
                                  name={`custom_field_label_${idx}`}
                                  value={field.label}
                                  customOnChange={(e) => updateCustomField(idx, { label: e.target.value })}
                                  placeholder="Label"
                                  className="form-control form-control-sm"
                                  aria-label="Field label"
                                />
                              </td>
                              <td className="p-4" style={{ width: '12%' }}>
                                <UniversalInput
                                  as="select"
                                  name={`custom_field_type_${idx}`}
                                  value={field.type}
                                  customOnChange={(e) => updateCustomField(idx, { type: e.target.value })}
                                  className="form-control form-control-sm"
                                  aria-label="Field type"
                                >
                                  <option value="text">Text</option>
                                  <option value="email">Email</option>
                                  <option value="number">Number</option>
                                  <option value="textarea">Textarea</option>
                                  <option value="select">Select</option>
                                  <option value="checkbox">Checkbox</option>
                                  <option value="radio">Radio</option>
                                </UniversalInput>
                              </td>
                              <td className="p-4" style={{ width: '15%' }}>
                                <UniversalInput
                                  type="text"
                                  name={`custom_field_placeholder_${idx}`}
                                  value={field.placeholder || ''}
                                  customOnChange={(e) => updateCustomField(idx, { placeholder: e.target.value })}
                                  placeholder="Placeholder"
                                  className="form-control form-control-sm"
                                  aria-label="Placeholder"
                                />
                              </td>
                              <td className="p-4 align-middle" style={{ width: '8%' }}>
                                <UniversalInput
                                  type="checkbox"
                                  name={`custom_field_required_${idx}`}
                                  label="Required"
                                  checked={!!field.required}
                                  customOnChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                                />
                              </td>
                              {(field.type === 'select' || field.type === 'radio') && (
                                <td className="p-4" style={{ width: '20%' }}>
                                  <UniversalInput
                                    type="text"
                                    name={`custom_field_options_${idx}`}
                                    value={(field.options || []).join(', ')}
                                    customOnChange={(e) => updateCustomField(idx, { value: e.target.value })}
                                    placeholder="Options (comma)"
                                    className="form-control form-control-sm"
                                    aria-label="Options"
                                  />
                                </td>
                              )}
                              <td className="p-4 align-middle">
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  type="button"
                                  onClick={() => removeCustomField(idx)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      <Button size="sm" variant="outline-primary" type="button" onClick={addCustomField} className="mt-8">
                        + Add Custom Field
                      </Button>
                    </td>
                  </tr>
                )}
                {(!formData.custom_fields || formData.custom_fields.length === 0) && (
                  <tr className="inline-edit-custom-fields-row">
                    <td colSpan={9} className="p-8">
                      <Button size="sm" variant="outline-primary" type="button" onClick={addCustomField}>
                        + Add Custom Field
                      </Button>
                    </td>
                  </tr>
                )}
              </>
            )}
            {tickets.length === 0 && !editorOpen && (
              <tr>
                <td colSpan={9} className="text-center py-4 text-muted small">
                  No ticket types yet. Click &quot;Add Ticket&quot; to create one.
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
                  <td>
                    <div className="form-edit-inline-actions d-flex gap-1">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        type="button"
                        onClick={() => openEditor(ticket)}
                        aria-label="Edit"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        type="button"
                        onClick={() => handleDelete(ticket.id, onUpdate)}
                        aria-label="Delete"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </div>
                  </td>
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
