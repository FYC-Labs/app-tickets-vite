/* eslint-disable consistent-return */
/* eslint-disable react-hooks/exhaustive-deps */
import { $embed } from '@src/signals';
import { $upsellTimer } from '@src/components/embed/_helpers/checkout.consts';
import { useEffect } from 'react';
import { handleClickPayNow } from '@src/components/embed/_helpers/eventForm.events';
import EmbedUpsellingCard from './EmbedUpsellingCard';

function EmbedUpsellingsList({ disabled = false }) {
  // Reset timer when entering upsell step
  useEffect(() => {
    if ($embed.value.currentStep === 'upsell') {
      $upsellTimer.value = 15;
    }
  }, [$embed.value.currentStep]);

  useEffect(() => {
    if ($embed.value.currentStep !== 'upsell') {
      return;
    }

    if ($embed.value.isPayNowDisabled) {
      return;
    }

    const timer = setInterval(() => {
      if ($embed.value.currentStep !== 'upsell' || $embed.value.isPayNowDisabled) {
        clearInterval(timer);
        return;
      }

      if ($upsellTimer.value > 0) {
        $upsellTimer.value--;
      } else {
        clearInterval(timer);
        handleClickPayNow();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [$embed.value.currentStep, $embed.value.isPayNowDisabled]);
  return (
    <div style={{ minHeight: '300px' }}>
      <div className="mb-16">
        <p className="lead text-dark mb-0">
          You might also like...
        </p>
      </div>
      {$embed.value.upsellings?.map((upselling, index) => (
        <EmbedUpsellingCard
          key={upselling.id}
          upselling={upselling}
          index={index}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export default EmbedUpsellingsList;
