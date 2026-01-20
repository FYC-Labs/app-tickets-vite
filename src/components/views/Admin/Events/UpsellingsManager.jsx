import { Card, Modal, Form, Button, Table, Dropdown, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV, faPlus } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import {
  $upsellingForm,
  $upsellingUI,
  handleSubmit,
  handleDelete,
  handleOpenModal,
  handleCloseModal,
  addCustomField,
  updateCustomField,
  removeCustomField,
} from './_helpers/upsellingsManager.events';

function UpsellingsManager({ eventId, upsellings, onUpdate }) {
  const { showModal } = $upsellingUI.value;
  const { editingUpselling } = $upsellingUI.value;
  const formData = $upsellingForm.value;

  return (
    <>
      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-24">
            <h5 className="mb-0">Upsellings</h5>
            <Button size="sm" variant="primary" onClick={() => handleOpenModal()}>
              <FontAwesomeIcon icon={faPlus} className="me-2" />
              Add Upselling
            </Button>
          </div>
          {upsellings.length === 0 ? (
            <div className="text-center py-4 text-muted">
              No upsellings yet
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Sales Period</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {upsellings.map((upselling) => (
                  <tr key={upselling.id}>
                    <td>
                      <strong>{upselling.name}</strong>
                      {upselling.description && (
                        <div className="small text-muted">{upselling.description}</div>
                      )}
                    </td>
                    <td>${parseFloat(upselling.price).toFixed(2)}</td>
                    <td>
                      {upselling.sold || 0} / {upselling.quantity}
                    </td>
                    <td className="small">
                      {format(new Date(upselling.sales_start), 'MMM d')} - {format(new Date(upselling.sales_end), 'MMM d')}
                    </td>
                    <td>
                      <Dropdown>
                        <Dropdown.Toggle variant="link" size="sm" className="text-white">
                          <FontAwesomeIcon icon={faEllipsisV} />
                        </Dropdown.Toggle>

                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => handleOpenModal(upselling)}>
                            Edit
                          </Dropdown.Item>
                          <Dropdown.Divider />
                          <Dropdown.Item
                            className="text-danger"
                            onClick={() => handleDelete(upselling.id, onUpdate)}
                          >
                            Delete
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingUpselling ? 'Edit Upselling' : 'Add Upselling'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={(e) => handleSubmit(e, eventId, onUpdate)}>
          <Modal.Body>
            <Form.Group className="mb-24">
              <Form.Label>Name *</Form.Label>
              <UniversalInput
                type="text"
                name="name"
                signal={$upsellingForm}
                required
              />
            </Form.Group>

            <Form.Group className="mb-24">
              <Form.Label>Description</Form.Label>
              <UniversalInput
                as="textarea"
                rows={2}
                name="description"
                signal={$upsellingForm}
              />
            </Form.Group>

            <Form.Group className="mb-24">
              <Form.Label>Benefits / Notes</Form.Label>
              <UniversalInput
                as="textarea"
                rows={2}
                name="benefits"
                signal={$upsellingForm}
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Price *</Form.Label>
                  <UniversalInput
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    signal={$upsellingForm}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Quantity *</Form.Label>
                  <UniversalInput
                    type="number"
                    min="1"
                    name="quantity"
                    signal={$upsellingForm}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Sales Start *</Form.Label>
                  <UniversalInput
                    type="datetime-local"
                    name="sales_start"
                    signal={$upsellingForm}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Sales End *</Form.Label>
                  <UniversalInput
                    type="datetime-local"
                    name="sales_end"
                    signal={$upsellingForm}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="mb-24">
              <div className="d-flex justify-content-between align-items-center mb-8">
                <Form.Label className="mb-0">Custom Fields</Form.Label>
                <Button
                  size="sm"
                  variant="outline-primary"
                  type="button"
                  onClick={addCustomField}
                >
                  Add Field
                </Button>
              </div>

              {formData.custom_fields?.length > 0 && (
                <div className="d-flex flex-column gap-3">
                  {formData.custom_fields.map((field, idx) => (
                    <Card key={idx} className="p-3">
                      <Row className="g-2 align-items-end">
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label>Label</Form.Label>
                            <UniversalInput
                              type="text"
                              name={`custom_field_label_${idx}`}
                              value={field.label}
                              customOnChange={(e) => updateCustomField(idx, { label: e.target.value })}
                              placeholder="E.g., T-shirt size"
                            />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Type</Form.Label>
                            <UniversalInput
                              as="select"
                              name={`custom_field_type_${idx}`}
                              value={field.type}
                              customOnChange={(e) => updateCustomField(idx, { type: e.target.value })}
                            >
                              <option value="text">Text</option>
                              <option value="email">Email</option>
                              <option value="number">Number</option>
                              <option value="textarea">Textarea</option>
                              <option value="select">Select</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="radio">Radio</option>
                            </UniversalInput>
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Placeholder</Form.Label>
                            <UniversalInput
                              type="text"
                              name={`custom_field_placeholder_${idx}`}
                              value={field.placeholder || ''}
                              customOnChange={(e) => updateCustomField(idx, { placeholder: e.target.value })}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group className="d-flex align-items-center gap-2">
                            <UniversalInput
                              type="checkbox"
                              name={`custom_field_required_${idx}`}
                              label="Required"
                              checked={!!field.required}
                              customOnChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={12}>
                          {(field.type === 'select' || field.type === 'radio') && (
                            <Form.Group className="mt-2">
                              <Form.Label>Options (comma separated)</Form.Label>
                              <UniversalInput
                                type="text"
                                name={`custom_field_options_${idx}`}
                                value={(field.options || []).join(', ')}
                                customOnChange={(e) => updateCustomField(idx, { value: e.target.value })}
                                placeholder="Small, Medium, Large"
                              />
                            </Form.Group>
                          )}
                        </Col>
                        <Col md={12} className="d-flex justify-content-end">
                          <Button
                            size="sm"
                            variant="outline-danger"
                            type="button"
                            onClick={() => removeCustomField(idx)}
                          >
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingUpselling ? 'Update' : 'Create'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

export default UpsellingsManager;
