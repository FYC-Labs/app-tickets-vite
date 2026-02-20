import { useRef } from 'react';
import { Card, Modal, Form, Button, Table, Dropdown, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import storageAPI from '@src/api/storage.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';
import {
  $upsellingForm,
  $upsellingUI,
  handleSubmit,
  handleDelete,
  handleOpenModal,
  handleCloseModal,
  addCustomField,
  updateCustomField,
  removeUpsellingImage,
  removeCustomField,
  addUpsellingImage,
  DISCOUNT_TYPES,
  QUANTITY_RULES,
  MANAGE_INVENTORY,
} from './_helpers/upsellingsManager.events';

function UpsellingsManager({ eventId, upsellings, onUpdate }) {
  const { showModal } = $upsellingUI.value;
  const { editingUpselling } = $upsellingUI.value;
  const formData = $upsellingForm.value;

  const imageInputRef = useRef(null);

  const strategyLabel = (v) => (v === 'POST-CHECKOUT' ? 'Post-checkout' : 'Pre-checkout');

  const handleImageSelect = async (e) => {
    const { files } = e.target;
    if (!files?.length || !eventId) return;
    const fileList = Array.from(files);
    const previews = fileList.map((file) => ({
      file,
      objectUrl: URL.createObjectURL(file),
    }));
    $upsellingForm.update({ uploadingPreviews: previews });
    $upsellingForm.update({ imagesUploading: true });
    const folderId = $upsellingUI.value.editingUpselling?.id || 'new';
    e.target.value = '';
    try {
      const urls = await Promise.all(
        fileList.map((file) => storageAPI.uploadUpsellingImage(file, eventId, folderId)),
      );
      urls.forEach((url) => addUpsellingImage(url));
      const newSigned = await Promise.all(
        urls.map(async (url) => {
          try {
            const signed = await storageAPI.getSignedUpsellingImageUrl(url);
            return [url, signed];
          } catch {
            return [url, url];
          }
        }),
      );
      $upsellingForm.update({ signedImageUrls: Object.fromEntries(newSigned) });
      setTimeout(() => {
        previews.forEach((p) => URL.revokeObjectURL(p.objectUrl));
        $upsellingForm.update({ uploadingPreviews: [] });
        $upsellingForm.update({ imagesUploading: false });
      }, 600);
    } catch (err) {
      const message = err?.message || err?.error_description || 'Error al subir la imagen';
      showToast(message, 'error');
      previews.forEach((p) => URL.revokeObjectURL(p.objectUrl));
      $upsellingForm.update({ uploadingPreviews: [] });
      $upsellingForm.update({ imagesUploading: false });
    }
  };

  return (
    <>
      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-24">
            <h5 className="mb-0">Upsellings</h5>
            <Button size="sm" variant="primary" onClick={() => handleOpenModal()}>
              <FontAwesomeIcon icon={faPlus} className="me-2" />
              Add Upselling
            </Button>
          </div>
          {upsellings.length === 0 ? (
            <div className="text-center py-4 text-muted">
              No upsellings yet
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Strategy</th>
                  <th>Discount Type</th>
                  <th>Discount</th>
                  <th>Amount</th>
                  <th>Quantity Rule</th>
                  <th>Manage Inventory</th>
                  <th>Quantity</th>
                  <th>Sales Period</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {upsellings.map((upselling) => {
                  const itemName = upselling.item ?? upselling.name;
                  const amount = upselling.amount ?? upselling.price;
                  const discountVal = upselling.discount ?? upselling.discount_value;

                  return (
                    <tr key={upselling.id}>
                      <td>
                        <strong>{itemName}</strong>
                      </td>
                      <td>{strategyLabel(upselling.upselling_strategy)}</td>
                      <td className="small">
                        {DISCOUNT_TYPES[upselling.discount_type] || DISCOUNT_TYPES.NO_DISCOUNT}
                      </td>
                      <td className="small">
                        {(() => {
                          if (upselling.discount_type === 'PERCENT' && discountVal != null) {
                            return `${discountVal}%`;
                          }
                          if (upselling.discount_type === 'FIXED' && discountVal != null) {
                            return `$${parseFloat(discountVal).toFixed(2)}`;
                          }
                          return '—';
                        })()}
                      </td>
                      <td>${parseFloat(amount).toFixed(2)}</td>
                      <td className="small">
                        {QUANTITY_RULES[upselling.quantity_rule] || QUANTITY_RULES.ONLY_ONE}
                      </td>
                      <td className="small">
                        {MANAGE_INVENTORY[upselling.manage_inventory] || MANAGE_INVENTORY.NO}
                      </td>
                      <td className="small">
                        {upselling.sold || 0} / {upselling.quantity}
                      </td>
                      <td className="small">
                        {format(new Date(upselling.sales_start), 'MMM d')} - {format(new Date(upselling.sales_end), 'MMM d')}
                      </td>
                      <td>
                        <Dropdown>
                          <Dropdown.Toggle variant="link" size="sm" className="text-white">
                            <FontAwesomeIcon icon={faEllipsisV} />
                          </Dropdown.Toggle>

                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleOpenModal(upselling)}>
                              Edit
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item
                              className="text-danger"
                              onClick={() => handleDelete(upselling.id, onUpdate)}
                            >
                              Delete
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingUpselling ? 'Edit Upselling' : 'Add Upselling'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={(e) => handleSubmit(e, eventId, onUpdate)}>
          <Modal.Body>
            <Form.Group className="mb-24">
              <Form.Label>Item Name *</Form.Label>
              <UniversalInput
                type="text"
                name="name"
                signal={$upsellingForm}
                required
              />
            </Form.Group>

            <Form.Group className="mb-24">
              <Form.Label>Upselling Strategy</Form.Label>
              <UniversalInput
                as="select"
                name="upselling_strategy"
                signal={$upsellingForm}
                disabled
              >
                <option value="PRE-CHECKOUT">Pre-checkout</option>
                <option value="POST-CHECKOUT">Post-checkout</option>
              </UniversalInput>
            </Form.Group>

            <Form.Group className="mb-24">
              <Form.Label>Discount Type</Form.Label>
              <UniversalInput
                as="select"
                name="discount_type"
                signal={$upsellingForm}
              >
                {Object.entries(DISCOUNT_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </UniversalInput>
            </Form.Group>

            <Form.Group className="mb-24">
              <Form.Label>Discount Value</Form.Label>
              <UniversalInput
                type="number"
                step="0.01"
                min="0"
                name="discount_value"
                signal={$upsellingForm}
              />
            </Form.Group>

            <Form.Group className="mb-24">
              <Form.Label>Item Price *</Form.Label>
              <UniversalInput
                type="number"
                step="0.01"
                min="0"
                name="price"
                signal={$upsellingForm}
              />
            </Form.Group>

            <Form.Group className="mb-24">
              <Form.Label>Quantity Rule</Form.Label>
              <UniversalInput
                as="select"
                name="quantity_rule"
                signal={$upsellingForm}
              >
                {Object.entries(QUANTITY_RULES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </UniversalInput>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Manage Inventory</Form.Label>
                  <UniversalInput
                    as="select"
                    name="manage_inventory"
                    signal={$upsellingForm}
                  >
                    {Object.entries(MANAGE_INVENTORY).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </UniversalInput>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Quantity</Form.Label>
                  <UniversalInput
                    type="number"
                    min="1"
                    name="quantity"
                    signal={$upsellingForm}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Sales Start *</Form.Label>
                  <UniversalInput
                    type="datetime-local"
                    name="sales_start"
                    signal={$upsellingForm}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-24">
                  <Form.Label>Sales End *</Form.Label>
                  <UniversalInput
                    type="datetime-local"
                    name="sales_end"
                    signal={$upsellingForm}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="mb-24">
              <div className="d-flex justify-content-between align-items-center mb-8">
                <Form.Label className="mb-0">Custom Fields</Form.Label>
                <Button
                  size="sm"
                  variant="outline-primary"
                  type="button"
                  onClick={addCustomField}
                >
                  Add Field
                </Button>
              </div>

              {formData.custom_fields?.length > 0 && (
                <div className="d-flex flex-column gap-3">
                  {formData.custom_fields.map((field, idx) => (
                    <Card key={idx} className="p-3">
                      <Row className="g-2 align-items-end">
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label>Label</Form.Label>
                            <UniversalInput
                              type="text"
                              name={`custom_field_label_${idx}`}
                              value={field.label}
                              customOnChange={(e) => updateCustomField(idx, { label: e.target.value })}
                              placeholder="E.g., T-shirt size"
                            />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Type</Form.Label>
                            <UniversalInput
                              as="select"
                              name={`custom_field_type_${idx}`}
                              value={field.type}
                              customOnChange={(e) => {
                                const newType = e.target.value;
                                const updateData = { type: newType };
                                // If changing to select/radio, ensure options is an array
                                if ((newType === 'select' || newType === 'radio') && !Array.isArray(field.options)) {
                                  updateData.options = [];
                                }
                                // If changing away from select/radio, clear options
                                if (newType !== 'select' && newType !== 'radio' && field.options) {
                                  updateData.options = [];
                                }
                                updateCustomField(idx, updateData);
                              }}
                            >
                              <option value="text">Text</option>
                              <option value="email">Email</option>
                              <option value="number">Number</option>
                              <option value="textarea">Textarea</option>
                              <option value="select">Select</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="radio">Radio</option>
                            </UniversalInput>
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Placeholder</Form.Label>
                            <UniversalInput
                              type="text"
                              name={`custom_field_placeholder_${idx}`}
                              value={field.placeholder || ''}
                              customOnChange={(e) => updateCustomField(idx, { placeholder: e.target.value })}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={2}>
                          <Form.Group className="d-flex align-items-center gap-2">
                            <UniversalInput
                              type="checkbox"
                              name={`custom_field_required_${idx}`}
                              label="Required"
                              checked={!!field.required}
                              customOnChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={12}>
                          {(field.type === 'select' || field.type === 'radio') && (
                            <Form.Group className="mt-2">
                              <Form.Label>Options (comma separated)</Form.Label>
                              <UniversalInput
                                type="text"
                                name={`custom_field_options_${idx}`}
                                value={(() => {
                                  // Handle both array and string formats
                                  if (Array.isArray(field.options)) {
                                    return field.options.join(', ');
                                  }
                                  if (typeof field.options === 'string') {
                                    return field.options;
                                  }
                                  return '';
                                })()}
                                customOnChange={(e) => {
                                  const optionsString = e.target.value;
                                  // Store as string while user is typing for better UX
                                  updateCustomField(idx, {
                                    options: optionsString,
                                  });
                                }}
                                onBlur={(e) => {
                                  // Parse to array when user finishes typing (on blur)
                                  const optionsString = e.target.value;
                                  if (optionsString.trim()) {
                                    const optionsArray = optionsString
                                      .split(',')
                                      .map(opt => opt.trim())
                                      .filter(opt => opt.length > 0);
                                    updateCustomField(idx, { options: optionsArray });
                                  } else {
                                    updateCustomField(idx, { options: [] });
                                  }
                                }}
                                placeholder="Small, Medium, Large"
                              />
                            </Form.Group>
                          )}
                        </Col>
                        <Col md={12} className="d-flex justify-content-end">
                          <Button
                            size="sm"
                            variant="outline-danger"
                            type="button"
                            onClick={() => removeCustomField(idx)}
                          >
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </div>
              )}
              <Form.Group className="mb-24">
                <Form.Label>Images</Form.Label>
              </Form.Group>
              <div className="d-flex flex-wrap gap-2 align-items-start mb-8">
                {(formData.images || []).map((url, idx) => {
                  const displayUrl = formData.failedImageUrls[url] ? url : (formData.signedImageUrls[url] || url);
                  const handleRemove = async () => {
                    if (url?.includes('upselling-images')) {
                      try {
                        await storageAPI.deleteUpsellingImage(url);
                      } catch {
                        showToast('No se pudo borrar del almacenamiento', 'error');
                      }
                    }
                    removeUpsellingImage(idx);
                  };
                  return (
                    <div key={`${url}-${idx}`} className="position-relative d-inline-block" style={{ width: 64, height: 64 }}>
                      <img
                        src={displayUrl}
                        alt=""
                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, imageOrientation: 'from-image' }}
                        onError={() => $upsellingForm.update({ failedImageUrls: { ...formData.failedImageUrls, [url]: true } })}
                      />
                      <button
                        type="button"
                        onClick={handleRemove}
                        aria-label="Remove image"
                        className="position-absolute rounded-circle border-0 d-flex align-items-center justify-content-center bg-danger text-white"
                        style={{ top: 2, right: 2, width: 20, height: 20, minWidth: 20, padding: 0, fontSize: 10 }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  );
                })}
                {formData.uploadingPreviews.map(({ objectUrl }, idx) => (
                  <div key={`uploading-${idx}`} className="position-relative d-inline-block">
                    <img src={objectUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, opacity: 0.8, imageOrientation: 'from-image' }} />
                    <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center rounded" style={{ background: 'rgba(0,0,0,0.4)' }}>
                      <span className="small text-white">Uploading…</span>
                    </div>
                  </div>
                ))}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="d-none"
                onChange={handleImageSelect}
              />
              <Button
                size="sm"
                variant="outline-primary"
                type="button"
                disabled={formData.imagesUploading}
                onClick={() => imageInputRef.current?.click()}
              >
                {formData.imagesUploading ? 'Uploading…' : '+ Add image'}
              </Button>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingUpselling ? 'Update' : 'Create'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

export default UpsellingsManager;
