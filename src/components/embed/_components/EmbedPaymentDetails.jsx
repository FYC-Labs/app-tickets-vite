import { AccruPay } from 'accru-pay-react';
import { $embed } from '@src/signals';
import TestCards from './TestCards';
import CreditCardForm from './CreditCardForm';

function EmbedPaymentDetails({ onPaymentSuccess }) {
  return (
    <div className="border-top border-bottom pt-16 pb-16" style={{ position: 'relative' }}>
      <TestCards />
      <AccruPay
        sessionToken={$embed.value.paymentSession?.sessionToken}
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
    </div>
  );
}

export default EmbedPaymentDetails;
