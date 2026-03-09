/**
 * Tests for utility functions
 */

import { getHealthScoreColor, getHealthScoreColorClass } from '../utils';

describe('Health Score Color Utilities', () => {
  describe('getHealthScoreColor', () => {
    it('should return green for scores >= 80', () => {
      expect(getHealthScoreColor(100)).toBe('green');
      expect(getHealthScoreColor(90)).toBe('green');
      expect(getHealthScoreColor(80)).toBe('green');
    });

    it('should return yellow for scores 50-79', () => {
      expect(getHealthScoreColor(79)).toBe('yellow');
      expect(getHealthScoreColor(65)).toBe('yellow');
      expect(getHealthScoreColor(50)).toBe('yellow');
    });

    it('should return red for scores < 50', () => {
      expect(getHealthScoreColor(49)).toBe('red');
      expect(getHealthScoreColor(25)).toBe('red');
      expect(getHealthScoreColor(0)).toBe('red');
    });
  });

  describe('getHealthScoreColorClass', () => {
    it('should return green classes for scores >= 80', () => {
      const classes = getHealthScoreColorClass(85);
      expect(classes).toContain('text-green-600');
      expect(classes).toContain('bg-green-50');
      expect(classes).toContain('border-green-200');
    });

    it('should return yellow classes for scores 50-79', () => {
      const classes = getHealthScoreColorClass(60);
      expect(classes).toContain('text-yellow-600');
      expect(classes).toContain('bg-yellow-50');
      expect(classes).toContain('border-yellow-200');
    });

    it('should return red classes for scores < 50', () => {
      const classes = getHealthScoreColorClass(30);
      expect(classes).toContain('text-red-600');
      expect(classes).toContain('bg-red-50');
      expect(classes).toContain('border-red-200');
    });
  });
});
