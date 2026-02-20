import { Table, Button, Form } from 'react-bootstrap';
import { format } from 'date-fns';

function FormEditModalDiscountsTab({ discounts }) {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-16">
        <Form.Label className="mb-0">{' '}</Form.Label>
      </div>

      <div>
        <Table responsive size="sm" className="form-edit-inline-table table-bordered mb-0 align-middle">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Max Uses</th>
              <th>Expires</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {discounts.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-4 text-muted small">
                  No discount codes yet.
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
                    aria-label={discount.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <span className={`badge bg-${discount.is_active ? 'success' : 'secondary'}`}>
                      {discount.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default FormEditModalDiscountsTab;
