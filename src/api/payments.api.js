import { edgeFunctionHelpers } from '@src/utils/edgeFunctions';

export const paymentsAPI = {
  async createPaymentSession(orderId) {
    const result = await edgeFunctionHelpers.payments.createPaymentSession(orderId);
    return result.data;
  },

  async confirmPayment(orderId, paymentData) {
    const result = await edgeFunctionHelpers.payments.confirmPayment(orderId, paymentData);
    return result.data;
  },

  async handleWebhook(webhookData) {
    const result = await edgeFunctionHelpers.payments.handleWebhook(webhookData);
    return result.data;
  },

  async getPaymentSession(orderId) {
    const result = await edgeFunctionHelpers.payments.getPaymentSession(orderId);
    return result.data;
  },

  async getProviders() {
    const result = await edgeFunctionHelpers.payments.getProviders();
    return result.data;
  },

  async chargeUpsellings(orderId, items) {
    const result = await edgeFunctionHelpers.payments.chargeUpsellings(orderId, items);
    return result.data;
  },
};

export default paymentsAPI;
