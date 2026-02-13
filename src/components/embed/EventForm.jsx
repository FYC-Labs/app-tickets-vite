import EmbeddedCheckoutFlow from './EmbeddedCheckoutFlow';

function EventForm({ formId, eventId, theme = 'light' }) {
  return <EmbeddedCheckoutFlow formId={formId} eventId={eventId} theme={theme} />;
}

export default EventForm;
