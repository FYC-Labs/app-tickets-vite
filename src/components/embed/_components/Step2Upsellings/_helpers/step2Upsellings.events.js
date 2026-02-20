import { $embed } from '@src/signals';
import ordersAPI from '@src/api/orders.api';
import formsAPI from '@src/api/forms.api';
import {
  handleFreeOrderComplete,
  getUpsellingDiscountAmount,
  goToOrderConfirmation,
  handlePaymentSuccess,
} from '../../../_helpers/eventForm.events';
import * as consts from './step2Upsellings.consts';

export const handleCompleteFreeOrder = async () => {
  try {
    consts.$isCompletingFree.value = true;
    consts.$paymentError.value = null;
    await handleFreeOrderComplete(consts.$confirmationUrlOverride.value);
  } catch (err) {
    consts.$paymentError.value = err.message || 'Unable to complete order. Please try again.';
  } finally {
    consts.$isCompletingFree.value = false;
  }
};

export const handlePaymentSuccessAndRedirect = async (paymentData, onCompletePayment) => {
  await handlePaymentSuccess(paymentData, consts.$confirmationUrlOverride.value, { skipRedirect: true });
  if (onCompletePayment) {
    onCompletePayment();
  } else {
    goToOrderConfirmation(consts.$confirmationUrlOverride.value);
  }
};

export const updateFormSubmission = async (submissionId, formData, schemaKeys) => {
  const patch = {};
  if (formData?.phone_number !== undefined) patch.phone_number = formData.phone_number ?? null;
  if (formData?.preferred_channel !== undefined) patch.preferred_channel = formData.preferred_channel ?? null;
  schemaKeys.forEach((key) => {
    if (formData?.[key] !== undefined) patch[key] = formData[key] ?? null;
  });
  
  if (Object.keys(patch).length === 0) return;
  
  try {
    await formsAPI.updateSubmission(submissionId, patch);
  } catch {
    // Non-blocking
  }
};

export const updateOrderWithUpsellings = async () => {
  const {
    order: currentOrder,
    selectedUpsellings: currentSelectedUpsellings,
    upsellingCustomFields: currentUpsellingCustomFields,
    upsellings: currentUpsellings,
  } = $embed.value;

  if (!currentOrder || currentOrder.status === 'PAID') {
    return;
  }

  try {
    const upsellingEntries = Object.entries(currentSelectedUpsellings || {});

    const upsellingOrderItems = upsellingEntries
      .filter(([, quantity]) => quantity > 0)
      .flatMap(([upsellingId, quantity]) => {
        const upselling = currentUpsellings.find((u) => u.id === upsellingId);
        if (!upselling) {
          return [];
        }

        const unitPrice = parseFloat(upselling.amount ?? upselling.price);
        const rawCustom = (currentUpsellingCustomFields && currentUpsellingCustomFields[upsellingId]) || {};
        const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;

        if (!hasCustomFields) {
          return [
            {
              upselling_id: upsellingId,
              quantity,
              unit_price: unitPrice,
              custom_fields: {},
            },
          ];
        }

        const perUnitList = Array.isArray(rawCustom) ? rawCustom : (rawCustom && typeof rawCustom === 'object' ? [rawCustom] : []);
        const items = [];
        for (let i = 0; i < quantity; i++) {
          const customFieldValues = perUnitList[i] && typeof perUnitList[i] === 'object' ? perUnitList[i] : {};
          const allFieldsComplete = upselling.custom_fields.every(field => {
            const value = customFieldValues[field.label];
            return value !== undefined && value !== null && value !== '';
          });
          if (!allFieldsComplete) {
            return [];
          }
          items.push({
            upselling_id: upsellingId,
            quantity: 1,
            unit_price: unitPrice,
            custom_fields: customFieldValues,
          });
        }
        return items;
      });

    const upsellingDiscountAmount = getUpsellingDiscountAmount();
    const updatedOrder = await ordersAPI.updatePendingItems(
      currentOrder.id,
      upsellingOrderItems,
      upsellingDiscountAmount,
    );
    $embed.update({ order: updatedOrder });
  } catch (err) {
    consts.$paymentError.value = err.message || 'Error updating order with upsellings. Please try again.';
  }
};

export const adjustUpsellingQuantities = () => {
  const { selectedUpsellings: currentSelectedUpsellings, upsellings: currentUpsellings, selectedTickets } = $embed.value;
  const currentTotalTickets = Object.values(selectedTickets || {}).reduce((sum, qty) => sum + (qty || 0), 0);

  let needsUpdate = false;
  const updatedSelectedUpsellings = { ...currentSelectedUpsellings };

  Object.entries(currentSelectedUpsellings || {}).forEach(([upsellingId, quantity]) => {
    if (quantity > 0) {
      const upselling = currentUpsellings.find((u) => u.id === upsellingId);
      if (upselling && upselling.quantity_rule === 'MATCHES_TICKET_COUNT' && quantity > currentTotalTickets) {
        updatedSelectedUpsellings[upsellingId] = currentTotalTickets;
        needsUpdate = true;
      }
    }
  });

  if (needsUpdate) {
    $embed.update({ selectedUpsellings: updatedSelectedUpsellings });
  }
};
