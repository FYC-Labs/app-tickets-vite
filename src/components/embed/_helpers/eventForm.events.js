/* eslint-disable no-restricted-syntax, no-nested-ternary */
import { $embed } from '@src/signals';
import formsAPI from '@src/api/forms.api';
import ticketsAPI from '@src/api/tickets.api';
import ordersAPI from '@src/api/orders.api';
import discountsAPI from '@src/api/discounts.api';
import upsellingsAPI from '@src/api/upsellings.api';
import paymentsAPI from '@src/api/payments.api';
import { initializePaymentSession, fetchPaymentSession } from '@src/components/embed/_helpers/checkout.resolvers';
import { paymentSubmitBtnRef } from '@src/components/embed/_helpers/checkout.consts';

export const loadFormData = async (formId, eventId) => {
  try {
    $embed.loadingStart();
    $embed.update({ error: null, currentStep: 'initial' });

    if (formId) {
      // Fetch providers and form data in parallel
      const [providers, formData] = await Promise.all([
        paymentsAPI.getProviders(),
        formsAPI.getById(formId),
      ]);
      $embed.update({ providers, form: formData });

      if (formData.event_id) {
        // Fetch tickets and upsellings in parallel
        const [ticketsData, upsellingsData] = await Promise.all([
          ticketsAPI.getByEventId(formData.event_id),
          upsellingsAPI.getByEventId(formData.event_id),
        ]);

        const now = new Date();

        let filtered = ticketsData || [];

        if (formData.available_ticket_ids && formData.available_ticket_ids.length > 0) {
          filtered = filtered.filter((t) => formData.available_ticket_ids.includes(t.id));
        }

        filtered = filtered.filter((t) => {
          const start = new Date(t.sales_start);
          const end = new Date(t.sales_end);
          const available = (t.quantity || 0) - (t.sold || 0);
          return start <= now && now <= end && available > 0;
        });

        let filteredUpsellings = upsellingsData.filter((u) => formData.available_upselling_ids.includes(u.id));

        filteredUpsellings = filteredUpsellings.filter((u) => {
          const start = new Date(u.sales_start);
          const end = new Date(u.sales_end);
          const available = (u.quantity || 0) - (u.sold || 0);
          return start <= now && now <= end && available > 0;
        });

        $embed.update({ tickets: filtered, upsellings: filteredUpsellings });
      }
    } else if (eventId) {
      // Fetch providers and tickets in parallel
      const [providers, ticketsData] = await Promise.all([
        paymentsAPI.getProviders(),
        ticketsAPI.getByEventId(eventId),
      ]);
      $embed.update({ providers });

      const now = new Date();
      const filtered = (ticketsData || []).filter((t) => {
        const start = new Date(t.sales_start);
        const end = new Date(t.sales_end);
        const available = (t.quantity || 0) - (t.sold || 0);
        return start <= now && now <= end && available > 0;
      });
      $embed.update({ tickets: filtered });
    } else {
      // If neither formId nor eventId, still fetch providers
      const providers = await paymentsAPI.getProviders();
      $embed.update({ providers });
    }
  } catch (err) {
    $embed.update({ error: 'Error loading form' });
  } finally {
    $embed.loadingEnd();
    checkFormValidity();
  }
};

