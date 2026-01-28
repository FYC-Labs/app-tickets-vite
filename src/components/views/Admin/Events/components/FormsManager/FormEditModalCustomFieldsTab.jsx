import { Form, Row, Col, Card, Button, ListGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { $formManagerForm, $currentFormField } from '../../_helpers/formsManager.events';
import {
  handleAddField,
  handleEditField,
  handleDeleteField,
  moveField,
} from '../../_helpers/formsManager.events';
import { FIELD_TYPES } from '../../_helpers/formsManager.consts';
import DraggableField from './DraggableField';

function FormEditModalCustomFieldsTab() {
  const formData = $formManagerForm.value;
  const currentField = $currentFormField.value;
  const needsOptions = ['select', 'radio'].includes(currentField.type);

  return (
    <Row>
      <Col lg={6}>
        <h6 className="mb-16">Add new field</h6>
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
              <Form.Label>Field ID String</Form.Label>
              <UniversalInput
                type="text"
                name="field_id_string"
                signal={$currentFormField}
                placeholder="e.g., phone_number"
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
      </Col>
      <Col lg={6}>
        {formData.schema.length > 0 ? (
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
        ) : (
          <div className="text-muted small">
            No custom fields yet. Use the form on the left to add fields.
          </div>
        )}
      </Col>
    </Row>
  );
}

export default FormEditModalCustomFieldsTab;
