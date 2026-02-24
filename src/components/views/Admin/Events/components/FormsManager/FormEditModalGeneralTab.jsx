import { Form, Row, Col } from 'react-bootstrap';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { $formManagerForm } from '../../_helpers/formsManager.events';

function FormEditModalGeneralTab() {
  return (
    <Row>
      <Col lg={12}>
        <Form.Group className="mb-24">
          <Form.Label>Form Name *</Form.Label>
          <UniversalInput
            type="text"
            name="name"
            signal={$formManagerForm}
            required
          />
        </Form.Group>

        <Form.Group className="mb-24">
          <Form.Label>Form Instructions</Form.Label>
          <UniversalInput
            as="textarea"
            rows={3}
            name="description"
            signal={$formManagerForm}
            placeholder="Add custom instructions or context for this specific form embed..."
          />
          <Form.Text className="text-muted">
            These instructions are unique to this form embed
          </Form.Text>
        </Form.Group>

        <Form.Group className="mb-24">
          <Form.Label>Upsellings Display</Form.Label>
          <UniversalInput
            as="select"
            name="upsellings_display"
            signal={$formManagerForm}
          >
            <option value="LIST">List</option>
            <option value="CAROUSEL">Carousel</option>
          </UniversalInput>
          <Form.Text className="text-muted">
            Choose how to display the upsellings (if any) in the form embed
          </Form.Text>
        </Form.Group>

        <div className="mb-24">
          <Form.Label className="d-block mb-16">Display Options</Form.Label>
          <UniversalInput
            type="checkbox"
            name="is_published"
            signal={$formManagerForm}
            label="Publish form (make it live)"
          />
          <UniversalInput
            type="checkbox"
            name="show_title"
            signal={$formManagerForm}
            label="Show form title"
          />
          <UniversalInput
            type="checkbox"
            name="show_description"
            signal={$formManagerForm}
            label="Show form instructions"
          />
          <UniversalInput
            type="checkbox"
            name="show_discount_code"
            signal={$formManagerForm}
            label="Show discount code option"
          />
          <UniversalInput
            type="checkbox"
            name="show_tickets_remaining"
            signal={$formManagerForm}
            label="Show tickets remaining"
          />
          <UniversalInput
            type="checkbox"
            name="request_phone_number"
            signal={$formManagerForm}
            label="Request phone number"
          />
          <UniversalInput
            type="checkbox"
            name="request_communication_preference"
            signal={$formManagerForm}
            label="Request communication preference"
          />
        </div>

        <Form.Group className="mb-24">
          <Form.Label>Theme</Form.Label>
          <UniversalInput
            as="select"
            name="theme"
            signal={$formManagerForm}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="transparent">Transparent</option>
          </UniversalInput>
          <Form.Text className="text-muted">
            Choose the theme for the embedded form
          </Form.Text>
        </Form.Group>

        <Form.Group className="mb-24">
          <Form.Label>Order Confirmation URL</Form.Label>
          <UniversalInput
            type="text"
            name="order_confirmation_url"
            signal={$formManagerForm}
            placeholder="https://example.com/confirmation or http://localhost:3000/confirmation"
          />
          <Form.Text className="text-muted">
            Optional: Custom URL to redirect users after successful payment. Order details will be passed as URL parameters. Leave empty to use default confirmation page.
          </Form.Text>
        </Form.Group>
      </Col>
    </Row>
  );
}

export default FormEditModalGeneralTab;
