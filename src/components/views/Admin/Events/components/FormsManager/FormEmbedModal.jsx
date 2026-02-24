import { Modal, Form, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { $formManagerUI } from '../../_helpers/formsManager.events';
import { handleCloseEmbedModal, handleCopyEmbed, handleCopyEventListener } from '../../_helpers/formsManager.events';

function FormEmbedModal() {
  const { showEmbedModal, embedCode, eventListenerCode } = $formManagerUI.value;

  return (
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
  );
}

export default FormEmbedModal;
