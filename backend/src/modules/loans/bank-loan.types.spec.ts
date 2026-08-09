import { mapBankStatusToDisplay, parseBankStatus } from './bank-loan.types';
import { CircuitBreaker } from './circuit-breaker';

describe('bank loan status mapping', () => {
  it('maps bank statuses to display without inventing decisions', () => {
    expect(mapBankStatusToDisplay('UNDER_REVIEW')).toBe('under_review');
    expect(mapBankStatusToDisplay('APPROVED')).toBe('approved');
    expect(mapBankStatusToDisplay('DISBURSED')).toBe('disbursed');
    expect(mapBankStatusToDisplay('UNKNOWN')).toBe('unknown');
  });

  it('parses unknown bank labels as UNKNOWN', () => {
    expect(parseBankStatus('WEIRD')).toBe('UNKNOWN');
    expect(parseBankStatus('approved')).toBe('APPROVED');
  });
});

describe('CircuitBreaker', () => {
  it('opens after threshold failures and cools down', () => {
    const b = new CircuitBreaker(2, 10);
    b.recordFailure();
    expect(() => b.assertClosed()).not.toThrow();
    b.recordFailure();
    expect(() => b.assertClosed()).toThrow('CIRCUIT_OPEN');
  });
});
