/* eslint-disable no-nested-ternary */
import { Signal } from '@fyclabs/tools-fyc-react/signals';
import { upsellingsAPI } from '@src/api/upsellings.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';

export const DISCOUNT_TYPES = {
  NO_DISCOUNT: 'No Discount',
  PERCENT: 'Percent',
  FIXED: 'Fixed',
};

export const QUANTITY_RULES = {
  ONLY_ONE: 'Only One',
  MATCHES_TICKET_COUNT: 'Matches Ticket Count',
  USER_CAN_CHANGE: 'User Can Change',
};

export const MANAGE_INVENTORY = {
  YES: 'Yes',
  NO: 'NO',
};

export const $upsellingForm = Signal({
  name: '',
  description: '',
  benefits: '',
  price: '',
  quantity: '',
  sales_start: '',
  sales_end: '',
  custom_fields: [],
  images: [],
  upselling_strategy: 'PRE-CHECKOUT',
  discount_type: 'NO_DISCOUNT',
  discount_value: '',
  quantity_rule: 'ONLY_ONE',
  manage_inventory: 'NO',
  failedImageUrls: {},
  signedImageUrls: {},
  imagesUploading: false,
  uploadingPreviews: [],
});

export const $upsellingUI = Signal({
  showModal: false,
  editingUpselling: null,
});

export const handleOpenModal = (upselling = null) => {
  if (upselling) {
    $upsellingUI.update({
      showModal: true,
      editingUpselling: upselling,
    });

    // Normalize custom_fields to ensure options are arrays
    const normalizedCustomFields = Array.isArray(upselling.custom_fields)
      ? upselling.custom_fields.map(field => ({
        ...field,
        options: Array.isArray(field.options)
          ? field.options
          : typeof field.options === 'string' && field.options.trim()
            ? field.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0)
            : [],
      }))
      : [];

    // DB columns: item, amount, discount (form keeps name, price, discount_value for UI)
    $upsellingForm.update({
      name: upselling.item ?? upselling.name ?? '',
      description: upselling.description || '',
      benefits: upselling.benefits || '',
      price: upselling.amount ?? upselling.price ?? '',
      quantity: upselling.quantity ?? '',
      sales_start: upselling.sales_start ? new Date(upselling.sales_start).toISOString().slice(0, 16) : '',
      sales_end: upselling.sales_end ? new Date(upselling.sales_end).toISOString().slice(0, 16) : '',
      custom_fields: normalizedCustomFields,
      images: Array.isArray(upselling.images) ? [...upselling.images] : [],
      upselling_strategy: upselling.upselling_strategy || 'PRE-CHECKOUT',
      discount_type: upselling.discount_type || 'NO_DISCOUNT',
      discount_value: upselling.discount ?? upselling.discount_value ?? '',
      quantity_rule: upselling.quantity_rule || 'ONLY_ONE',
      manage_inventory: upselling.manage_inventory || 'NO',
    });
  } else {
    $upsellingUI.update({
      showModal: true,
      editingUpselling: null,
    });
    $upsellingForm.reset();
  }
};

/** Loads upselling into form for inline editing (e.g. in FormEditModal Upsellings tab). Does NOT set showModal. */
export const loadUpsellingFormForInline = (upselling = null) => {
  if (upselling) {
    $upsellingUI.update({ editingUpselling: upselling });

    const normalizedCustomFields = Array.isArray(upselling.custom_fields)
      ? upselling.custom_fields.map(field => ({
        ...field,
        options: Array.isArray(field.options)
          ? field.options
          : typeof field.options === 'string' && field.options.trim()
            ? field.options.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0)
            : [],
      }))
      : [];

    // DB columns: item, amount, discount (form keeps name, price, discount_value for UI)
    $upsellingForm.update({
      name: upselling.item ?? upselling.name ?? '',
      description: upselling.description || '',
      benefits: upselling.benefits || '',
      price: upselling.amount ?? upselling.price ?? '',
      quantity: upselling.quantity ?? '',
      sales_start: upselling.sales_start ? new Date(upselling.sales_start).toISOString().slice(0, 16) : '',
      sales_end: upselling.sales_end ? new Date(upselling.sales_end).toISOString().slice(0, 16) : '',
      custom_fields: normalizedCustomFields,
      images: Array.isArray(upselling.images) ? [...upselling.images] : [],
      upselling_strategy: upselling.upselling_strategy || 'PRE-CHECKOUT',
      discount_type: upselling.discount_type || 'NO_DISCOUNT',
      discount_value: upselling.discount ?? upselling.discount_value ?? '',
      quantity_rule: upselling.quantity_rule || 'ONLY_ONE',
      manage_inventory: upselling.manage_inventory || 'NO',
    });
  } else {
    $upsellingUI.update({ editingUpselling: null });
    $upsellingForm.reset();
  }
};

