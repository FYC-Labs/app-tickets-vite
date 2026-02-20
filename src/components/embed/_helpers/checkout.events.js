/* eslint-disable no-nested-ternary */
import { $checkout } from '@src/signals';
import paymentsAPI from '@src/api/payments.api';
import { isProcessingPayment, showTestCards, selectedPostCheckoutUpsellings, postCheckoutUpsellingCustomFields, isAddingUpsellings, postCheckoutUpsellings, paymentSubmitBtnRef } from './checkout.consts';

// Build URL with order details as query parameters
const buildConfirmationUrl = (baseUrl, order) => {
  // Handle relative URLs and ensure absolute URL for URL constructor
  let absoluteUrl = baseUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    // If it's a relative URL, prepend current origin
    absoluteUrl = `${window.location.origin}${baseUrl.startsWith('/') ? '' : '/'}${baseUrl}`;
  }

  const url = new URL(absoluteUrl);

  // Add all order details as query parameters
  url.searchParams.set('orderId', order.id);
  url.searchParams.set('customerEmail', order.customer_email || '');
  url.searchParams.set('customerName', order.customer_name || '');
  url.searchParams.set('total', order.total?.toString() || '0');
  url.searchParams.set('subtotal', order.subtotal?.toString() || '0');
  url.searchParams.set('discountAmount', order.discount_amount?.toString() || '0');
  url.searchParams.set('status', order.status || '');
  url.searchParams.set('eventTitle', order.events?.title || '');
  url.searchParams.set('discountCode', order.discount_codes?.code || '');
  url.searchParams.set('createdAt', order.created_at || '');
  url.searchParams.set('paymentIntentId', order.payment_intent_id || '');

  // Serialize order items as JSON string
  if (order.order_items && order.order_items.length > 0) {
    const itemsData = order.order_items.map(item => ({
      ticketTypeName: item.ticket_types?.name || '',
      quantity: item.quantity,
      unitPrice: item.unit_price?.toString() || '0',
      subtotal: item.subtotal?.toString() || '0',
    }));
    url.searchParams.set('orderItems', JSON.stringify(itemsData));
  }

  return url.toString();
};

export const handlePaymentSuccess = async (paymentData) => {
  try {
    isProcessingPayment.value = true;
    $checkout.update({ error: null });

    const { order, form, confirmationUrlOverride, isEmbedded } = $checkout.value;

    // Confirm payment with backend - this must succeed before we redirect
    await paymentsAPI.confirmPayment(order.id, paymentData);

    // Only proceed with redirect logic if confirmPayment succeeded
    let redirectUrl;

    const hasConfirmationUrlOverride = confirmationUrlOverride &&
      typeof confirmationUrlOverride === 'string' &&
      confirmationUrlOverride.trim() !== '';

    const hasFormUrl = form?.order_confirmation_url &&
      typeof form.order_confirmation_url === 'string' &&
      form.order_confirmation_url.trim() !== '';

    if (hasConfirmationUrlOverride) {
      redirectUrl = buildConfirmationUrl(confirmationUrlOverride, order);
    } else if (hasFormUrl) {
      redirectUrl = buildConfirmationUrl(form.order_confirmation_url, order);
    } else {
      redirectUrl = `/embed/order-confirmation/${order.id}`;
    }

    // Prepare order details for the event
    const orderDetails = {
      orderId: order.id,
      customerEmail: order.customer_email || '',
      customerName: order.customer_name || '',
      total: order.total?.toString() || '0',
      subtotal: order.subtotal?.toString() || '0',
      discountAmount: order.discount_amount?.toString() || '0',
      status: order.status || '',
      eventTitle: order.events?.title || '',
      discountCode: order.discount_codes?.code || '',
      createdAt: order.created_at || '',
      paymentIntentId: order.payment_intent_id || '',
      orderItems: order.order_items?.map(item => ({
        ticketTypeName: item.ticket_types?.name || '',
        quantity: item.quantity,
        unitPrice: item.unit_price?.toString() || '0',
        subtotal: item.subtotal?.toString() || '0',
      })) || [],
    };

    const isInIframe = window.parent && window.parent !== window;

    if (isInIframe) {
      window.parent.postMessage({
        type: 'order-complete',
        redirectUrl,
        orderDetails,
        order, // Include full order object for convenience
      }, '*'); // In production, you might want to specify the origin
    }

    $checkout.update({
      paymentStatus: 'completed',
    });

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, isEmbedded ? 1000 : 2000);
  } catch (err) {
    // Payment confirmation failed - show clear error message
    const errorMessage = err.message || 'Payment confirmation failed. Please contact support if you were charged.';
    $checkout.update({
      error: errorMessage,
      paymentStatus: 'failed',
    });
    isProcessingPayment.value = false;
  } finally {
    // Only reset processing state if not embedded and not in completed status
    if (!$checkout.value.isEmbedded && $checkout.value.paymentStatus !== 'completed') {
      isProcessingPayment.value = false;
    }
  }
};

