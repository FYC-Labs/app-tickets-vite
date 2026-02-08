import { $embed } from '@src/signals';
import EmbedUpsellingCard from './EmbedUpsellingCard';

function EmbedUpsellingsList({ disabled = false }) {
  return (
    <div>
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
