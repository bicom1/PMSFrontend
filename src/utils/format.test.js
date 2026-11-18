import { describe, expect, it } from 'vitest';
import { calculateAge, clinicToday } from './format.js';

describe('clinic dates', () => {
  it('calculates age from a date of birth', () => {
    const today = clinicToday();
    const year = Number(today.slice(0, 4)) - 30;
    expect(calculateAge(`${year}-01-01`)).toBeGreaterThanOrEqual(29);
  });

  it('rejects an incomplete date of birth', () => {
    expect(calculateAge('')).toBe('');
  });
});
