import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Alert, Container, Button } from 'react-bootstrap';
import { useEffectAsync } from '@fyclabs/tools-fyc-react/utils';
import { Signal } from '@fyclabs/tools-fyc-react/signals';
import ordersAPI from '@src/api/orders.api';
import formsAPI from '@src/api/forms.api';
import Loader from '@src/components/global/Loader';
import { $embed } from '@src/signals';
import ContactPreferences from './_components/ContactPreferences';
import AdditionalInformation from './_components/AdditionalInformation';
import * as checkoutResolvers from './_helpers/checkout.resolvers';

const $orderConfirmation = Signal({
  order: null,
  error: null,
});

function OrderConfirmation() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const { order, error } = $orderConfirmation.value;
  const { isLoading } = $orderConfirmation.value;
  const theme = searchParams.get('theme') || 'light';

  const handleSubmitForm = async () => {
    if (!order?.form_submission_id) {
      return;
    }

    try {
      const currentFormData = $embed.value.formData || {};
      const submissionId = order.form_submission_id;

      // Prepare responses to update (only fields that are being requested)
      const responsesToUpdate = {};
      const form = order.form_submissions?.forms;

      if (form?.request_phone_number && currentFormData.phone_number !== undefined) {
        responsesToUpdate.phone_number = currentFormData.phone_number || null;
      }
      if (form?.request_communication_preference && currentFormData.preferred_channel !== undefined) {
        responsesToUpdate.preferred_channel = currentFormData.preferred_channel || null;
      }

      // Add schema fields
      if (form?.schema) {
        form.schema.forEach((field) => {
          const key = field.field_id_string != null ? field.field_id_string : field.label;
          if (currentFormData[key] !== undefined) {
            responsesToUpdate[key] = currentFormData[key] || null;
          }
        });
      }

      if (Object.keys(responsesToUpdate).length === 0) {
        return;
      }

      await formsAPI.updateSubmission(submissionId, responsesToUpdate);

      // Reload order to get updated data
      const updatedOrder = await ordersAPI.getById(orderId);
      $orderConfirmation.update({ order: updatedOrder });

      // Update formData in signal with updated responses
      if (updatedOrder.form_submissions?.responses) {
        $embed.update({ formData: updatedOrder.form_submissions.responses });
      }

      // Show success message (you can customize this)
      alert('Form submitted successfully!');
    } catch (err) {
      console.error('Error updating form submission:', err);
      alert('Error submitting form. Please try again.');
    }
  };

  useEffectAsync(async () => {
    try {
      $orderConfirmation.loadingStart();
      const orderData = await ordersAPI.getById(orderId);

      if (!orderData) {
        throw new Error('Order not found. Please check your order link.');
      }

      $orderConfirmation.update({ order: orderData, error: null });

      // Initialize formData in $embed signal with existing responses
      if (orderData.form_submissions?.responses) {
        $embed.update({ formData: orderData.form_submissions.responses });
      }

      const eventId = orderData.event_id || orderData.events?.id;
      const formData = orderData.form_submissions?.forms || null;
      if (eventId) {
        await checkoutResolvers.loadPostCheckoutUpsellings(eventId, orderData, formData);
      }
    } catch (err) {
      let errorMessage = err.message || 'Unable to load order confirmation.';

      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.isTimeout) {
        errorMessage = 'Request timed out. Please refresh the page and try again.';
      } else if (err.status === 404) {
        errorMessage = 'Order not found. Please check your order link.';
      }

      $orderConfirmation.update({
        error: errorMessage,
      });
    } finally {
      $orderConfirmation.update({ isLoading: false });
    }
  }, [orderId]);

  if (isLoading) return <Loader />;

  if (error) {
    return (
      <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
        <Alert variant="danger">
          <Alert.Heading>Unable to Load Order</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
        <Alert variant="warning">
          <Alert.Heading>Order Not Found</Alert.Heading>
          <p>We couldn't find this order. Please check your order link and try again.</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className={`py-5 ${theme}`} style={{ maxWidth: '800px' }}>
      <Alert variant="success" className="mb-32">
        <Alert.Heading>
          <i className="fas fa-check-circle me-2" />
          Payment Successful!
        </Alert.Heading>
        <p className="mb-0">
          Your order has been confirmed. A confirmation email has been sent to{' '}
          <strong>{order.customer_email}</strong>.
        </p>
      </Alert>

      {order.form_submissions?.responses && order.form_submissions.forms && (() => {
        const { forms: form, responses } = order.form_submissions;

        const isFormComplete = (() => {
          if (form.request_communication_preference) {
            if (!responses.preferred_channel || responses.preferred_channel === '') {
              return false;
            }
            if (form.request_phone_number && responses.preferred_channel === 'sms') {
              if (!responses.phone_number || responses.phone_number === '') {
                return false;
              }
            }
          }
          if (form.schema && form.schema.length > 0) {
            const incompleteSchemaField = form.schema.find((field) => {
              if (!field.required) return false;
              const key = field.field_id_string != null ? field.field_id_string : field.label;
              return !responses[key] || responses[key] === '';
            });
            if (incompleteSchemaField) {
              return false;
            }
          }
          return true;
        })();

        // Show form only if not complete
        if (!isFormComplete) {
          return (
            <>
              <ContactPreferences
                form={form}
                formData={responses}
              />
              <AdditionalInformation
                form={form}
                formData={responses}
              />
              <div className="mb-24">
                <Button variant="dark" onClick={handleSubmitForm}>
                  Submit Form
                </Button>
              </div>
            </>
          );
        }
        return null;
      })()}

      <Card className="mb-24">
        <Card.Body>
          <h5 className="mb-24">Order Details</h5>

          <div className="mb-16">
            <small className="text-muted">Order ID</small>
            <div className="font-monospace">{order.id}</div>
          </div>

          <div className="mb-24">
            <small className="text-muted">Event</small>
            <div><strong>{order.events?.title || 'N/A'}</strong></div>
          </div>

          <div className="mb-24">
            <small className="text-muted">Customer</small>
            <div>{order.customer_name || 'Guest'}</div>
            <div className="text-muted">{order.customer_email}</div>
            {order.form_submissions?.responses && order.form_submissions.forms && (() => {
              const { forms: form, responses } = order.form_submissions;
              const hasContactInfo = (form.request_phone_number && responses.phone_number) ||
                (form.request_communication_preference && responses.preferred_channel);
              const hasSchemaInfo = form.schema && form.schema.some((field) => {
                const key = field.field_id_string != null ? field.field_id_string : field.label;
                return responses[key] && responses[key] !== '';
              });

              if (!hasContactInfo && !hasSchemaInfo) {
                return null;
              }

              return (
                <div className="mt-16">
                  {form.request_communication_preference && responses.preferred_channel && (() => {
                    let contactDisplay = responses.preferred_channel;
                    if (responses.preferred_channel === 'email') {
                      contactDisplay = 'Email';
                    } else if (responses.preferred_channel === 'sms') {
                      contactDisplay = 'SMS';
                    }
                    return (
                      <div className="small text-muted mt-8">
                        Preferred contact: {contactDisplay}
                      </div>
                    );
                  })()}
                  {form.request_phone_number && responses.phone_number && (
                    <div className="small text-muted mt-8">
                      Phone: {responses.phone_number}
                    </div>
                  )}
                  {form.schema && form.schema.map((field) => {
                    const key = field.field_id_string != null ? field.field_id_string : field.label;
                    const value = responses[key];
                    if (!value || value === '') return null;

                    let displayValue = value;
                    if (field.type === 'checkbox') {
                      displayValue = value ? 'Yes' : 'No';
                    }

                    return (
                      <div key={key} className="small text-muted mt-8">
                        {field.label}: {displayValue}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="mb-24">
            <small className="text-muted">Items</small>
            {order.order_items?.map((item, index) => (
              <div key={index} className="d-flex justify-content-between mt-8">
                <span>
                  {item.ticket_types?.name || item.upsellings?.item || item.upsellings?.name || 'Item'} x {item.quantity}
                </span>
                <span>${parseFloat(item.subtotal).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-top pt-16">
            <div className="d-flex justify-content-between mb-8">
              <span>Subtotal:</span>
              <span>${parseFloat(order.subtotal).toFixed(2)}</span>
            </div>

            {order.discount_amount > 0 && (
              <div className="d-flex justify-content-between mb-8 text-danger">
                <span>Discount ({order.discount_codes?.code}):</span>
                <span>-${parseFloat(order.discount_amount).toFixed(2)}</span>
              </div>
            )}

            <div className="d-flex justify-content-between pt-8 border-top">
              <strong>Total Paid:</strong>
              <strong className="text-dark">
                ${parseFloat(order.total).toFixed(2)}
              </strong>
            </div>
          </div>
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 mb-24">
        <Button
          variant="outline-dark"
          onClick={() => window.print()}
        >
          Print Receipt
        </Button>
      </div>

    </Container>
  );
}

export default OrderConfirmation;
