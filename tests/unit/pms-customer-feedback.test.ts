import { describe, it, expect } from 'vitest';
import {
  isValidFeedbackType,
  isValidRating,
} from '@/lib/pms/customer-feedback-service';

describe('PMS feedback · isValidFeedbackType', () => {
  it('合法类型', () => {
    expect(isValidFeedbackType('satisfaction')).toBe(true);
    expect(isValidFeedbackType('complaint')).toBe(true);
    expect(isValidFeedbackType('suggestion')).toBe(true);
    expect(isValidFeedbackType('repair_request')).toBe(true);
  });
  it('非法类型', () => {
    expect(isValidFeedbackType('spam')).toBe(false);
    expect(isValidFeedbackType('')).toBe(false);
  });
});

describe('PMS feedback · isValidRating', () => {
  it('1-5 整数合法', () => {
    expect(isValidRating(1, 'satisfaction')).toBe(true);
    expect(isValidRating(5, 'satisfaction')).toBe(true);
  });
  it('越界/小数非法', () => {
    expect(isValidRating(0, 'satisfaction')).toBe(false);
    expect(isValidRating(6, 'satisfaction')).toBe(false);
    expect(isValidRating(3.5, 'satisfaction')).toBe(false);
  });
  it('满意度类必须填分, 其它类可空', () => {
    expect(isValidRating(null, 'satisfaction')).toBe(false);
    expect(isValidRating(null, 'complaint')).toBe(true);
    expect(isValidRating(undefined, 'suggestion')).toBe(true);
  });
});
