/**
 * Utility functions for calling Supabase Edge Functions
 */
import supabase from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Makes a request to a Supabase Edge Function with timeout handling
 * @param {string} functionName - Name of the edge function
 * @param {object} options - Request options
 * @param {string} options.method - HTTP method
 * @param {object} options.body - Request body
 * @param {object} options.headers - Additional headers
 * @param {number} options.timeout - Request timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>} The response from the edge function
 */
export async function callEdgeFunction(functionName, options = {}) {
  const { method = 'GET', body, headers = {}, timeout = 30000 } = options;

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const requestHeaders = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    ...headers,
  };

  // Add auth token if available
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      requestHeaders.Authorization = `Bearer ${session.access_token}`;
    } else {
      // If no session, use the anon key as Authorization for edge functions
      requestHeaders.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    }
  } catch (error) {
    // If there's no session, use anon key
    requestHeaders.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const config = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    config.signal = controller.signal;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      // Provide more specific error messages based on status code
      let errorMessage = data.error || data.message || 'An error occurred';

      if (response.status === 404) {
        errorMessage = 'Resource not found';
      } else if (response.status === 500) {
        // Use the server's error message if available, otherwise use generic message
        errorMessage = data.error || data.message || 'Server error. Please try again later.';
        console.error('Server error details:', {
          status: response.status,
          error: data.error,
          message: data.message,
          data,
        });
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'Authentication error. Please refresh the page.';
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.originalData = data;
      throw error;
    }

    return data;
  } catch (error) {
    // Handle different types of errors
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please check your internet connection and try again.');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      const networkError = new Error('Network error. Please check your internet connection.');
      networkError.isNetworkError = true;
      throw networkError;
    }

    throw error;
  }
}

/**
 * Edge function helpers for each resource
 */
