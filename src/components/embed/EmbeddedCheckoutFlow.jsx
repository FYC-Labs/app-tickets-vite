import { useState } from 'react';
import { Card } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import Loader from '@src/components/global/Loader';
import { loadFormData } from './_helpers/eventForm.events';
import Step1Checkout from './_components/Step1Checkout';
import Step2Upsellings from './_components/Step2Upsellings';

function EmbeddedCheckoutFlow({ formId, eventId, theme = 'light' }) {
  const { isLoading } = $embed.value;
  const [currentStep, setCurrentStep] = useState(1);

  useEffectAsync(async () => {
    await loadFormData(formId, eventId);
  }, [formId, eventId]);

  if (isLoading) {
    return (
      <div className="min-vh-100 w-100 d-flex justify-content-center align-items-center">
        <Loader className="text-center" />
      </div>
    );
  }

  return (
    <Card className={`${theme} border-0`}>
      <Card.Body>
        {currentStep === 1 && (
          <Step1Checkout
            formId={formId}
            eventId={eventId}
            theme={theme}
            onPlaceOrder={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 2 && (
          <Step2Upsellings
            formId={formId}
            eventId={eventId}
            theme={theme}
            onGoBack={() => setCurrentStep(1)}
          />
        )}
      </Card.Body>
    </Card>
  );
}

export default EmbeddedCheckoutFlow;
