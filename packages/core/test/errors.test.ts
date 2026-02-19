import { describe, it, expect } from 'vitest';
import {
  HieroError,
  normalizeError,
} from '../src/errors/hiero-error.js';

describe('HieroError', () => {
  it('creates an error with default values', () => {
    const error = new HieroError('test error');
    expect(error.message).toBe('test error');
    expect(error.code).toBe('UNKNOWN');
    expect(error.name).toBe('HieroError');
    expect(error.context).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it('creates an error with custom options', () => {
    const cause = new Error('original');
    const error = new HieroError('wrapped', {
      code: 'MY_CODE',
      context: 'doing something',
      cause,
    });
    expect(error.code).toBe('MY_CODE');
    expect(error.context).toBe('doing something');
    expect(error.cause).toBe(cause);
  });

  it('is instanceof Error', () => {
    const error = new HieroError('test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HieroError);
  });
});

describe('normalizeError', () => {
  it('returns HieroError as-is', () => {
    const original = new HieroError('original', { code: 'TEST' });
    const result = normalizeError(original);
    expect(result).toBe(original);
  });

  it('wraps a standard Error', () => {
    const original = new Error('std error');
    const result = normalizeError(original, 'in testing');
    expect(result).toBeInstanceOf(HieroError);
    expect(result.message).toBe('std error');
    expect(result.code).toBe('SDK_ERROR');
    expect(result.context).toBe('in testing');
    expect(result.cause).toBe(original);
  });

  it('wraps an SDK error with status code', () => {
    const sdkError = Object.assign(new Error('sdk'), {
      status: { _code: 404 },
    });
    const result = normalizeError(sdkError);
    expect(result.code).toBe('404');
  });

  it('wraps a string', () => {
    const result = normalizeError('oops');
    expect(result.message).toBe('oops');
    expect(result.code).toBe('UNKNOWN');
  });

  it('wraps a number', () => {
    const result = normalizeError(42);
    expect(result.message).toBe('42');
  });
});
