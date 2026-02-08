import { $embed } from '@src/signals';
import { $upsellTimer } from '@src/components/embed/_helpers/checkout.consts';
import { useEffect } from 'react';
import { handleClickPayNow } from '@src/components/embed/_helpers/eventForm.events';
import EmbedUpsellingCard from './EmbedUpsellingCard';

function EmbedUpsellingsList({ disabled = false }) {
  useEffect(() => {
    console.log('EmbedUpsellingsList', $embed.value.upsellings);
    $upsellTimer.value = 15;
  }, [$embed.value.currentStep]);

  useEffect(() => {
    if ($embed.value.currentStep !== 'upsell') return;
    const timer = setInterval(() => {
      if ($upsellTimer.value > 0) {
        $upsellTimer.value--;
      } else {
        if ($embed.value.currentStep !== 'upsell') return;
        handleClickPayNow();
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);
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