export const getUpsellingDiscountAmount = () => {
  const { selectedTickets, selectedUpsellings, tickets, upsellings, appliedDiscount } = $embed.value;

  // When a discount code is applied to tickets, do not apply upselling discount rules
  if (appliedDiscount) {
    return 0;
  }

  let ticketsSubtotal = 0;
  let totalTickets = 0;
  Object.entries(selectedTickets || {}).forEach(([ticketId, quantity]) => {
    const q = parseInt(quantity, 10) || 0;
    if (q > 0) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        ticketsSubtotal += parseFloat(ticket.price) * q;
        totalTickets += q;
      }
    }
  });

  let upsellingDiscountAmount = 0;
  Object.entries(selectedUpsellings || {}).forEach(([upsellingId, quantity]) => {
    const qty = parseInt(quantity, 10) || 0;
    if (qty > 0) {
      const upselling = upsellings.find((u) => u.id === upsellingId);
      if (upselling) {
        const discountType = upselling.discount_type?.toLowerCase();
        const discountValue = upselling.discount;
        const quantityRule = upselling.quantity_rule || 'USER_CAN_CHANGE';

        if (discountValue != null && !isNaN(parseFloat(discountValue))) {
          const discountAmount = parseFloat(discountValue);
          const isUserCanChange = quantityRule === 'USER_CAN_CHANGE';

          if (discountType === 'percent' && discountAmount > 0 && ticketsSubtotal > 0) {
            if (isUserCanChange) {
              const applications = totalTickets > 0 ? Math.min(totalTickets, qty) : 0;
              const discountPerTicket = totalTickets > 0 ? (ticketsSubtotal / totalTickets) * (discountAmount / 100) : 0;
              upsellingDiscountAmount += applications * discountPerTicket;
            } else {
              const baseDiscount = (ticketsSubtotal * discountAmount) / 100;
              upsellingDiscountAmount += baseDiscount;
            }
          } else if (discountType === 'fixed' && discountAmount > 0) {
            if (isUserCanChange) {
              const applications = totalTickets > 0 ? Math.min(totalTickets, qty) : 0;
              upsellingDiscountAmount += applications * discountAmount;
            } else {
              upsellingDiscountAmount += discountAmount;
            }
          }
        }
      }
    }
  });

  return parseFloat(upsellingDiscountAmount.toFixed(2));
};

export const calculateTotals = () => {
  const { selectedTickets, selectedUpsellings, appliedDiscount, tickets, upsellings } = $embed.value;

  let ticketsSubtotal = 0;
  Object.entries(selectedTickets).forEach(([ticketId, quantity]) => {
    if (quantity > 0) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        ticketsSubtotal += parseFloat(ticket.price) * quantity;
      }
    }
  });

  let upsellingsSubtotal = 0;
  Object.entries(selectedUpsellings).forEach(([upsellingId, quantity]) => {
    if (quantity > 0) {
      const upselling = upsellings.find((u) => u.id === upsellingId);
      if (upselling) {
        upsellingsSubtotal += parseFloat(upselling.amount ?? upselling.price) * quantity;
      }
    }
  });

  const upsellingDiscountAmount = getUpsellingDiscountAmount();

  const totalSubtotal = ticketsSubtotal + upsellingsSubtotal;
  // Discount code applies only to tickets, not to upsellings
  let discountCodeAmount = 0;
  if (appliedDiscount && ticketsSubtotal > 0) {
    if (appliedDiscount.type === 'PERCENT') {
      discountCodeAmount = (ticketsSubtotal * parseFloat(appliedDiscount.value)) / 100;
    } else {
      const fixedDiscount = parseFloat(appliedDiscount.value);
      discountCodeAmount = Math.min(fixedDiscount, ticketsSubtotal);
    }
  }

  const totalDiscountAmount = upsellingDiscountAmount + discountCodeAmount;
  const total = Math.max(0, totalSubtotal - totalDiscountAmount);

  $embed.update({
    totals: {
      ticketsSubtotal,
      subtotal: parseFloat(totalSubtotal.toFixed(2)),
      discount_amount: parseFloat(totalDiscountAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    },
  });
};

export const handleFieldChange = async (fieldId, value, fieldIdString = null) => {
  const formData = { ...$embed.value.formData };
  const key = fieldIdString !== null ? fieldIdString : fieldId;
  formData[key] = value;
  $embed.update({ formData });
  checkFormValidity();
  updateIsPayNowDisabled();

  await createOrUpdateOrderAndInitializePayment();
};

export const handleTicketChange = async (ticketId, quantity) => {
  const selectedTickets = { ...$embed.value.selectedTickets };
  selectedTickets[ticketId] = parseInt(quantity, 10) || 0;
  $embed.update({ selectedTickets });
  calculateTotals();
  checkFormValidity();
  updateIsPayNowDisabled();

  await createOrUpdateOrderAndInitializePayment();
};

