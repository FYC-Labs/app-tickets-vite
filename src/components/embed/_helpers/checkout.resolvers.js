import { $checkout } from '@src/signals';
import ordersAPI from '@src/api/orders.api';
import paymentsAPI from '@src/api/payments.api';
import upsellingsAPI from '@src/api/upsellings.api';
import { sessionInitError, postCheckoutUpsellings } from './checkout.consts';

export const loadOrderData = async (orderId) => {
  try {
    $checkout.loadingStart();
    $checkout.update({ error: null });
    sessionInitError.value = null;

    const orderData = await ordersAPI.getById(orderId);

    if (!orderData) {
      throw new Error('Order not found. Please check your order link and try again.');
    }

    if (orderData.status === 'PAID') {
      const formData = orderData.form_submissions?.forms || null;
      $checkout.update({
        order: orderData,
        paymentStatus: 'completed',
        form: formData,
      });
      return;
    }

    if (orderData.status === 'CANCELLED') {
      throw new Error('This order has been cancelled and cannot be paid.');
    }

    if (orderData.status === 'EXPIRED') {
      throw new Error('This order has expired. Please create a new order.');
    }

    if (orderData.status !== 'PENDING') {
      throw new Error(`This order cannot be processed. Status: ${orderData.status}`);
    }

    const orderTotal = parseFloat(orderData.total) || 0;
    const isFreeOrder = orderTotal === 0;

    if (isFreeOrder) {
      try {
        await paymentsAPI.confirmFreePayment(orderId);
        const updatedOrderData = await ordersAPI.getById(orderId);
        const formData = updatedOrderData.form_submissions?.forms || null;
        $checkout.update({
          order: updatedOrderData,
          form: formData,
          paymentStatus: 'completed',
          error: null,
        });
        return;
      } catch (updateError) {
        console.error('Error auto-completing free order:', updateError);
      }
    }

    if (!orderData.customer_email) {
      throw new Error('Order is missing customer information. Please contact support.');
    }

    // Extract form data from order's form_submissions relationship
    const formData = orderData.form_submissions?.forms || null;

    $checkout.update({ order: orderData, form: formData, error: null });
  } catch (err) {
    // Provide specific error messages based on error type
    let errorMessage = err.message || 'Unable to load order information.';

    // Check for network errors
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (err.message.includes('timeout')) {
      errorMessage = 'Request timed out. Please check your internet connection and refresh the page.';
    } else if (err.message.includes('404') || err.message.includes('not found')) {
      errorMessage = 'Order not found. Please check your order link and try again.';
    } else if (err.message.includes('500') || err.message.includes('server error')) {
      errorMessage = 'Server error. Please try again later or contact support.';
    }

    $checkout.update({ error: errorMessage });
  } finally {
    $checkout.loadingEnd();
  }
};

export const initializePaymentSession = async (orderId) => {
  try {
    sessionInitError.value = null;
    const sessionData = await paymentsAPI.createPaymentSession(orderId);

    if (!sessionData || !sessionData.sessionToken) {
      const errorMsg = 'Payment session was created but is missing required information. Please refresh the page.';
      sessionInitError.value = errorMsg;
      $checkout.update({ error: errorMsg });
      throw new Error(errorMsg);
    }

    $checkout.update({ paymentSession: sessionData, error: null });
    return sessionData;
  } catch (err) {
    const errorMsg = err.message || 'Unable to initialize payment session. Please refresh the page or contact support.';
    sessionInitError.value = errorMsg;
    $checkout.update({ error: errorMsg });
    throw err;
  }
};

export const fetchPaymentSession = async (orderId) => {
  try {
    sessionInitError.value = null;
    const sessionData = await paymentsAPI.getPaymentSession(orderId);

    if (!sessionData) {
      // No existing session found - this is expected, will create new one
      return null;
    }

    if (!sessionData.sessionToken) {
      const errorMsg = 'Payment session is invalid. Please refresh the page.';
      sessionInitError.value = errorMsg;
      throw new Error(errorMsg);
    }

    return sessionData;
  } catch (err) {
    // Only set error for actual failures, not for "not found" scenarios
    if (err.message && !err.message.includes('not found')) {
      const errorMsg = err.message || 'Unable to retrieve payment session.';
      sessionInitError.value = errorMsg;
      $checkout.update({ error: errorMsg });
    }
    throw err;
  }
};

const getFormFromOrder = (order, fallbackForm) => {
  if (order?.form_submissions?.forms) {
    const { forms } = order.form_submissions;
    return Array.isArray(forms) ? forms[0] : forms;
  }
  return fallbackForm ?? null;
};

export const loadPostCheckoutUpsellings = async (eventId, order = null, fallbackForm = null) => {
  try {
    if (!eventId) {
      postCheckoutUpsellings.value = [];
      return;
    }

    const form = getFormFromOrder(order, fallbackForm);

    const allUpsellings = await upsellingsAPI.getByEventId(eventId);
    const now = new Date();

    let availableUpsellings = (allUpsellings || []).filter((upselling) => {
      if (upselling.upselling_strategy !== 'POST-CHECKOUT') {
        return false;
      }
      const start = new Date(upselling.sales_start);
      const end = new Date(upselling.sales_end);
      const available = (upselling.quantity || 0) - (upselling.sold || 0);
      return start <= now && now <= end && available > 0;
    });

    if (form && 'available_upselling_ids' in form) {
      if (form.available_upselling_ids && Array.isArray(form.available_upselling_ids) && form.available_upselling_ids.length > 0) {
        const availableIds = form.available_upselling_ids.map(String);
        availableUpsellings = availableUpsellings.filter((u) => availableIds.includes(String(u.id)));
      } else {
        // if available_upsellings_ids is defined but empty, do not show any upselling
        availableUpsellings = [];
      }
    }

    postCheckoutUpsellings.value = availableUpsellings;
  } catch (err) {
    postCheckoutUpsellings.value = [];
  }
};
