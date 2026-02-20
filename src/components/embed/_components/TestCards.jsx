import { Button, Alert } from 'react-bootstrap';
import { $embed } from '@src/signals';
import { showTestCards } from '../_helpers/checkout.consts';
import * as events from '../_helpers/checkout.events';

function TestCards() {
  const { providers } = $embed.value;
  const env = providers?.config?.env || providers?.config?.environment;

  if (env !== 'int' && window.location.hostname !== 'localhost') {
    return null;
  }

  const testCards = [
    {
      scenario: 'Frictionless',
      amount: '>= 150',
      cardHolderName: 'FL-BRW1',
      cardNumber: '4000020951595032',
      expiration: '01/30',
      cvv: '123',
    },
    {
      scenario: 'Challenge',
      amount: '151',
      cardHolderName: 'CL-BRW2',
      cardNumber: '2221008123677736',
      expiration: '01/30',
      cvv: '123',
    },
    {
      scenario: 'non-3DS',
      amount: '10',
      cardHolderName: 'Jane Smith',
      cardNumber: '4000027891380961',
      expiration: '01/30',
      cvv: '123',
    },
  ];

  return (
    <div className="mb-24">
      <Button
        variant="outline-dark"
        size="sm"
        onClick={events.toggleTestCards}
        className="mb-16"
      >
        {showTestCards.value ? 'Hide' : 'Show'} Test Cards
      </Button>

      {showTestCards.value && (
        <Alert variant="info">
          <small className="text-muted d-block mb-16">
            Environment: <strong>{env}</strong>
          </small>
          <div className="table-responsive">
            <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Amount</th>
                  <th>Name</th>
                  <th>CC Number</th>
                  <th>Exp Date</th>
                  <th>CVV</th>
                </tr>
              </thead>
              <tbody>
                {testCards.map((card, index) => (
                  <tr key={index}>
                    <td>{card.scenario}</td>
                    <td>{card.amount}</td>
                    <td>
                      <code>{card.cardHolderName}</code>
                    </td>
                    <td>
                      <code>{card.cardNumber}</code>
                    </td>
                    <td>
                      <code>{card.expiration}</code>
                    </td>
                    <td>
                      <code>{card.cvv}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Alert>
      )}
    </div>
  );
}

export default TestCards;
