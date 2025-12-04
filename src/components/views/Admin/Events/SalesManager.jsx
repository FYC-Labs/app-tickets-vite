import { Card, Table, Badge, ButtonGroup, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faTrash } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import Loader from '@src/components/global/Loader';
import UniversalModal from '@src/components/global/UniversalModal';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';
import { $sales, loadSales, setStatusFilter, exportToCSV, showDeleteConfirmation, hideDeleteConfirmation, deleteOrder } from './_helpers/salesManager.events';
import { $statusFilter, $deleteOrder } from './_helpers/salesManager.consts';

function SalesManager({ eventId }) {
  const { orders } = $sales.value;
  const loading = $sales.value.isLoading;
  const statusFilter = $statusFilter.value;
  const orderToDelete = $deleteOrder.value;

  useEffectAsync(async () => {
    await loadSales(eventId);
  }, [eventId, statusFilter]);

  const handleFilterChange = async (status) => {
    setStatusFilter(status);
    await loadSales(eventId);
  };

  const getStatusBadge = (status) => {
    const variants = {
      PENDING: 'warning',
      PAID: 'success',
      COMPLETED: 'success',
      CANCELLED: 'danger',
      REFUNDED: 'secondary',
    };
    return variants[status] || 'secondary';
  };

  const getPaymentEnvironmentBadge = (env) => {
    if (!env) return null;
    const variants = {
      production: 'success',
      sandbox: 'warning',
    };
    return variants[env] || 'secondary';
  };

  const getStatusExplanation = (status) => {
    const explanations = {
      PENDING: 'This order has not been paid yet. Deleting it will remove the pending order and any associated tickets will not be reserved.',
      PAID: 'This order has been paid. Deleting it will permanently remove the order record. This action cannot be undone.',
      COMPLETED: 'This order has been completed. Deleting it will permanently remove the order record. This action cannot be undone.',
      CANCELLED: 'This order has already been cancelled. Deleting it will permanently remove the order record.',
      REFUNDED: 'This order has been refunded. Deleting it will permanently remove the order record.',
    };
    return explanations[status] || 'Deleting this order will permanently remove it. This action cannot be undone.';
  };

  const handleDeleteClick = (e, order) => {
    e.stopPropagation();
    showDeleteConfirmation(order);
  };

  const handleConfirmDelete = async () => {
    if (orderToDelete) {
      await deleteOrder(orderToDelete.id, eventId);
    }
  };

  const handleCopyOrderId = async (orderId) => {
    try {
      await navigator.clipboard.writeText(orderId);
      showToast('Order ID copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy Order ID', 'error');
    }
  };

  const handleExportCSV = () => {
    exportToCSV(orders, eventId);
  };

  if (loading) return <Loader />;

  return (
    <Card>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-24">
          <h5 className="mb-0">Sales & Orders</h5>
          <div className="d-flex align-items-center gap-16">
            <ButtonGroup>
              <Button
                variant={statusFilter === null ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => handleFilterChange(null)}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'PAID' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => handleFilterChange('PAID')}
              >
                Paid
              </Button>
              <Button
                variant={statusFilter === 'PENDING' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => handleFilterChange('PENDING')}
              >
                Pending
              </Button>
            </ButtonGroup>
            {orders.length > 0 && (
              <Button
                variant="outline-success"
                size="sm"
                onClick={handleExportCSV}
              >
                <FontAwesomeIcon icon={faDownload} className="me-2" />
                Export CSV
              </Button>
            )}
            <div className="text-muted small">
              {orders.length} order{orders.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {orders.length > 0 && (
          <div className="mb-24 pb-24 border-bottom">
            <div className="row">
              <div className="col-md-3">
                <div className="text-muted small">Total Orders</div>
                <div className="h4 mb-0">{orders.length}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">Total Tickets Sold</div>
                <div className="h4 mb-0">
                  {orders
                    .filter((order) => order.status === 'PAID')
                    .reduce((sum, order) => sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0)}
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">Total Revenue</div>
                <div className="h4 mb-0">
                  ${orders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0).toFixed(2)}
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">Total Discounts</div>
                <div className="h4 mb-0 text-success">
                  ${orders.reduce((sum, order) => sum + parseFloat(order.discount_amount || 0), 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            No orders yet for this event
          </div>
        ) : (
          <Table responsive hover>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Tickets</th>
                <th>Total</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Environment</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td
                    className="font-monospace small"
                    style={{ cursor: 'pointer', color: '#0d6efd' }}
                    onClick={() => handleCopyOrderId(order.id)}
                    title="Click to copy full Order ID"
                  >
                    {order.id.substring(0, 8)}...
                  </td>
                  <td>
                    <div>
                      <strong>{order.customer_name || 'N/A'}</strong>
                    </div>
                    <div className="small text-muted">{order.customer_email}</div>
                  </td>
                  <td>
                    {order.order_items?.map((item, idx) => (
                      <div key={idx} className="small">
                        {item.quantity}x {item.ticket_types?.name || 'Ticket'}
                      </div>
                    )) || '-'}
                  </td>
                  <td>
                    <strong>${parseFloat(order.total || 0).toFixed(2)}</strong>
                    {order.subtotal !== order.total && (
                      <div className="small text-muted">
                        (was ${parseFloat(order.subtotal || 0).toFixed(2)})
                      </div>
                    )}
                  </td>
                  <td>
                    {order.discount_amount > 0 ? (
                      <span className="text-success">
                        -${parseFloat(order.discount_amount).toFixed(2)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <Badge bg={getStatusBadge(order.status)}>
                      {order.status}
                    </Badge>
                  </td>
                  <td>
                    {order.payment_environment ? (
                      <Badge bg={getPaymentEnvironmentBadge(order.payment_environment)}>
                        {order.payment_environment === 'production' ? 'Prod' : 'Sandbox'}
                      </Badge>
                    ) : (
                      <span className="text-muted small">-</span>
                    )}
                  </td>
                  <td className="small">
                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                    <div className="text-muted">
                      {format(new Date(order.created_at), 'h:mm a')}
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={(e) => handleDeleteClick(e, order)}
                      title="Delete order"
                      aria-label="Delete order"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>

      <UniversalModal
        show={!!orderToDelete}
        onHide={hideDeleteConfirmation}
        headerSize="h5"
        headerBgColor="danger"
        headerText="Delete Order"
        bodyClass="p-24"
        body={
          orderToDelete ? (
            <div>
              <p className="mb-16">
                Are you sure you want to delete this order?
              </p>
              <div className="mb-16">
                <strong>Order Details:</strong>
                <ul className="mt-8 mb-0">
                  <li>Order ID: <code className="small">{orderToDelete.id.substring(0, 8)}...</code></li>
                  <li>Customer: {orderToDelete.customer_name || 'N/A'} ({orderToDelete.customer_email})</li>
                  <li>Total: ${parseFloat(orderToDelete.total || 0).toFixed(2)}</li>
                  <li>Status: <Badge bg={getStatusBadge(orderToDelete.status)}>{orderToDelete.status}</Badge></li>
                </ul>
              </div>
              <div className="alert alert-warning mb-0">
                <strong>Payment Status:</strong>
                <p className="mb-0 mt-8">{getStatusExplanation(orderToDelete.status)}</p>
              </div>
            </div>
          ) : null
        }
        leftBtnText="Cancel"
        leftBtnVariant="secondary"
        leftBtnOnClick={hideDeleteConfirmation}
        rightBtnText="Delete Order"
        rightBtnVariant="danger"
        rightBtnOnClick={handleConfirmDelete}
      />
    </Card>
  );
}

export default SalesManager;
