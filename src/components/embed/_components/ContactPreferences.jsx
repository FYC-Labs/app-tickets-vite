import { Card, Row, Col, Form } from 'react-bootstrap';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { formatPhone } from '@src/components/global/Inputs/UniversalInput/_helpers/universalinput.events';
import { handleFieldChange } from '../_helpers/eventForm.events';

function ContactPreferences() {
  const { form, formData } = $embed.value;
  const requestPhone = form?.request_phone_number === true;
  const requestPreference = form?.request_communication_preference === true;
  const showExtraFields = requestPhone || requestPreference;

  if (!showExtraFields) {
    return null;
  }

  return (
    <Card className="mt-32 border-0">
      <Card.Body className="p-24">
        <h6 className="mb-16 fw-semibold">Contact preferences</h6>
        <Row>
          {requestPhone && (
            <Col xs={12} md={requestPreference ? 6 : 12} className="mb-16 mb-md-0">
              <Form.Group>
                <Form.Label className="small">Phone number</Form.Label>
                <UniversalInput
                  type="tel"
                  name="phone_number"
                  value={formData?.phone_number ?? ''}
                  customOnChange={(e) => handleFieldChange('phone_number', formatPhone(e.target.value))}
                  placeholder="(555) 123-4567"
                  className="form-control"
                />
              </Form.Group>
            </Col>
          )}
          {requestPreference && (
            <Col xs={12} md={requestPhone ? 6 : 12}>
              <Form.Group>
                <Form.Label className="small">How would you like to be contacted? *</Form.Label>
                <UniversalInput
                  as="select"
                  name="preferred_channel"
                  value={formData?.preferred_channel ?? ''}
                  customOnChange={(e) => handleFieldChange('preferred_channel', e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">Select...</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </UniversalInput>
              </Form.Group>
            </Col>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
}

export default ContactPreferences;
