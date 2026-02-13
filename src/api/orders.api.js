import { edgeFunctionHelpers } from '@src/utils/edgeFunctions';

export const ordersAPI = {
  async getAll(filters = {}) {
    const result = await edgeFunctionHelpers.orders.getAll(filters);
    return result.data;
  },

  async getById(id) {
    const result = await edgeFunctionHelpers.orders.getById(id);
    return result.data;
  },

  async getByEventId(eventId) {
    const result = await edgeFunctionHelpers.orders.getAll({ event_id: eventId });
    return result.data;
  },

  async create(orderData) {
    const result = await edgeFunctionHelpers.orders.create(orderData);
    return result.data;
  },

  async updateStatus(id, status, paymentIntentId = null) {
    const result = await edgeFunctionHelpers.orders.updateStatus(id, status, paymentIntentId);
    return result.data;
  },

  async updateTicketInventory() {
    // This is handled server-side in the edge function
    // Keeping the method for backward compatibility
    return true;
  },

  async calculateTotal(items, discountCodeId = null) {
    const result = await edgeFunctionHelpers.orders.calculateTotal(items, discountCodeId);
    return result;
  },

  async addItemsToOrder(orderId, items) {
    const result = await edgeFunctionHelpers.orders.addItemsToOrder(orderId, items);
    return result.data;
  },

  async updatePendingItems(orderId, items, upsellingDiscountAmount = 0) {
    const result = await edgeFunctionHelpers.orders.updatePendingItems(orderId, items, upsellingDiscountAmount);
    return result.data;
  },

  async update(orderId, items, upsellingDiscountAmount = 0, customerName = null, customerEmail = null) {
    const result = await edgeFunctionHelpers.orders.update(orderId, items, upsellingDiscountAmount, customerName, customerEmail);
    return result.data;
  },

  async delete(id) {
    const result = await edgeFunctionHelpers.orders.delete(id);
    return result.data;
  },
};

export default ordersAPI;
