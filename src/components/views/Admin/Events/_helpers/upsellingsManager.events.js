import { Signal } from '@fyclabs/tools-fyc-react/signals';
import { upsellingsAPI } from '@src/api/upsellings.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';

export const $upsellingForm = Signal({
  name: '',
  description: '',
  benefits: '',
  price: '',
  quantity: '',
  sales_start: '',
  sales_end: '',
  custom_fields: [],
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
  } else {
    $upsellingUI.update({
      showModal: true,
      editingUpselling: null,
    });
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

    const submitData = {
      name: formData.name,
      description: formData.description,
      benefits: formData.benefits,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity, 10),
      sales_start: formData.sales_start,
      sales_end: formData.sales_end,
      custom_fields: formData.custom_fields,
      event_id: eventId,
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
