/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import Loader from '@src/components/global/Loader';
import { handleClickPayNow } from '@src/components/embed/_helpers/eventForm.events';
import EmbedUpsellingsList from '@src/components/embed/_components/EmbedUpsellingsList';
import EmbedOrderTotals from '@src/components/embed/_components/EmbedOrderTotals';
import CardLoader from '@src/components/global/CardLoader';
import { handlePaymentSuccess, goToOrderConfirmation, loadFormData, updateIsPayNowDisabled } from './_helpers/eventForm.events';
import Step1Checkout from './_components/Step1Checkout';
import EmbedPaymentDetails from './_components/EmbedPaymentDetails';
import DiscountCodeInput from './_components/DiscountCodeInput';

function EmbeddedCheckoutFlow({ formId, eventId, theme = 'light' }) {
  const [searchParams] = useSearchParams();
  const confirmationUrlOverride = searchParams.get('confirmationUrl');
  const orderTotal = $embed.value.order != null ? parseFloat($embed.value.order?.total || 0) : null;

  const handlePaymentSuccessCallback = useCallback(
    async (paymentData) => {
      const updatedOrder = await handlePaymentSuccess(paymentData, confirmationUrlOverride, { skipRedirect: true });
      goToOrderConfirmation(confirmationUrlOverride, updatedOrder ?? undefined);
    },
    [confirmationUrlOverride],
  );

  useEffect(() => {
    updateIsPayNowDisabled();
  }, [$embed.value.formData, $embed.value.order, $embed.value.selectedTickets, $embed.value.selectedUpsellings]);

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
        <div className={`d-${$embed.value.currentStep === 'initial' ? 'block' : 'none'}`}>
          <Step1Checkout
            formId={formId}
            eventId={eventId}
            theme={theme}
            onPlaceOrder={() => { }}
          />
          {$embed.value.isLoadingCCForm && (
            <div className="d-flex justify-content-center align-items-center">
              <CardLoader message="Loading payment form..." />
            </div>
          )}
          {$embed.value.order && (
            <EmbedPaymentDetails onPaymentSuccess={handlePaymentSuccessCallback} />
          )}
        </div>
        <div className={`d-${$embed.value.currentStep === 'upsell' ? 'block' : 'none'}`}>
          <EmbedUpsellingsList />
        </div>
        <DiscountCodeInput
          formId={formId}
          eventId={eventId}
          className="mt-24"
        />
        <Button
          variant="dark"
          size="lg"
          className="w-100 mt-24"
          onClick={handleClickPayNow}
          disabled={$embed.value.isPayNowDisabled}
        >
          Pay ${orderTotal?.toFixed(2)} Now
        </Button>
        <EmbedOrderTotals />
      </Card.Body>
    </Card>
  );
}

export default EmbeddedCheckoutFlow;
