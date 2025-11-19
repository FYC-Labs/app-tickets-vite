import { Signal } from '@fyclabs/tools-fyc-react/signals';
import formsAPI from '@src/api/forms.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';
import { $forms } from '@src/signals';
import { $formsView } from './formsManager.consts';

export const $formManagerForm = Signal({
  name: '',
  description: '',
  available_ticket_ids: [],
  schema: [],
  is_published: false,
  show_title: true,
  show_description: true,
  show_discount_code: true,
  show_tickets_remaining: true,
  theme: 'light',
  order_confirmation_url: '',
});

export const $formManagerUI = Signal({
  showModal: false,
  showEmbedModal: false,
  editingForm: null,
  embedCode: '',
  eventListenerCode: '',
});

export const $currentFormField = Signal({
  type: 'text',
  label: '',
  placeholder: '',
  instructions: '',
  required: false,
  options: [],
  optionsString: '',
});

export const loadForms = async (eventId) => {
  try {
    $forms.loadingStart();
    $formsView.update({ isTableLoading: true });
    const data = await formsAPI.getAll({ event_id: eventId });
    $forms.update({ list: data || [] });
  } catch (error) {
    showToast('Error loading forms', 'error');
  } finally {
    $forms.loadingEnd();
    $formsView.update({ isTableLoading: false });
  }
};

export const handleOpenModal = (form = null) => {
  if (form) {
    $formManagerForm.update({
      name: form.name,
      description: form.description || '',
      available_ticket_ids: form.available_ticket_ids || [],
      schema: form.schema || [],
      is_published: form.is_published || false,
      show_title: form.show_title !== undefined ? form.show_title : true,
      show_description: form.show_description !== undefined ? form.show_description : true,
      show_discount_code: form.show_discount_code !== undefined ? form.show_discount_code : true,
      show_tickets_remaining: form.show_tickets_remaining !== undefined ? form.show_tickets_remaining : true,
      theme: form.theme || 'light',
      order_confirmation_url: form.order_confirmation_url || '',
    });
    $formManagerUI.update({
      showModal: true,
      editingForm: form,
    });
  } else {
    $formManagerForm.reset();
    $formManagerUI.update({
      showModal: true,
      editingForm: null,
    });
  }
};

export const handleCloseModal = () => {
  $formManagerUI.update({
    showModal: false,
    editingForm: null,
  });
  $formManagerForm.reset();
  $currentFormField.reset();
};

export const handleChange = (e) => {
  const { name, value, type, checked } = e.target;
  const newValue = type === 'checkbox' ? checked : value;

  // Try setting the entire object to force reactivity
  $formManagerForm.value = {
    ...$formManagerForm.value,
    [name]: newValue,
  };
};

export const handleTicketSelection = (ticketId) => {
  const currentIds = $formManagerForm.value.available_ticket_ids;
  const isSelected = currentIds.includes(ticketId);

  const newIds = isSelected
    ? currentIds.filter(id => id !== ticketId)
    : [...currentIds, ticketId];

  // Try setting the entire object to force reactivity
  $formManagerForm.value = {
    ...$formManagerForm.value,
    available_ticket_ids: newIds,
  };
};

export const handleFieldChange = (e) => {
  const { name, value, type: inputType, checked } = e.target;
  const newValue = inputType === 'checkbox' ? checked : value;

  // Try setting the entire object to force reactivity
  $currentFormField.value = {
    ...$currentFormField.value,
    [name]: newValue,
  };
};


export const handleAddField = () => {
  const currentField = $currentFormField.value;

  if (!currentField.label) {
    showToast('Please enter a field label', 'error');
    return;
  }

  // Convert optionsString to options array
  const fieldToAdd = { ...currentField };
  if (currentField.optionsString) {
    fieldToAdd.options = currentField.optionsString
      .split(',')
      .map((opt) => opt.trim())
      .filter((opt) => opt);
  }
  delete fieldToAdd.optionsString;

  const currentSchema = $formManagerForm.value.schema;
  $formManagerForm.value = {
    ...$formManagerForm.value,
    schema: [...currentSchema, fieldToAdd],
  };

  $currentFormField.reset();
};

export const handleEditField = (index) => {
  const fields = $formManagerForm.value.schema;
  const field = fields[index];
  
  // Convert options array back to string for editing
  const fieldToEdit = { ...field };
  if (field.options && Array.isArray(field.options)) {
    fieldToEdit.optionsString = field.options.join(', ');
  }
  
  $currentFormField.value = fieldToEdit;

  // Remove the field temporarily - will be re-added on "Add Field"
  const newSchema = fields.filter((_, i) => i !== index);
  $formManagerForm.value = {
    ...$formManagerForm.value,
    schema: newSchema,
  };
};

