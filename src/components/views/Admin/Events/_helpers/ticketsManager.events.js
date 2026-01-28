import { Signal } from '@fyclabs/tools-fyc-react/signals';
import ticketsAPI from '@src/api/tickets.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';

export const $ticketForm = Signal({
  name: '',
  description: '',
  benefits: '',
  price: '',
  quantity: '',
  sales_start: '',
  sales_end: '',
  custom_fields: [],
});

export const $ticketUI = Signal({
  showModal: false,
  editingTicket: null,
});

export const handleOpenModal = (ticket = null) => {
  if (ticket) {
    $ticketUI.update({
      showModal: true,
      editingTicket: ticket,
    });
    $ticketForm.update({
      name: ticket.name,
      description: ticket.description || '',
      benefits: ticket.benefits || '',
      price: ticket.price,
      quantity: ticket.quantity,
      sales_start: new Date(ticket.sales_start).toISOString().slice(0, 16),
      sales_end: new Date(ticket.sales_end).toISOString().slice(0, 16),
      custom_fields: Array.isArray(ticket.custom_fields) ? ticket.custom_fields : [],
    });
  } else {
    $ticketUI.update({
      showModal: true,
      editingTicket: null,
    });
    $ticketForm.reset();
  }
};

/** Loads ticket into form for inline editing (e.g. in FormEditModal Tickets tab). Does NOT set showModal. */
export const loadTicketFormForInline = (ticket = null) => {
  if (ticket) {
    $ticketUI.update({ editingTicket: ticket });
    $ticketForm.update({
      name: ticket.name,
      description: ticket.description || '',
      benefits: ticket.benefits || '',
      price: ticket.price,
      quantity: ticket.quantity,
      sales_start: new Date(ticket.sales_start).toISOString().slice(0, 16),
      sales_end: new Date(ticket.sales_end).toISOString().slice(0, 16),
      custom_fields: Array.isArray(ticket.custom_fields) ? ticket.custom_fields : [],
    });
  } else {
    $ticketUI.update({ editingTicket: null });
    $ticketForm.reset();
  }
};

export const handleCloseModal = () => {
  $ticketUI.update({
    showModal: false,
    editingTicket: null,
  });
};

export const handleChange = (e) => {
  const { name, value } = e.target;
  $ticketForm.update({ [name]: value });
};

export const handleSubmit = async (e, eventId, onUpdate) => {
  e.preventDefault();

  try {
    const formData = $ticketForm.value;
    const { editingTicket } = $ticketUI.value;

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

    if (editingTicket) {
      await ticketsAPI.update(editingTicket.id, submitData);
      showToast('Ticket updated successfully', 'success');
    } else {
      await ticketsAPI.create(submitData);
      showToast('Ticket created successfully', 'success');
    }

    handleCloseModal();
    onUpdate();
  } catch (error) {
    showToast('Error saving ticket', 'error');
  }
};

export const handleDelete = async (id, onUpdate) => {
  if (!window.confirm('Are you sure you want to delete this ticket type?')) return;

  try {
    await ticketsAPI.delete(id);
    showToast('Ticket deleted successfully', 'success');
    onUpdate();
  } catch (error) {
    showToast('Error deleting ticket', 'error');
  }
};

export const addCustomField = () => {
  const currentFields = $ticketForm.value.custom_fields;
  $ticketForm.update({
    custom_fields: [
      ...currentFields,
      { label: '', type: 'text', required: false, placeholder: '', options: [] },
    ],
  });
};

export const updateCustomField = (idx, field) => {
  const currentFields = [...$ticketForm.value.custom_fields];
  currentFields[idx] = { ...currentFields[idx], ...field };
  $ticketForm.update({ custom_fields: currentFields });
};

export const removeCustomField = (idx) => {
  const currentFields = $ticketForm.value.custom_fields.filter((_, i) => i !== idx);
  $ticketForm.update({ custom_fields: currentFields });
};
