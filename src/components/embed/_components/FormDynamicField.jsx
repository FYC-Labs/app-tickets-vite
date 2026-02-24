import { Form } from 'react-bootstrap';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { formatPhone } from '@src/components/global/Inputs/UniversalInput/_helpers/universalinput.events';

function FormDynamicField({
  field,
  index,
  value,
  onChange,
  name,
  groupClassName = 'mb-24',
  labelClassName,
  selectPlaceholder,
}) {
  const labelRequired = (
    <>
      {field.label} {field.required && <span className="text-danger">*</span>}
    </>
  );

  const controlName = name || `field_${index}`;
  const groupClass = groupClassName;

  switch (field.type) {
    case 'textarea':
      return (
        <Form.Group key={index} className={groupClass}>
          <Form.Label className={labelClassName}>{labelRequired}</Form.Label>
          <UniversalInput
            as="textarea"
            rows={3}
            name={controlName}
            placeholder={field.placeholder}
            value={value}
            customOnChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
          {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
        </Form.Group>
      );

    case 'select':
      return (
        <Form.Group key={index} className={groupClass}>
          <Form.Label className={labelClassName}>{labelRequired}</Form.Label>
          <UniversalInput
            as="select"
            name={controlName}
            value={value}
            customOnChange={(e) => onChange(e.target.value)}
            required={field.required}
          >
            <option value="">{selectPlaceholder || 'Select...'}</option>
            {field.options?.map((option, i) => (
              <option key={i} value={option}>
                {option}
              </option>
            ))}
          </UniversalInput>
          {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
        </Form.Group>
      );

    case 'checkbox':
      return (
        <Form.Group key={index} className={groupClass}>
          <UniversalInput
            type="checkbox"
            name={controlName}
            label={field.label}
            checked={!!value}
            customOnChange={(e) => onChange(e.target.checked)}
            required={field.required}
          />
          {field.instructions && <Form.Text className="text-muted d-block">{field.instructions}</Form.Text>}
        </Form.Group>
      );

    case 'radio':
      return (
        <Form.Group key={index} className={groupClass}>
          <Form.Label className={labelClassName}>{labelRequired}</Form.Label>
          <div>
            {field.options?.map((option, i) => (
              <Form.Check
                key={i}
                type="radio"
                label={option}
                name={controlName}
                value={option}
                checked={value === option}
                onChange={(e) => onChange(e.target.value)}
                required={field.required}
              />
            ))}
          </div>
          {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
        </Form.Group>
      );

    case 'tel':
      return (
        <Form.Group key={index} className={groupClass}>
          <Form.Label className={labelClassName}>{labelRequired}</Form.Label>
          <UniversalInput
            type="tel"
            name={controlName}
            placeholder={field.placeholder || '(123) 456-7890'}
            value={value}
            customOnChange={(e) => {
              const inputValue = e.target.value;
              const digitsOnly = inputValue.replace(/\D/g, '');
              const limitedDigits = digitsOnly.slice(0, 10);
              const formatted = formatPhone(limitedDigits);
              onChange(formatted);
            }}
            required={field.required}
            maxLength={14}
          />
          {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
        </Form.Group>
      );

    default:
      return (
        <Form.Group key={index} className={groupClass}>
          <Form.Label className={labelClassName}>{labelRequired}</Form.Label>
          <UniversalInput
            type={field.type}
            name={controlName}
            placeholder={field.placeholder}
            value={value}
            customOnChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
          {field.instructions && <Form.Text className="text-muted">{field.instructions}</Form.Text>}
        </Form.Group>
      );
  }
}

export default FormDynamicField;

