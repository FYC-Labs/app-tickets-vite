import { Card } from 'react-bootstrap';
import { $embed } from '@src/signals';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import { handleFieldChange } from '../_helpers/eventForm.events';

function AdditionalInformation() {
  const { form, formData } = $embed.value;

  if (!form?.schema || form.schema.length === 0) {
    return null;
  }

  const renderFormSchemaField = (field, index) => {
    const key = field.field_id_string != null ? field.field_id_string : field.label;
    const value = formData?.[key] ?? '';
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
    <Card className="mt-32 border-0">
      <Card.Body className="p-24">
        <h6 className="mb-16 fw-semibold">Additional information</h6>
        {form.schema.map((field, index) => renderFormSchemaField(field, index))}
      </Card.Body>
    </Card>
  );
}

export default AdditionalInformation;
