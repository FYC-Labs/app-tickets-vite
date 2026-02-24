import { signal } from '@preact/signals-react';

export const $paymentError = signal(null);
export const $isCompletingFree = signal(false);
export const $postCheckoutLoaded = signal(false);
export const $confirmationUrlOverride = signal(null);
