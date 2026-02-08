import { Card, Alert } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed, $checkout } from '@src/signals';
import ordersAPI from '@src/api/orders.api';
import {
  postCheckoutUpsellings,
  selectedPostCheckoutUpsellings,
  postCheckoutUpsellingCustomFields,
} from '../_helpers/checkout.consts';
import { loadPostCheckoutUpsellings } from '../_helpers/checkout.resolvers';
import { getUpsellingDiscountAmount } from '../_helpers/eventForm.events';
import EmbedUpsellingsList from './EmbedUpsellingsList';
import OrderSummary from './OrderSummary';

/**
 * Step 3: Post-checkout upsellings. Adding/removing items updates the order automatically
 * (same behaviour as Step 2). No "Add to order" button; Pay completes the order.
 */
function Step3UpsellingsPost() {
  const { order, form } = $embed.value;
  const upsellings = postCheckoutUpsellings.value;
  const selected = selectedPostCheckoutUpsellings.value;
  const customFields = postCheckoutUpsellingCustomFields.value;

  useEffectAsync(async () => {
    if (!order?.event_id) return;
    await loadPostCheckoutUpsellings(order.event_id, order, form);
  }, [order?.event_id, order?.id, order?.form_submissions, form]);

  const postUpsellingsKey = JSON.stringify(selected || {});
  const postCustomFieldsKey = JSON.stringify(customFields || {});
  const preUpsellingsKey = JSON.stringify($embed.value.selectedUpsellings || {});
  const preCustomFieldsKey = JSON.stringify($embed.value.upsellingCustomFields || {});

  useEffectAsync(async () => {
    const currentOrder = $embed.value.order;
    if (!currentOrder || currentOrder.status === 'PAID') return;

    const preUpsellings = ($embed.value.upsellings || []).filter((u) => u.upselling_strategy === 'PRE-CHECKOUT');
    const preSelected = $embed.value.selectedUpsellings || {};
    const preCustom = $embed.value.upsellingCustomFields || {};
    const postSelected = selectedPostCheckoutUpsellings.value || {};
    const postCustomFields = postCheckoutUpsellingCustomFields.value || {};
    const postUpsellingsList = postCheckoutUpsellings.value || [];

    const toPerUnitList = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') return [raw];
      return [];
    };

    const buildPreEntry = (upsellingId, quantity) => {
      const upselling = preUpsellings.find((u) => u.id === upsellingId);
      if (!upselling) return [];
      const unitPrice = parseFloat(upselling.amount ?? upselling.price);
      const rawCustom = preCustom[upsellingId] || {};
      const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;
      if (!hasCustomFields) {
        return [{ upselling_id: upsellingId, quantity, unit_price: unitPrice, custom_fields: {} }];
      }
      const perUnitList = toPerUnitList(rawCustom);
      const items = [];
      for (let i = 0; i < quantity; i++) {
        const customFieldValues = perUnitList[i] && typeof perUnitList[i] === 'object' ? perUnitList[i] : {};
        const allFieldsComplete = upselling.custom_fields.every((field) => {
          const v = customFieldValues[field.label];
          return v !== undefined && v !== null && v !== '';
        });
        if (!allFieldsComplete) return [];
        items.push({ upselling_id: upsellingId, quantity: 1, unit_price: unitPrice, custom_fields: customFieldValues });
      }
      return items;
    };

    const buildPostEntry = (upsellingId, quantity) => {
      const upselling = postUpsellingsList.find((u) => u.id === upsellingId);
      if (!upselling) return [];
      const unitPrice = parseFloat(upselling.amount ?? upselling.price);
      const rawCustom = postCustomFields[upsellingId] || {};
      const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;
      if (!hasCustomFields) {
        return [{ upselling_id: upsellingId, quantity, unit_price: unitPrice, custom_fields: {} }];
      }
      const perUnitList = toPerUnitList(rawCustom);
      const items = [];
      for (let i = 0; i < quantity; i++) {
        const customFieldValues = perUnitList[i] && typeof perUnitList[i] === 'object' ? perUnitList[i] : {};
        const allFieldsComplete = upselling.custom_fields.every((field) => {
          const v = customFieldValues[field.label];
          return v !== undefined && v !== null && v !== '';
        });
        if (!allFieldsComplete) return [];
        items.push({ upselling_id: upsellingId, quantity: 1, unit_price: unitPrice, custom_fields: customFieldValues });
      }
      return items;
    };

    const preItems = Object.entries(preSelected)
      .filter(([, qty]) => qty > 0)
      .flatMap(([upsellingId, quantity]) => buildPreEntry(upsellingId, quantity));
    const postItems = Object.entries(postSelected)
      .filter(([, qty]) => qty > 0)
      .flatMap(([upsellingId, quantity]) => buildPostEntry(upsellingId, quantity));

    try {
      $checkout.update({ error: null });
      const combinedItems = [...preItems, ...postItems];
      const upsellingDiscountAmount = getUpsellingDiscountAmount();
      const updatedOrder = await ordersAPI.updatePendingItems(
        currentOrder.id,
        combinedItems,
        upsellingDiscountAmount,
      );
      $embed.update({ order: updatedOrder });
    } catch (err) {
      $checkout.update({ error: err.message || 'Error updating order. Please try again.' });
    }
  }, [order?.id, order?.status, preUpsellingsKey, preCustomFieldsKey, postUpsellingsKey, postCustomFieldsKey]);

  const syncError = $checkout.value?.error;

  if (!order) {
    return null;
  }

  return (
    <div className="mb-24">
      <div className="mb-32">
        <h3 className="mb-4">Don&apos;t forget about this!</h3>
        <p className="text-muted mb-0">
          Add these items to your order before you go
        </p>
      </div>

      {upsellings && upsellings.length > 0 ? (
        <>
          <EmbedUpsellingsList />

          {syncError && (
            <Alert variant="danger" className="mt-24">
              {syncError}
            </Alert>
          )}

          {order && (
            <div className="mt-32 mb-32">
              <OrderSummary order={order} />
            </div>
          )}
        </>
      ) : (
        <>
          <Card className="border-0 mb-24">
            <Card.Body>
              <p className="text-muted mb-0">No additional items available right now.</p>
            </Card.Body>
          </Card>
          {order && (
            <div className="mt-32 mb-32">
              <OrderSummary order={order} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Step3UpsellingsPost;
