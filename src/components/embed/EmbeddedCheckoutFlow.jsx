/* eslint-disable react-hooks/exhaustive-deps */
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
import { handlePaymentSuccess, goToOrderConfirmation, handleFreeOrderComplete, loadFormData, createOrderForPayment } from './_helpers/eventForm.events';
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

  const confirmationUrlOverride = searchParams.get('confirmationUrl');
  const orderTotal = order != null ? parseFloat(order?.total || 0) : null;
  const providers = useMemo(
    () => (paymentSession?.preSessionData ? [{ name: 'nuvei', config: paymentSession.preSessionData }] : null),
    [paymentSession?.preSessionData, paymentSession?.sessionToken],
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

  useEffectAsync(async () => {
    await loadFormData(formId, eventId);
  }, [formId, eventId]);

  // Auto-create order when tickets are selected and contact info is available in Step 1
  // This reduces clicks by creating the order automatically, which starts the payment session
  const orderCreationInProgressRef = useRef(false);

  // Extract values for dependency tracking
  const formEmail = $embed.value.formData?.email;
  const formName = $embed.value.formData?.name;
  const selectedTicketsForDep = $embed.value.selectedTickets;
  const selectedTicketsKey = useMemo(() => JSON.stringify(selectedTicketsForDep || {}), [selectedTicketsForDep]);

  useEffectAsync(async () => {
    // Only run in Step 1
    if (currentStep !== 1) {
      orderCreationInProgressRef.current = false;
      return;
    }

    const { formData, selectedTickets, order: currentOrder } = $embed.value;
    const hasContactInfo = Boolean(formData?.email && formData?.name);
    const hasTicketsSelected = Object.values(selectedTickets || {}).some((qty) => qty > 0);

    // Only create order if we have email, name, and tickets selected
    if (!hasContactInfo || !hasTicketsSelected) {
      orderCreationInProgressRef.current = false;
      return;
    }

    // Don't create if order already exists and has items
    if (currentOrder && currentOrder.order_items && currentOrder.order_items.length > 0) {
      orderCreationInProgressRef.current = false;
      return;
    }

    // Prevent multiple simultaneous creation attempts
    if (orderCreationInProgressRef.current) return;

    try {
      orderCreationInProgressRef.current = true;
      const newOrder = await createOrderForPayment(formId, eventId);
      if (!newOrder) {
        orderCreationInProgressRef.current = false;
      }
      // Payment session will be created automatically by the effect below when total > 0
    } catch (err) {
      // Silently fail - order creation will be retried when conditions change
      orderCreationInProgressRef.current = false;
    } finally {
      // Reset after a delay to allow for order creation
      setTimeout(() => {
        orderCreationInProgressRef.current = false;
      }, 1000);
    }
  }, [formId, eventId, currentStep, formEmail, formName, selectedTicketsKey, order?.id]);

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

  // Create payment session when order total becomes > 0 in any step
  // This ensures AccruPay session is created early to preserve state between steps
  // Handles: order starts at $0 but tickets/upsellings are added, or order created with total > 0
  useEffectAsync(async () => {
    // Read current values directly from state/signal/ref to avoid stale closures
    const currentOrder = $embed.value.order;
    const currentOrderTotal = currentOrder != null ? parseFloat(currentOrder?.total || 0) : null;
    const signalSession = $embed.value.paymentSession;

    // Only proceed if we have a valid order with total > 0 and no session yet
    if (!currentOrder || currentOrder.status === 'PAID') return;
    if (currentOrderTotal <= 0) return;
    if (signalSession?.sessionToken) return;

    try {
      // Create session - this initializes AccruPay and preserves state between steps
      const session = await paymentsAPI.createPaymentSession(currentOrder.id);
      if (session?.sessionToken) {
        $embed.update({ paymentSession: session });
      }
    } catch (err) {
      // Session creation can fail; paymentError will show when user tries to pay
      // The effect will retry when order.total changes again
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
            // onGoBack={() => setCurrentStep(1)}
            onCompletePayment={() => setCurrentStep(3)}
            paymentFormRenderedByParent
          />
        )}
        {currentStep === 3 && hasPostCheckoutUpsellings && (
          <Step3UpsellingsPost />
        )}

        {/* Read paymentSession directly from signal in render to ensure reactivity */}
        {(() => {
          const currentSession = $embed.value.paymentSession;
          const shouldShow = (currentStep === 1 || currentStep === 2 || currentStep === 3)
            && order
            && currentSession?.sessionToken
            && !isPaidOrder
            && orderTotal > 0;

          if (!shouldShow) return null;

          return (
            <div className="mt-32 pt-32 border-top">
              {/* Show "Payment details" title only in step 1, or when fields are visible in step 2/3 */}
              {(currentStep === 1 || (currentStep !== 1 && !sessionExistedAtStep2Ref.current && currentSession?.sessionToken && orderTotal > 0)) && (
                <h5 className="mb-24">Payment details</h5>
              )}
              <AccruPay
                sessionToken={currentSession.sessionToken}
                preferredProvider="nuvei"
                preReleaseGetProviders={getProviders}
              >
                <CreditCardForm
                  order={order}
                  showCardFields={
                    // Show fields in step 1 always if there's a session
                    // OR in step 2/3 if session was created AFTER entering step 2 (total went from 0 to >0)
                    // If session existed when entering step 2, hide fields (order came from step 1 with total > 0)
                    currentStep === 1 ? true : (currentStep !== 1 && !sessionExistedAtStep2Ref.current && currentSession?.sessionToken && orderTotal > 0)
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
          );
        })()}

        {/* Show "Complete order" button when order is free (total = 0) in step 3 */}
        {/* Only show if there's no payment session (i.e., total hasn't changed to > 0) */}
        {currentStep === 3 && order && isFreeOrder && !isPaidOrder && hasPostCheckoutUpsellings && !paymentSession?.sessionToken && (
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
