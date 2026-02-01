/* eslint-disable consistent-return */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button } from 'react-bootstrap';
import { AccruPay } from 'accru-pay-react';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import Loader from '@src/components/global/Loader';
import paymentsAPI from '@src/api/payments.api';
import { postCheckoutUpsellings } from './_helpers/checkout.consts';
import { loadPostCheckoutUpsellings } from './_helpers/checkout.resolvers';
import { handlePaymentSuccess, goToOrderConfirmation, handleFreeOrderComplete, loadFormData } from './_helpers/eventForm.events';
import Step1Checkout from './_components/Step1Checkout';
import Step2Upsellings from './_components/Step2Upsellings';
import Step3UpsellingsPost from './_components/Step3UpsellingsPost';
import CreditCardForm from './_components/CreditCardForm';

function EmbeddedCheckoutFlow({ formId, eventId, theme = 'light' }) {
  const [searchParams] = useSearchParams();
  const { isLoading, order, form, paymentSession } = $embed.value;
  const [currentStep, setCurrentStep] = useState(1);
  const [postCheckoutLoaded, setPostCheckoutLoaded] = useState(false);
  // Use ref to track currentStep to avoid stale closures in useEffectAsync
  const currentStepRef = useRef(currentStep);
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);
  // Track if payment session existed when entering step 2
  // This helps distinguish between:
  // - Order from Step 1 with total > 0 (session existed) → hide fields, show button only
  // - Order total went from 0 to >0 in Step 2 (session created) → show fields
  const sessionExistedAtStep2Ref = useRef(false);
  const prevStepRef = useRef(currentStep);
  useEffect(() => {
    // Detect when we transition TO step 2 (not just when we're in step 2)
    if (prevStepRef.current !== 2 && currentStep === 2) {
      // Just entered step 2 - check if session already exists
      sessionExistedAtStep2Ref.current = Boolean(paymentSession?.sessionToken);
    } else if (currentStep === 1) {
      // Reset when going back to step 1
      sessionExistedAtStep2Ref.current = false;
    }
    prevStepRef.current = currentStep;
  }, [currentStep, paymentSession?.sessionToken]);
  // Use paymentSession from signal destructuring to ensure reactivity
  const currentPaymentSession = paymentSession;

  const confirmationUrlOverride = searchParams.get('confirmationUrl');
  const orderTotal = order != null ? parseFloat(order?.total || 0) : null;
  const providers = useMemo(
    () => (currentPaymentSession?.preSessionData ? [{ name: 'nuvei', config: currentPaymentSession.preSessionData }] : null),
    [currentPaymentSession?.preSessionData, currentPaymentSession?.sessionToken],
  );
  const getProviders = useCallback(() => {
    if (providers) return providers;
    // If we have a sessionToken but no preSessionData yet, return empty array
    // AccruPay will handle it
    return [];
  }, [providers]);
  const isPaidOrder = order?.status === 'PAID';
  const isFreeOrder = orderTotal !== null && orderTotal <= 0;
  const postCheckoutList = postCheckoutUpsellings.value ?? [];
  const hasPostCheckoutUpsellings = postCheckoutList.length > 0;

  // Stable payment success handler to prevent component recreation
  const handlePaymentSuccessCallback = useCallback(
    async (paymentData) => {
      const updatedOrder = await handlePaymentSuccess(paymentData, confirmationUrlOverride, { skipRedirect: true });
      goToOrderConfirmation(confirmationUrlOverride, updatedOrder ?? undefined);
    },
    [confirmationUrlOverride],
  );

  // Keep card form mounted in all steps (1, 2, 3) to preserve AccruPay state
  // Only hide it if order is paid or no session
  // Use currentPaymentSession (read from signal) instead of paymentSession (destructured)
  const showCardForm = (currentStep === 1 || currentStep === 2 || currentStep === 3)
    && order
    && currentPaymentSession?.sessionToken
    && !isPaidOrder
    && orderTotal > 0;

  useEffectAsync(async () => {
    await loadFormData(formId, eventId);
  }, [formId, eventId]);

  // Load post-checkout upsellings as soon as we have an order so step 2 shows the right button
  useEffectAsync(async () => {
    if (order?.event_id) {
      await loadPostCheckoutUpsellings(order.event_id, order, form);
      setPostCheckoutLoaded(true);
    } else {
      setPostCheckoutLoaded(false);
    }
  }, [order?.event_id, order?.id, order?.form_submissions, form]);

  // If we're on step 3 but there are no post-checkout upsellings, go back to step 2
  useEffectAsync(async () => {
    if (currentStep === 3 && postCheckoutLoaded && !hasPostCheckoutUpsellings) {
      setCurrentStep(2);
    }
  }, [currentStep, postCheckoutLoaded, hasPostCheckoutUpsellings]);

  // Create payment session when order total becomes > 0 in step 2 or 3
  // This handles the case where order starts at $0 (100% discount) but upsellings are added
  useEffectAsync(async () => {
    // Read current values directly from state/signal/ref to avoid stale closures
    const currentStepValue = currentStepRef.current;
    const currentOrder = $embed.value.order;
    const currentOrderTotal = currentOrder != null ? parseFloat(currentOrder?.total || 0) : null;
    const signalSession = $embed.value.paymentSession;
    if (currentStepValue !== 2 && currentStepValue !== 3) return;
    if (!currentOrder || currentOrder.status === 'PAID') return;
    if (currentOrderTotal <= 0) return;
    if (signalSession?.sessionToken) return;

    try {
      const session = await paymentsAPI.createPaymentSession(currentOrder.id);
      if (session?.sessionToken) {
        $embed.update({ paymentSession: session });
      }
    } catch (err) {
      // Session creation can fail; paymentError will show when user tries to pay
    }
  }, [order?.id, order?.status, order?.total]);

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
            {/* Show "Payment details" title only in step 1, or when fields are visible in step 2/3 */}
            {(currentStep === 1 || (currentStep !== 1 && !sessionExistedAtStep2Ref.current && currentPaymentSession?.sessionToken && orderTotal > 0)) && (
              <h5 className="mb-24">Payment details</h5>
            )}
            <AccruPay
              sessionToken={currentPaymentSession.sessionToken}
              preferredProvider="nuvei"
              preReleaseGetProviders={getProviders}
            >
              <CreditCardForm
                order={order}
                showCardFields={
                  // Show fields in step 1 always
                  // OR in step 2/3 if session was created AFTER entering step 2 (total went from 0 to >0)
                  // If session existed when entering step 2, hide fields (order came from step 1 with total > 0)
                  currentStep === 1 || (currentStep !== 1 && !sessionExistedAtStep2Ref.current && currentPaymentSession?.sessionToken && orderTotal > 0)
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
                Place order
              </Button>
            )}
            {currentStep === 2 && postCheckoutLoaded && hasPostCheckoutUpsellings && (
              <Button
                variant="dark"
                size="lg"
                className="w-100 mt-24"
                onClick={() => setCurrentStep(3)}
              >
                Pay and complete order
              </Button>
            )}
          </div>
        )}

        {/* Show "Complete order" button when order is free (total = 0) in step 3 */}
        {/* Only show if there's no payment session (i.e., total hasn't changed to > 0) */}
        {currentStep === 3 && order && isFreeOrder && !isPaidOrder && hasPostCheckoutUpsellings && !currentPaymentSession?.sessionToken && (
          <div className="mt-32 pt-32 border-top">
            <h5 className="mb-24">Complete your order</h5>
            <p className="text-muted mb-16">
              Your order total is $0. No payment required.
            </p>
            <Button
              variant="dark"
              size="lg"
              className="w-100"
              onClick={async () => {
                await handleFreeOrderComplete(confirmationUrlOverride);
              }}
            >
              Complete Order
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default EmbeddedCheckoutFlow;
