import {
  TokenCreateTransaction,
  TokenType,
  TokenAssociateTransaction,
  TokenDissociateTransaction,
  TokenMintTransaction,
  TokenBurnTransaction,
  TransferTransaction,
  PrivateKey,
  Hbar,
} from '@hashgraph/sdk';
import { HieroContext } from '../context/index.js';
import { normalizeError } from '../errors/index.js';

/**
 * Options for creating a fungible token.
 */
export interface CreateTokenOptions {
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Decimal places (default: 0) */
  decimals?: number;
  /** Initial supply (default: 0) */
  initialSupply?: number;
  /** Treasury account ID (defaults to operator) */
  treasuryAccountId?: string;
  /** Treasury account private key (required if treasury != operator) */
  treasuryKey?: string;
  /** Supply key (defaults to operator key) */
  supplyKey?: string;
  /** Admin key (defaults to operator key) */
  adminKey?: string;
  /** Maximum supply (0 = infinite) */
  maxSupply?: number;
  /** Token memo */
  memo?: string;
}

/**
 * Service for managing fungible tokens on the Hiero network (HTS).
 * Maps to Java: com.openelements.hiero.base.FungibleTokenClient
 */
export class FungibleTokenClient {
  private readonly context: HieroContext;

  constructor(context: HieroContext) {
    this.context = context;
  }

  /**
   * Create a new fungible token.
   *
   * @param options - Token creation options
   * @returns The token ID of the created token
   */
  async createToken(options: CreateTokenOptions): Promise<string> {
    try {
      const supplyKey = options.supplyKey
        ? PrivateKey.fromString(options.supplyKey)
        : this.context.operatorKey;
      const adminKey = options.adminKey
        ? PrivateKey.fromString(options.adminKey)
        : this.context.operatorKey;

      const tx = new TokenCreateTransaction()
        .setTokenName(options.name)
        .setTokenSymbol(options.symbol)
        .setTokenType(TokenType.FungibleCommon)
        .setDecimals(options.decimals ?? 0)
        .setInitialSupply(options.initialSupply ?? 0)
        .setTreasuryAccountId(
          options.treasuryAccountId ?? this.context.operatorAccountId.toString(),
        )
        .setSupplyKey(supplyKey.publicKey)
        .setAdminKey(adminKey.publicKey);

      if (options.maxSupply !== undefined && options.maxSupply > 0) {
        tx.setMaxSupply(options.maxSupply);
      }
      if (options.memo) {
        tx.setTokenMemo(options.memo);
      }

      let frozenTx = tx.freezeWith(this.context.client);
      if (options.treasuryKey) {
        frozenTx = await frozenTx.sign(
          PrivateKey.fromString(options.treasuryKey),
        );
      }

      const response = await frozenTx.execute(this.context.client);
      const receipt = await response.getReceipt(this.context.client);
      return receipt.tokenId!.toString();
    } catch (error) {
      throw normalizeError(error, 'FungibleTokenClient.createToken');
    }
  }

  /**
   * Associate a token with an account.
   *
   * @param tokenId - Token to associate
   * @param accountId - Account to associate with
   * @param accountKey - Private key of the account
   */
  async associateToken(
    tokenId: string,
    accountId: string,
    accountKey: string,
  ): Promise<void> {
    try {
      const key = PrivateKey.fromString(accountKey);
      const tx = new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([tokenId])
        .freezeWith(this.context.client);

      await (await tx.sign(key)).execute(this.context.client);
    } catch (error) {
      throw normalizeError(error, 'FungibleTokenClient.associateToken');
    }
  }

  /**
   * Dissociate a token from an account.
   *
   * @param tokenId - Token to dissociate
   * @param accountId - Account to dissociate from
   * @param accountKey - Private key of the account
   */
  async dissociateToken(
    tokenId: string,
    accountId: string,
    accountKey: string,
  ): Promise<void> {
    try {
      const key = PrivateKey.fromString(accountKey);
      const tx = new TokenDissociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([tokenId])
        .freezeWith(this.context.client);

      await (await tx.sign(key)).execute(this.context.client);
    } catch (error) {
      throw normalizeError(error, 'FungibleTokenClient.dissociateToken');
    }
  }

  /**
   * Mint additional supply of a token.
   *
   * @param tokenId - Token to mint
   * @param amount - Amount to mint
   * @param supplyKey - Supply key (defaults to operator key)
   */
  async mintToken(
    tokenId: string,
    amount: number,
    supplyKey?: string,
  ): Promise<void> {
    try {
      const key = supplyKey
        ? PrivateKey.fromString(supplyKey)
        : this.context.operatorKey;
      const tx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(amount)
        .freezeWith(this.context.client);

      await (await tx.sign(key)).execute(this.context.client);
    } catch (error) {
      throw normalizeError(error, 'FungibleTokenClient.mintToken');
    }
  }

  /**
   * Burn supply of a token.
   *
   * @param tokenId - Token to burn
   * @param amount - Amount to burn
   * @param supplyKey - Supply key (defaults to operator key)
   */
  async burnToken(
    tokenId: string,
    amount: number,
    supplyKey?: string,
  ): Promise<void> {
    try {
      const key = supplyKey
        ? PrivateKey.fromString(supplyKey)
        : this.context.operatorKey;
      const tx = new TokenBurnTransaction()
        .setTokenId(tokenId)
        .setAmount(amount)
        .freezeWith(this.context.client);

      await (await tx.sign(key)).execute(this.context.client);
    } catch (error) {
      throw normalizeError(error, 'FungibleTokenClient.burnToken');
    }
  }

  /**
   * Transfer tokens between accounts.
   *
   * @param tokenId - Token to transfer
   * @param fromAccountId - Sender account
   * @param fromKey - Sender private key
   * @param toAccountId - Receiver account
   * @param amount - Amount to transfer
   */
  async transferToken(
    tokenId: string,
    fromAccountId: string,
    fromKey: string,
    toAccountId: string,
    amount: number,
  ): Promise<void> {
    try {
      const key = PrivateKey.fromString(fromKey);
      const tx = new TransferTransaction()
        .addTokenTransfer(tokenId, fromAccountId, -amount)
        .addTokenTransfer(tokenId, toAccountId, amount)
        .freezeWith(this.context.client);

      await (await tx.sign(key)).execute(this.context.client);
    } catch (error) {
      throw normalizeError(error, 'FungibleTokenClient.transferToken');
    }
  }
}
