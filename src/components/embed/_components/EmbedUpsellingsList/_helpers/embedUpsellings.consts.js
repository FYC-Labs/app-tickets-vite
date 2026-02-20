/* eslint-disable arrow-body-style */
import { signal, computed } from '@preact/signals-react';
import { $embed } from '@src/signals';

// Signals and constants shared across the EmbedUpsellingsList component
export const $signedImageUrls = signal({});
export const $failedImageUrls = signal({});
export const $carouselIndexByUpsellingId = signal({});
export const $hoverPreview = signal(null);
export const $currentUpsellingIndex = signal(0);

// Computed signals for derived data
export const $upsellings = computed(() => {
  const embedUpsellings = $embed.value.upsellings || [];
  return embedUpsellings.filter((u) => u.upselling_strategy === 'PRE-CHECKOUT');
});

export const $totalTicketsSelected = computed(() => {
  const selectedTickets = $embed.value.selectedTickets || {};
  return Object.values(selectedTickets).reduce((sum, qty) => sum + (qty || 0), 0);
});

export const $embedImageUrlsKey = computed(() => {
  return ($upsellings.value || [])
    .flatMap((u) => (Array.isArray(u?.images) ? u.images : []))
    .filter((url) => url && typeof url === 'string')
    .filter((url, i, arr) => arr.indexOf(url) === i)
    .join(',');
});
