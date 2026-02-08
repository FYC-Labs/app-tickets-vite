/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-nested-ternary */
import { useEffect, useRef, useMemo } from 'react';
import { Card, Alert, Button } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import { $confirmationUrlOverride, $isCompletingFree, $paymentError, $postCheckoutLoaded } from '@src/components/embed/_components/Step2Upsellings/_helpers/step2Upsellings.consts';
import { adjustUpsellingQuantities, handleCompleteFreeOrder, updateFormSubmission, updateOrderWithUpsellings } from '@src/components/embed/_components/Step2Upsellings/_helpers/step2Upsellings.events';
import { createPaymentSessionIfNeeded, loadPostCheckoutUpsellingsData } from '@src/components/embed/_components/Step2Upsellings/_helpers/step2Upsellings.resolvers';
import EmbedUpsellingsList from './EmbedUpsellingsList';
import { postCheckoutUpsellings } from '../_helpers/checkout.consts';

function Step2Upsellings({ onGoBack, onCompletePayment }) {
  const { form, upsellings, formData, order } = $embed.value;
  const { selectedTickets } = $embed.value;

  useEffect(() => {
    $confirmationUrlOverride.value = $embed.value.confirmationUrlOverride ?? null;
  }, [$embed.value.confirmationUrlOverride]);

  const requestPreference = form?.request_communication_preference === true;
  const hasPreferredChannel = Boolean(formData?.preferred_channel?.trim?.());
  const isContactPreferencesValid = !requestPreference || hasPreferredChannel;

  const orderTotal = order != null ? parseFloat(order.total) : null;
  const isFreeOrder = orderTotal !== null && orderTotal <= 0;
  const postCheckoutList = postCheckoutUpsellings.value ?? [];
  const hasPostCheckoutUpsellings = postCheckoutList.length > 0;

  const ticketsKey = JSON.stringify(selectedTickets || {});
  useEffectAsync(async () => {
    adjustUpsellingQuantities();
  }, [ticketsKey]);

  // Load post-checkout upsellings to determine if we should show "Continue to step 3" button
  useEffectAsync(async () => {
    await loadPostCheckoutUpsellingsData(order, form);
  }, [order?.event_id, order?.id, order?.form_submissions, form]);

  // Create payment session only once per order. Nuvei does not allow creating a second
  // session with the same merchantInternalTransactionCode (order.id), so we do not
  // re-create when the order total changes (e.g. after adding upsellings).
  useEffectAsync(async () => {
    const { order: currentOrder, paymentSession: currentSession } = $embed.value;
    await createPaymentSessionIfNeeded(currentOrder, currentSession);
  }, [order?.id, order?.total]);

  // Update form_submission with phone_number, preferred_channel, and custom schema fields (debounced)
  const schemaKeys = useMemo(
    () => form?.schema?.map((f) => (f.field_id_string != null ? f.field_id_string : f.label)) ?? [],
    [form?.schema],
  );
  const contactPrefsKey = JSON.stringify({
    phone_number: $embed.value.formData?.phone_number,
    preferred_channel: $embed.value.formData?.preferred_channel,
    ...Object.fromEntries(schemaKeys.map((k) => [k, $embed.value.formData?.[k]])),
  });
  const debounceRef = useRef(null);
  useEffect(() => {
    const submissionId = order?.form_submission_id;
    if (!submissionId) return () => { };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      const currentFormData = $embed.value.formData;
      await updateFormSubmission(submissionId, currentFormData, schemaKeys);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [order?.form_submission_id, contactPrefsKey, schemaKeys]);

  const upsellingsKey = JSON.stringify($embed.value.selectedUpsellings || {});
  const customFieldsKey = JSON.stringify($embed.value.upsellingCustomFields || {});
  useEffectAsync(async () => {
    await updateOrderWithUpsellings();
  }, [order?.id, upsellingsKey, customFieldsKey]);

  const preCheckoutUpsellings = upsellings.filter(u => u.upselling_strategy === 'PRE-CHECKOUT');
  const showUpsellingsSection = preCheckoutUpsellings.length > 0; // && !upsellingsSectionDismissed;

  return (
    <>
      {showUpsellingsSection && (
        <>
          <div className="mb-32">
            <div className="d-flex justify-content-between align-items-center mb-16">
              <div>
                <h3 className="mb-4">You might also like...</h3>
                <p className="text-muted mb-0">
                  Add these items to your order
                </p>
              </div>
              {onGoBack && (
                <Button
                  type="button"
                  variant="link"
                  className="p-0 text-muted small"
                  onClick={onGoBack}
                >
                  ← Back to tickets
                </Button>
              )}
            </div>
          </div>

          <EmbedUpsellingsList />
        </>
      )}

      <div className="mt-32">
        {$paymentError.value && (
          <Alert variant="danger" className="mb-16">
            {$paymentError.value}
          </Alert>
        )}

        {order && isFreeOrder && (
          <Card>
            <Card.Body>
              <p className="text-muted mb-16">
                Your order total is $0. No payment required.
              </p>
              {$postCheckoutLoaded.value && hasPostCheckoutUpsellings ? (
                <Button
                  variant="dark"
                  size="lg"
                  className="w-100"
                  disabled={!isContactPreferencesValid}
                  onClick={() => {
                    if (onCompletePayment) onCompletePayment();
                  }}
                >
                  Pay and complete order
                </Button>
              ) : $postCheckoutLoaded.value && !hasPostCheckoutUpsellings ? (
                <Button
                  variant="dark"
                  size="lg"
                  className="w-100"
                  disabled={$isCompletingFree.value || !isContactPreferencesValid}
                  onClick={async () => {
                    await handleCompleteFreeOrder();
                  }}
                >
                  {$isCompletingFree.value ? 'Completing...' : 'Complete order'}
                </Button>
              ) : null}
            </Card.Body>
          </Card>
        )}
      </div>
    </>
  );
}

export default Step2Upsellings;