export const handleApplyDiscount = async (formId, eventId) => {
  const { discountCode } = $embed.value;

  if (!discountCode) return;

  try {
    const { form } = $embed.value;
    const result = await discountsAPI.validateCode(discountCode, form?.event_id || eventId);

    if (result.valid) {
      $embed.update({
        appliedDiscount: result.discount,
        error: null,
      });
      calculateTotals();
      updateIsPayNowDisabled();

      // Update existing order with new discount amounts without re-initializing payment session
      const { order, totals, selectedTickets, tickets, formData } = $embed.value;
      if (order && order.status === 'PENDING') {
        const orderItems = Object.entries(selectedTickets)
          .filter(([, quantity]) => quantity > 0)
          .map(([ticketId, quantity]) => {
            const ticket = tickets.find((t) => t.id === ticketId);
            return {
              ticket_type_id: ticketId,
              quantity,
              unit_price: parseFloat(ticket.price),
            };
          });

        if (orderItems.length > 0) {
          try {
            const updatedOrder = await ordersAPI.update(
              order.id,
              orderItems,
              totals.discount_amount,
              $embed.value.appliedDiscount?.id,
              formData.name,
              formData.email,
            );
            $embed.update({ order: updatedOrder });
          } catch (updateErr) {
            // Non-critical: order update for discount failed silently
          }
        }
      }
    } else {
      $embed.update({
        error: result.error,
        appliedDiscount: null,
      });
    }
  } catch (err) {
    $embed.update({ error: 'Error validating discount code' });
  }
};

/** Normalize upselling custom fields to per-unit array: [ { label: value }, ... ] */
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

// Debounce ref for updating order with upsellings
let updateUpsellingsDebounceTimer = null;

const updateOrderWithUpsellings = async () => {
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

        // For upsellings with custom fields, we need all fields complete for each unit
        const perUnitList = Array.isArray(rawCustom) ? rawCustom : (rawCustom && typeof rawCustom === 'object' ? [rawCustom] : []);
        const items = [];
        for (let i = 0; i < quantity; i++) {
          const customFieldValues = perUnitList[i] && typeof perUnitList[i] === 'object' ? perUnitList[i] : {};
          // Check if all required custom fields are filled for this unit
          const allFieldsComplete = upselling.custom_fields.every(field => {
            const value = customFieldValues[field.label];
            return value !== undefined && value !== null && value !== '';
          });
          // If custom fields are complete, add this unit to the order
          if (allFieldsComplete) {
            items.push({
              upselling_id: upsellingId,
              quantity: 1,
              unit_price: unitPrice,
              custom_fields: customFieldValues,
            });
          }
        }
        return items;
      });

    const totalDiscountAmount = $embed.value.totals?.discount_amount ?? getUpsellingDiscountAmount();
    const updatedOrder = await ordersAPI.updatePendingItems(
      currentOrder.id,
      upsellingOrderItems,
      totalDiscountAmount,
    );
    $embed.update({ order: updatedOrder });
  } catch (err) {
    console.error('Error updating order with upsellings:', err);
    // Don't show error to user, just log it
  }
};

export const handleUpsellingChange = (upsellingId, quantity) => {
  const selectedUpsellings = { ...$embed.value.selectedUpsellings };
  const newQuantity = parseInt(quantity, 10) || 0;
  selectedUpsellings[upsellingId] = newQuantity;

  const upsellingCustomFields = { ...$embed.value.upsellingCustomFields };
  if (newQuantity === 0) {
    delete upsellingCustomFields[upsellingId];
  } else {
    upsellingCustomFields[upsellingId] = getPerUnitCustomFields(upsellingCustomFields, upsellingId, newQuantity);
  }

  $embed.update({ selectedUpsellings, upsellingCustomFields });
  calculateTotals();
  checkFormValidity();
  updateIsPayNowDisabled();
  disableCountDownTimer();

  // Debounce the database update to avoid too many API calls
  // updateOrderWithUpsellings updates the order items without re-initializing the payment session
  if (updateUpsellingsDebounceTimer) {
    clearTimeout(updateUpsellingsDebounceTimer);
  }
  updateUpsellingsDebounceTimer = setTimeout(() => {
    updateOrderWithUpsellings();
    updateUpsellingsDebounceTimer = null;
  }, 500);
};

