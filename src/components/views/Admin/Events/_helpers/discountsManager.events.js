import { Signal } from '@fyclabs/tools-fyc-react/signals';
import discountsAPI from '@src/api/discounts.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';
import { $discounts } from '@src/signals';

export const $discountForm = Signal({
  code: '',
  type: 'PERCENT',
  value: '',
  max_uses: '',
  expires_at: '',
  is_active: true,
});

export const $discountUI = Signal({
  showModal: false,
  editingDiscount: null,
});

export const loadDiscounts = async (eventId) => {
  try {
    $discounts.loadingStart();
    const data = await discountsAPI.getByEventId(eventId);
    $discounts.update({ list: data });
  } catch (error) {
    showToast('Error loading discounts', 'error');
  } finally {
    $discounts.loadingEnd();
  }
};

export const handleOpenModal = (discount = null) => {
  if (discount) {
    $discountUI.update({
      showModal: true,
      editingDiscount: discount,
    });
    $discountForm.update({
      code: discount.code,
      type: discount.type,
      value: discount.value,
      max_uses: discount.max_uses || '',
      expires_at: discount.expires_at ? new Date(discount.expires_at).toISOString().slice(0, 16) : '',
      is_active: discount.is_active,
    });
  } else {
    $discountUI.update({
      showModal: true,
      editingDiscount: null,
    });
    $discountForm.reset();
  }
};

/** Loads discount into form for inline editing (e.g. in FormEditModal Discounts tab). Does NOT set showModal. */
export const loadDiscountFormForInline = (discount = null) => {
  if (discount) {
    $discountUI.update({ editingDiscount: discount });
    $discountForm.update({
      code: discount.code,
      type: discount.type,
      value: discount.value,
      max_uses: discount.max_uses || '',
      expires_at: discount.expires_at ? new Date(discount.expires_at).toISOString().slice(0, 16) : '',
      is_active: discount.is_active,
    });
  } else {
    $discountUI.update({ editingDiscount: null });
    $discountForm.reset();
  }
};

export const handleCloseModal = () => {
  $discountUI.update({
    showModal: false,
    editingDiscount: null,
  });
};

export const handleChange = (e) => {
  const { name, value, type: inputType, checked } = e.target;
  $discountForm.update({
    [name]: inputType === 'checkbox' ? checked : value,
  });
};

export const handleSubmit = async (e, eventId, onUpdate) => {
  e.preventDefault();

  try {
    const formData = $discountForm.value;
    const { editingDiscount } = $discountUI.value;

    const submitData = {
      code: formData.code.toUpperCase(),
      type: formData.type,
      value: parseFloat(formData.value),
      max_uses: formData.max_uses ? parseInt(formData.max_uses, 10) : null,
      expires_at: formData.expires_at || null,
      is_active: formData.is_active,
      event_id: eventId,
    };

    if (editingDiscount) {
      await discountsAPI.update(editingDiscount.id, submitData);
      showToast('Discount updated successfully', 'success');
    } else {
      await discountsAPI.create(submitData);
      showToast('Discount created successfully', 'success');
    }

    handleCloseModal();
    if (typeof onUpdate === 'function') {
      await onUpdate();
    } else {
      await loadDiscounts(eventId);
    }
  } catch (error) {
    showToast('Error saving discount', 'error');
  }
};

export const handleDelete = async (id, eventId, onUpdate) => {
  if (!window.confirm('Are you sure you want to delete this discount code?')) return;

  try {
    await discountsAPI.delete(id);
    showToast('Discount deleted successfully', 'success');
    if (typeof onUpdate === 'function') {
      onUpdate();
    } else {
      await loadDiscounts(eventId);
    }
  } catch (error) {
    showToast('Error deleting discount', 'error');
  }
};

export const handleToggleActive = async (discount, eventId, onUpdate) => {
  try {
    await discountsAPI.update(discount.id, { is_active: !discount.is_active });
    showToast(`Discount ${!discount.is_active ? 'activated' : 'deactivated'}`, 'success');
    if (typeof onUpdate === 'function') {
      onUpdate();
    } else {
      await loadDiscounts(eventId);
    }
  } catch (error) {
    showToast('Error updating discount', 'error');
  }
};