export const edgeFunctionHelpers = {
  events: {
    getAll: (filters = {}) => callEdgeFunction('events', {
      method: 'POST',
      body: { action: 'getAll', filters },
    }),
    getById: (id) => callEdgeFunction('events', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    create: (data) => callEdgeFunction('events', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    update: (id, data) => callEdgeFunction('events', {
      method: 'POST',
      body: { action: 'update', id, data },
    }),
    delete: (id) => callEdgeFunction('events', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
  },

  users: {
    getAll: (filters = {}) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'getAll', filters },
    }),
    getById: (id) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    getByFirebaseUid: (firebaseUid) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'getByFirebaseUid', firebaseUid },
    }),
    create: (data) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    update: (id, data) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'update', id, data },
    }),
    delete: (id) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
    getOrganizations: (userId) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'getOrganizations', userId },
    }),
    addToOrganization: (userId, orgId, role) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'addToOrganization', userId, orgId, role },
    }),
    removeFromOrganization: (userId, orgId) => callEdgeFunction('users', {
      method: 'POST',
      body: { action: 'removeFromOrganization', userId, orgId },
    }),
  },

  organizations: {
    getAll: (filters = {}) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'getAll', filters },
    }),
    getById: (id) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    create: (data) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    update: (id, data) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'update', id, data },
    }),
    delete: (id) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
    getUsers: (orgId) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'getUsers', orgId },
    }),
    addUser: (orgId, userId, role) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'addUser', orgId, userId, role },
    }),
    removeUser: (orgId, userId) => callEdgeFunction('organizations', {
      method: 'POST',
      body: { action: 'removeUser', orgId, userId },
    }),
  },

  tickets: {
    getByEventId: (eventId) => callEdgeFunction('tickets', {
      method: 'POST',
      body: { action: 'getByEventId', eventId },
    }),
    getById: (id) => callEdgeFunction('tickets', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    create: (data) => callEdgeFunction('tickets', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    update: (id, data) => callEdgeFunction('tickets', {
      method: 'POST',
      body: { action: 'update', id, data },
    }),
    delete: (id) => callEdgeFunction('tickets', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
    checkAvailability: (ticketTypeId, quantity) => callEdgeFunction('tickets', {
      method: 'POST',
      body: { action: 'checkAvailability', ticketTypeId, quantity },
    }),
  },

  upsellings: {
    getByEventId: (eventId) => callEdgeFunction('upsellings', {
      method: 'POST',
      body: { action: 'getByEventId', eventId },
    }),
    getById: (id) => callEdgeFunction('upsellings', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    create: (data) => callEdgeFunction('upsellings', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    update: (id, data) => callEdgeFunction('upsellings', {
      method: 'POST',
      body: { action: 'update', id, data },
    }),
    delete: (id) => callEdgeFunction('upsellings', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
    checkAvailability: (upsellingId, quantity) => callEdgeFunction('upsellings', {
      method: 'POST',
      body: { action: 'checkAvailability', upsellingId, quantity },
    }),
  },

  orders: {
    getAll: (filters = {}) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'getAll', filters },
    }),
    getById: (id) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    create: (data) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    updateStatus: (id, status, paymentIntentId) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'updateStatus', id, status, paymentIntentId },
    }),
    calculateTotal: (items, discountCodeId) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'calculateTotal', items, discountCodeId },
    }),
    addItemsToOrder: (id, items) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'addItemsToOrder', id, items },
    }),
    updatePendingItems: (id, items, upsellingDiscountAmount = 0) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'updatePendingItems', id, items, upsellingDiscountAmount },
    }),
    update: (id, items, upsellingDiscountAmount = 0, customerName = null, customerEmail = null) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'update', id, items, upsellingDiscountAmount, customerName, customerEmail },
    }),
    delete: (id) => callEdgeFunction('orders', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
  },

  forms: {
    getAll: (filters = {}) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'getAll', filters },
    }),
    getById: (id) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    create: (data) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    update: (id, data) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'update', id, data },
    }),
    delete: (id) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
    publish: (id) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'update', id, data: { is_published: true } },
    }),
    unpublish: (id) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'update', id, data: { is_published: false } },
    }),
    submitForm: (formId, responses, email) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'submitForm', formId, responses, email },
    }),
    getSubmissions: (formId) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'getSubmissions', formId },
    }),
    updateSubmission: (submissionId, responses) => callEdgeFunction('forms', {
      method: 'POST',
      body: { action: 'updateSubmission', submissionId, responses },
    }),
  },

  discounts: {
    getByEventId: (eventId) => callEdgeFunction('discounts', {
      method: 'POST',
      body: { action: 'getByEventId', eventId },
    }),
    getById: (id) => callEdgeFunction('discounts', {
      method: 'POST',
      body: { action: 'getById', id },
    }),
    create: (data) => callEdgeFunction('discounts', {
      method: 'POST',
      body: { action: 'create', data },
    }),
    update: (id, data) => callEdgeFunction('discounts', {
      method: 'POST',
      body: { action: 'update', id, data },
    }),
    delete: (id) => callEdgeFunction('discounts', {
      method: 'POST',
      body: { action: 'delete', id },
    }),
    validateCode: (code, eventId) => callEdgeFunction('discounts', {
      method: 'POST',
      body: { action: 'validateCode', code, eventId },
    }),
    incrementUsage: (id) => callEdgeFunction('discounts', {
      method: 'POST',
      body: { action: 'incrementUsage', id },
    }),
  },

  payments: {
    createPaymentSession: (orderId) => callEdgeFunction('payments', {
      method: 'POST',
      body: { action: 'createPaymentSession', orderId },
      timeout: 60000, // 60 seconds - AccruPay session creation can take longer
    }),
    confirmFreePayment: (orderId) => callEdgeFunction('payments', {
      method: 'POST',
      body: { action: 'confirmFreePayment', orderId },
    }),
    confirmPayment: (orderId, paymentData) => callEdgeFunction('payments', {
      method: 'POST',
      body: { action: 'confirmPayment', orderId, paymentData },
    }),
    handleWebhook: (webhookData) => callEdgeFunction('payments', {
      method: 'POST',
      body: { action: 'handleWebhook', webhookData },
    }),
    getPaymentSession: (orderId) => callEdgeFunction('payments', {
      method: 'POST',
      body: { action: 'getPaymentSession', orderId },
    }),
    getProviders: () => callEdgeFunction('payments', {
      method: 'POST',
      body: { action: 'getProviders' },
    }),
    chargeUpsellings: (orderId, items) => callEdgeFunction('payments', {
      method: 'POST',
      body: { action: 'chargeUpsellings', orderId, items },
    }),
  },
};

export default callEdgeFunction;
