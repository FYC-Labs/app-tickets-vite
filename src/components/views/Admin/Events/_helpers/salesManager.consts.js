import { signal } from '@preact/signals-react';

// Filter signal for payment status (null = all, 'PAID' = paid only, 'PENDING' = pending only)
export const $statusFilter = signal(null);

// Filter signal for ticket types (empty array = all, otherwise array of ticket/item names)
export const $ticketFilter = signal([]);

// Signal for delete confirmation modal (stores the order to delete)
export const $deleteOrder = signal(null);
