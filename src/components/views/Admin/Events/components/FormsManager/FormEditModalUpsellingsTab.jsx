import { useState, useRef, useEffect } from 'react';
import { Table, Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faTrash, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import UniversalInput from '@src/components/global/Inputs/UniversalInput';
import storageAPI from '@src/api/storage.api';
import { showToast } from '@src/components/global/Alert/_helpers/alert.events';
import {
  $formManagerForm,
  handleUpsellingSelection,
} from '../../_helpers/formsManager.events';
import {
  $upsellingForm,
  $upsellingUI,
  loadUpsellingFormForInline,
  handleSubmit,
  handleDelete,
  addCustomField,
  updateCustomField,
  removeCustomField,
  addUpsellingImage,
  removeUpsellingImage,
} from '../../_helpers/upsellingsManager.events';

const DISCOUNT_TYPES = {
  NO_DISCOUNT: 'No Discount',
  PERCENT: 'Percent',
  FIXED: 'Fixed',
};

const QUANTITY_RULES = {
  ONLY_ONE: 'Only One',
  MATCHES_TICKET_COUNT: 'Matches Ticket Count',
  USER_CAN_CHANGE: 'User Can Change',
};

const MANAGE_INVENTORY = {
  YES: 'Yes',
  NO: 'NO',
};

function FormEditModalUpsellingsTab({ upsellings, eventId, onUpdate }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const formData = $upsellingForm.value;

  const openEditor = (upselling = null) => {
    loadUpsellingFormForInline(upselling);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    $upsellingForm.reset();
    $upsellingUI.update({ editingUpselling: null });
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    await handleSubmit(e, eventId, onUpdate);
    setEditorOpen(false);
  };

  const strategyLabel = (v) => (v === 'POST-CHECKOUT' ? 'Post-checkout' : 'Pre-checkout');

  const [imagesUploading, setImagesUploading] = useState(false);
  const [uploadingPreviews, setUploadingPreviews] = useState([]); // [{ file, objectUrl }]
  const [signedImageUrls, setSignedImageUrls] = useState({}); // { publicUrl -> signedUrl }
  const [failedImageUrls, setFailedImageUrls] = useState({});
  const imageInputRef = useRef(null);

  const imageUrls = formData.images || [];
  const imageUrlsKey = imageUrls.length ? imageUrls.join(',') : '';
  useEffect(() => {
    if (!imageUrlsKey) {
      setSignedImageUrls({});
      setFailedImageUrls({});
      return undefined;
    }
    setFailedImageUrls({});
    let cancelled = false;
    const urlsToSign = imageUrls.filter((url) => url && url.includes('upselling-images'));
    const fallbacks = Object.fromEntries((imageUrls.filter((url) => !url || !url.includes('upselling-images'))).map((url) => [url, url]));
    Promise.all(
      urlsToSign.map(async (url) => {
        try {
          const signed = await storageAPI.getSignedUpsellingImageUrl(url);
          return [url, signed];
        } catch {
          return [url, url];
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setSignedImageUrls({ ...fallbacks, ...Object.fromEntries(pairs) });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrlsKey]);

  const handleImageSelect = async (e) => {
    const { files } = e.target;
    if (!files?.length || !eventId) return;
    const fileList = Array.from(files);
    const previews = fileList.map((file) => ({
      file,
      objectUrl: URL.createObjectURL(file),
    }));
    setUploadingPreviews(previews);
    setImagesUploading(true);
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
      setSignedImageUrls((prev) => ({ ...prev, ...Object.fromEntries(newSigned) }));
      setTimeout(() => {
        previews.forEach((p) => URL.revokeObjectURL(p.objectUrl));
        setUploadingPreviews([]);
      }, 600);
    } catch (err) {
      const message = err?.message || err?.error_description || 'Error al subir la imagen';
      showToast(message, 'error');
      previews.forEach((p) => URL.revokeObjectURL(p.objectUrl));
      setUploadingPreviews([]);
    } finally {
      setImagesUploading(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-16">
        <Form.Label className="mb-0">{' '}</Form.Label>
        <Button size="sm" variant="primary" onClick={() => openEditor()}>
          <FontAwesomeIcon icon={faPlus} className="me-2" />
          Add Upselling
        </Button>
      </div>

      <div>
        <Table responsive size="sm" className="form-edit-inline-table table-bordered mb-0 align-middle">
          <thead>
            <tr>
              <th style={{ width: '2%' }}>Include</th>
              <th style={{ width: '14%' }}>Item</th>
              <th style={{ width: '10%' }}>Strategy</th>
              <th style={{ width: '14%' }}>Discount Type</th>
              <th style={{ width: '6%' }}>Discount</th>
              <th style={{ width: '6%' }}>Amount</th>
              <th style={{ width: '10%' }}>Quantity Rule</th>
              <th style={{ width: '6%' }}>Manage Inventory</th>
              <th style={{ width: '6%' }}>Quantity</th>
              <th style={{ width: '10%' }}>Sales Start</th>
              <th style={{ width: '10%' }}>Sales Ends</th>
              <th style={{ width: '6%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {editorOpen && (
              <>
                <tr className="inline-edit-row">
                  <td className="p-8 text-center align-middle">
                    {$upsellingUI.value.editingUpselling && (
                      <button
                        type="button"
                        className={
                          `upselling-include-toggle ${
                            ($formManagerForm.value.available_upselling_ids || [])
                              .map(String)
                              .includes(String($upsellingUI.value.editingUpselling.id))
                              ? 'is-checked'
                              : ''
                          }`
                        }
                        onClick={() => handleUpsellingSelection($upsellingUI.value.editingUpselling.id)}
                        aria-label="Include upselling in form"
                      >
                        {($formManagerForm.value.available_upselling_ids || [])
                          .map(String)
                          .includes(String($upsellingUI.value.editingUpselling.id)) && (
                          <FontAwesomeIcon icon={faCheck} size="xs" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="text"
                      name="name"
                      signal={$upsellingForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Name"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      as="select"
                      name="upselling_strategy"
                      signal={$upsellingForm}
                      className="form-control form-control-sm"
                      aria-label="Strategy"
                    >
                      <option value="PRE-CHECKOUT">Pre-checkout</option>
                      <option value="POST-CHECKOUT">Post-checkout</option>
                    </UniversalInput>
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      as="select"
                      name="discount_type"
                      signal={$upsellingForm}
                      className="form-control form-control-sm"
                      aria-label="Discount Type"
                    >
                      {Object.entries(DISCOUNT_TYPES).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </UniversalInput>
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="number"
                      step="0.01"
                      min="0"
                      name="discount_value"
                      signal={$upsellingForm}
                      className="form-control form-control-sm"
                      aria-label="Discount"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="number"
                      step="0.01"
                      min="0"
                      name="price"
                      signal={$upsellingForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Amount"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      as="select"
                      name="quantity_rule"
                      signal={$upsellingForm}
                      className="form-control form-control-sm"
                      aria-label="Quantity Rule"
                    >
                      {Object.entries(QUANTITY_RULES).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </UniversalInput>
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      as="select"
                      name="manage_inventory"
                      signal={$upsellingForm}
                      className="form-control form-control-sm"
                      aria-label="Manage Inventory"
                    >
                      {Object.entries(MANAGE_INVENTORY).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </UniversalInput>
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="number"
                      min="0"
                      name="quantity"
                      signal={$upsellingForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Quantity"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="datetime-local"
                      name="sales_start"
                      signal={$upsellingForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Sales Start"
                    />
                  </td>
                  <td className="p-8">
                    <UniversalInput
                      type="datetime-local"
                      name="sales_end"
                      signal={$upsellingForm}
                      required
                      className="form-control form-control-sm"
                      aria-label="Sales End"
                    />
                  </td>
                  <td className="p-8">
                    <div className="form-edit-inline-actions d-flex gap-1">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        type="button"
                        onClick={closeEditor}
                        aria-label="Cancel"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        type="button"
                        onClick={onFormSubmit}
                        aria-label="Save"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </Button>
                    </div>
                  </td>
                </tr>
                {formData.custom_fields?.length > 0 && (
                  <tr className="inline-edit-custom-fields-row">
                    <td colSpan={12} className="p-8">
                      <div className="form-edit-custom-fields-label small mb-8">Custom Fields</div>
                      <Table size="sm" className="mb-0 table-bordered">
                        <tbody>
                          {formData.custom_fields.map((field, idx) => (
                            <tr key={idx}>
                              <td className="p-4" style={{ width: '18%' }}>
                                <UniversalInput
                                  type="text"
                                  name={`custom_field_label_${idx}`}
                                  value={field.label}
                                  customOnChange={(e) => updateCustomField(idx, { label: e.target.value })}
                                  placeholder="Label"
                                  className="form-control form-control-sm"
                                  aria-label="Field label"
                                />
                              </td>
                              <td className="p-4" style={{ width: '12%' }}>
                                <UniversalInput
                                  as="select"
                                  name={`custom_field_type_${idx}`}
                                  value={field.type}
                                  customOnChange={(e) => updateCustomField(idx, { type: e.target.value })}
                                  className="form-control form-control-sm"
                                  aria-label="Field type"
                                >
                                  <option value="text">Text</option>
                                  <option value="email">Email</option>
                                  <option value="number">Number</option>
                                  <option value="textarea">Textarea</option>
                                  <option value="select">Select</option>
                                  <option value="checkbox">Checkbox</option>
                                  <option value="radio">Radio</option>
                                </UniversalInput>
                              </td>
                              <td className="p-4" style={{ width: '15%' }}>
                                <UniversalInput
                                  type="text"
                                  name={`custom_field_placeholder_${idx}`}
                                  value={field.placeholder || ''}
                                  customOnChange={(e) => updateCustomField(idx, { placeholder: e.target.value })}
                                  placeholder="Placeholder"
                                  className="form-control form-control-sm"
                                  aria-label="Placeholder"
                                />
                              </td>
                              <td className="p-4 align-middle" style={{ width: '8%' }}>
                                <UniversalInput
                                  type="checkbox"
                                  name={`custom_field_required_${idx}`}
                                  label="Required"
                                  checked={!!field.required}
                                  customOnChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                                />
                              </td>
                              {(field.type === 'select' || field.type === 'radio') && (
                                <td className="p-4" style={{ width: '20%' }}>
                                  <UniversalInput
                                    type="text"
                                    name={`custom_field_options_${idx}`}
                                    value={typeof field.options === 'string' ? field.options : (field.options || []).join(', ')}
                                    customOnChange={(e) => updateCustomField(idx, { options: e.target.value })}
                                    placeholder="Options (comma)"
                                    className="form-control form-control-sm"
                                    aria-label="Options"
                                  />
                                </td>
                              )}
                              <td className="p-4 align-middle">
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  type="button"
                                  onClick={() => removeCustomField(idx)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      <Button size="sm" variant="outline-primary" type="button" onClick={addCustomField} className="mt-8">
                        + Add Custom Field
                      </Button>
                    </td>
                  </tr>
                )}
                {(!formData.custom_fields || formData.custom_fields.length === 0) && (
                  <tr className="inline-edit-custom-fields-row">
                    <td colSpan={12} className="p-8">
                      <Button size="sm" variant="outline-primary" type="button" onClick={addCustomField}>
                        + Add Custom Field
                      </Button>
                    </td>
                  </tr>
                )}
                <tr className="inline-edit-images-row">
                  <td colSpan={12} className="p-8">
                    <div className="form-edit-custom-fields-label small mb-8">Images</div>
                    <div className="d-flex flex-wrap gap-2 align-items-start mb-8">
                      {(formData.images || []).map((url, idx) => {
                        const displayUrl = failedImageUrls[url] ? url : (signedImageUrls[url] || url);
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
                              onError={() => setFailedImageUrls((prev) => ({ ...prev, [url]: true }))}
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
                      {uploadingPreviews.map(({ objectUrl }, idx) => (
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
                      disabled={imagesUploading}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {imagesUploading ? 'Uploading…' : '+ Add image'}
                    </Button>
                  </td>
                </tr>
              </>
            )}
            {upsellings.length === 0 && !editorOpen && (
              <tr>
                <td colSpan={12} className="text-center py-4 text-muted small">
                  No upsellings yet. Click &quot;Add Upselling&quot; to create one.
                </td>
              </tr>
            )}
            {upsellings.map((upselling) => {
              const itemName = upselling.item ?? upselling.name;
              const amount = upselling.amount ?? upselling.price;
              const discountVal = upselling.discount ?? upselling.discount_value;
              const selectedIds = ($formManagerForm.value.available_upselling_ids || []).map(String);
              const isSelected = selectedIds.includes(String(upselling.id));

              return (
                <tr key={upselling.id}>
                  <td className="p-8 text-center align-middle">
                    <button
                      type="button"
                      className={`upselling-include-toggle ${isSelected ? 'is-checked' : ''}`}
                      onClick={() => handleUpsellingSelection(upselling.id)}
                      aria-label="Include upselling in form"
                    >
                      {isSelected && <FontAwesomeIcon icon={faCheck} size="xs" />}
                    </button>
                  </td>
                  <td><strong>{itemName}</strong></td>
                  <td className="small">{strategyLabel(upselling.upselling_strategy)}</td>
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
                  <td>{upselling.sold || 0} / {upselling.quantity}</td>
                  <td className="small">{format(new Date(upselling.sales_start), 'MMM d')}</td>
                  <td className="small">{format(new Date(upselling.sales_end), 'MMM d')}</td>
                  <td>
                    <div className="form-edit-inline-actions d-flex gap-1">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        type="button"
                        onClick={() => openEditor(upselling)}
                        aria-label="Edit"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        type="button"
                        onClick={() => handleDelete(upselling.id, onUpdate)}
                        aria-label="Delete"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default FormEditModalUpsellingsTab;
