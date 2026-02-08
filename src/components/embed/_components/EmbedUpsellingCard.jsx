import { Card, Row, Col, Form, Image } from 'react-bootstrap';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import FormDynamicField from '@src/components/embed/_components/FormDynamicField';
import { $embed } from '@src/signals';
import { $failedImageUrls, $signedImageUrls, $totalTicketsSelected } from '@src/components/embed/_components/EmbedUpsellingsList/_helpers/embedUpsellings.consts';
import { markImageAsFailed, handleUpsellingChange, handleUpsellingCustomFieldChange } from '@src/components/embed/_components/EmbedUpsellingsList/_helpers/embedUpsellings.events';

export default function EmbedUpsellingCard({
  upselling,
  index,
  disabled,
}) {
  const selectedQty = $embed.value.selectedUpsellings?.[upselling.id] || 0;
  const upsellingCustomFields = $embed.value.upsellingCustomFields || {};
  const totalTicketsSelected = $totalTicketsSelected.value;

  const imageList = Array.isArray(upselling?.images) ? upselling.images : [];
  const firstImageUrl = imageList[0];
  const available = upselling.quantity - (upselling.sold || 0);
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

  const renderUpsellingCustomField = (field, upsellingId, unitIndex, fieldIndex) => {
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
        index={fieldIndex}
        name={fieldKey}
        value={value}
        groupClassName="mb-16"
        labelClassName="small"
        selectPlaceholder={field.placeholder || 'Select...'}
        onChange={(newValue) => handleUpsellingCustomFieldChange(upsellingId, unitIndex, field.label, newValue)}
      />
    );
  };

  return (
    <Card
      key={upselling.id}
      className={`mb-16 border-0 ${isSelected ? 'selected' : ''} ${available === 0 ? 'sold-out' : ''}`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <Card.Body className="p-0">
        <Row className="align-items-center">
          <Col md={$embed.value.form?.show_tickets_remaining !== false ? 6 : 9}>
            <Row className="align-items-start">
              {firstImageUrl && (
                <Col xs="auto" className="pe-20">
                  <Image
                    src={$failedImageUrls.value[firstImageUrl] ? firstImageUrl : ($signedImageUrls.value[firstImageUrl] ?? firstImageUrl)}
                    alt={upselling.item ?? upselling.name}
                    rounded
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: 'cover',
                      imageOrientation: 'from-image',
                    }}
                    onError={() => markImageAsFailed(firstImageUrl)}
                    loading="lazy"
                  />
                </Col>
              )}
              <Col>
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
              </Col>
            </Row>
          </Col>
          <Col md={3}>
            <Form.Label className="small fw-semibold mb-8">Quantity</Form.Label>
            <UniversalInput
              as="select"
              name={`upselling_${upselling.id}`}
              value={selectedQty}
              customOnChange={(e) => handleUpsellingChange(upselling.id, Number(e.target.value))}
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
}
