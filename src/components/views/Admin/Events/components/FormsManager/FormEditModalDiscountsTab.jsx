import { useState } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faTrash, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import {
  $discountForm,
  $discountUI,
  loadDiscountFormForInline,
  handleSubmit,
  handleDelete,
  handleToggleActive,
} from '../../_helpers/discountsManager.events';

function FormEditModalDiscountsTab({ discounts = [], eventId, onUpdate }) {
  const [editorOpen, setEditorOpen] = useState(false);

  const openEditor = (discount = null) => {
    loadDiscountFormForInline(discount);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    $discountForm.reset();
    $discountUI.update({ editingDiscount: null });
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    await handleSubmit(e, eventId, onUpdate);
    setEditorOpen(false);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-16">
        <Form.Label className="mb-0">{' '}</Form.Label>
        <Button size="sm" variant="primary" onClick={() => openEditor()}>
          <FontAwesomeIcon icon={faPlus} className="me-2" />
          Add Discount
        </Button>
      </div>

      <Form onSubmit={onFormSubmit}>
        <Table responsive size="sm" className="form-edit-inline-table table-bordered mb-0 align-middle">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Max Uses</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {editorOpen && (
              <tr className="inline-edit-row">
                <td className="p-8">
                  <UniversalInput
                    type="text"
                    name="code"
                    signal={$discountForm}
                    required
                    className="form-control form-control-sm text-uppercase"
                    aria-label="Code"
                  />
                </td>
                <td className="p-8">
                  <UniversalInput
                    as="select"
                    name="type"
                    signal={$discountForm}
                    required
                    className="form-control form-control-sm"
                    aria-label="Type"
                  >
                    <option value="PERCENT">Percent</option>
                    <option value="AMOUNT">Amount</option>
                  </UniversalInput>
                </td>
                <td className="p-8">
                  <UniversalInput
                    type="number"
                    step="0.01"
                    min="0"
                    name="value"
                    signal={$discountForm}
                    required
                    className="form-control form-control-sm"
                    aria-label="Value"
                  />
                </td>
                <td className="p-8">
                  <UniversalInput
                    type="number"
                    min="1"
                    name="max_uses"
                    signal={$discountForm}
                    placeholder="∞"
                    className="form-control form-control-sm"
                    aria-label="Max Uses"
                  />
                </td>
                <td className="p-8">
                  <UniversalInput
                    type="datetime-local"
                    name="expires_at"
                    signal={$discountForm}
                    className="form-control form-control-sm"
                    aria-label="Expires"
                  />
                </td>
                <td className="p-8 align-middle">
                  <UniversalInput
                    type="checkbox"
                    name="is_active"
                    signal={$discountForm}
                    label="Active"
                  />
                </td>
                <td className="p-8">
                  <div className="form-edit-inline-actions d-flex gap-1">
                    <Button size="sm" variant="outline-secondary" type="button" onClick={closeEditor} aria-label="Cancel">
                      <FontAwesomeIcon icon={faTimes} />
                    </Button>
                    <Button size="sm" variant="primary" type="submit" aria-label="Save">
                      <FontAwesomeIcon icon={faCheck} />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
            {discounts.length === 0 && !editorOpen && (
              <tr>
                <td colSpan={7} className="text-center py-4 text-muted small">
                  No discount codes yet. Click &quot;Add Discount&quot; to create one.
                </td>
              </tr>
            )}
            {discounts.map((discount) => (
              <tr key={discount.id}>
                <td><strong>{discount.code}</strong></td>
                <td className="small">{discount.type === 'PERCENT' ? 'Percent' : 'Amount'}</td>
                <td>
                  {discount.type === 'PERCENT' ? `${discount.value}%` : `$${parseFloat(discount.value).toFixed(2)}`}
                </td>
                <td>
                  {discount.max_uses != null ? `${discount.used_count || 0} / ${discount.max_uses}` : `${discount.used_count || 0} / ∞`}
                </td>
                <td className="small">
                  {discount.expires_at ? format(new Date(discount.expires_at), 'MMM d, yyyy') : '—'}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="link"
                    className="p-0 text-decoration-none"
                    onClick={() => handleToggleActive(discount, eventId).then(() => onUpdate?.())}
                    aria-label={discount.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <span className={`badge bg-${discount.is_active ? 'success' : 'secondary'}`}>
                      {discount.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </Button>
                </td>
                <td>
                  <div className="form-edit-inline-actions d-flex gap-1">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      type="button"
                      onClick={() => openEditor(discount)}
                      aria-label="Edit"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      type="button"
                      onClick={() => handleDelete(discount.id, eventId).then(() => onUpdate?.())}
                      aria-label="Delete"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Form>
    </div>
  );
}

export default FormEditModalDiscountsTab;
