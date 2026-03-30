import { Form, Row, Col, Alert } from 'react-bootstrap';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import AdditionalHoldersForm from '@src/components/embed/AdditionalHoldersForm';
import { handleFieldChange } from '../_helpers/eventForm.events';
import TicketSelection from './TicketSelection';

function Step1Checkout({ theme = 'light' }) {
  const getThemeBgClass = () => {
    switch (theme) {
      case 'dark':
        return 'bg-grey-800';
      case 'scale-up':
        return 'bg-primary-900';
      case 'transparent':
        return 'bg-transparent';
      default:
        return 'bg-light-200';
    }
  };

  return (
    <>
      {$embed.value.form && (
        <div className="mb-32">
          {$embed.value.form.show_title !== false && <h3>{$embed.value.form.name}</h3>}
          {$embed.value.form.show_description !== false && $embed.value.form.description && <p className="text-muted">{$embed.value.form.description}</p>}
        </div>
      )}

      {$embed.value.error && <Alert variant="danger">{$embed.value.error}</Alert>}

      <Form className={`${getThemeBgClass()} rounded-15 p-16 mb-16`}>
        <Form.Group className="mb-24">
          <Row>
            <Col md={12} className="mb-16">
              <Form.Label>Email *</Form.Label>
              <UniversalInput
                type="email"
                name="email"
                placeholder="your@email.com"
                value={$embed.value.formData.email || ''}
                customOnChange={(e) => handleFieldChange('email', e.target.value)}
                required
              />
            </Col>
            <Col md={12}>
              <Form.Label>First Name *</Form.Label>
              <UniversalInput
                type="text"
                name="first_name"
                placeholder="Your name"
                value={$embed.value.formData.first_name || ''}
                customOnChange={(e) => handleFieldChange('first_name', e.target.value)}
                required
              />
            </Col>
            <Col md={12} className="mt-16">
              <Form.Label>Last Name *</Form.Label>
              <UniversalInput
                type="text"
                name="last_name"
                placeholder="Your name"
                value={$embed.value.formData.last_name || ''}
                customOnChange={(e) => handleFieldChange('last_name', e.target.value)}
                required
              />
            </Col>
          </Row>
        </Form.Group>
        <TicketSelection />
        <AdditionalHoldersForm />
      </Form>
    </>
  );
}

export default Step1Checkout;
