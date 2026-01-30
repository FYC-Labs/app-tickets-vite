import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button } from 'react-bootstrap';
import { AccruPay } from 'accru-pay-react';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import Loader from '@src/components/global/Loader';
import paymentsAPI from '@src/api/payments.api';
import { postCheckoutUpsellings } from './_helpers/checkout.consts';
import { loadPostCheckoutUpsellings } from './_helpers/checkout.resolvers';
import { loadFormData } from './_helpers/eventForm.events';
import { handlePaymentSuccess, goToOrderConfirmation } from './_helpers/eventForm.events';
import Step1Checkout from './_components/Step1Checkout';
import Step2Upsellings from './_components/Step2Upsellings';
import Step3UpsellingsPost from './_components/Step3UpsellingsPost';
import CreditCardForm from './_components/CreditCardForm';

function EmbeddedCheckoutFlow({ formId, eventId, theme = 'light' }) {
  const [searchParams] = useSearchParams();
  const { isLoading, order, paymentSession, form } = $embed.value;
  const [currentStep, setCurrentStep] = useState(1);
  const [postCheckoutLoaded, setPostCheckoutLoaded] = useState(false);

  const confirmationUrlOverride = searchParams.get('confirmationUrl');
  const providers = useMemo(
    () => (paymentSession?.preSessionData ? [{ name: 'nuvei', config: paymentSession.preSessionData }] : null),
    [paymentSession?.preSessionData]
  );
  const getProviders = useCallback(() => providers || [], [providers]);
  const orderTotal = order != null ? parseFloat(order?.total) : null;
  const isPaidOrder = order?.status === 'PAID';
  const postCheckoutList = postCheckoutUpsellings.value ?? [];
  const hasPostCheckoutUpsellings = postCheckoutList.length > 0;

  // Stable payment success handler to prevent component recreation
  const handlePaymentSuccessCallback = useCallback(
    async (paymentData) => {
      const updatedOrder = await handlePaymentSuccess(paymentData, confirmationUrlOverride, { skipRedirect: true });
      goToOrderConfirmation(confirmationUrlOverride, updatedOrder ?? undefined);
    },
    [confirmationUrlOverride]
  );

  // Keep card form mounted in all steps (1, 2, 3) to preserve AccruPay state
  // Only hide it if order is paid or no session
  const showCardForm = (currentStep === 1 || currentStep === 2 || currentStep === 3)
    && order
    && paymentSession?.sessionToken
    && !isPaidOrder
    && orderTotal > 0;

  useEffectAsync(async () => {
    await loadFormData(formId, eventId);
  }, [formId, eventId]);

  // Load post-checkout upsellings as soon as we have an order so step 2 shows the right button
  useEffectAsync(async () => {
    if (order?.event_id) {
      await loadPostCheckoutUpsellings(order.event_id, form ?? null);
      setPostCheckoutLoaded(true);
    } else {
      setPostCheckoutLoaded(false);
    }
  }, [order?.event_id, order?.id, form]);

  // If we're on step 3 but there are no post-checkout upsellings, go back to step 2
  useEffectAsync(async () => {
    if (currentStep === 3 && postCheckoutLoaded && !hasPostCheckoutUpsellings) {
      setCurrentStep(2);
    }
  }, [currentStep, postCheckoutLoaded, hasPostCheckoutUpsellings]);

  // Create payment session when order total becomes > 0 in step 2 or 3
  // This handles the case where order starts at $0 (100% discount) but upsellings are added
  useEffectAsync(async () => {
    if (currentStep !== 2 && currentStep !== 3) return;
    if (!order || order.status === 'PAID') return;
    if (orderTotal <= 0) return;
    if (paymentSession?.sessionToken) return;

    try {
      const session = await paymentsAPI.createPaymentSession(order.id);
      if (session?.sessionToken) {
        $embed.update({ paymentSession: session });
      }
    } catch {
      // Session creation can fail; paymentError will show when user tries to pay
    }
  }, [currentStep, order?.id, order?.status, orderTotal, paymentSession?.sessionToken]);

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
            onCompletePayment={() => setCurrentStep(3)}
            paymentFormRenderedByParent
          />
        )}
        {currentStep === 3 && hasPostCheckoutUpsellings && (
          <Step3UpsellingsPost />
        )}

        {showCardForm && providers && (
          <div className="mt-32 pt-32 border-top">
            {currentStep === 1 && <h5 className="mb-24">Payment details</h5>}
            <AccruPay
              sessionToken={paymentSession.sessionToken}
              preferredProvider="nuvei"
              preReleaseGetProviders={getProviders}
            >
              <CreditCardForm
                order={order}
                showCardFields={
                  // Show fields in step 1 always, or in step 2/3 when there's a payment session
                  // (e.g., when order total becomes > 0 after adding upsellings to a 100% discount)
                  currentStep === 1 || (paymentSession?.sessionToken && orderTotal > 0)
                }
                showSubmitButton={
                  // Show button in step 2 if no post-checkout upsellings
                  // OR in step 3 if there are post-checkout upsellings
                  (currentStep === 2 && !hasPostCheckoutUpsellings)
                  || (currentStep === 3 && hasPostCheckoutUpsellings)
                }
                onPaymentSuccess={
                  (currentStep === 2 && !hasPostCheckoutUpsellings)
                  || (currentStep === 3 && hasPostCheckoutUpsellings)
                    ? handlePaymentSuccessCallback
                    : undefined
                }
              />
            </AccruPay>
            {currentStep === 1 && (
              <Button
                variant="dark"
                size="lg"
                className="w-100 mt-24"
                onClick={() => setCurrentStep(2)}
              >
                Continue to step 2
              </Button>
            )}
            {currentStep === 2 && postCheckoutLoaded && hasPostCheckoutUpsellings && (
              <Button
                variant="dark"
                size="lg"
                className="w-100 mt-24"
                onClick={() => setCurrentStep(3)}
              >
                Continue to step 3
              </Button>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default EmbeddedCheckoutFlow;
