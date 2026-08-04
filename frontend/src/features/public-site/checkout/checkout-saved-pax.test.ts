import { describe, expect, it } from 'vitest';
import {
  monthNameToValue,
  demoCheckoutSavedPassengers,
  resolveCheckoutSavedPassengers,
  savedOptionToPassengerPatch,
} from './checkout-saved-pax';

describe('checkout-saved-pax', () => {
  it('maps Jalali and Gregorian month names to 1–12', () => {
    expect(monthNameToValue('خرداد')).toBe('3');
    expect(monthNameToValue('مرداد')).toBe('5');
    expect(monthNameToValue('June')).toBe('6');
    expect(monthNameToValue('August')).toBe('8');
    expect(monthNameToValue('6')).toBe('6');
  });

  it('demo list matches design names for fa', () => {
    const demo = demoCheckoutSavedPassengers('fa');
    expect(demo.map((d) => d.label)).toEqual(['نگار رضایی', 'صادق کاظمی', 'محمد رضایی']);
  });

  it('falls back to demo when API is empty', () => {
    expect(resolveCheckoutSavedPassengers([], 'fa')).toHaveLength(3);
  });

  it('savedOptionToPassengerPatch uppercases Latin names', () => {
    const patch = savedOptionToPassengerPatch(demoCheckoutSavedPassengers('fa')[0]!);
    expect(patch.firstNameLatin).toBe('NEGAR');
    expect(patch.lastNameLatin).toBe('REZAEI');
  });
});
