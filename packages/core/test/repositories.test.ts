import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountRepository } from '../src/repositories/account-repository.js';
import { NftRepository } from '../src/repositories/nft-repository.js';
import { TokenRepository } from '../src/repositories/token-repository.js';
import { createMockMirrorNodeClient } from '../src/testing/index.js';

describe('AccountRepository', () => {
  let repo: AccountRepository;
  let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

  beforeEach(() => {
    mockClient = createMockMirrorNodeClient();
    repo = new AccountRepository(mockClient as any);
  });

  it('delegates findByAccountId to queryAccount', async () => {
    const spy = vi.spyOn(mockClient, 'queryAccount');
    await repo.findByAccountId('0.0.123');
    expect(spy).toHaveBeenCalledWith('0.0.123');
  });

  it('delegates getBalance to queryAccountBalance', async () => {
    const spy = vi.spyOn(mockClient, 'queryAccountBalance');
    await repo.getBalance('0.0.123');
    expect(spy).toHaveBeenCalledWith('0.0.123');
  });
});

describe('NftRepository', () => {
  let repo: NftRepository;
  let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

  beforeEach(() => {
    mockClient = createMockMirrorNodeClient();
    repo = new NftRepository(mockClient as any);
  });

  it('delegates findByOwner to queryNftsByAccount', async () => {
    const spy = vi.spyOn(mockClient, 'queryNftsByAccount');
    await repo.findByOwner('0.0.123');
    expect(spy).toHaveBeenCalledWith('0.0.123');
  });

  it('delegates findBySerial to queryNftsByTokenIdAndSerial', async () => {
    const spy = vi.spyOn(mockClient, 'queryNftsByTokenIdAndSerial');
    await repo.findBySerial('0.0.99', 5);
    expect(spy).toHaveBeenCalledWith('0.0.99', 5);
  });
});

describe('TokenRepository', () => {
  let repo: TokenRepository;
  let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

  beforeEach(() => {
    mockClient = createMockMirrorNodeClient();
    repo = new TokenRepository(mockClient as any);
  });

  it('delegates findById to queryTokenById', async () => {
    const spy = vi.spyOn(mockClient, 'queryTokenById');
    await repo.findById('0.0.555');
    expect(spy).toHaveBeenCalledWith('0.0.555');
  });
});