export const disableCountDownTimer = () => {
  $embed.update({ isCountDownTimerDisabled: true });
};

/** unitIndex: 0-based index of the selected unit (e.g. shirt 1, shirt 2) */
export const handleUpsellingCustomFieldChange = (upsellingId, unitIndex, fieldLabel, value) => {
  const upsellingCustomFields = { ...$embed.value.upsellingCustomFields };
  const existing = upsellingCustomFields[upsellingId];
  const list = Array.isArray(existing) ? [...existing] : existing && typeof existing === 'object' ? [{ ...existing }] : [];
  while (list.length <= unitIndex) list.push({});
  list[unitIndex] = { ...list[unitIndex], [fieldLabel]: value };
  upsellingCustomFields[upsellingId] = list;
  $embed.update({ upsellingCustomFields });

  // Debounce the database update to avoid too many API calls
  if (updateUpsellingsDebounceTimer) {
    clearTimeout(updateUpsellingsDebounceTimer);
  }
  updateUpsellingsDebounceTimer = setTimeout(() => {
    updateOrderWithUpsellings();
    updateUpsellingsDebounceTimer = null;
  }, 500);
};

export const validateForm = () => {
  const { form, formData, selectedTickets, tickets } = $embed.value;

  if (form?.schema) {
    for (const field of form.schema) {
      if (field.required) {
        const key = field.field_id_string !== null && field.field_id_string !== undefined ? field.field_id_string : field.label;
        if (!formData[key]) {
          return `${field.label} is required`;
        }
      }
    }
  }

  const hasTickets = Object.values(selectedTickets).some((qty) => qty > 0);
  if (tickets.length > 0 && !hasTickets) {
    return 'Please select at least one ticket';
  }

  if (!formData.email) {
    return 'Email is required';
  }

  return null;
};

const isValidUSPhone = (phone) => {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10;
};

export const checkFormValidity = () => {
  const { form, formData, selectedTickets, tickets } = $embed.value;

  if (!formData.email || !formData.email.trim()) {
    $embed.update({ isFormValid: false });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    $embed.update({ isFormValid: false });
    return;
  }

  if (form?.schema) {
    for (const field of form.schema) {
      if (field.required) {
        const key = field.field_id_string !== null && field.field_id_string !== undefined ? field.field_id_string : field.label;
        const value = formData[key];
        if (!value || (typeof value === 'string' && !value.trim())) {
          $embed.update({ isFormValid: false });
          return;
        }
        if (field.type === 'tel' && !isValidUSPhone(value)) {
          $embed.update({ isFormValid: false });
          return;
        }
      }
    }
  }

  if (tickets.length > 0) {
    const hasTickets = Object.values(selectedTickets).some((qty) => qty > 0);
    if (!hasTickets) {
      $embed.update({ isFormValid: false });
      return;
    }
  }

  $embed.update({ isFormValid: true });
};

