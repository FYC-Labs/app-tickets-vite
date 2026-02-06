/* eslint-disable no-nested-ternary */
import { useState, useEffect } from 'react';
import { Card, Row, Col, Form, Button } from 'react-bootstrap';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import storageAPI from '@src/api/storage.api';

/**
 * Shared list of upselling cards with images (carousel + hover preview), quantity selector, and custom fields.
 * Used in Step2Upsellings (pre-checkout) and Step3UpsellingsPost (post-checkout).
 *
 * @param {Array} upsellings - List of upselling objects
 * @param {Object} selectedUpsellings - { [upsellingId]: quantity }
 * @param {Function} onUpsellingChange - (upsellingId, quantity) => void
 * @param {Object} upsellingCustomFields - { [upsellingId]: array of per-unit values or single object }
 * @param {Function} onUpsellingCustomFieldChange - (upsellingId, unitIndex, fieldLabel, value) => void
 * @param {number} totalTicketsSelected - For MATCHES_TICKET_COUNT rule
 * @param {Object} form - Form config (e.g. show_tickets_remaining, upsellings_display)
 * @param {boolean} disabled - Disable quantity and custom fields
 */
function EmbedUpsellingsList({
  upsellings = [],
  selectedUpsellings = {},
  onUpsellingChange,
  upsellingCustomFields = {},
  onUpsellingCustomFieldChange,
  totalTicketsSelected = 0,
  form = null,
  disabled = false,
}) {
  const [signedImageUrls, setSignedImageUrls] = useState({});
  const [failedImageUrls, setFailedImageUrls] = useState({});
  const [carouselIndexByUpsellingId, setCarouselIndexByUpsellingId] = useState({});
  const [hoverPreview, setHoverPreview] = useState(null);
  const [currentUpsellingIndex, setCurrentUpsellingIndex] = useState(0);

  const displayMode = form?.upsellings_display || 'LIST';
  const isCarouselMode = displayMode === 'CAROUSEL';

  // Reset carousel index when upsellings change or when switching modes
  useEffect(() => {
    if (isCarouselMode && upsellings.length > 0) {
      // Ensure index is within bounds
      if (currentUpsellingIndex >= upsellings.length) {
        setCurrentUpsellingIndex(0);
      }
    } else if (!isCarouselMode) {
      // Reset when switching back to list mode
      setCurrentUpsellingIndex(0);
    }
  }, [upsellings.length, isCarouselMode, currentUpsellingIndex]);

  const embedImageUrlsKey = (upsellings || [])
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

  const renderUpsellingCustomField = (field, upsellingId, unitIndex, index) => {
    const unitValues = upsellingCustomFields[upsellingId];
    const isArray = Array.isArray(unitValues);
    let value = '';
    if (isArray && unitValues[unitIndex]) {
      value = unitValues[unitIndex][field.label] ?? '';
    } else if (!isArray && unitValues) {
      value = unitValues[field.label] ?? '';
    }
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
        onChange={(newValue) => onUpsellingCustomFieldChange(upsellingId, unitIndex, field.label, newValue)}
      />
    );
  };

  if (!upsellings || upsellings.length === 0) {
    return null;
  }

  const currentUpselling = isCarouselMode ? upsellings[currentUpsellingIndex] : null;
  const upsellingsToRender = isCarouselMode ? (currentUpselling ? [currentUpselling] : []) : upsellings;

  const handlePreviousUpselling = () => {
    setCurrentUpsellingIndex((prev) => (prev <= 0 ? upsellings.length - 1 : prev - 1));
  };

  const handleNextUpselling = () => {
    setCurrentUpsellingIndex((prev) => (prev >= upsellings.length - 1 ? 0 : prev + 1));
  };

  const renderUpsellingCard = (upselling, index) => {
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
      quantityOptions = maxQuantity <= 0 ? [0] : [0, maxQuantity];
    } else {
      quantityOptions = [...Array(maxQuantity + 1).keys()];
    }

    return (
      <Card
        key={upselling.id}
        className={`mb-16 border-0 ${isSelected ? 'selected' : ''} ${available === 0 ? 'sold-out' : ''}`}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
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
                customOnChange={(e) => onUpsellingChange(upselling.id, Number(e.target.value))}
                disabled={available === 0 || disabled}
              >
                {quantityOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </UniversalInput>
              {selectedQty > 0 && (
              <div className="mt-8">
                <small className="text-muted">Subtotal: </small>
                <strong className="text-dark">
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
  };

  return (
    <>
      {isCarouselMode && upsellings.length > 1 && (
        <div className="d-flex justify-content-between align-items-center mb-16">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handlePreviousUpselling}
            aria-label="Previous upselling"
          >
            ‹ Previous
          </Button>
          <span className="text-muted small">
            {currentUpsellingIndex + 1} / {upsellings.length}
          </span>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleNextUpselling}
            aria-label="Next upselling"
          >
            Next ›
          </Button>
        </div>
      )}

      {upsellingsToRender.map((upselling, index) => renderUpsellingCard(upselling, index))}

      {isCarouselMode && upsellings.length > 1 && (
        <div className="d-flex justify-content-center gap-8 mt-16">
          {upsellings.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`rounded-circle border-0 ${idx === currentUpsellingIndex ? 'bg-primary' : 'bg-secondary bg-opacity-25'}`}
              style={{ width: 8, height: 8 }}
              onClick={() => setCurrentUpsellingIndex(idx)}
              aria-label={`Go to upselling ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default EmbedUpsellingsList;
