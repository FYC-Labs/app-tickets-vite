import storageAPI from '@src/api/storage.api';
import * as consts from './embedUpsellings.consts';

export const loadSignedImageUrls = async (embedImageUrlsKey) => {
  if (!embedImageUrlsKey) {
    consts.$signedImageUrls.value = {};
    consts.$failedImageUrls.value = {};
    return;
  }

  consts.$failedImageUrls.value = {};
  const allUrls = embedImageUrlsKey.split(',').filter(Boolean);
  const uniqueUrlsToSign = [...new Set(allUrls)].filter((url) => url.includes('upselling-images'));

  try {
    const pairs = await Promise.all(
      uniqueUrlsToSign.map(async (url) => {
        try {
          const signed = await storageAPI.getSignedUpsellingImageUrl(url);
          return [url, signed];
        } catch {
          return [url, url];
        }
      }),
    );
    consts.$signedImageUrls.value = Object.fromEntries(pairs);
  } catch (error) {
    // If there's an error, set $signedImageUrls to empty object
    consts.$signedImageUrls.value = {};
  }
};
