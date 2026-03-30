import { useParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { $embed } from '@src/signals';
import EventForm from './EventForm';

function EmbedPage() {
  const { formId } = useParams();
  // const [searchParams] = useSearchParams();
  const { form } = $embed.value;
  const theme = form?.theme || 'light';
  let pageBgClass = 'light';
  if (!form || theme === 'scale-up') {
    pageBgClass = 'scale-up';
  }
  // const confirmationUrlOverride = searchParams.get('confirmationUrl');

  return (
    <div className={`${pageBgClass} min-vh-100`}>
      <Container className="py-5" style={{ maxWidth: '800px' }}>
        <EventForm
          formId={formId}
          theme={theme}
        />
      </Container>
    </div>
  );
}

export default EmbedPage;