export const handleDeleteField = (index) => {
  const fields = $formManagerForm.value.schema.filter((_, i) => i !== index);
  $formManagerForm.value = {
    ...$formManagerForm.value,
    schema: fields,
  };
};

export const moveField = (fromIndex, toIndex) => {
  const newFields = [...$formManagerForm.value.schema];
  const [removed] = newFields.splice(fromIndex, 1);
  newFields.splice(toIndex, 0, removed);
  $formManagerForm.value = {
    ...$formManagerForm.value,
    schema: newFields,
  };
};

// Validate URL format (allows localhost)
const validateUrl = (url) => {
  if (!url || url.trim() === '') return true; // Empty is valid (optional field)
  const urlPattern = /^(https?:\/\/|http:\/\/localhost|https:\/\/localhost)/i;
  return urlPattern.test(url.trim());
};

export const handleSubmit = async (e, eventId, onUpdate) => {
  e.preventDefault();

  const formData = $formManagerForm.value;

  if (!formData.name) {
    showToast('Please enter a form name', 'error');
    return;
  }

  // Validate order_confirmation_url if provided
  if (formData.order_confirmation_url && !validateUrl(formData.order_confirmation_url)) {
    showToast('Please enter a valid URL (e.g., https://example.com or http://localhost:3000)', 'error');
    return;
  }

  try {
    $formManagerForm.loadingStart();

    const submitData = {
      name: formData.name,
      description: formData.description,
      event_id: eventId,
      available_ticket_ids: formData.available_ticket_ids,
      schema: formData.schema,
      is_published: formData.is_published,
      show_title: formData.show_title,
      show_description: formData.show_description,
      show_discount_code: formData.show_discount_code,
      show_tickets_remaining: formData.show_tickets_remaining,
      theme: formData.theme,
      order_confirmation_url: formData.order_confirmation_url || null,
    };

    const { editingForm } = $formManagerUI.value;

    if (editingForm) {
      await formsAPI.update(editingForm.id, submitData);
      showToast('Form updated successfully', 'success');
    } else {
      // Add created_by field when creating a new form
      const { $user } = await import('@src/signals');
      const userData = $user.value;
      if (userData?.id) {
        submitData.created_by = userData.id;
      } else {
        throw new Error('User not authenticated. Please log in and try again.');
      }

      await formsAPI.create(submitData);
      showToast('Form created successfully', 'success');
    }

    handleCloseModal();
    if (onUpdate) await onUpdate();
  } catch (error) {
    showToast(error.message || 'Error saving form', 'error');
  } finally {
    $formManagerForm.loadingEnd();
  }
};

export const handleDelete = async (formId, eventId) => {
  if (!confirm('Are you sure you want to delete this form?')) {
    return;
  }

  try {
    await formsAPI.delete(formId);
    showToast('Form deleted successfully', 'success');
    await loadForms(eventId);
  } catch (error) {
    showToast('Error deleting form', 'error');
  }
};

export const handlePublish = async (formId, isPublished, eventId) => {
  try {
    if (isPublished) {
      await formsAPI.unpublish(formId);
      showToast('Form unpublished', 'success');
    } else {
      await formsAPI.publish(formId);
      showToast('Form published', 'success');
    }
    await loadForms(eventId);
  } catch (error) {
    showToast('Error updating form status', 'error');
  }
};

export const handleShowEmbed = (formId) => {
  const embedCode = `<iframe 
  src="${window.location.origin}/embed/form/${formId}?embed=true" 
  width="100%" 
  height="800"
  frameborder="0"
  style="border: none; border-radius: 8px;">
</iframe>`;

  const eventListenerCode = `// Listen for order complete event from iframe
window.addEventListener('message', (event) => {
  // Verify origin for security (replace with your iframe domain)
  // if (event.origin !== 'https://your-domain.com') return;
  
  if (event.data && event.data.type === 'order-complete') {
    const { redirectUrl, orderDetails, order } = event.data;
    
    // Redirect to confirmation page
    window.location.href = redirectUrl;
    
    // Or handle the redirect manually with order details:
    // window.location.href = redirectUrl;
  }
});`;

  $formManagerUI.update({
    showEmbedModal: true,
    embedCode,
    eventListenerCode,
  });
};

export const handleCloseEmbedModal = () => {
  $formManagerUI.update({
    showEmbedModal: false,
    embedCode: '',
    eventListenerCode: '',
  });
};

export const handleCopyEmbed = () => {
  const { embedCode } = $formManagerUI.value;
  navigator.clipboard.writeText(embedCode);
  showToast('Embed code copied to clipboard', 'success');
};

export const handleCopyEventListener = () => {
  const { eventListenerCode } = $formManagerUI.value;
  navigator.clipboard.writeText(eventListenerCode);
  showToast('Event listener code copied to clipboard', 'success');
};
