/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import Loader from '@src/components/global/Loader';
import CardLoader from '@src/components/global/CardLoader';
import { handleClickPayNow } from '@src/components/embed/_helpers/eventForm.events';
import EmbedUpsellingsList from '@src/components/embed/_components/EmbedUpsellingsList';
import EmbedOrderTotals from '@src/components/embed/_components/EmbedOrderTotals';
import { $upsellTimer, isProcessingPayment } from '@src/components/embed/_helpers/checkout.consts';
import { handlePaymentSuccess, goToOrderConfirmation, loadFormData, updateIsPayNowDisabled } from './_helpers/eventForm.events';
import Step1Checkout from './_components/Step1Checkout';
import EmbedPaymentDetails from './_components/EmbedPaymentDetails';
import DiscountCodeInput from './_components/DiscountCodeInput';

function EmbeddedCheckoutFlow({ formId, eventId, theme = 'light' }) {
  const [searchParams] = useSearchParams();
  const confirmationUrlOverride = searchParams.get('confirmationUrl');

  const handlePaymentSuccessCallback = useCallback(
    async (paymentData) => {
      const updatedOrder = await handlePaymentSuccess(paymentData, confirmationUrlOverride, { skipRedirect: true });
      goToOrderConfirmation(confirmationUrlOverride, updatedOrder ?? undefined);
    },
    [confirmationUrlOverride],
  );

  useEffect(() => {
    updateIsPayNowDisabled();
  }, [$embed.value.formData, $embed.value.order, $embed.value.selectedTickets, $embed.value.selectedUpsellings, $embed.value.isLoadingCCForm]);

  useEffectAsync(async () => {
    await loadFormData(formId, eventId);
  }, [formId, eventId]);

  if ($embed.value.isLoading) {
    return (
      <div className="min-vh-100 w-100 d-flex justify-content-center align-items-center">
        <Loader className="text-center" />
      </div>
    );
  }

  return (
    <Card className={`${theme} border-0`}>
      <Card.Body>
        {isProcessingPayment.value && (
          <div className="bg-light-200 rounded-15 p-16">
            <CardLoader variant="skeleton" message="Processing payment..." />
          </div>
        )}
        <div className={`d-${$embed.value.currentStep === 'initial' ? 'block' : 'none'}`}>
          {!isProcessingPayment.value && (
            <Step1Checkout
              formId={formId}
              eventId={eventId}
              theme={theme}
              onPlaceOrder={() => { }}
            />
          )}
          {$embed.value.order &&
           parseFloat($embed.value.totals?.subtotal) > $embed.value.totals?.discount_amount && (
           <EmbedPaymentDetails onPaymentSuccess={handlePaymentSuccessCallback} />
          )}
        </div>
        <div className={`d-${$embed.value.currentStep === 'checkoutWithUpsell' ? 'block' : 'none'}`}>
          {$embed.value.order && (
            <>
              {$embed.value.totals?.total === 0 && (
                <div className="my-16 lead text-center text-dark bg-light-200 rounded-15 p-16">
                  Your order is $0. Click below to complete your free registration!
                </div>
              )}
              <div className={`d-${$embed.value.totals?.total === 0 ? 'none' : 'block'}`}>
                <EmbedPaymentDetails onPaymentSuccess={handlePaymentSuccessCallback} />
              </div>
            </>
          )}
        </div>
        <div className={`d-${$embed.value.currentStep === 'upsell' ? 'block' : 'none'}`}>
          {!isProcessingPayment.value && <EmbedUpsellingsList />}
        </div>
        {!isProcessingPayment.value && (
          <>
            {$embed.value.order && $embed.value.currentStep === 'initial' && (
              <DiscountCodeInput
                formId={formId}
                eventId={eventId}
                className="mt-24"
              />
            )}
            <Button
              variant="dark"
              size="lg"
              className="w-100 mt-24"
              onClick={handleClickPayNow}
              disabled={$embed.value.isPayNowDisabled}
            >
              {$embed.value.currentStep === 'initial' ? 'Place Order' : 'Complete Checkout'}
            </Button>
            {$embed.value.currentStep === 'upsell' && !$embed.value.isCountDownTimerDisabled && (
              <div className="text-muted text-center mt-8">Auto-completes in {$upsellTimer.value} seconds</div>
            )}
            <EmbedOrderTotals />
          </>
        )}
      </Card.Body>
    </Card>
  );
}

export default EmbeddedCheckoutFlow;
