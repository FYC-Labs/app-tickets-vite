/* eslint-disable no-nested-ternary */
import { Card, Button, Dropdown, Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEllipsisV } from '@fortawesome/free-solid-svg-icons';
import SignalTable from '@src/components/global/SignalTable';
import { $formsFilter, $formsView } from '../../_helpers/formsManager.consts';
import {
  handleOpenModal,
  handleShowEmbed,
  handlePublish,
  handleDelete,
} from '../../_helpers/formsManager.events';

function FormsManagerTable({ eventId, forms }) {
  const headers = [
    { key: 'name', value: 'Name', sortKey: 'name' },
    { key: 'instructions', value: 'Instructions' },
    { key: 'tickets', value: 'Tickets' },
    { key: 'fields', value: 'Fields' },
    { key: 'status', value: 'Status' },
    { key: 'actions', value: 'Actions' },
  ];

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
  );
}

export default FormsManagerTable;