export const handleSubmit = async (e, formId, eventId, onSubmitSuccess) => {
  const isUserSubmit = !!e;

  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  if (isUserSubmit) {
    const validationError = validateForm();
    if (validationError) {
      $embed.update({ error: validationError });
      return;
    }
  }

  try {
    $embed.loadingStart();
    $embed.update({ error: null });

    const { form, formData, selectedTickets, selectedUpsellings, appliedDiscount, totals, tickets, upsellings } = $embed.value;
    let submissionId = null;

    if (form) {
      const {
        card_number: _cardNumber,
        card_cvc: _cardCvc,
        card_expiration: _cardExpiration,
        cardholder_name: _cardholderName,
        ...safeFormData
      } = formData;

      const submission = await formsAPI.submitForm(form.id, safeFormData, formData.email);
      submissionId = submission.id;
    }

    const hasTickets = Object.values(selectedTickets).some((qty) => qty > 0);
    const hasUpsellings = Object.values(selectedUpsellings).some((qty) => qty > 0);
    let orderItems = [];
    if (hasTickets) {
      orderItems = Object.entries(selectedTickets)
        .filter(([, quantity]) => quantity > 0)
        .map(([ticketId, quantity]) => {
          const ticket = tickets.find((t) => t.id === ticketId);
          return {
            ticket_type_id: ticketId,
            quantity,
            unit_price: parseFloat(ticket.price),
          };
        });

      if (hasUpsellings) {
        const { upsellingCustomFields } = $embed.value;
        const upsellingOrderItems = Object.entries(selectedUpsellings)
          .filter(([, quantity]) => quantity > 0)
          .map(([upsellingId, quantity]) => {
            const upselling = upsellings.find((u) => u.id === upsellingId);
            const customFieldValues = upsellingCustomFields[upsellingId] || {};
            return {
              upselling_id: upsellingId,
              quantity,
              unit_price: parseFloat(upselling.amount ?? upselling.price),
              custom_fields: customFieldValues,
            };
          });
        orderItems.push(...upsellingOrderItems);
      }

      const orderData = {
        event_id: form?.event_id || eventId,
        form_submission_id: submissionId,
        discount_code_id: appliedDiscount?.id || null,
        subtotal: totals.subtotal,
        discount_amount: totals.discount_amount,
        total: totals.total,
        status: 'PENDING',
        customer_email: formData.email,
        customer_name: formData.name || null,
        items: orderItems,
      };

      const order = await ordersAPI.create(orderData);

      if (onSubmitSuccess) {
        onSubmitSuccess({ order, submission: submissionId });
      }
    } else if (onSubmitSuccess) {
      onSubmitSuccess({ submission: submissionId });
    }
  } catch (err) {
    $embed.update({ error: 'Error submitting form. Please try again.' });
  } finally {
    $embed.loadingEnd();
  }
};

/**
 * Creates or updates an order and initializes payment session when:
 * - Tickets are selected/changed
 * - Name or email is entered/changed
 */
export const createOrUpdateOrderAndInitializePayment = async () => {
  try {
    if ($embed.value.isPayNowDisabled) {
      return;
    }

    if (!$embed.value.form?.event_id) {
      return;
    }
    $embed.update({ isLoadingCCForm: true });

    const { form, formData } = $embed.value;
    const hasMinimalData = formData?.email && formData?.name;

    // If an order exists and is PENDING, try to update it; otherwise create new
    let orderToUse = null;

    if ($embed.value.order && $embed.value.order.status === 'PENDING') {
      // Try to update existing pending order
      try {
        const { totals } = $embed.value;
        const orderItems = Object.entries($embed.value.selectedTickets)
          .filter(([, quantity]) => quantity > 0)
          .map(([ticketId, quantity]) => {
            const ticket = $embed.value.tickets.find((t) => t.id === ticketId);
            return {
              ticket_type_id: ticketId,
              quantity,
              unit_price: parseFloat(ticket.price),
            };
          });

        // Don't update if there are no order items
        if (orderItems.length === 0) {
          return;
        }

        // Create form_submission if it doesn't exist and we have minimal data
        // Only include name and email in responses at this point
        let submissionId = $embed.value.order.form_submission_id;
        if (!submissionId && form && hasMinimalData) {
          try {
            const minimalResponses = {
              name: formData.name,
              email: formData.email,
            };
            const submission = await formsAPI.submitForm(form.id, minimalResponses, formData.email);
            submissionId = submission.id;
          } catch (submissionError) {
            console.error('Error creating form submission:', submissionError);
            // Continue without submission if creation fails
          }
        }

        orderToUse = await ordersAPI.update(
          $embed.value.order.id,
          orderItems,
          totals.discount_amount,
          $embed.value.formData.name,
          $embed.value.formData.email,
          submissionId, // Pass submissionId if we created one
        );
      } catch (updateError) {
        // If update fails, create a new order
        orderToUse = null;
      }
    }

    // Create new order if we don't have a valid updated one
    if (!orderToUse) {
      // Only skip form submission if we don't have minimal data
      const skipFormSubmission = !hasMinimalData;
      orderToUse = await createOrderForPayment(null, $embed.value.form?.event_id, skipFormSubmission);
    }

    if (orderToUse && orderToUse.id) {
      try {
        let sessionData = await fetchPaymentSession(orderToUse.id);
        if (!sessionData) {
          sessionData = await initializePaymentSession(orderToUse.id);
        }
        if (sessionData) {
          $embed.update({ paymentSession: sessionData });
        }
      } catch (sessionError) {
        console.error('Error fetching or initializing payment session:', sessionError);
      }
    }
  } catch (err) {
    console.error('Error creating or updating order and initializing payment:', err);
  } finally {
    $embed.update({ isLoadingCCForm: false });
  }
};

