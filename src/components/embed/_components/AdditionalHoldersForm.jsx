/* eslint-disable arrow-body-style */
import { Form, Row, Col } from 'react-bootstrap';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { $embed } from '@src/signals';
import { handleAdditionalHolderFieldChange, getEmbedPageBgClass, getAdditionalHoldersRequiredCount } from '../_helpers/eventForm.events';

function AdditionalHoldersForm() {
  const selectedTickets = $embed.value.selectedTickets || {};
  const formData = $embed.value.formData || {};
  const additionalHoldersCount = getAdditionalHoldersRequiredCount(selectedTickets);

  if (additionalHoldersCount <= 0) {
    return null;
  }

  const attendeeLabel = {
    0: 'Primary Holder',
    1: 'Second Attendee Information',
    2: 'Third Attendee Information',
    3: 'Fourth Attendee Information',
    4: 'Fifth Attendee Information',
    5: 'Sixth Attendee Information',
    6: 'Seventh Attendee Information',
    7: 'Eighth Attendee Information',
    8: 'Ninth Attendee Information',
    9: 'Tenth Attendee Information',
  };

  return (
    <Form className={`${getEmbedPageBgClass()} rounded-15 p-16 mb-16`}>
      <Form.Group className="mb-24">
        <Row>
          {Array.from({ length: additionalHoldersCount }).map((_, index) => (
            <Row key={`holder-${index}`} className="g-0">
              <Col md={12} className="mb-16">
                <Form.Label>{attendeeLabel[index + 1]}</Form.Label>
                <UniversalInput
                  type="text"
                  name={`holder_${index + 1}_name`}
                  placeholder="Enter full name"
                  value={formData[`holder_${index + 1}_name`] || ''}
                  customOnChange={(e) => handleAdditionalHolderFieldChange(`holder_${index + 1}_name`, e.target.value)}
                  required
                />
              </Col>
              <Col md={12} className="mb-16">
                <Form.Label>Email</Form.Label>
                <UniversalInput
                  type="email"
                  name={`holder_${index + 1}_email`}
                  placeholder="Enter email"
                  value={formData[`holder_${index + 1}_email`] || ''}
                  customOnChange={(e) => handleAdditionalHolderFieldChange(`holder_${index + 1}_email`, e.target.value)}
                  required
                />
              </Col>
            </Row>
          ))}
        </Row>
      </Form.Group>
    </Form>
  );
}

export default AdditionalHoldersForm;
