import { Button, Badge, ListGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useDrag, useDrop } from 'react-dnd';

function DraggableField({ field, index, moveField, onEdit, onDelete }) {
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
        moveField(fieldItem.index, index);
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

export default DraggableField;