export const handlePaymentError = (error) => {
  $checkout.update({
    error: error.message || 'Payment processing failed. Please try again.',
    paymentStatus: 'failed',
  });
  isProcessingPayment.value = false;
};

export const handlePaymentCancel = () => {
  $checkout.update({
    paymentStatus: 'cancelled',
  });
  isProcessingPayment.value = false;
};

export const toggleTestCards = () => {
  showTestCards.value = !showTestCards.value;
};

const getPerUnitCustomFields = (current, upsellingId, newLength) => {
  const existing = current[upsellingId];
  const isArray = Array.isArray(existing);
  const list = isArray ? [...existing] : existing && typeof existing === 'object' ? [{ ...existing }] : [];
  const result = [];
  for (let i = 0; i < newLength; i++) {
    result.push(i < list.length && list[i] && typeof list[i] === 'object' ? { ...list[i] } : {});
  }
  return result;
};

export const handlePostCheckoutUpsellingChange = (upsellingId, quantity) => {
  const selected = { ...selectedPostCheckoutUpsellings.value };
  const customFields = { ...postCheckoutUpsellingCustomFields.value };
  const qty = parseInt(quantity, 10) || 0;
  if (qty > 0) {
    selected[upsellingId] = qty;
    // Adjust custom fields array to match new quantity
    customFields[upsellingId] = getPerUnitCustomFields(customFields, upsellingId, qty);
  } else {
    delete selected[upsellingId];
    delete customFields[upsellingId];
  }
  selectedPostCheckoutUpsellings.value = selected;
  postCheckoutUpsellingCustomFields.value = customFields;
};

/** unitIndex: 0-based index of the selected unit (e.g. shirt 1, shirt 2) */
export const handlePostCheckoutUpsellingCustomFieldChange = (upsellingId, unitIndex, fieldLabel, value) => {
  const customFields = { ...postCheckoutUpsellingCustomFields.value };
  const existing = customFields[upsellingId];
  // Convert to array format: [{ field1: value1 }, { field1: value2 }] per unit
  const list = Array.isArray(existing) ? [...existing] : existing && typeof existing === 'object' ? [{ ...existing }] : [];
  // Ensure array is long enough for the unitIndex
  while (list.length <= unitIndex) list.push({});
  // Update the specific unit's custom fields
  list[unitIndex] = { ...list[unitIndex], [fieldLabel]: value };
  customFields[upsellingId] = list;
  postCheckoutUpsellingCustomFields.value = customFields;
};

export const handleAddUpsellingsToOrder = async (orderId) => {
  try {
    isAddingUpsellings.value = true;
    $checkout.update({ error: null });

    const selected = selectedPostCheckoutUpsellings.value;
    const upsellings = postCheckoutUpsellings.value;
    const customFields = postCheckoutUpsellingCustomFields.value;

    const items = Object.entries(selected)
      .filter(([, quantity]) => quantity > 0)
      .map(([upsellingId, quantity]) => {
        const upselling = upsellings.find((u) => u.id === upsellingId);
        if (!upselling) {
          throw new Error(`Upselling ${upsellingId} not found`);
        }
        const customFieldValues = customFields[upsellingId] || {};
        return {
          upselling_id: upsellingId,
          quantity,
          unit_price: parseFloat(upselling.amount ?? upselling.price),
          custom_fields: customFieldValues,
        };
      });

    if (items.length === 0) {
      throw new Error('Please select at least one item to add');
    }

    // Charge upsellings using stored payment method and append items to order
    const updatedOrder = await paymentsAPI.chargeUpsellings(orderId, items);

    $checkout.update({ order: updatedOrder });

    selectedPostCheckoutUpsellings.value = {};
    postCheckoutUpsellingCustomFields.value = {};

    return updatedOrder;
  } catch (err) {
    const errorMessage = err.message || 'Failed to add items to order. Please try again.';
    $checkout.update({ error: errorMessage });
    throw err;
  } finally {
    isAddingUpsellings.value = false;
  }
};
