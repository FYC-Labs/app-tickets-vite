import { Row, Col, Form } from 'react-bootstrap';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { formatPhone } from '@src/components/global/Inputs/UniversalInput/_helpers/universalinput.events';
import { handleFieldChange } from '../_helpers/eventForm.events';

function ContactPreferences({ form: formProp, formData: formDataProp, readOnly = false }) {
  // Read directly from signal for reactivity, like Step1Checkout does
  const { form: embedForm, formData: embedFormData } = $embed.value;
  const form = formProp || embedForm;
  // Use signal formData for reactivity, fallback to prop for initial load
  const formData = embedFormData || formDataProp || {};

  const requestPhone = form?.request_phone_number === true;
  const requestPreference = form?.request_communication_preference === true;
  const showExtraFields = requestPhone || requestPreference;

  const phoneNumber = formData?.phone_number;
  const preferredChannel = formData?.preferred_channel;

  if (!showExtraFields) {
    return null;
  }

  // In read-only mode, check if we have at least one field with data to show
  if (readOnly) {
    const hasPhoneData = requestPhone && phoneNumber;
    const hasPreferenceData = requestPreference && preferredChannel;
    // Only show component if at least one requested field has data
    if (!hasPhoneData && !hasPreferenceData) {
      return null;
    }
  }

  // In edit mode, show phone only if SMS is selected
  // In read-only mode, show phone if it exists
  const showPhoneCol = requestPhone && (readOnly ? phoneNumber : preferredChannel === 'sms');
  const showPreferenceCol = requestPreference && (!readOnly || preferredChannel);
  const phoneColMd = showPreferenceCol ? 6 : 12;
  const preferenceColMd = showPhoneCol ? 6 : 12;

  return (
    <>
      <Form.Group className="mb-24">
        <h6 className="mb-16 fw-semibold">Contact preferences</h6>
        <Row>
          {showPreferenceCol && (
            <Col xs={12} md={preferenceColMd} className={showPhoneCol ? 'mb-16 mb-md-0' : ''}>
              {readOnly && preferredChannel ? (
                <div>
                  <small className="text-muted d-block mb-4">How would you like to be contacted?</small>
                  <div>
                    {preferredChannel === 'email' && 'Email'}
                    {preferredChannel === 'sms' && 'SMS'}
                    {preferredChannel !== 'email' && preferredChannel !== 'sms' && preferredChannel}
                  </div>
                </div>
              ) : null}
              {!readOnly && (
                <Form.Group>
                  <Form.Label className="small">How would you like to be contacted during the event?</Form.Label>
                  <UniversalInput
                    as="select"
                    name="preferred_channel"
                    value={preferredChannel ?? ''}
                    customOnChange={(e) => handleFieldChange('preferred_channel', e.target.value)}
                    className="form-control"
                    required
                  >
                    <option value="">Select...</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </UniversalInput>
                </Form.Group>
              )}
            </Col>
          )}
          {showPhoneCol && (
            <Col xs={12} md={phoneColMd}>
              {readOnly && phoneNumber ? (
                <div>
                  <small className="text-muted d-block mb-4">Phone number</small>
                  <div>{phoneNumber}</div>
                </div>
              ) : null}
              {!readOnly && (
                <Form.Group>
                  <Form.Label className="small">Phone number</Form.Label>
                  <UniversalInput
                    type="tel"
                    name="phone_number"
                    value={phoneNumber ?? ''}
                    customOnChange={(e) => handleFieldChange('phone_number', formatPhone(e.target.value))}
                    placeholder="(555) 123-4567"
                    className="form-control"
                  />
                </Form.Group>
              )}
            </Col>
          )}
        </Row>
      </Form.Group>
    </>
  );
}

export default ContactPreferences;
