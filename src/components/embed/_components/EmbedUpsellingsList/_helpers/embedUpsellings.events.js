import {
  handleUpsellingChange as handlePreCheckoutUpsellingChange,
  handleUpsellingCustomFieldChange as handlePreCheckoutUpsellingCustomFieldChange,
} from '@src/components/embed/_helpers/eventForm.events';
import * as consts from './embedUpsellings.consts';

export const setHoverPreview = (preview) => {
  consts.$hoverPreview.value = preview;
};

export const clearHoverPreview = () => {
  consts.$hoverPreview.value = null;
};

export const setCurrentUpsellingIndex = (index) => {
  consts.$currentUpsellingIndex.value = index;
};

export const handlePreviousUpselling = (totalUpsellings) => {
  const prev = consts.$currentUpsellingIndex.value;
  consts.$currentUpsellingIndex.value = prev <= 0 ? totalUpsellings - 1 : prev - 1;
};

export const handleNextUpselling = (totalUpsellings) => {
  const prev = consts.$currentUpsellingIndex.value;
  consts.$currentUpsellingIndex.value = prev >= totalUpsellings - 1 ? 0 : prev + 1;
};

export const handleCarouselPrevious = (upsellingId, currentIndex, imageListLength) => {
  consts.$carouselIndexByUpsellingId.value = {
    ...consts.$carouselIndexByUpsellingId.value,
    [upsellingId]: currentIndex <= 0 ? imageListLength - 1 : currentIndex - 1,
  };
};

export const handleCarouselNext = (upsellingId, currentIndex, imageListLength) => {
  consts.$carouselIndexByUpsellingId.value = {
    ...consts.$carouselIndexByUpsellingId.value,
    [upsellingId]: currentIndex >= imageListLength - 1 ? 0 : currentIndex + 1,
  };
};

export const markImageAsFailed = (imageUrl) => {
  consts.$failedImageUrls.value = {
    ...consts.$failedImageUrls.value,
    [imageUrl]: true,
  };
};

// Simplified event handlers (no postCheckout concept)
export const handleUpsellingChange = (upsellingId, quantity) => {
  handlePreCheckoutUpsellingChange(upsellingId, quantity);
};

export const handleUpsellingCustomFieldChange = (upsellingId, unitIndex, fieldLabel, value) => {
  handlePreCheckoutUpsellingCustomFieldChange(upsellingId, unitIndex, fieldLabel, value);
};
