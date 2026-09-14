import { describe, expect, it } from 'vitest';

import { formatPrice } from './format.js';

const NBSP = String.fromCharCode(160);
const normalize = (value: string) => value.split(NBSP).join(' ');

describe('formatPrice', () => {
  it('formats cents as BRL currency', () => {
    const result = normalize(formatPrice(1234));

    expect(result).toContain('R$');
    expect(result).toContain('12,34');
  });

  it('formats zero cents', () => {
    const result = normalize(formatPrice(0));

    expect(result).toContain('R$');
    expect(result).toContain('0,00');
  });

  it('formats a thousands separator', () => {
    const result = normalize(formatPrice(123456));

    expect(result).toContain('1.234,56');
  });
});
