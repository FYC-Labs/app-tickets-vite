import {
  faArrowLeft,
  faCheck,
  faCopy,
  faSave,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import GooglePlacesAutocomplete from '@src/components/global/Inputs/GooglePlacesAutocomplete';
import Loader from '@src/components/global/Loader';
import { $events, $tickets } from '@src/signals';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Tab,
  Tabs,
} from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import DiscountsManager from './DiscountsManager';
import FormsManager from './FormsManager';
import SalesManager from './SalesManager';
import TicketsManager from './TicketsManager';
import { getStatusBadge, loadEventData } from './_helpers/eventDetail.events';
import {
  $eventForm,
  handleChange,
  handleSubmit,
  loadEvent,
} from './_helpers/eventForm.events';

function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = $events.value.current;
  const tickets = $tickets.value.list;
  const loading = $events.value.isLoading;
  const formData = $eventForm.value;
  const formLoading = $eventForm.value.isLoading;
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  useEffectAsync(async () => {
    await loadEventData(id);
    await loadEvent(id);
  }, [id]);

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    await handleSubmit(e, id, () => {});
    await loadEventData(id);
  };

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <Loader />;
  if (!event) return <div>Event not found</div>;

  return (
    <Container fluid className="py-4">
      <Row className="mb-32">
        <Col>
          <div className="d-flex align-items-center gap-3">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate('/admin/events')}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
            <div>
              <h2 className="mb-8">{event.title}</h2>
              <div>
                <Badge bg={getStatusBadge(event.status).variant}>
                  {getStatusBadge(event.status).text}
                </Badge>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      <Row>
        <Col lg={12}>
          <Tabs defaultActiveKey="basic" className="mb-24" variant="pills">
            <Tab eventKey="basic" title="Basic Info">
              <Card>
                <Card.Body>
                  <Form onSubmit={handleEventSubmit}>
                    <Form.Group className="mb-24">
                      <Form.Label>Title *</Form.Label>
                      <Form.Control
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-24">
                      <Form.Label>Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                      />
                    </Form.Group>

                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-24">
                          <Form.Label>Start Date *</Form.Label>
                          <Form.Control
                            type="datetime-local"
                            name="start_date"
                            value={formData.start_date}
                            onChange={handleChange}
                            required
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-24">
                          <Form.Label>End Date *</Form.Label>
                          <Form.Control
                            type="datetime-local"
                            name="end_date"
                            value={formData.end_date}
                            onChange={handleChange}
                            required
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="mb-24">
                      <Form.Label>Location</Form.Label>
                      <GooglePlacesAutocomplete
                        signal={$eventForm}
                        name="location"
                        value={formData.location}
                        placeholder="Search for a location"
                      />
                    </Form.Group>

                    <Form.Group className="mb-24">
                      <Form.Label>Image URL</Form.Label>
                      <Form.Control
                        type="url"
                        name="image_url"
                        value={formData.image_url}
                        onChange={handleChange}
                        placeholder="https://example.com/image.jpg"
                      />
                    </Form.Group>

                    <Form.Group className="mb-24">
                      <Form.Label>Capacity</Form.Label>
                      <Form.Control
                        type="number"
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleChange}
                        min="1"
                      />
                      <Form.Text className="text-muted">
                        Leave empty for unlimited capacity
                      </Form.Text>
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={formLoading}
                    >
                      <FontAwesomeIcon icon={faSave} className="me-2" />
                      {formLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="tickets" title="Tickets">
              <TicketsManager
                eventId={id}
                tickets={tickets}
                onUpdate={() => loadEventData(id)}
              />
            </Tab>

            <Tab eventKey="forms" title="Forms">
              <FormsManager
                eventId={id}
                tickets={tickets}
                onUpdate={() => loadEventData(id)}
              />
            </Tab>

            <Tab eventKey="discounts" title="Discount Codes">
              <DiscountsManager eventId={id} />
            </Tab>

            <Tab eventKey="sales" title="Sales">
              <SalesManager eventId={id} />
            </Tab>

            <Tab eventKey="integrations" title="Integrations">
              <Card>
                <Card.Body>
                  <h5 className="mb-24">Customer.io Configuration</h5>
                  <p className="text-muted mb-24">
                    Configure Customer.io credentials to enable transactional
                    email notifications for ticket purchases. These emails will
                    be sent automatically after successful payment.
                  </p>
                  <Form onSubmit={handleEventSubmit}>
                    <Form.Group className="mb-24">
                      <Form.Label>App API Key</Form.Label>
                      <Form.Control
                        type="password"
                        name="customerio_app_api_key"
                        value={formData.customerio_app_api_key}
                        onChange={handleChange}
                        placeholder="Enter your Customer.io App API Key"
                      />
                      <Form.Text className="text-muted">
                        Your Customer.io App API Key (not Track API Key). Find
                        this in Workspace Settings → API Credentials → App API
                        Keys. Keep this secure.
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-24">
                      <Form.Label>Transactional Template ID</Form.Label>
                      <Form.Control
                        type="text"
                        name="customerio_transactional_template_id"
                        value={formData.customerio_transactional_template_id}
                        onChange={handleChange}
                        placeholder="Enter the transactional email template ID"
                      />
                      <Form.Text className="text-muted">
                        The ID or name of your Customer.io transactional email
                        template
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-24">
                      <Form.Label>Site ID</Form.Label>
                      <Form.Control
                        type="text"
                        name="customerio_site_id"
                        value={formData.customerio_site_id}
                        onChange={handleChange}
                        placeholder="Enter your Customer.io Site ID"
                      />
                      <Form.Text className="text-muted">
                        Your Customer.io Site ID for Track API. Find this in
                        Workspace Settings → API Credentials → Tracking API
                        Keys.
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-24">
                      <Form.Label>Track API Key</Form.Label>
                      <Form.Control
                        type="password"
                        name="customerio_track_api_key"
                        value={formData.customerio_track_api_key}
                        onChange={handleChange}
                        placeholder="Enter your Customer.io Track API Key"
                      />
                      <Form.Text className="text-muted">
                        Your Customer.io Track API Key (used with Site ID for
                        identifying customers). Keep this secure.
                      </Form.Text>
                    </Form.Group>

                    <hr className="my-32" />

                    <h6 className="mb-24">Custom Attributes (Optional)</h6>
                    <p className="text-muted mb-24">
                      Configure custom attributes to be sent to Customer.io when
                      identifying customers. This allows you to tag customers
                      with event-specific attributes (e.g., "ftw2026: true",
                      "event_tag: DVLPR2026"). Leave empty to skip custom
                      attributes.
                    </p>

                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-24">
                          <Form.Label>Custom Attribute Key</Form.Label>
                          <Form.Control
                            type="text"
                            name="customerio_custom_attribute_key"
                            value={formData.customerio_custom_attribute_key}
                            onChange={handleChange}
                            placeholder="e.g., ftw2026, event_tag"
                          />
                          <Form.Text className="text-muted">
                            The attribute key to send to Customer.io (e.g.,
                            "ftw2026", "event_tag")
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-24">
                          <Form.Label>Custom Attribute Value</Form.Label>
                          <Form.Control
                            type="text"
                            name="customerio_custom_attribute_value"
                            value={formData.customerio_custom_attribute_value}
                            onChange={handleChange}
                            placeholder="e.g., true, DVLPR2026, 123"
                          />
                          <Form.Text className="text-muted">
                            The attribute value to send to Customer.io (e.g.,
                            "true", "developer2026", "123"). Will be parsed as
                            boolean or number if applicable.
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>

                    <hr className="my-32" />

                    <h5 className="mb-24">Slack Notifications</h5>
                    <p className="text-muted mb-24">
                      Configure a Slack webhook URL to receive notifications
                      when new orders are created for this event. Leave empty to
                      disable Slack notifications.
                    </p>

                    <Form.Group className="mb-24">
                      <Form.Label>Slack Webhook URL</Form.Label>
                      <Form.Control
                        type="url"
                        name="slack_webhook_url"
                        value={formData.slack_webhook_url || ''}
                        onChange={handleChange}
                        placeholder="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
                      />
                      <Form.Text className="text-muted">
                        Enter your Slack webhook URL. You can create one by
                        going to your Slack workspace → Apps → Incoming Webhooks
                        → Add New Webhook. When configured, you'll receive a
                        notification in Slack whenever a new order is created
                        for this event.
                      </Form.Text>
                    </Form.Group>

                    <hr className="my-32" />

                    <h5 className="mb-24">AccruPay Configuration</h5>
                    <p className="text-muted mb-24">
                      Configure which AccruPay environment to use for payment
                      processing for this event.
                    </p>

                    <Form.Group className="mb-24">
                      <Form.Label>Payment Environment</Form.Label>
                      <Form.Select
                        name="accrupay_environment"
                        value={formData.accrupay_environment}
                        onChange={handleChange}
                      >
                        <option value="">Use Default (Based on ENV_TAG)</option>
                        <option value="production">Production</option>
                        <option value="sandbox">Sandbox/Integration</option>
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Select which AccruPay environment to use. "Use Default"
                        will use the global ENV_TAG setting (currently{' '}
                        {import.meta.env.VITE_ENV_TAG || 'development'} mode).
                        Override this to force production or sandbox mode for
                        this specific event.
                      </Form.Text>
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={formLoading}
                    >
                      <FontAwesomeIcon icon={faSave} className="me-2" />
                      {formLoading ? 'Saving...' : 'Save Integration Settings'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="api-access" title="API Access">
              <Card>
                <Card.Body>
                  <h5 className="mb-24">Public Order Confirmation API</h5>
                  <p className="text-muted mb-24">
                    Use this API key to fetch order details from your website or
                    external systems. This key only provides access to orders
                    for this specific event.
                  </p>

                  <Form.Group className="mb-24">
                    <Form.Label>API Key</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control
                        type="text"
                        value={event.api_key || 'Loading...'}
                        readOnly
                        className="font-monospace"
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={() => copyToClipboard(event.api_key, setCopiedApiKey)}
                      >
                        <FontAwesomeIcon
                          icon={copiedApiKey ? faCheck : faCopy}
                        />
                      </Button>
                    </div>
                    <Form.Text className="text-muted">
                      Keep this key secure. Do not expose it in client-side
                      code.
                    </Form.Text>
                  </Form.Group>

                  <h6 className="mb-16">API Endpoint</h6>
                  <div className="bg-light p-3 mb-24 rounded">
                    <code className="text-dark">
                      GET {import.meta.env.VITE_SUPABASE_URL}
                      /functions/v1/public-orders?order_id=ORDER_ID
                    </code>
                  </div>

                  <h6 className="mb-16">Example cURL Request</h6>
                  <div className="bg-dark p-3 mb-16 rounded position-relative">
                    <Button
                      variant="outline-light"
                      size="sm"
                      className="position-absolute top-0 end-0 m-2"
                      onClick={() => copyToClipboard(
                        `curl -X GET "${
                          import.meta.env.VITE_SUPABASE_URL
                        }/functions/v1/public-orders?order_id=YOUR_ORDER_ID" \\\n  -H "X-API-Key: ${
                          event.api_key || 'YOUR_API_KEY'
                        }"`,
                        setCopiedCurl,
                      )}
                    >
                      <FontAwesomeIcon icon={copiedCurl ? faCheck : faCopy} />
                    </Button>
                    <pre
                      className="text-light mb-0"
                      style={{ fontSize: '0.85rem' }}
                    >
                      {`curl -X GET "${
                        import.meta.env.VITE_SUPABASE_URL
                      }/functions/v1/public-orders?order_id=YOUR_ORDER_ID" \\
  -H "X-API-Key: ${event.api_key || 'YOUR_API_KEY'}"`}
                    </pre>
                  </div>

                  <h6 className="mb-16">Example JavaScript/Fetch Request</h6>
                  <div className="bg-dark p-3 mb-24 rounded">
                    <pre
                      className="text-light mb-0"
                      style={{ fontSize: '0.85rem' }}
                    >
                      {`const res = await fetch(
  '${
    import.meta.env.VITE_SUPABASE_URL
  }/functions/v1/public-orders?order_id=YOUR_ORDER_ID',
  {
    headers: {
      'X-API-Key': '${event.api_key || 'YOUR_API_KEY'}'
    }
  }
);
const data = await res.json();`}
                    </pre>
                  </div>

                  <h6 className="mb-16">Response Format</h6>
                  <div className="bg-dark p-3 rounded">
                    <pre
                      className="text-light mb-0"
                      style={{ fontSize: '0.85rem' }}
                    >
                      {`{
  "data": {
    "id": "order-uuid",
    "status": "PAID",
    "total": 100.00,
    "subtotal": 100.00,
    "discount_amount": 0.00,
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "customer_first_name": "John",
    "customer_last_name": "Doe",
    "customer_phone": "+1234567890",
    "billing_address": "123 Main St",
    "billing_city": "New York",
    "billing_state": "NY",
    "billing_zip": "10001",
    "events": {
      "title": "Event Name",
      "description": "Event description",
      "start_date": "2025-01-01T19:00:00Z",
      "location": "Event Location"
    },
    "order_items": [
      {
        "quantity": 2,
        "unit_price": 50.00,
        "subtotal": 100.00,
        "ticket_types": {
          "name": "General Admission",
          "description": "Standard ticket"
        }
      }
    ],
    "discount_codes": {
      "code": "SAVE10",
      "type": "PERCENT",
      "value": 10
    }
  }
}`}
                    </pre>
                  </div>

                  <div className="alert alert-info mt-24 mb-0">
                    <strong>Note:</strong> This is a truly public endpoint that
                    requires no authentication other than the X-API-Key header.
                    The API key restricts access to only orders for this event.
                    You can safely call this from client-side or server-side
                    code.
                  </div>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Col>
      </Row>
    </Container>
  );
}

export default EventDetail;