export const createOrderForPayment = async (formId, eventId, skipFormSubmission = false) => {
  try {
    const { form, formData, selectedTickets, appliedDiscount, totals, tickets } = $embed.value;

    const hasTickets = Object.values(selectedTickets).some((qty) => qty > 0);
    if (!hasTickets) {
      return null;
    }

    const orderItems = Object.entries(selectedTickets)
      .filter(([, quantity]) => quantity > 0)
      .map(([ticketId, quantity]) => {
        const ticket = tickets.find((t) => t.id === ticketId);
        return {
          ticket_type_id: ticketId,
          quantity,
          unit_price: parseFloat(ticket.price),
        };
      });

    let submissionId = null;
    if (form && !skipFormSubmission) {
      // Only include name and email in responses at this point
      const minimalResponses = {
        name: formData.name,
        email: formData.email,
      };

      const submission = await formsAPI.submitForm(form.id, minimalResponses, formData.email);
      submissionId = submission.id;
    }

    const orderData = {
      event_id: form?.event_id || eventId,
      form_submission_id: submissionId,
      discount_code_id: appliedDiscount?.id || null,
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      total: totals.total,
      status: 'PENDING',
      customer_email: formData.email,
      customer_name: formData.name || null,
      items: orderItems,
    };

    const order = await ordersAPI.create(orderData);
    $embed.update({ order });
    return order;
  } catch (err) {
    console.error('Error creating order for payment:', err);
    throw err;
  }
};

export const updateDiscountCode = (code) => {
  $embed.update({ discountCode: code });
};

const buildConfirmationUrl = (baseUrl, order) => {
  let absoluteUrl = baseUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    absoluteUrl = `${window.location.origin}${baseUrl.startsWith('/') ? '' : '/'}${baseUrl}`;
  }

  const url = new URL(absoluteUrl);

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

  if (order.order_items && order.order_items.length > 0) {
    const itemsData = order.order_items.map(item => ({
      ticketTypeName: item.ticket_types?.name || item.upsellings?.item || '',
      quantity: item.quantity,
      unitPrice: item.unit_price?.toString() || '0',
      subtotal: item.subtotal?.toString() || '0',
    }));
    url.searchParams.set('orderItems', JSON.stringify(itemsData));
  }

  return url.toString();
};

