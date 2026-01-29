import { useParams, useSearchParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { $embed } from '@src/signals';
import EventForm from './EventForm';

function EmbedPage() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const { form } = $embed.value;
  const confirmationUrlOverride = searchParams.get('confirmationUrl');

  return (
    <Container className="py-5" style={{ maxWidth: '800px' }}>
      <EventForm
        formId={formId}
        theme={form?.theme || 'light'}
      />
    </Container>
  );
}

export default EmbedPage;
