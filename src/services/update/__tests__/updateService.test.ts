import { compareSemver } from '../updateService';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.0.7', '0.0.7')).toBe(0);
  });

  it('returns 1 when first is greater', () => {
    expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
    expect(compareSemver('0.1.0', '0.0.9')).toBe(1);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
  });

  it('returns -1 when first is lesser', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
    expect(compareSemver('0.0.9', '0.1.0')).toBe(-1);
    expect(compareSemver('1.9.9', '2.0.0')).toBe(-1);
  });

  it('handles double-digit segments correctly', () => {
    // This is the key case that lexicographic comparison gets wrong
    expect(compareSemver('0.0.12', '0.0.9')).toBe(1);
    expect(compareSemver('0.0.9', '0.0.12')).toBe(-1);
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
  });

  it('handles different length versions', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '1.0')).toBe(0);
    expect(compareSemver('1.0.1', '1.0')).toBe(1);
    expect(compareSemver('1.0', '1.0.1')).toBe(-1);
  });

  it('returns 0 for non-numeric segments (NaN)', () => {
    expect(compareSemver('1.0.0-beta', '1.0.0')).toBe(0);
    expect(compareSemver('abc', '1.0.0')).toBe(0);
  });
});
