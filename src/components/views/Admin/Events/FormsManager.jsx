/* eslint-disable no-nested-ternary */
import { Card, Button, Modal, Form, Row, Col, Badge, Dropdown, ListGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEllipsisV, faGripVertical, faTrash, faCopy } from '@fortawesome/free-solid-svg-icons';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $forms } from '@src/signals';
import SignalTable from '@src/components/global/SignalTable';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { $formsFilter, $formsView } from './_helpers/formsManager.consts';
import {
  $formManagerForm,
  $formManagerUI,
  $currentFormField,
  loadForms,
  handleOpenModal,
  handleCloseModal,
  handleTicketSelection,
  handleAddField,
  handleEditField,
  handleDeleteField,
  moveField,
  handleSubmit,
  handleDelete,
  handlePublish,
  handleShowEmbed,
  handleCloseEmbedModal,
  handleCopyEmbed,
  handleCopyEventListener,
} from './_helpers/formsManager.events';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'date', label: 'Date' },
];

function DraggableField({ field, index, onMoveField, onEdit, onDelete }) {
  const [{ isDragging }, drag] = useDrag({
    type: 'field',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'field',
    hover: (fieldItem) => {
      if (fieldItem.index !== index) {
        onMoveField(fieldItem.index, index);
        // eslint-disable-next-line no-param-reassign
        fieldItem.index = index;
      }
    },
  });

  return (
    <ListGroup.Item
      ref={(node) => drag(drop(node))}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: 'move' }}
      className="d-flex align-items-center justify-content-between"
    >
      <div className="d-flex align-items-center gap-2">
        <FontAwesomeIcon icon={faGripVertical} className="text-muted" />
        <div>
          <strong>{field.label || 'Untitled Field'}</strong>
          <Badge bg="secondary" className="ms-2">{field.type}</Badge>
          {field.required && <Badge bg="danger" className="ms-1">Required</Badge>}
        </div>
      </div>
      <div className="d-flex gap-2">
        <Button size="sm" variant="outline-primary" onClick={() => onEdit(index)}>
          Edit
        </Button>
        <Button size="sm" variant="outline-danger" onClick={() => onDelete(index)}>
          <FontAwesomeIcon icon={faTrash} />
        </Button>
      </div>
    </ListGroup.Item>
  );
}

