/**
 * cn utility tests
 * Tests for the class name utility function.
 */

import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('should return empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('should return single class name', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('should join multiple class names with space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should join multiple class names', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('should filter out false values', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('should filter out undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('should filter out null values', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('should filter out empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });

  it('should handle all falsy values', () => {
    expect(cn(false, undefined, null, '', 'valid')).toBe('valid');
  });

  it('should handle conditional class names', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('should handle only falsy values', () => {
    expect(cn(false, undefined, null)).toBe('');
  });

  it('should preserve class order', () => {
    expect(cn('first', 'second', 'third')).toBe('first second third');
  });
});
