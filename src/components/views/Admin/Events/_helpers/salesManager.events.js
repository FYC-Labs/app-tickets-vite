import { Signal } from '@fyclabs/tools-fyc-react/signals';
import ordersAPI from '@src/api/orders.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';
import { format } from 'date-fns';
import { $statusFilter, $ticketFilter, $deleteOrder } from './salesManager.consts';

export const $sales = Signal({
  orders: [],
  isLoading: false,
});

export const loadSales = async (eventId) => {
  try {
    $sales.loadingStart();
    const filters = { event_id: eventId };
    if ($statusFilter.value) {
      filters.status = $statusFilter.value;
    }
    const data = await ordersAPI.getAll(filters);
    $sales.update({ orders: data || [] });
  } catch (error) {
    console.error('Error loading sales:', error);
    showToast('Error loading sales data', 'error');
  } finally {
    $sales.loadingEnd();
  }
};

export const setStatusFilter = (status) => {
  $statusFilter.value = status;
};

export const setTicketFilter = (selectedNames) => {
  $ticketFilter.value = Array.isArray(selectedNames) ? selectedNames : [];
};

export const toggleTicketInFilter = (name) => {
  if (!name) return;
  const current = $ticketFilter.value;
  const next = current.includes(name)
    ? current.filter((n) => n !== name)
    : [...current, name];
  $ticketFilter.value = next;
};

export const exportToCSV = (orders, eventId) => {
  if (!orders || orders.length === 0) {
    showToast('No orders to export', 'warning');
    return;
  }

  try {
    // CSV Headers
    const headers = [
      'Order ID',
      'Date',
      'Time',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Status',
      'Payment Environment',
      'Subtotal',
      'Discount Amount',
      'Total',
      'Payment Intent ID',
      'Tickets',
      'Billing Address',
      'Billing City',
      'Billing State',
      'Billing ZIP',
    ];

    // Convert orders to CSV rows
    const rows = orders.map((order) => {
      const orderDate = new Date(order.created_at);
      const dateStr = format(orderDate, 'yyyy-MM-dd');
      const timeStr = format(orderDate, 'HH:mm:ss');

      // Format tickets as "Quantity x Ticket Name"
      const ticketsStr = order.order_items
        ?.map((item) => `${item.quantity}x ${item.ticket_types?.name || 'Ticket'}`)
        .join('; ') || '';

      // Escape CSV values (handle commas, quotes, newlines)
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      return [
        escapeCSV(order.id),
        escapeCSV(dateStr),
        escapeCSV(timeStr),
        escapeCSV(order.customer_name || ''),
        escapeCSV(order.customer_email || ''),
        escapeCSV(order.customer_phone || ''),
        escapeCSV(order.status || ''),
        escapeCSV(order.payment_environment || ''),
        escapeCSV(parseFloat(order.subtotal || 0).toFixed(2)),
        escapeCSV(parseFloat(order.discount_amount || 0).toFixed(2)),
        escapeCSV(parseFloat(order.total || 0).toFixed(2)),
        escapeCSV(order.payment_intent_id || ''),
        escapeCSV(ticketsStr),
        escapeCSV(order.billing_address || ''),
        escapeCSV(order.billing_city || ''),
        escapeCSV(order.billing_state || ''),
        escapeCSV(order.billing_zip || ''),
      ];
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filterSuffix = $statusFilter.value ? `-${$statusFilter.value}` : '';
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales-${eventId.substring(0, 8)}${filterSuffix}-${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Sales data exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    showToast('Error exporting sales data', 'error');
  }
};

export const showDeleteConfirmation = (order) => {
  $deleteOrder.value = order;
};

export const hideDeleteConfirmation = () => {
  $deleteOrder.value = null;
};

export const deleteOrder = async (orderId, eventId) => {
  try {
    await ordersAPI.delete(orderId);
    showToast('Order deleted successfully', 'success');
    hideDeleteConfirmation();
    await loadSales(eventId);
  } catch (error) {
    showToast('Error deleting order', 'error');
  }
};
