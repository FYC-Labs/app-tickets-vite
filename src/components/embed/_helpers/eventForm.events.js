/* eslint-disable no-restricted-syntax */
import { $embed } from '@src/signals';
import formsAPI from '@src/api/forms.api';
import ticketsAPI from '@src/api/tickets.api';
import ordersAPI from '@src/api/orders.api';
import discountsAPI from '@src/api/discounts.api';
import upsellingsAPI from '@src/api/upsellings.api';

export const loadFormData = async (formId, eventId) => {
  try {
    $embed.loadingStart();
    $embed.update({ error: null });

    if (formId) {
      const formData = await formsAPI.getById(formId);
      $embed.update({ form: formData });

      if (formData.event_id) {
        const ticketsData = await ticketsAPI.getByEventId(formData.event_id);
        const now = new Date();

        // Filter tickets by form's available_ticket_ids if specified
        let filtered = ticketsData || [];

        if (formData.available_ticket_ids && formData.available_ticket_ids.length > 0) {
          filtered = filtered.filter((t) => formData.available_ticket_ids.includes(t.id));
        }

        // Then apply date and availability filters
        filtered = filtered.filter((t) => {
          const start = new Date(t.sales_start);
          const end = new Date(t.sales_end);
          const available = (t.quantity || 0) - (t.sold || 0);
          return start <= now && now <= end && available > 0;
        });

        $embed.update({ tickets: filtered });

        const upsellingsData = await upsellingsAPI.getByEventId(formData.event_id);
        let filteredUpsellings = (upsellingsData || []).filter(
          (u) => u.upselling_strategy === 'PRE-CHECKOUT'
        );

        // Solo mostrar upsellings ligados al formulario (available_upselling_ids)
        if (formData.available_upselling_ids && formData.available_upselling_ids.length > 0) {
          filteredUpsellings = filteredUpsellings.filter((u) =>
            formData.available_upselling_ids.includes(u.id)
          );
        }

        $embed.update({ upsellings: filteredUpsellings });
      }
    } else if (eventId) {
      const ticketsData = await ticketsAPI.getByEventId(eventId);
      const now = new Date();
      const filtered = (ticketsData || []).filter((t) => {
        const start = new Date(t.sales_start);
        const end = new Date(t.sales_end);
        const available = (t.quantity || 0) - (t.sold || 0);
        return start <= now && now <= end && available > 0;
      });
      $embed.update({ tickets: filtered });
    }
  } catch (err) {
    $embed.update({ error: 'Error loading form' });
  } finally {
    $embed.loadingEnd();
    checkFormValidity();
  }
};

export const calculateTotals = () => {
  const { selectedTickets, selectedUpsellings, appliedDiscount, tickets, upsellings } = $embed.value;

  let subtotal = 0;
  Object.entries(selectedTickets).forEach(([ticketId, quantity]) => {
    if (quantity > 0) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        subtotal += parseFloat(ticket.price) * quantity;
      }
    }
  });

  Object.entries(selectedUpsellings).forEach(([upsellingId, quantity]) => {
    if (quantity > 0) {
      const upselling = upsellings.find((u) => u.id === upsellingId);
      if (upselling) {
        subtotal += parseFloat(upselling.amount ?? upselling.price) * quantity;
      }
    }
  });

  let discountAmount = 0;
  if (appliedDiscount) {
    if (appliedDiscount.type === 'PERCENT') {
      discountAmount = (subtotal * parseFloat(appliedDiscount.value)) / 100;
    } else {
      discountAmount = parseFloat(appliedDiscount.value);
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  $embed.update({
    totals: {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    },
  });
};

export const handleFieldChange = (fieldId, value, fieldIdString = null) => {
  const formData = { ...$embed.value.formData };
  const key = fieldIdString !== null ? fieldIdString : fieldId;
  formData[key] = value;
  $embed.update({ formData });
  checkFormValidity();
};

export const handleTicketChange = (ticketId, quantity) => {
  const selectedTickets = { ...$embed.value.selectedTickets };
  selectedTickets[ticketId] = parseInt(quantity, 10) || 0;
  $embed.update({ selectedTickets });
  calculateTotals();
  checkFormValidity();
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

export const handleUpsellingChange = (upsellingId, quantity) => {
  const selectedUpsellings = { ...$embed.value.selectedUpsellings };
  const newQuantity = parseInt(quantity, 10) || 0;
  selectedUpsellings[upsellingId] = newQuantity;
  
  // Clear custom fields if quantity is 0
  const upsellingCustomFields = { ...$embed.value.upsellingCustomFields };
  if (newQuantity === 0) {
    delete upsellingCustomFields[upsellingId];
  }
  
  $embed.update({ selectedUpsellings, upsellingCustomFields });
  calculateTotals();
  checkFormValidity();
};

export const handleUpsellingCustomFieldChange = (upsellingId, fieldLabel, value) => {
  const upsellingCustomFields = { ...$embed.value.upsellingCustomFields };
  if (!upsellingCustomFields[upsellingId]) {
    upsellingCustomFields[upsellingId] = {};
  }
  upsellingCustomFields[upsellingId][fieldLabel] = value;
  $embed.update({ upsellingCustomFields });
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

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    $embed.update({ isFormValid: false });
    return;
  }

  // Check all required form fields
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
  console.log('tickets', tickets);

  // Check if at least one ticket is selected (only if tickets are available)
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
  e.preventDefault();

  const validationError = validateForm();
  if (validationError) {
    $embed.update({ error: validationError });
    return;
  }

  try {
    $embed.loadingStart();
    $embed.update({ error: null });

    const { form, formData, selectedTickets, selectedUpsellings, appliedDiscount, totals, tickets, upsellings } = $embed.value;
    let submissionId = null;

    if (form) {
      const submission = await formsAPI.submitForm(form.id, formData, formData.email);
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
    console.log('err', err);
    $embed.update({ error: 'Error submitting form. Please try again.' });
  } finally {
    $embed.loadingEnd();
  }
};

export const updateDiscountCode = (code) => {
  $embed.update({ discountCode: code });
};
