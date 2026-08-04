import { numeric, positiveInteger, ymdDate, sumNumeric, multiplyNumeric } from '@/lib/factory-money';

describe('factory-money utilities', () => {
  describe('numeric()', () => {
    it('should convert string number to Decimal', () => {
      const result = numeric('100.50');
      expect(result.toString()).toBe('100.50');
    });

    it('should handle integer input', () => {
      const result = numeric('100');
      expect(result.toString()).toBe('100');
    });

    it('should handle negative numbers', () => {
      const result = numeric('-50.25');
      expect(result.toString()).toBe('-50.25');
    });

    it('should handle zero', () => {
      const result = numeric('0');
      expect(result.toString()).toBe('0');
    });
  });

  describe('positiveInteger()', () => {
    it('should return positive integer', () => {
      expect(positiveInteger(5)).toBe(5);
    });

    it('should return 0 for negative numbers', () => {
      expect(positiveInteger(-5)).toBe(0);
    });

    it('should return 0 for strings', () => {
      expect(positiveInteger('abc')).toBe(0);
    });

    it('should floor decimal numbers', () => {
      expect(positiveInteger(5.9)).toBe(5);
    });

    it('should return 0 for null/undefined', () => {
      expect(positiveInteger(null)).toBe(0);
      expect(positiveInteger(undefined)).toBe(0);
    });
  });

  describe('ymdDate()', () => {
    it('should return YYYY-MM-DD format', () => {
      const result = ymdDate('2026-08-04');
      expect(result).toBe('2026-08-04');
    });

    it('should parse Date object', () => {
      const date = new Date('2026-08-04');
      const result = ymdDate(date);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should return null for invalid date', () => {
      const result = ymdDate('invalid');
      expect(result).toBeNull();
    });

    it('should handle timestamp', () => {
      const timestamp = new Date('2026-08-04').getTime();
      const result = ymdDate(timestamp);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('sumNumeric()', () => {
    it('should sum two Decimal numbers', () => {
      const a = numeric('100.50');
      const b = numeric('50.25');
      const result = sumNumeric(a, b);
      expect(result.toString()).toBe('150.75');
    });

    it('should handle zero values', () => {
      const a = numeric('0');
      const b = numeric('100');
      const result = sumNumeric(a, b);
      expect(result.toString()).toBe('100');
    });

    it('should handle negative numbers', () => {
      const a = numeric('-50');
      const b = numeric('100');
      const result = sumNumeric(a, b);
      expect(result.toString()).toBe('50');
    });
  });

  describe('multiplyNumeric()', () => {
    it('should multiply Decimal by number', () => {
      const decimal = numeric('25.50');
      const result = multiplyNumeric(decimal, 10);
      expect(result.toString()).toBe('255.00');
    });

    it('should handle zero multiplier', () => {
      const decimal = numeric('100');
      const result = multiplyNumeric(decimal, 0);
      expect(result.toString()).toBe('0');
    });

    it('should handle decimal multiplier', () => {
      const decimal = numeric('100');
      const result = multiplyNumeric(decimal, 1.5);
      expect(result.toString()).toBe('150.00');
    });

    it('should handle negative multiplier', () => {
      const decimal = numeric('100');
      const result = multiplyNumeric(decimal, -2);
      expect(result.toString()).toBe('-200.00');
    });
  });
});