export const handlePaymentSuccess = async (paymentData, confirmationUrlOverride = null, options = {}) => {
  const { skipRedirect = false } = options;

  try {
    $embed.update({ error: null });

    const { order, form } = $embed.value;

    if (!order) {
      throw new Error('Order not found');
    }

    await paymentsAPI.confirmPayment(order.id, paymentData);

    const updatedOrder = await ordersAPI.getById(order.id);
    $embed.update({ order: updatedOrder });

    if (skipRedirect) {
      return updatedOrder;
    }

    let redirectUrl;

    const hasConfirmationUrlOverride = confirmationUrlOverride &&
      typeof confirmationUrlOverride === 'string' &&
      confirmationUrlOverride.trim() !== '';

    const hasFormUrl = form?.order_confirmation_url &&
      typeof form.order_confirmation_url === 'string' &&
      form.order_confirmation_url.trim() !== '';

    if (hasConfirmationUrlOverride) {
      redirectUrl = buildConfirmationUrl(confirmationUrlOverride, updatedOrder);
    } else if (hasFormUrl) {
      redirectUrl = buildConfirmationUrl(form.order_confirmation_url, updatedOrder);
    } else {
      redirectUrl = `/embed/order-confirmation/${updatedOrder.id}`;
    }

    const orderDetails = {
      orderId: updatedOrder.id,
      customerEmail: updatedOrder.customer_email || '',
      customerName: updatedOrder.customer_name || '',
      total: updatedOrder.total?.toString() || '0',
      subtotal: updatedOrder.subtotal?.toString() || '0',
      discountAmount: updatedOrder.discount_amount?.toString() || '0',
      status: updatedOrder.status || '',
      eventTitle: updatedOrder.events?.title || '',
      discountCode: updatedOrder.discount_codes?.code || '',
      createdAt: updatedOrder.created_at || '',
      paymentIntentId: updatedOrder.payment_intent_id || '',
      orderItems: updatedOrder.order_items?.map(item => ({
        ticketTypeName: item.ticket_types?.name || item.upsellings?.item || '',
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
        order: updatedOrder,
      }, '*');
    }

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, isInIframe ? 1000 : 2000);

    return updatedOrder;
  } catch (err) {
    const errorMessage = err.message || 'Payment confirmation failed. Please contact support if you were charged.';
    $embed.update({
      error: errorMessage,
    });
    throw err;
  }
};

