import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import type { HieroConfig } from '../config/index.js';
import { resolveConfigFromEnv } from '../config/index.js';
import { HieroError } from '../errors/index.js';

/**
 * Central context for interacting with a Hiero network.
 * Manages the SDK Client lifecycle and provides access to the operator account.
 *
 * Maps to Java: com.openelements.hiero.base.HieroContext
 *
 * @example
 * ```ts
 * const ctx = HieroContext.initialize({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' });
 * const client = ctx.client;
 * ```
 */
export class HieroContext {
  private static instance: HieroContext | null = null;

  /** The underlying Hedera SDK Client */
  public readonly client: Client;

  /** The resolved configuration */
  public readonly config: HieroConfig;

  /** The operator account ID */
  public readonly operatorAccountId: AccountId;

  /** The operator private key */
  public readonly operatorKey: PrivateKey;

  private constructor(config: HieroConfig) {
    this.config = config;

    // Resolve network
    const network = config.network.toLowerCase();
    if (network === 'mainnet' || network === 'hedera-mainnet') {
      this.client = Client.forMainnet();
    } else if (network === 'testnet' || network === 'hedera-testnet') {
      this.client = Client.forTestnet();
    } else if (network === 'previewnet' || network === 'hedera-previewnet') {
      this.client = Client.forPreviewnet();
    } else {
      // Custom network — attempt to parse as JSON or URL
      throw new HieroError(
        `Custom networks are not yet supported: "${network}"`,
        {
          code: 'UNSUPPORTED_NETWORK',
        },
      );
    }

    // Set operator
    this.operatorAccountId = AccountId.fromString(config.operatorId);
    this.operatorKey = PrivateKey.fromStringDer(config.operatorKey);
    this.client.setOperator(this.operatorAccountId, this.operatorKey);
  }

  /**
   * Initialize the HieroContext singleton.
   * If no config is provided, it attempts to resolve from environment variables.
   *
   * @param config - Optional explicit configuration
   * @returns The initialized HieroContext
   * @throws HieroError if configuration is missing or invalid
   */
  public static initialize(config?: HieroConfig): HieroContext {
    if (HieroContext.instance) {
      return HieroContext.instance;
    }

    const resolved = config ?? resolveConfigFromEnv();
    if (!resolved) {
      throw new HieroError(
        'No Hiero configuration found. Provide a config object or set HIERO_NETWORK, HIERO_OPERATOR_ID, and HIERO_OPERATOR_KEY environment variables.',
        { code: 'MISSING_CONFIG' },
      );
    }

    HieroContext.instance = new HieroContext(resolved);
    return HieroContext.instance;
  }

  /**
   * Get the current HieroContext instance.
   *
   * @returns The current instance
   * @throws HieroError if not initialized
   */
  public static get(): HieroContext {
    if (!HieroContext.instance) {
      throw new HieroError(
        'HieroContext has not been initialized. Call HieroContext.initialize() first.',
        { code: 'NOT_INITIALIZED' },
      );
    }
    return HieroContext.instance;
  }

  /**
   * Reset the singleton (useful for testing or reconfiguration).
   */
  public static reset(): void {
    if (HieroContext.instance) {
      HieroContext.instance.client.close();
      HieroContext.instance = null;
    }
  }
}
