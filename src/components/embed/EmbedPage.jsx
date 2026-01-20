import { useParams, useSearchParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { $embed } from '@src/signals';
import EventForm from './EventForm';

function EmbedPage() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const { form } = $embed.value;
  const confirmationUrlOverride = searchParams.get('confirmationUrl');

  const handleSubmitSuccess = (data) => {
    console.log('data', data);
    if (data.order) {
      // Build checkout URL with embed=true and optional confirmationUrl
      const params = new URLSearchParams();
      params.set('embed', 'true'); // Indicate we're in an iframe

      if (confirmationUrlOverride) {
        params.set('confirmationUrl', confirmationUrlOverride);
      }

      const checkoutUrl = `/embed/checkout/${data.order.id}?${params.toString()}`;
      window.location.href = checkoutUrl;
    } else {
      alert('Form submitted successfully!');
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: '800px' }}>
      <EventForm
        formId={formId}
        onSubmitSuccess={handleSubmitSuccess}
        theme={form?.theme || 'light'}
      />
    </Container>
  );
}

export default EmbedPage;
