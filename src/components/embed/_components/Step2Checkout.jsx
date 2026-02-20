import EmbedUpsellingsList from '@src/components/embed/_components/EmbedUpsellingsList';
import { $embed } from '@src/signals';

const Step2Checkout = () => (
  <div className={`d-${$embed.value.showUpsellings ? 'block' : 'none'}`}>
    <EmbedUpsellingsList />
  </div>
);

export default Step2Checkout;
