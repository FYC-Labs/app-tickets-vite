import { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand } from '@fortawesome/free-solid-svg-icons';

/**
 * Cell that shows a short preview and opens a modal with a larger textarea when clicked.
 * Use for long-text fields (Description, Benefits) in inline-edit tables.
 */
function ExpandableTextCell({ value, onApply, label, placeholder }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const handleOpen = () => {
    setDraft(value ?? '');
    setOpen(true);
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const display = (value ?? '').trim();
  const hint = placeholder ?? `Click to add ${label}…`;

  return (
    <>
      <button
        type="button"
        className="form-control form-control-sm text-start d-flex align-items-start gap-1 overflow-hidden"
        onClick={handleOpen}
        aria-label={`Edit ${label}`}
        style={{ minHeight: '31px', cursor: 'pointer', wordBreak: 'break-word', overflowWrap: 'break-word' }}
      >
        <span className="small flex-grow-1 min-w-0 text-body text-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {display || <span className="text-muted">{hint}</span>}
        </span>
        <FontAwesomeIcon icon={faExpand} className="flex-shrink-0 text-muted mt-1" />
      </button>
      <Modal show={open} onHide={handleCancel} size="md">
        <Modal.Header closeButton>
          <Modal.Title>{label}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            as="textarea"
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            className="form-control"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default ExpandableTextCell;
