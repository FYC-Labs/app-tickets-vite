import { Signal } from '@fyclabs/tools-fyc-react/signals';
import eventsAPI from '@src/api/events.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';
import { $user } from '@src/signals';

export const $eventForm = Signal({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  location: '',
  location_lat: null,
  location_lng: null,
  location_place_id: '',
  image_url: '',
  capacity: '',
  status: 'DRAFT',
  customerio_app_api_key: '',
  customerio_transactional_template_id: '',
  customerio_site_id: '',
  customerio_track_api_key: '',
  customerio_custom_attribute_key: '',
  customerio_custom_attribute_value: '',
  accrupay_environment: '',
});

export const loadEvent = async (id) => {
  try {
    $eventForm.loadingStart();
    const data = await eventsAPI.getById(id);
    $eventForm.update({
      title: data.title || '',
      description: data.description || '',
      start_date: data.start_date ? new Date(data.start_date).toISOString().slice(0, 16) : '',
      end_date: data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) : '',
      location: data.location || '',
      location_lat: data.location_lat || null,
      location_lng: data.location_lng || null,
      location_place_id: data.location_place_id || '',
      image_url: data.image_url || '',
      capacity: data.capacity || '',
      status: data.status || 'DRAFT',
      customerio_app_api_key: data.customerio_app_api_key || '',
      customerio_transactional_template_id: data.customerio_transactional_template_id || '',
      customerio_site_id: data.customerio_site_id || '',
      customerio_track_api_key: data.customerio_track_api_key || '',
      customerio_custom_attribute_key: data.customerio_custom_attribute_key || '',
      customerio_custom_attribute_value: data.customerio_custom_attribute_value || '',
      accrupay_environment: data.accrupay_environment || '',
    });
  } catch (error) {
    showToast('Error loading event', 'error');
  } finally {
    $eventForm.loadingEnd();
  }
};

export const handleChange = (e) => {
  const { name, value } = e.target;
  $eventForm.update({ [name]: value });
};

export const handleSubmit = async (e, id, navigate) => {
  e.preventDefault();

  const formData = $eventForm.value;

  if (!formData.title || !formData.start_date || !formData.end_date) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    $eventForm.loadingStart();
    const submitData = {
      title: formData.title,
      description: formData.description,
      start_date: formData.start_date,
      end_date: formData.end_date,
      location: formData.location,
      location_lat: formData.location_lat,
      location_lng: formData.location_lng,
      location_place_id: formData.location_place_id,
      image_url: formData.image_url,
      capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
      status: formData.status,
      customerio_app_api_key: formData.customerio_app_api_key || null,
      customerio_transactional_template_id: formData.customerio_transactional_template_id || null,
      customerio_site_id: formData.customerio_site_id || null,
      customerio_track_api_key: formData.customerio_track_api_key || null,
      customerio_custom_attribute_key: formData.customerio_custom_attribute_key || null,
      customerio_custom_attribute_value: formData.customerio_custom_attribute_value || null,
      accrupay_environment: formData.accrupay_environment || null,
    };

    if (id) {
      await eventsAPI.update(id, submitData);
      showToast('Event updated successfully', 'success');
    } else {
      // Add created_by field when creating a new event
      const userData = $user.value;
      if (userData?.id) {
        submitData.created_by = userData.id;
      } else {
        throw new Error('User not authenticated. Please log in and try again.');
      }
      await eventsAPI.create(submitData);
      showToast('Event created successfully', 'success');
    }
    navigate('/admin/events');
  } catch (error) {
    showToast(error.message || `Error ${id ? 'updating' : 'creating'} event`, 'error');
  } finally {
    $eventForm.loadingEnd();
  }
};