export const handleCloseModal = () => {
  $upsellingUI.update({
    showModal: false,
    editingUpselling: null,
  });
};

export const handleChange = (e) => {
  const { name, value } = e.target;
  $upsellingForm.update({ [name]: value });
};

export const handleSubmit = async (e, eventId, onUpdate) => {
  e.preventDefault();

  try {
    const formData = $upsellingForm.value;
    const { editingUpselling } = $upsellingUI.value;

    // Normalize custom_fields: ensure options are arrays for select/radio types
    const normalizedCustomFields = (formData.custom_fields || []).map(field => {
      const normalizedField = { ...field };
      // If field is select or radio and options is a string, parse it to array
      if ((field.type === 'select' || field.type === 'radio') && typeof field.options === 'string') {
        normalizedField.options = field.options
          .split(',')
          .map(opt => opt.trim())
          .filter(opt => opt.length > 0);
      }
      // Ensure options is always an array for select/radio, empty array for others
      if (field.type === 'select' || field.type === 'radio') {
        if (!Array.isArray(normalizedField.options)) {
          normalizedField.options = [];
        }
      } else {
        // Remove options for non-select/radio fields
        delete normalizedField.options;
      }
      return normalizedField;
    });

    const currentImages = Array.isArray($upsellingForm.value.images) ? $upsellingForm.value.images : [];

    // Payload uses DB column names: item, amount, discount, quantity_rule, manage_inventory, images, etc.
    const submitData = {
      event_id: eventId,
      item: formData.name?.trim() || '',
      upselling_strategy: formData.upselling_strategy,
      discount_type: formData.discount_type,
      discount: formData.discount_value ? parseFloat(formData.discount_value) : null,
      amount: parseFloat(formData.price),
      quantity_rule: formData.quantity_rule,
      manage_inventory: formData.manage_inventory,
      quantity: parseInt(formData.quantity, 10),
      sales_start: formData.sales_start || null,
      sales_end: formData.sales_end || null,
      custom_fields: normalizedCustomFields,
      images: currentImages,
    };

    if (editingUpselling) {
      await upsellingsAPI.update(editingUpselling.id, submitData);
      showToast('Upselling updated successfully', 'success');
    } else {
      await upsellingsAPI.create(submitData);
      showToast('Upselling created successfully', 'success');
    }

    handleCloseModal();
    onUpdate();
  } catch (error) {
    showToast('Error saving upselling', 'error');
  } finally {
    $upsellingForm.loadingEnd();
  }
};

export const handleDelete = async (id, onUpdate) => {
  if (!window.confirm('Are you sure you want to delete this upselling?')) return;

  try {
    await upsellingsAPI.delete(id);
    showToast('Upselling deleted successfully', 'success');
    onUpdate();
  } catch (error) {
    showToast('Error deleting upselling', 'error');
  }
};

export const addCustomField = () => {
  const currentFields = $upsellingForm.value.custom_fields;
  $upsellingForm.update({
    custom_fields: [
      ...currentFields,
      { label: '', type: 'text', required: false, placeholder: '', options: [] },
    ],
  });
};

export const updateCustomField = (idx, field) => {
  const currentFields = [...$upsellingForm.value.custom_fields];
  currentFields[idx] = { ...currentFields[idx], ...field };
  $upsellingForm.update({ custom_fields: currentFields });
};

export const removeCustomField = (idx) => {
  const currentFields = $upsellingForm.value.custom_fields.filter((_, i) => i !== idx);
  $upsellingForm.update({ custom_fields: currentFields });
};

export const addUpsellingImage = (url) => {
  const current = $upsellingForm.value.images || [];
  $upsellingForm.update({ images: [...current, url] });
};

export const removeUpsellingImage = (idx) => {
  const current = ($upsellingForm.value.images || []).filter((_, i) => i !== idx);
  $upsellingForm.update({ images: current });
};
