import { $embed } from '@src/signals';
import paymentsAPI from '@src/api/payments.api';
import { loadPostCheckoutUpsellings } from '../../../_helpers/checkout.resolvers';
import * as consts from './step2Upsellings.consts';

export const loadPostCheckoutUpsellingsData = async (order, form) => {
  if (order?.event_id) {
    await loadPostCheckoutUpsellings(order.event_id, order, form);
    consts.$postCheckoutLoaded.value = true;
  } else {
    consts.$postCheckoutLoaded.value = false;
  }
};

export const createPaymentSessionIfNeeded = async (order, paymentSession) => {
  if (!order || order.status === 'PAID') return;
  if (parseFloat(order.total) <= 0) return;
  if (paymentSession?.sessionToken) return;
  
  try {
    const session = await paymentsAPI.createPaymentSession(order.id);
    if (session?.sessionToken) {
      $embed.update({ paymentSession: session });
    }
  } catch {
    // Session creation can fail; paymentError will show when user tries to pay
  }
};
