import { Modal, Form, Button, Tab, Tabs } from 'react-bootstrap';
import {
  $formManagerUI,
  handleCloseModal,
  handleSubmit,
} from '../../_helpers/formsManager.events';
import FormEditModalGeneralTab from './FormEditModalGeneralTab';
import FormEditModalTicketsTab from './FormEditModalTicketsTab';
import FormEditModalUpsellingsTab from './FormEditModalUpsellingsTab';
import FormEditModalDiscountsTab from './FormEditModalDiscountsTab';
import FormEditModalCustomFieldsTab from './FormEditModalCustomFieldsTab';

function FormEditModal({ eventId, tickets, upsellings, discounts = [], onUpdate }) {
  const { showModal, editingForm } = $formManagerUI.value;

  return (
    <Modal show={showModal} onHide={handleCloseModal} size="xl" dialogClassName="form-edit-modal-wider">
      <Modal.Header closeButton>
        <Modal.Title>{editingForm ? 'Edit Form' : 'Create Form'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={(e) => handleSubmit(e, eventId, onUpdate)}>
        <Modal.Body>
          <Tabs defaultActiveKey="general" className="mb-24" variant="pills">
            <Tab eventKey="general" title="General">
              <FormEditModalGeneralTab />
            </Tab>
            <Tab eventKey="tickets" title="Tickets">
              <FormEditModalTicketsTab tickets={tickets} eventId={eventId} onUpdate={onUpdate} />
            </Tab>
            <Tab eventKey="upsellings" title="Upsellings">
              <FormEditModalUpsellingsTab upsellings={upsellings} eventId={eventId} onUpdate={onUpdate} />
            </Tab>
            <Tab eventKey="discounts" title="Discount Codes">
              <FormEditModalDiscountsTab discounts={discounts} eventId={eventId} onUpdate={onUpdate} />
            </Tab>
            <Tab eventKey="custom-fields" title="Custom Fields">
              <FormEditModalCustomFieldsTab />
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" type="submit">
            Save
          </Button>
          <Button variant="secondary" onClick={handleCloseModal}>
            Cancel
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default FormEditModal;
