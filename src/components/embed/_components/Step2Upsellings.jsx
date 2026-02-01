/* eslint-disable no-nested-ternary */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Row, Col, Form, Alert, Button } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { formatPhone } from '@src/components/global/Inputs/UniversalInput/_helpers/universalinput.events';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import { AccruPay } from 'accru-pay-react';
import ordersAPI from '@src/api/orders.api';
import paymentsAPI from '@src/api/payments.api';
import formsAPI from '@src/api/forms.api';
import OrderSummary from './OrderSummary';
import EmbedUpsellingsList from './EmbedUpsellingsList';
import CreditCardForm from './CreditCardForm';
import {
  handleUpsellingChange,
  handleUpsellingCustomFieldChange,
  handleFieldChange,
  handleFreeOrderComplete,
  getUpsellingDiscountAmount,
  goToOrderConfirmation,
  handlePaymentSuccess,
} from '../_helpers/eventForm.events';
import { postCheckoutUpsellings } from '../_helpers/checkout.consts';
import { loadPostCheckoutUpsellings } from '../_helpers/checkout.resolvers';

function Step2Upsellings({ onGoBack, onCompletePayment, paymentFormRenderedByParent = false }) {
  const [searchParams] = useSearchParams();
  const { form, upsellings, formData, paymentSession } = $embed.value;
  const { selectedTickets, selectedUpsellings, upsellingCustomFields, order } = $embed.value;
  const confirmationUrlOverride = searchParams.get('confirmationUrl');
  const providers = paymentSession?.preSessionData
    ? [{ name: 'nuvei', config: paymentSession.preSessionData }]
    : null;

  const requestPhone = form?.request_phone_number === true;
  const requestPreference = form?.request_communication_preference === true;
  const showExtraFields = requestPhone || requestPreference;
  const hasPreferredChannel = Boolean(formData?.preferred_channel?.trim?.());
  const isContactPreferencesValid = !requestPreference || hasPreferredChannel;

  const totalTicketsSelected = Object.values(selectedTickets || {}).reduce((sum, qty) => sum + (qty || 0), 0);

  const orderTotal = order != null ? parseFloat(order.total) : null;
  const isFreeOrder = orderTotal !== null && orderTotal <= 0;
  const postCheckoutList = postCheckoutUpsellings.value ?? [];
  const hasPostCheckoutUpsellings = postCheckoutList.length > 0;
  const showPaymentForm = !paymentFormRenderedByParent && order && paymentSession?.sessionToken && !isFreeOrder && order.status === 'PENDING' && parseFloat(order?.total) > 0;

  const [paymentError, setPaymentError] = useState(null);
  const [isCompletingFree, setIsCompletingFree] = useState(false);
  const [upsellingsTimerRemaining, setUpsellingsTimerRemaining] = useState(50);
  const [upsellingsSectionDismissed, setUpsellingsSectionDismissed] = useState(false);
  const [postCheckoutLoaded, setPostCheckoutLoaded] = useState(false);

  const ticketsKey = JSON.stringify(selectedTickets || {});
  useEffectAsync(async () => {
    const { selectedUpsellings: currentSelectedUpsellings, upsellings: currentUpsellings } = $embed.value;
    const currentTotalTickets = Object.values(selectedTickets || {}).reduce((sum, qty) => sum + (qty || 0), 0);

    let needsUpdate = false;
    const updatedSelectedUpsellings = { ...currentSelectedUpsellings };

    Object.entries(currentSelectedUpsellings || {}).forEach(([upsellingId, quantity]) => {
      if (quantity > 0) {
        const upselling = currentUpsellings.find((u) => u.id === upsellingId);
        if (upselling && upselling.quantity_rule === 'MATCHES_TICKET_COUNT' && quantity > currentTotalTickets) {
          updatedSelectedUpsellings[upsellingId] = currentTotalTickets;
          needsUpdate = true;
        }
      }
    });

    if (needsUpdate) {
      $embed.update({ selectedUpsellings: updatedSelectedUpsellings });
    }
  }, [ticketsKey]);

  // Load post-checkout upsellings to determine if we should show "Continue to step 3" button
  useEffectAsync(async () => {
    if (order?.event_id) {
      await loadPostCheckoutUpsellings(order.event_id, order, form);
      setPostCheckoutLoaded(true);
    } else {
      setPostCheckoutLoaded(false);
    }
  }, [order?.event_id, order?.id, order?.form_submissions, form]);

  // Create payment session only once per order. Nuvei does not allow creating a second
  // session with the same merchantInternalTransactionCode (order.id), so we do not
  // re-create when the order total changes (e.g. after adding upsellings).
  useEffectAsync(async () => {
    const { order: currentOrder, paymentSession: currentSession } = $embed.value;
    if (!currentOrder || currentOrder.status === 'PAID') return;
    if (parseFloat(currentOrder.total) <= 0) return;
    if (currentSession?.sessionToken) return;
    try {
      const session = await paymentsAPI.createPaymentSession(currentOrder.id);
      if (session?.sessionToken) {
        $embed.update({ paymentSession: session });
      }
    } catch {
      // Session creation can fail; paymentError will show when user tries to pay
    }
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
    if (!submissionId) return () => {};

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      const currentFormData = $embed.value.formData;
      const patch = {};
      if (currentFormData?.phone_number !== undefined) patch.phone_number = currentFormData.phone_number ?? null;
      if (currentFormData?.preferred_channel !== undefined) patch.preferred_channel = currentFormData.preferred_channel ?? null;
      schemaKeys.forEach((key) => {
        if (currentFormData?.[key] !== undefined) patch[key] = currentFormData[key] ?? null;
      });
      if (Object.keys(patch).length === 0) return;
      try {
        await formsAPI.updateSubmission(submissionId, patch);
      } catch {
        // Non-blocking
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [order?.form_submission_id, contactPrefsKey, schemaKeys]);

  const preCheckoutUpsellingsList = upsellings?.filter((u) => u.upselling_strategy === 'PRE-CHECKOUT') ?? [];

  useEffect(() => {
    if (preCheckoutUpsellingsList.length === 0 || upsellingsSectionDismissed) {
      return undefined;
    }
    const id = setInterval(() => {
      setUpsellingsTimerRemaining((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [upsellingsSectionDismissed, preCheckoutUpsellingsList.length]);

  useEffect(() => {
    if (upsellingsTimerRemaining !== 0 || upsellingsSectionDismissed) return;
    const selected = $embed.value.selectedUpsellings || {};
    const hasAny = Object.values(selected).some((q) => (q || 0) > 0);
    if (!hasAny) setUpsellingsSectionDismissed(true);
  }, [upsellingsTimerRemaining, upsellingsSectionDismissed]);

  const upsellingsKey = JSON.stringify($embed.value.selectedUpsellings || {});
  const customFieldsKey = JSON.stringify($embed.value.upsellingCustomFields || {});
  useEffectAsync(async () => {
    const {
      order: currentOrder,
      selectedUpsellings: currentSelectedUpsellings,
      upsellingCustomFields: currentUpsellingCustomFields,
      upsellings: currentUpsellings,
    } = $embed.value;

    if (!currentOrder) {
      return;
    }

    if (currentOrder.status === 'PAID') {
      return;
    }

    try {
      const upsellingEntries = Object.entries(currentSelectedUpsellings || {});

      const upsellingOrderItems = upsellingEntries
        .filter(([, quantity]) => quantity > 0)
        .flatMap(([upsellingId, quantity]) => {
          const upselling = currentUpsellings.find((u) => u.id === upsellingId);
          if (!upselling) {
            return [];
          }

          const unitPrice = parseFloat(upselling.amount ?? upselling.price);
          const rawCustom = (currentUpsellingCustomFields && currentUpsellingCustomFields[upsellingId]) || {};
          const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;

          if (!hasCustomFields) {
            return [
              {
                upselling_id: upsellingId,
                quantity,
                unit_price: unitPrice,
                custom_fields: {},
              },
            ];
          }

          const perUnitList = Array.isArray(rawCustom) ? rawCustom : (rawCustom && typeof rawCustom === 'object' ? [rawCustom] : []);
          const items = [];
          for (let i = 0; i < quantity; i++) {
            const customFieldValues = perUnitList[i] && typeof perUnitList[i] === 'object' ? perUnitList[i] : {};
            const allFieldsComplete = upselling.custom_fields.every(field => {
              const value = customFieldValues[field.label];
              return value !== undefined && value !== null && value !== '';
            });
            if (!allFieldsComplete) {
              return [];
            }
            items.push({
              upselling_id: upsellingId,
              quantity: 1,
              unit_price: unitPrice,
              custom_fields: customFieldValues,
            });
          }
          return items;
        });

      const upsellingDiscountAmount = getUpsellingDiscountAmount();
      const updatedOrder = await ordersAPI.updatePendingItems(
        currentOrder.id,
        upsellingOrderItems,
        upsellingDiscountAmount,
      );
      $embed.update({ order: updatedOrder });
    } catch (err) {
      setPaymentError(err.message || 'Error updating order with upsellings. Please try again.');
    }
  }, [order?.id, upsellingsKey, customFieldsKey]);

  const renderFormSchemaField = (field, index) => {
    const key = field.field_id_string != null ? field.field_id_string : field.label;
    const value = formData?.[key] ?? '';
    return (
      <FormDynamicField
        key={index}
        field={field}
        index={index}
        value={value}
        groupClassName="mb-16"
        labelClassName="small"
        selectPlaceholder={field.placeholder || 'Select...'}
        onChange={(newValue) => handleFieldChange(field.label, newValue, field.field_id_string)}
      />
    );
  };

  const preCheckoutUpsellings = upsellings.filter(u => u.upselling_strategy === 'PRE-CHECKOUT');
  const showUpsellingsSection = preCheckoutUpsellings.length > 0 && !upsellingsSectionDismissed;

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
                  {upsellingsTimerRemaining > 0 && (
                    <span className="ms-8 text-warning fw-semibold">
                      — Offer ends in {upsellingsTimerRemaining}s
                    </span>
                  )}
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

          <EmbedUpsellingsList
            upsellings={preCheckoutUpsellings}
            selectedUpsellings={selectedUpsellings || {}}
            onUpsellingChange={handleUpsellingChange}
            upsellingCustomFields={upsellingCustomFields || {}}
            onUpsellingCustomFieldChange={handleUpsellingCustomFieldChange}
            totalTicketsSelected={totalTicketsSelected}
            form={form}
          />
        </>
      )}

      {showExtraFields && (
        <Card className="mt-32 border-0">
          <Card.Body className="p-24">
            <h6 className="mb-16 fw-semibold">Contact preferences</h6>
            <Row>
              {requestPhone && (
                <Col xs={12} md={requestPreference ? 6 : 12} className="mb-16 mb-md-0">
                  <Form.Group>
                    <Form.Label className="small">Phone number</Form.Label>
                    <UniversalInput
                      type="tel"
                      name="phone_number"
                      value={formData?.phone_number ?? ''}
                      customOnChange={(e) => handleFieldChange('phone_number', formatPhone(e.target.value))}
                      placeholder="(555) 123-4567"
                      className="form-control"
                    />
                  </Form.Group>
                </Col>
              )}
              {requestPreference && (
                <Col xs={12} md={requestPhone ? 6 : 12}>
                  <Form.Group>
                    <Form.Label className="small">How would you like to be contacted? *</Form.Label>
                    <UniversalInput
                      as="select"
                      name="preferred_channel"
                      value={formData?.preferred_channel ?? ''}
                      customOnChange={(e) => handleFieldChange('preferred_channel', e.target.value)}
                      className="form-control"
                      required
                    >
                      <option value="">Select...</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                    </UniversalInput>
                  </Form.Group>
                </Col>
              )}
            </Row>
          </Card.Body>
        </Card>
      )}

      {form?.schema?.length > 0 && (
        <Card className="mt-32 border-0">
          <Card.Body className="p-24">
            <h6 className="mb-16 fw-semibold">Additional information</h6>
            {form.schema.map((field, index) => renderFormSchemaField(field, index))}
          </Card.Body>
        </Card>
      )}

      {order && (
        <div className="mt-32">
          <OrderSummary order={order} />
        </div>
      )}

      <div className="mt-32">
        <h4 className="mb-16">Complete your order</h4>

        {paymentError && (
          <Alert variant="danger" className="mb-16">
            {paymentError}
          </Alert>
        )}

        {order && isFreeOrder && (
          <Card>
            <Card.Body>
              <p className="text-muted mb-16">
                Your order total is $0. No payment required.
              </p>
              {postCheckoutLoaded && hasPostCheckoutUpsellings ? (
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
              ) : postCheckoutLoaded && !hasPostCheckoutUpsellings ? (
                <Button
                  variant="dark"
                  size="lg"
                  className="w-100"
                  disabled={isCompletingFree || !isContactPreferencesValid}
                  onClick={async () => {
                    try {
                      setIsCompletingFree(true);
                      setPaymentError(null);
                      // For free orders without post-checkout upsellings, redirect directly to confirmation
                      await handleFreeOrderComplete(confirmationUrlOverride);
                    } catch (err) {
                      setPaymentError(err.message || 'Unable to complete order. Please try again.');
                    } finally {
                      setIsCompletingFree(false);
                    }
                  }}
                >
                  {isCompletingFree ? 'Completing...' : 'Complete order'}
                </Button>
              ) : null}
            </Card.Body>
          </Card>
        )}

        {showPaymentForm && providers && (
          <Card className="mt-32 border-0">
            <Card.Body className="p-24">
              <h5 className="mb-24">Payment Information</h5>
              <AccruPay
                sessionToken={paymentSession.sessionToken}
                preferredProvider="nuvei"
                preReleaseGetProviders={() => providers || []}
              >
                <CreditCardForm
                  order={order}
                  onPaymentSuccess={async (paymentData) => {
                    await handlePaymentSuccess(paymentData, confirmationUrlOverride, { skipRedirect: true });
                    if (onCompletePayment) {
                      onCompletePayment();
                    } else {
                      goToOrderConfirmation(confirmationUrlOverride);
                    }
                  }}
                />
              </AccruPay>
              {paymentError && (
                <Alert variant="danger" className="mt-16 mb-0">
                  {paymentError}
                </Alert>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Show "Continue to step 3" button for non-free orders with post-checkout upsellings */}
        {order && !isFreeOrder && postCheckoutLoaded && hasPostCheckoutUpsellings && (
          <div className="mt-32">
            <Button
              variant="dark"
              size="lg"
              className="w-100"
              onClick={() => {
                if (onCompletePayment) onCompletePayment();
              }}
            >
              Pay and complete order
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

export default Step2Upsellings;