/** Navigate to order confirmation (used after payment success in step 2 or 3). */
export const goToOrderConfirmation = (confirmationUrlOverride = null, orderOverride = null) => {
  const { order: embedOrder, form } = $embed.value;
  const order = orderOverride ?? embedOrder;
  if (!order) return;
  const hasOverride = confirmationUrlOverride && typeof confirmationUrlOverride === 'string' && confirmationUrlOverride.trim() !== '';
  const hasFormUrl = form?.order_confirmation_url && typeof form.order_confirmation_url === 'string' && form.order_confirmation_url.trim() !== '';
  const base = hasOverride ? confirmationUrlOverride : (hasFormUrl ? form.order_confirmation_url : `/embed/order-confirmation/${order.id}`);
  const redirectUrl = buildConfirmationUrl(base, order);
  const orderDetails = {
    orderId: order.id,
    customerEmail: order.customer_email || '',
    customerName: order.customer_name || '',
    total: order.total?.toString() || '0',
    subtotal: order.subtotal?.toString() || '0',
    discountAmount: order.discount_amount?.toString() || '0',
    status: order.status || '',
    eventTitle: order.events?.title || '',
    orderItems: order.order_items?.map(item => ({
      ticketTypeName: item.ticket_types?.name || item.upsellings?.item || '',
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
      order,
    }, '*');
  }
  window.location.href = redirectUrl;
};

/** Completes a free order (total <= 0) without payment, then redirects to confirmation (unless options.skipRedirect). */
export const handleFreeOrderComplete = async (confirmationUrlOverride = null, options = {}) => {
  try {
    $embed.update({ error: null });

    const { order, form } = $embed.value;

    if (!order) {
      throw new Error('Order not found');
    }

    try {
      await paymentsAPI.confirmFreePayment(order.id);
    } catch (paymentError) {
      console.error('Error confirming free payment:', paymentError);
      // Re-throw with more context
      throw new Error(
        paymentError.message || 'Failed to confirm free payment. Please try again.',
      );
    }

    const updatedOrder = await ordersAPI.getById(order.id);
    if (!updatedOrder) {
      throw new Error('Order not found after confirmation');
    }
    $embed.update({ order: updatedOrder });

    if (options.skipRedirect) {
      return;
    }

    let redirectUrl;

    const hasConfirmationUrlOverride = confirmationUrlOverride &&
      typeof confirmationUrlOverride === 'string' &&
      confirmationUrlOverride.trim() !== '';

    const hasFormUrl = form?.order_confirmation_url &&
      typeof form.order_confirmation_url === 'string' &&
      form.order_confirmation_url.trim() !== '';

    if (hasConfirmationUrlOverride) {
      redirectUrl = buildConfirmationUrl(confirmationUrlOverride, updatedOrder);
    } else if (hasFormUrl) {
      redirectUrl = buildConfirmationUrl(form.order_confirmation_url, updatedOrder);
    } else {
      redirectUrl = `/embed/order-confirmation/${updatedOrder.id}`;
    }

    const orderDetails = {
      orderId: updatedOrder.id,
      customerEmail: updatedOrder.customer_email || '',
      customerName: updatedOrder.customer_name || '',
      total: updatedOrder.total?.toString() || '0',
      subtotal: updatedOrder.subtotal?.toString() || '0',
      discountAmount: updatedOrder.discount_amount?.toString() || '0',
      status: updatedOrder.status || '',
      eventTitle: updatedOrder.events?.title || '',
      discountCode: updatedOrder.discount_codes?.code || '',
      createdAt: updatedOrder.created_at || '',
      paymentIntentId: updatedOrder.payment_intent_id || '',
      orderItems: updatedOrder.order_items?.map(item => ({
        ticketTypeName: item.ticket_types?.name || item.upsellings?.item || '',
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
        order: updatedOrder,
      }, '*');
    }

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, isInIframe ? 1000 : 2000);
  } catch (err) {
    const errorMessage = err.message || 'Unable to complete order. Please try again.';
    $embed.update({
      error: errorMessage,
    });
    throw err;
  }
};

export const updateIsPayNowDisabled = () => {
  const hasName = $embed.value.formData.name && $embed.value.formData.name.trim() !== '';
  const hasEmail = $embed.value.formData.email && $embed.value.formData.email.trim() !== '';
  const hasTickets = Object.values($embed.value.selectedTickets).some((qty) => qty > 0);
  const isCcLoading = $embed.value.isLoadingCCForm;
  $embed.update({ isPayNowDisabled: !hasName || !hasEmail || !hasTickets || isCcLoading });
};

export const submitPaymentFormProgrammatically = () => {
  if ($embed.value.totals.total <= 0) {
    handleFreeOrderComplete();
    return;
  }
  if (paymentSubmitBtnRef.value) {
    paymentSubmitBtnRef.value.click();
  } else {
    console.warn('Payment submit button ref not available');
  }
};

export const handleClickPayNow = async () => {
  if ($embed.value.currentStep === 'initial') {
    if ($embed.value.upsellings.length > 0) {
      $embed.update({ currentStep: 'upsell' });
      return;
    }
    submitPaymentFormProgrammatically();
    return;
  }

  if ($embed.value.currentStep === 'upsell' && $embed.value.totals.ticketsSubtotal <= $embed.value.totals.discount_amount) {
    const hasSelectedUpsellings = Object.values($embed.value.selectedUpsellings).some((qty) => qty > 0);

    // Only flush upselling updates if the user actually selected upsellings
    if (hasSelectedUpsellings) {
      if (updateUpsellingsDebounceTimer) {
        clearTimeout(updateUpsellingsDebounceTimer);
        updateUpsellingsDebounceTimer = null;
      }
      await updateOrderWithUpsellings();
    }

    $embed.update({ currentStep: 'checkoutWithUpsell' });

    // Only initialize payment session if there is something to pay
    if ($embed.value.totals.total > 0) {
      $embed.update({ isLoadingCCForm: true });
      try {
        const { order } = $embed.value;
        if (order?.id) {
          const sessionData = await initializePaymentSession(order.id);
          if (sessionData) {
            $embed.update({ paymentSession: sessionData });
          }
        }
      } catch (err) {
        // Payment session initialization failed - form will show error state
      } finally {
        $embed.update({ isLoadingCCForm: false });
      }
    }
    return;
  }

  if ($embed.value.currentStep === 'upsell') {
    submitPaymentFormProgrammatically();
    return;
  }

  if ($embed.value.currentStep === 'checkoutWithUpsell') {
    submitPaymentFormProgrammatically();
    return;
  }

  $embed.update({ currentStep: 'initial' });
};
