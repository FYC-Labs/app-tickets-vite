import { AccruPay } from 'accru-pay-react';
import { $embed } from '@src/signals';
import { Spinner } from 'react-bootstrap';
import TestCards from './TestCards';
import CreditCardForm from './CreditCardForm';

function EmbedPaymentDetails({ onPaymentSuccess, isActive = true }) {
  const sessionToken = $embed.value.paymentSession?.sessionToken;
  const showLoader = $embed.value.isLoadingCCForm;
  const canRenderPaymentForm = isActive && sessionToken;

  return (
    <div style={{ position: 'relative' }} className="bg-light-200 rounded-15 p-16">
      {showLoader && (
        <div className="d-flex justify-content-center align-items-center">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading payment form...
        </div>
      )}
      {!showLoader && canRenderPaymentForm && (
        <>
          <TestCards />
          <AccruPay
            key={sessionToken}
            sessionToken={sessionToken}
            preferredProvider="nuvei"
            preReleaseGetProviders={() => $embed.value.providers || []}
          >
            <CreditCardForm
              order={$embed.value.order}
              showCardFields
              showSubmitButton={false}
              onPaymentSuccess={onPaymentSuccess}
            />
          </AccruPay>
        </>
      )}
    </div>
  );
}

export default EmbedPaymentDetails;
