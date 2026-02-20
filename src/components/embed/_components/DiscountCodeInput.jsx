import React from 'react';
import { Button, Form } from 'react-bootstrap';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { $embed } from '@src/signals';
import { handleApplyDiscount, updateDiscountCode } from '@src/components/embed/_helpers/eventForm.events';

function DiscountCodeInput({ formId, eventId, className = '' }) {
  const shouldShowDiscountCode = $embed.value.form?.show_discount_code !== false;

  if (!shouldShowDiscountCode) {
    return null;
  }

  return (
    <div className={className}>
      <Form.Label>Discount Code</Form.Label>
      <div className="d-flex gap-2">
        <UniversalInput
          type="text"
          name="discountCode"
          placeholder="Enter code"
          value={$embed.value.discountCode || ''}
          customOnChange={(e) => updateDiscountCode(e.target.value.toUpperCase())}
          className="flex-grow-1"
          style={{ minWidth: 0 }}
        />
        <Button
          variant="dark"
          onClick={() => handleApplyDiscount(formId, eventId)}
          style={{ whiteSpace: 'nowrap' }}
        >
          Apply
        </Button>
      </div>
      {$embed.value.appliedDiscount && (
        <small className="text-success d-block mt-8">
          Discount applied: {$embed.value.appliedDiscount.code}
        </small>
      )}
    </div>
  );
}

export default DiscountCodeInput;
