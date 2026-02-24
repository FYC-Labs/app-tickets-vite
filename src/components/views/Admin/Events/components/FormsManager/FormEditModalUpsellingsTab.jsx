import { Table, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import {
  $formManagerForm,
  handleUpsellingSelection,
} from '../../_helpers/formsManager.events';
import {
  DISCOUNT_TYPES,
  QUANTITY_RULES,
  MANAGE_INVENTORY,
} from '../../_helpers/upsellingsManager.events';

function FormEditModalUpsellingsTab({ upsellings }) {
  const strategyLabel = (v) => (v === 'POST-CHECKOUT' ? 'Post-checkout' : 'Pre-checkout');

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-16">
        <Form.Label className="mb-0">{' '}</Form.Label>
      </div>

      <div>
        <Table responsive size="sm" className="form-edit-inline-table table-bordered mb-0 align-middle">
          <thead>
            <tr>
              <th style={{ width: '2%' }}>Include</th>
              <th style={{ width: '14%' }}>Item</th>
              <th style={{ width: '10%' }}>Strategy</th>
              <th style={{ width: '14%' }}>Discount Type</th>
              <th style={{ width: '6%' }}>Discount</th>
              <th style={{ width: '6%' }}>Amount</th>
              <th style={{ width: '10%' }}>Quantity Rule</th>
              <th style={{ width: '6%' }}>Manage Inventory</th>
              <th style={{ width: '6%' }}>Quantity</th>
              <th style={{ width: '10%' }}>Sales Start</th>
              <th style={{ width: '10%' }}>Sales Ends</th>
            </tr>
          </thead>
          <tbody>
            {upsellings.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-4 text-muted small">
                  No upsellings yet. Click &quot;Add Upselling&quot; to create one.
                </td>
              </tr>
            )}
            {upsellings.map((upselling) => {
              const itemName = upselling.item ?? upselling.name;
              const amount = upselling.amount ?? upselling.price;
              const discountVal = upselling.discount ?? upselling.discount_value;
              const selectedIds = ($formManagerForm.value.available_upselling_ids || []).map(String);
              const isSelected = selectedIds.includes(String(upselling.id));

              return (
                <tr key={upselling.id}>
                  <td className="p-8 text-center align-middle">
                    <button
                      type="button"
                      className={`upselling-include-toggle ${isSelected ? 'is-checked' : ''}`}
                      onClick={() => handleUpsellingSelection(upselling.id)}
                      aria-label="Include upselling in form"
                    >
                      {isSelected && <FontAwesomeIcon icon={faCheck} size="xs" />}
                    </button>
                  </td>
                  <td><strong>{itemName}</strong></td>
                  <td className="small">{strategyLabel(upselling.upselling_strategy)}</td>
                  <td className="small">
                    {DISCOUNT_TYPES[upselling.discount_type] || DISCOUNT_TYPES.NO_DISCOUNT}
                  </td>
                  <td className="small">
                    {(() => {
                      if (upselling.discount_type === 'PERCENT' && discountVal != null) {
                        return `${discountVal}%`;
                      }
                      if (upselling.discount_type === 'FIXED' && discountVal != null) {
                        return `$${parseFloat(discountVal).toFixed(2)}`;
                      }
                      return '—';
                    })()}
                  </td>
                  <td>${parseFloat(amount).toFixed(2)}</td>
                  <td className="small">
                    {QUANTITY_RULES[upselling.quantity_rule] || QUANTITY_RULES.ONLY_ONE}
                  </td>
                  <td className="small">
                    {MANAGE_INVENTORY[upselling.manage_inventory] || MANAGE_INVENTORY.NO}
                  </td>
                  <td>{upselling.sold || 0} / {upselling.quantity}</td>
                  <td className="small">{format(new Date(upselling.sales_start), 'MMM d')}</td>
                  <td className="small">{format(new Date(upselling.sales_end), 'MMM d')}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default FormEditModalUpsellingsTab;
