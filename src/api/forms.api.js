import { edgeFunctionHelpers } from '@src/utils/edgeFunctions';

export const formsAPI = {
  async getAll(filters = {}) {
    const result = await edgeFunctionHelpers.forms.getAll(filters);
    return result.data;
  },

  async getById(id) {
    const result = await edgeFunctionHelpers.forms.getById(id);
    return result.data;
  },

  async create(formData) {
    const result = await edgeFunctionHelpers.forms.create(formData);
    return result.data;
  },

  async update(id, formData) {
    const result = await edgeFunctionHelpers.forms.update(id, formData);
    return result.data;
  },

  async delete(id) {
    await edgeFunctionHelpers.forms.delete(id);
    return true;
  },

  async publish(id) {
    const result = await edgeFunctionHelpers.forms.publish(id);
    return result.data;
  },

  async unpublish(id) {
    const result = await edgeFunctionHelpers.forms.unpublish(id);
    return result.data;
  },

  async submitForm(formId, responses, email = null) {
    const result = await edgeFunctionHelpers.forms.submitForm(formId, responses, email);
    return result.data;
  },

  async getSubmissions(formId) {
    const result = await edgeFunctionHelpers.forms.getSubmissions(formId);
    return result.data;
  },

  async updateSubmission(submissionId, responses) {
    const result = await edgeFunctionHelpers.forms.updateSubmission(submissionId, responses);
    return result.data;
  },
};

export default formsAPI;
