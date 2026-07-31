import { describe, expect, it } from 'vitest';
import { formatAdvisoryExplanation } from './advisory-text';

const advisory = {
  available: true as const,
  recommendation: 'BUY_NOW' as const,
  explanationFa: 'احتمال افزایش قیمت در ۴۸ ساعت آینده بالاست.',
  modelVersion: 'rec-v1',
  confidence: 0.82,
};

describe('formatAdvisoryExplanation', () => {
  it('returns Persian text for fa and ar', () => {
    expect(formatAdvisoryExplanation(advisory, 'fa')).toBe(advisory.explanationFa);
    expect(formatAdvisoryExplanation(advisory, 'ar')).toBe(advisory.explanationFa);
  });

  it('returns an English summary for en', () => {
    expect(formatAdvisoryExplanation(advisory, 'en')).toContain('prices may rise');
    expect(formatAdvisoryExplanation({ ...advisory, recommendation: 'WAIT' }, 'en')).toContain('waiting may lower');
  });
});
