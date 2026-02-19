import { describe, it, expect } from 'vitest';
import {
  resolveConfigFromEnv,
  resolveMirrorNodeUrl,
} from '../src/config/hiero-config.js';

describe('resolveMirrorNodeUrl', () => {
  it('resolves known networks', () => {
    expect(resolveMirrorNodeUrl('testnet')).toBe(
      'https://testnet.mirrornode.hedera.com',
    );
    expect(resolveMirrorNodeUrl('mainnet')).toBe(
      'https://mainnet.mirrornode.hedera.com',
    );
    expect(resolveMirrorNodeUrl('previewnet')).toBe(
      'https://previewnet.mirrornode.hedera.com',
    );
  });

  it('resolves with hedera-prefixed names', () => {
    expect(resolveMirrorNodeUrl('hedera-testnet')).toBe(
      'https://testnet.mirrornode.hedera.com',
    );
  });

  it('is case-insensitive', () => {
    expect(resolveMirrorNodeUrl('TESTNET')).toBe(
      'https://testnet.mirrornode.hedera.com',
    );
  });

  it('uses explicit URL when provided', () => {
    expect(resolveMirrorNodeUrl('testnet', 'http://custom:8080')).toBe(
      'http://custom:8080',
    );
  });

  it('throws for unknown network without explicit URL', () => {
    expect(() => resolveMirrorNodeUrl('devnet')).toThrow();
  });
});

describe('resolveConfigFromEnv', () => {
  const env = process.env;

  it('returns null when env vars are missing', () => {
    process.env = {};
    expect(resolveConfigFromEnv()).toBeNull();
    process.env = env;
  });

  it('resolves HIERO_ prefixed env vars', () => {
    process.env = {
      HIERO_NETWORK: 'testnet',
      HIERO_OPERATOR_ID: '0.0.1',
      HIERO_OPERATOR_KEY: 'key123',
    };
    const config = resolveConfigFromEnv();
    expect(config).toEqual({
      network: 'testnet',
      operatorId: '0.0.1',
      operatorKey: 'key123',
      mirrorNodeUrl: undefined,
    });
    process.env = env;
  });

  it('resolves HEDERA_ prefixed env vars as fallback', () => {
    process.env = {
      HEDERA_NETWORK: 'mainnet',
      HEDERA_OPERATOR_ID: '0.0.2',
      HEDERA_OPERATOR_KEY: 'key456',
    };
    const config = resolveConfigFromEnv();
    expect(config?.network).toBe('mainnet');
    process.env = env;
  });
});
