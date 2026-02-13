import { $events, $tickets, $upsellings, $discounts } from '@src/signals';
import eventsAPI from '@src/api/events.api';
import ticketsAPI from '@src/api/tickets.api';
import upsellingsAPI from '@src/api/upsellings.api';
import discountsAPI from '@src/api/discounts.api';

export const loadEventData = async (id) => {
  try {
    $events.loadingStart();
    const [eventData, ticketsData, upsellingsData, discountsData] = await Promise.all([
      eventsAPI.getById(id),
      ticketsAPI.getByEventId(id),
      upsellingsAPI.getByEventId(id),
      discountsAPI.getByEventId(id),
    ]);
    $events.update({ current: eventData });
    $tickets.update({ list: ticketsData });
    $upsellings.update({ list: upsellingsData });
    $discounts.update({ list: discountsData });
  } catch (error) {
    console.error('Error loading event:', error);
  } finally {
    $events.loadingEnd();
  }
};

export const getStatusBadge = (status) => {
  const variants = {
    DRAFT: 'secondary',
    PUBLISHED: 'success',
    CANCELLED: 'danger',
  };
  return { variant: variants[status] || 'secondary', text: status };
};
