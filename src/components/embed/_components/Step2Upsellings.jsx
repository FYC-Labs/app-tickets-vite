/* eslint-disable no-nested-ternary */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Row, Col, Form, Alert, Button } from 'react-bootstrap';
import { AccruPay } from 'accru-pay-react';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { $embed } from '@src/signals';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import { formatPhone } from '@src/components/global/Inputs/UniversalInput/_helpers/universalinput.events';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import ordersAPI from '@src/api/orders.api';
import paymentsAPI from '@src/api/payments.api';
import formsAPI from '@src/api/forms.api';
import storageAPI from '@src/api/storage.api';
import CreditCardForm from './CreditCardForm';
import OrderSummary from './OrderSummary';
import {
  handleUpsellingChange,
  handleUpsellingCustomFieldChange,
  handleFieldChange,
  handlePaymentSuccess,
  handleFreeOrderComplete,
  getUpsellingDiscountAmount,
} from '../_helpers/eventForm.events';

function Step2Upsellings({ onGoBack }) {
  const [searchParams] = useSearchParams();
  const { form, upsellings, formData } = $embed.value;
  const { selectedTickets, selectedUpsellings, upsellingCustomFields, order, paymentSession } = $embed.value;

  const requestPhone = form?.request_phone_number === true;
  const requestPreference = form?.request_communication_preference === true;
  const showExtraFields = requestPhone || requestPreference;
  const hasPreferredChannel = Boolean(formData?.preferred_channel?.trim?.());
  const isContactPreferencesValid = !requestPreference || hasPreferredChannel;

  const totalTicketsSelected = Object.values(selectedTickets || {}).reduce((sum, qty) => sum + (qty || 0), 0);

  const orderTotal = order != null ? parseFloat(order.total) : null;
  const isFreeOrder = orderTotal !== null && orderTotal <= 0;

  const [paymentError, setPaymentError] = useState(null);
  const [isCompletingFree, setIsCompletingFree] = useState(false);
  const [upsellingsTimerRemaining, setUpsellingsTimerRemaining] = useState(50);
  const [upsellingsSectionDismissed, setUpsellingsSectionDismissed] = useState(false);
  const [signedImageUrls, setSignedImageUrls] = useState({});
  const [failedImageUrls, setFailedImageUrls] = useState({});
  const [carouselIndexByUpsellingId, setCarouselIndexByUpsellingId] = useState({});
  const [hoverPreview, setHoverPreview] = useState(null);

  const confirmationUrlOverride = searchParams.get('confirmationUrl');

  const providers = paymentSession?.preSessionData
    ? [
      {
        name: 'nuvei',
        config: paymentSession.preSessionData,
      },
    ]
    : null;

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

  // When order total becomes > 0 (e.g. user added upsellings) and we have no session yet, create one
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

  // Signed URLs for all upselling images (carousel + hover)
  const embedImageUrlsKey = (preCheckoutUpsellingsList || [])
    .flatMap((u) => (Array.isArray(u?.images) ? u.images : []))
    .filter((url) => url && typeof url === 'string')
    .filter((url, i, arr) => arr.indexOf(url) === i)
    .join(',');
  useEffect(() => {
    if (!embedImageUrlsKey) {
      setSignedImageUrls({});
      setFailedImageUrls({});
      return undefined;
    }
    setFailedImageUrls({});
    let cancelled = false;
    const allUrls = embedImageUrlsKey.split(',').filter(Boolean);
    const uniqueUrlsToSign = [...new Set(allUrls)].filter((url) => url.includes('upselling-images'));
    Promise.all(
      uniqueUrlsToSign.map(async (url) => {
        try {
          const signed = await storageAPI.getSignedUpsellingImageUrl(url);
          return [url, signed];
        } catch {
          return [url, url];
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setSignedImageUrls(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [embedImageUrlsKey]);

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

  const renderUpsellingCustomField = (field, upsellingId, unitIndex, index) => {
    const unitValues = upsellingCustomFields[upsellingId];
    const isArray = Array.isArray(unitValues);
    const value = isArray && unitValues[unitIndex]
      ? (unitValues[unitIndex][field.label] ?? '')
      : !isArray && unitValues
        ? (unitValues[field.label] ?? '')
        : '';
    const fieldKey = `${upsellingId}_${unitIndex}_${field.label}`;

    return (
      <FormDynamicField
        key={fieldKey}
        field={field}
        index={index}
        name={fieldKey}
        value={value}
        groupClassName="mb-16"
        labelClassName="small"
        selectPlaceholder={field.placeholder || 'Select...'}
        onChange={(newValue) => handleUpsellingCustomFieldChange(upsellingId, unitIndex, field.label, newValue)}
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

          {preCheckoutUpsellings.map((upselling, index) => {
            const imageList = Array.isArray(upselling?.images) ? upselling.images : [];
            const firstImageUrl = imageList[0];
            const currentCarouselIndex = Math.min(
              carouselIndexByUpsellingId[upselling.id] ?? 0,
              Math.max(0, imageList.length - 1),
            );
            const currentImageUrl = imageList[currentCarouselIndex] ?? firstImageUrl;
            const available = upselling.quantity - (upselling.sold || 0);
            const selectedQty = selectedUpsellings[upselling.id] || 0;
            const hasCustomFields = upselling.custom_fields && upselling.custom_fields.length > 0;
            const isSelected = selectedQty > 0;
            const isOnlyOne = upselling.quantity_rule === 'ONLY_ONE';
            const matchesTicketCount = upselling.quantity_rule === 'MATCHES_TICKET_COUNT';

            let maxQuantity = available;
            if (isOnlyOne) {
              maxQuantity = Math.min(1, available);
            } else if (matchesTicketCount) {
              maxQuantity = Math.min(totalTicketsSelected, available);
            }

            let quantityOptions;
            if (isOnlyOne) {
              quantityOptions = maxQuantity > 0 ? [0, 1] : [0];
            } else if (matchesTicketCount) {
              if (maxQuantity <= 0) {
                quantityOptions = [0];
              } else {
                quantityOptions = [0, maxQuantity];
              }
            } else {
              quantityOptions = [...Array(maxQuantity + 1).keys()];
            }

            return (
              <Card key={upselling.id} className={`mb-16 border-0 ${isSelected ? 'selected' : ''} ${available === 0 ? 'sold-out' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
                <Card.Body className="p-24">
                  <Row className="align-items-center">
                    <Col md={form?.show_tickets_remaining !== false ? 6 : 9}>
                      <div className="d-flex align-items-start">
                        <div
                          className="me-20 flex-shrink-0 position-relative"
                          onMouseEnter={() => {
                            if (!firstImageUrl) return;
                            const url = imageList[currentCarouselIndex];
                            const displayUrl = failedImageUrls[url] ? url : (signedImageUrls[url] ?? url);
                            setHoverPreview({ upsellingId: upselling.id, imageUrl: displayUrl });
                          }}
                          onMouseLeave={() => setHoverPreview(null)}
                        >
                          {firstImageUrl ? (
                            <>
                              {hoverPreview?.upsellingId === upselling.id && (
                                <div
                                  className="position-absolute start-50 translate-middle-x rounded overflow-hidden bg-white border shadow"
                                  style={{
                                    top: '100%',
                                    marginTop: 8,
                                    marginLeft: 100,
                                    width: 280,
                                    height: 280,
                                    zIndex: 10,
                                  }}
                                >
                                  <img
                                    src={hoverPreview.imageUrl}
                                    alt=""
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'contain',
                                      imageOrientation: 'from-image',
                                    }}
                                  />
                                </div>
                              )}
                              <div
                                className="position-relative rounded overflow-hidden d-flex align-items-center"
                                style={{ width: 96, height: 96 }}
                              >
                                {imageList.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label="Previous image"
                                    className="position-absolute start-0 top-50 translate-middle-y border-0 rounded-end d-flex align-items-center justify-content-center text-white bg-dark bg-opacity-50"
                                    style={{ width: 28, height: 36, zIndex: 2 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCarouselIndexByUpsellingId((prev) => ({
                                        ...prev,
                                        [upselling.id]: currentCarouselIndex <= 0 ? imageList.length - 1 : currentCarouselIndex - 1,
                                      }));
                                    }}
                                  >
                                    ‹
                                  </button>
                                )}
                                <img
                                  key={currentImageUrl}
                                  src={failedImageUrls[currentImageUrl] ? currentImageUrl : (signedImageUrls[currentImageUrl] ?? currentImageUrl)}
                                  alt=""
                                  loading="lazy"
                                  style={{
                                    width: 96,
                                    height: 96,
                                    objectFit: 'cover',
                                    imageOrientation: 'from-image',
                                  }}
                                  onError={() => setFailedImageUrls((prev) => ({ ...prev, [currentImageUrl]: true }))}
                                />
                                {imageList.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label="Next image"
                                    className="position-absolute end-0 top-50 translate-middle-y border-0 rounded-start d-flex align-items-center justify-content-center text-white bg-dark bg-opacity-50"
                                    style={{ width: 28, height: 36, zIndex: 2 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCarouselIndexByUpsellingId((prev) => ({
                                        ...prev,
                                        [upselling.id]: currentCarouselIndex >= imageList.length - 1 ? 0 : currentCarouselIndex + 1,
                                      }));
                                    }}
                                  >
                                    ›
                                  </button>
                                )}
                              </div>
                              {imageList.length > 1 && (
                                <div className="text-center text-muted small mt-8">
                                  {currentCarouselIndex + 1} / {imageList.length}
                                </div>
                              )}
                            </>
                          ) : (
                            <div
                              className="rounded d-flex align-items-center justify-content-center bg-light text-muted"
                              style={{ width: 96, height: 96, fontSize: 24 }}
                              aria-hidden
                            >
                              —
                            </div>
                          )}
                        </div>
                        <div className="flex-grow-1">
                          <h6 className="mb-8">{upselling.item ?? upselling.name}</h6>
                          {upselling.description && (
                            <p className="text-muted small mb-8">{upselling.description}</p>
                          )}
                          {upselling.benefits && (
                            <div className="mb-8">
                              <span className="benefits-label">Benefits:</span>
                              <span className="benefits-text">{upselling.benefits}</span>
                            </div>
                          )}
                          <div>
                            <span className="price-currency">$</span>
                            <span className="price-amount">{parseFloat(upselling.amount ?? upselling.price).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </Col>
                    <Col md={3}>
                      <Form.Label className="small fw-semibold mb-8">Quantity</Form.Label>
                      <UniversalInput
                        as="select"
                        name={`upselling_${upselling.id}`}
                        value={selectedQty}
                        customOnChange={e => handleUpsellingChange(upselling.id, Number(e.target.value))}
                        disabled={available === 0}
                      >
                        {quantityOptions.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </UniversalInput>
                      {selectedQty > 0 && (
                        <div className="mt-8">
                          <small className="text-muted">Subtotal: </small>
                          <strong className="text-primary">
                            ${(parseFloat(upselling.amount ?? upselling.price) * selectedQty).toFixed(2)}
                          </strong>
                        </div>
                      )}
                    </Col>
                  </Row>
                  {selectedQty > 0 && hasCustomFields && (
                    <Row className="mt-16">
                      <Col md={12}>
                        <div className="border-top pt-16 mt-16">
                          <h6 className="small mb-16 fw-semibold">Additional Information</h6>
                          {Array.from({ length: selectedQty }, (_, unitIndex) => (
                            <div key={`${upselling.id}_unit_${unitIndex}`} className="mb-24">
                              {selectedQty > 1 && (
                                <div className="small fw-semibold text-muted mb-8">
                                  {upselling.item ?? upselling.name} #{unitIndex + 1}
                                </div>
                              )}
                              {upselling.custom_fields.map((field, idx) => renderUpsellingCustomField(field, upselling.id, unitIndex, idx))}
                            </div>
                          ))}
                        </div>
                      </Col>
                    </Row>
                  )}
                </Card.Body>
              </Card>
            );
          })}
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
              <Button
                variant="dark"
                size="lg"
                className="w-100"
                disabled={isCompletingFree || !isContactPreferencesValid}
                onClick={async () => {
                  try {
                    setIsCompletingFree(true);
                    setPaymentError(null);
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
            </Card.Body>
          </Card>
        )}

        {order && !isFreeOrder && providers && paymentSession && (
          <Card>
            <Card.Body>
              {showExtraFields && !isContactPreferencesValid && (
                <Alert variant="warning" className="mb-16">
                  Please select how you would like to be contacted before completing your order.
                </Alert>
              )}
              <AccruPay
                sessionToken={paymentSession.sessionToken}
                preferredProvider="nuvei"
                preReleaseGetProviders={() => providers || []}
              >
                <CreditCardForm
                  order={order}
                  submitDisabled={showExtraFields && !isContactPreferencesValid}
                  onPaymentSuccess={async (paymentData) => {
                    try {
                      await handlePaymentSuccess(paymentData, confirmationUrlOverride);
                    } catch (err) {
                      setPaymentError(err.message || 'Error processing payment. Please try again.');
                    }
                  }}
                />
              </AccruPay>
            </Card.Body>
          </Card>
        )}
      </div>
    </>
  );
}

export default Step2Upsellings;