function FormsManager({ eventId, tickets, onUpdate }) {
  const forms = $forms.value.list;
  const { showModal, showEmbedModal, editingForm, embedCode, eventListenerCode } = $formManagerUI.value;
  const formData = $formManagerForm.value;
  const currentField = $currentFormField.value;

  useEffectAsync(async () => {
    await loadForms(eventId);
  }, [eventId]);

  const needsOptions = ['select', 'radio'].includes(currentField.type);

  // Define table headers
  const headers = [
    { key: 'name', value: 'Name', sortKey: 'name' },
    { key: 'instructions', value: 'Instructions' },
    { key: 'tickets', value: 'Tickets' },
    { key: 'fields', value: 'Fields' },
    { key: 'status', value: 'Status' },
    { key: 'actions', value: 'Actions' },
  ];

  // Transform forms data to rows
  const rows = forms.map((form) => ({
    id: form.id,
    name: <strong>{form.name}</strong>,
    instructions: (
      <span className="small text-muted">
        {form.description
          ? (form.description.length > 50
            ? `${form.description.substring(0, 50)}...`
            : form.description)
          : '-'}
      </span>
    ),
    tickets: `${form.available_ticket_ids?.length || 0} ticket${form.available_ticket_ids?.length !== 1 ? 's' : ''}`,
    fields: `${form.schema?.length || 0} field${form.schema?.length !== 1 ? 's' : ''}`,
    status: () => (
      <Badge bg={form.is_published ? 'success' : 'secondary'}>
        {form.is_published ? 'Published' : 'Draft'}
      </Badge>
    ),
    actions: () => (
      <Dropdown>
        <Dropdown.Toggle variant="link" size="sm" className="text-light">
          <FontAwesomeIcon icon={faEllipsisV} />
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <Dropdown.Item onClick={() => handleOpenModal(form)}>
            Edit
          </Dropdown.Item>
          <Dropdown.Item onClick={() => handleShowEmbed(form.id)}>
            Get Embed Code
          </Dropdown.Item>
          <Dropdown.Item
            onClick={() => window.open(`/embed/form/${form.id}`, '_blank', 'noopener,noreferrer')}
          >
            Open Form In New Tab
          </Dropdown.Item>
          <Dropdown.Item onClick={() => handlePublish(form.id, form.is_published, eventId)}>
            {form.is_published ? 'Unpublish' : 'Publish'}
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item
            className="text-danger"
            onClick={() => handleDelete(form.id, eventId)}
          >
            Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    ),
  }));

  return (
    <DndProvider backend={HTML5Backend}>
      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-24">
            <h5 className="mb-0">Purchase Forms</h5>
            <Button size="sm" variant="primary" onClick={() => handleOpenModal()}>
              <FontAwesomeIcon icon={faPlus} className="me-2" />
              Add Form
            </Button>
          </div>

          <SignalTable
            $filter={$formsFilter}
            $view={$formsView}
            headers={headers}
            rows={rows}
            hasPagination={false}
          />
        </Card.Body>
      </Card>

      {/* Form Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>{editingForm ? 'Edit Form' : 'Create Form'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={(e) => handleSubmit(e, eventId, onUpdate)}>
          <Modal.Body>
            <Row>
              <Col lg={6}>
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

                <div className="mb-24">
                  <Form.Label>Available Tickets</Form.Label>
                  {tickets.length === 0 ? (
                    <div className="text-muted small">
                      No tickets available. Add tickets to this event first.
                    </div>
                  ) : (
                    <>
                      {tickets.map((ticket) => (
                        <UniversalInput
                          type="checkbox"
                          name={`ticket_${ticket.id}`}
                          signal={$formManagerForm}
                          checked={formData.available_ticket_ids.includes(ticket.id)}
                          onChange={() => {
                            handleTicketSelection(ticket.id);
                          }}
                          label={`${ticket.name} - $${parseFloat(ticket.price).toFixed(2)}`}
                          id={`ticket-${ticket.id}`}
                        />
                      ))}
                    </>
                  )}
                </div>
              </Col>

              <Col lg={6}>
                <h6 className="mb-16">Custom Fields</h6>

                <Card className="mb-24">
                  <Card.Body>
                    <Form.Group className="mb-16">
                      <Form.Label>Field Type</Form.Label>
                      <UniversalInput
                        as="select"
                        name="type"
                        signal={$currentFormField}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </UniversalInput>
                    </Form.Group>

                    <Form.Group className="mb-16">
                      <Form.Label>Label *</Form.Label>
                      <UniversalInput
                        type="text"
                        name="label"
                        signal={$currentFormField}
                      />
                    </Form.Group>

                    <Form.Group className="mb-16">
                      <Form.Label>Placeholder</Form.Label>
                      <UniversalInput
                        type="text"
                        name="placeholder"
                        signal={$currentFormField}
                      />
                    </Form.Group>

                    <Form.Group className="mb-16">
                      <Form.Label>Instructions</Form.Label>
                      <UniversalInput
                        as="textarea"
                        rows={2}
                        name="instructions"
                        signal={$currentFormField}
                        placeholder="Additional help text for this field..."
                      />
                      <Form.Text className="text-muted">
                        Optional help text that will appear below the field
                      </Form.Text>
                    </Form.Group>

                    {needsOptions && (
                      <Form.Group className="mb-16">
                        <Form.Label>Options (comma separated)</Form.Label>
                        <UniversalInput
                          type="text"
                          name="optionsString"
                          signal={$currentFormField}
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </Form.Group>
                    )}
                    <Form.Group className="mb-16">
                      <Form.Label>Required?</Form.Label>
                      <UniversalInput
                        type="checkbox"
                        name="required"
                        signal={$currentFormField}
                        label="Required field"
                      />
                    </Form.Group>

                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={handleAddField}
                      className="w-100"
                      type="button"
                    >
                      <FontAwesomeIcon icon={faPlus} className="me-2" />
                      Add Field
                    </Button>
                  </Card.Body>
                </Card>

                {formData.schema.length > 0 && (
                  <div>
                    <div className="small text-muted mb-8">
                      {formData.schema.length} custom field{formData.schema.length !== 1 ? 's' : ''} (drag to reorder)
                    </div>
                    <ListGroup>
                      {formData.schema.map((field, index) => (
                        <DraggableField
                          key={index}
                          field={field}
                          index={index}
                          moveField={moveField}
                          onEdit={handleEditField}
                          onDelete={handleDeleteField}
                        />
                      ))}
                    </ListGroup>
                  </div>
                )}
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" type="submit">
              Save
            </Button>
            <Button variant="muted" onClick={handleCloseModal}>
              Cancel
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Embed Code Modal */}
      <Modal show={showEmbedModal} onHide={handleCloseEmbedModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Embed Code</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-16">
            Copy and paste this code into your website to embed this form:
          </p>
          <Form.Control
            as="textarea"
            rows={6}
            value={embedCode}
            readOnly
            className="font-monospace small mb-24"
          />

          <div className="mb-24">
            <h6 className="mb-8">Listen for Order Complete Event</h6>
            <p className="text-muted small mb-16">
              The iframe will emit a <code>postMessage</code> event when an order is completed.
              Add this JavaScript to your parent page to handle the redirect:
            </p>
            <Form.Control
              as="textarea"
              rows={12}
              readOnly
              className="font-monospace small mb-16"
              value={eventListenerCode || ''}
            />
            <Button
              variant="outline-primary"
              onClick={handleCopyEventListener}
              className="w-100 mb-16"
              size="sm"
            >
              <FontAwesomeIcon icon={faCopy} className="me-2" />
              Copy Event Listener Code
            </Button>
          </div>

          <Button variant="primary" onClick={handleCopyEmbed} className="w-100">
            <FontAwesomeIcon icon={faCopy} className="me-2" />
            Copy Embed Code to Clipboard
          </Button>
        </Modal.Body>
      </Modal>
    </DndProvider>
  );
}

export default FormsManager;
