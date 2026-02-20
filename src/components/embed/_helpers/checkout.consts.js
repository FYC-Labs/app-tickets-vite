import { signal, computed } from '@preact/signals-react';
import { $embed } from '@src/signals';

// Signals and constants for checkout component
export const isProcessingPayment = signal(false);
export const showTestCards = signal(false);
export const providerConfigError = signal(null);
export const sessionInitError = signal(null);
export const postCheckoutUpsellings = signal([]);
export const selectedPostCheckoutUpsellings = signal({});
export const postCheckoutUpsellingCustomFields = signal({}); // { [upsellingId]: { [fieldLabel]: value } }
export const isAddingUpsellings = signal(false);
export const isAccruPayLoading = signal(true);
export const paymentSubmitBtnRef = signal(null);

// Computed signal for payment providers derived from paymentSession
export const providers = computed(() => {
  const { paymentSession } = $embed.value;
  return paymentSession?.preSessionData ? [{ name: 'nuvei', config: paymentSession.preSessionData }] : null;
});

export const $upsellTimer = signal(15);
