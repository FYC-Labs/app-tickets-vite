import { $embed } from '@src/signals';
import { Form } from 'react-bootstrap';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import { handleFieldChange } from '../_helpers/eventForm.events';

function AdditionalInformation({ form: formProp, formData: formDataProp, readOnly = false }) {
  // Read directly from signal for reactivity, like Step1Checkout does
  const { form: embedForm, formData: embedFormData } = $embed.value;
  const form = formProp || embedForm;
  // Use signal formData for reactivity, fallback to prop for initial load
  const formData = embedFormData || formDataProp || {};

  if (!form?.schema || form.schema.length === 0) {
    return null;
  }

  // In read-only mode, check if there's any data
  if (readOnly) {
    const hasData = form.schema.some((field) => {
      const key = field.field_id_string != null ? field.field_id_string : field.label;
      const value = formData?.[key];
      return value != null && value !== '';
    });
    if (!hasData) {
      return null;
    }
  }

  const renderFieldValue = (field, value) => {
    if (value == null || value === '') {
      return null;
    }

    switch (field.type) {
      case 'checkbox':
        return value ? 'Yes' : 'No';
      case 'radio':
      case 'select':
        return value;
      case 'textarea':
        return <div className="text-break">{value}</div>;
      default:
        return value;
    }
  };

  const renderFormSchemaField = (field, index) => {
    const key = field.field_id_string != null ? field.field_id_string : field.label;
    const value = formData?.[key] ?? '';

    if (readOnly) {
      if (value == null || value === '') {
        return null;
      }
      return (
        <div key={index} className="mb-16">
          <small className="text-muted d-block mb-4">{field.label}</small>
          <div>{renderFieldValue(field, value)}</div>
        </div>
      );
    }

    return (
      <FormDynamicField
        key={index}
        field={field}
        index={index}
        value={value}
        groupClassName="mb-16"
        labelClassName="small"
        selectPlaceholder={field.placeholder || 'Select...'}
        onChange={(newValue) => handleFieldChange(field.label, newValue, field.field_id_string)}
      />
    );
  };

  return (
    <>
      <Form.Group className="mb-24">
        <h6 className="mb-16 fw-semibold">Additional information</h6>
        {form.schema.map((field, index) => renderFormSchemaField(field, index))}
      </Form.Group>
    </>
  );
}

export default AdditionalInformation;
