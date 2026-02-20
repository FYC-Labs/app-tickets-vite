import { edgeFunctionHelpers } from '@src/utils/edgeFunctions';

export const upsellingsAPI = {
  async getByEventId(eventId) {
    const result = await edgeFunctionHelpers.upsellings.getByEventId(eventId);
    return result.data;
  },

  async getById(id) {
    const result = await edgeFunctionHelpers.upsellings.getById(id);
    return result.data;
  },

  async create(upsellingData) {
    const result = await edgeFunctionHelpers.upsellings.create(upsellingData);
    return result.data;
  },

  async update(id, upsellingData) {
    const result = await edgeFunctionHelpers.upsellings.update(id, upsellingData);
    return result.data;
  },

  async delete(id) {
    await edgeFunctionHelpers.upsellings.delete(id);
    return true;
  },

  async checkAvailability(upsellingId, quantity) {
    const result = await edgeFunctionHelpers.upsellings.checkAvailability(upsellingId, quantity);
    return result;
  },
};

export default upsellingsAPI;
