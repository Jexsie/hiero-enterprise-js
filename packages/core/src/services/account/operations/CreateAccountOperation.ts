import {
    AccountCreateTransaction,
    AccountId,
    PublicKey,
    Hbar,
} from "@hiero-ledger/sdk";
import { AccountType } from "../../../types/index.js";
import type { Account } from "../../../types/index.js";
import type { IHieroContext } from "../../../context/index.js";
import type { TransactionEvent } from "../../../listeners/index.js";
import { normalizeError } from "../../../errors/index.js";
import { CreateAccountValidator } from "../validation/index.js";
import type { TransactionOptions } from "../types/index.js";

/**
 * Options for creating a new account on the Hiero network.
 *
 * The caller is responsible for key generation (e.g. via HSM, KMS, or wallet).
 * Only the public key is provided here — private key material never enters
 * this library.
 */
export interface CreateAccountOptions extends TransactionOptions {
    /** The public key for the new account (raw hex or DER-encoded hex). */
    publicKey: string;

    /**
     * How to parse the public key. Required for raw hex keys where the
     * algorithm cannot be inferred. For DER-encoded keys, the specified
     * type must match the algorithm encoded in the DER prefix.
     *
     * Defaults to `AccountType.ED25519`.
     */
    keyType?: AccountType;

    /**
     * Whether to derive an EVM alias for the account.
     *
     * - `true` — derives alias from `publicKey` (requires `keyType: "ECDSA"`).
     * - `{ ecdsaPublicKey: string }` — derives alias from a separate ECDSA key
     *   while using `publicKey` as the account's controlling key (two-key pattern).
     *   The separate key's derived EVM address becomes the permanent, immutable alias.
     * - `undefined` / `false` — no alias is set.
     *
     * Note: aliases are immutable once set. Do not set an alias if you plan
     * to rotate keys in the future.
     */
    alias?: boolean | { ecdsaPublicKey: string };

    /** Initial balance in HBAR (default: 0). Accepts Hbar instance for tinybar precision. */
    initialBalance?: number | Hbar;

    /** Whether the receiver signature is required for transfers to this account. */
    receiverSignatureRequired?: boolean;

    /** Account memo (max 100 bytes). */
    memo?: string;

    /** Maximum number of automatic token associations (default: 0, use -1 for unlimited). */
    maxAutomaticTokenAssociations?: number;

    /** Account ID to stake to for earning rewards. Mutually exclusive with `stakedNodeId`. */
    stakedAccountId?: string;

    /** Node ID to stake to for earning rewards. Mutually exclusive with `stakedAccountId`. */
    stakedNodeId?: number;

    /** Whether to decline staking rewards (default: false). */
    declineStakingReward?: boolean;

    /** Auto-renew period in seconds (default: 7776000 = 90 days). Must be between 30 days and 90 days. */
    autoRenewPeriod?: number;

    /** Whether this account is high-volume (optimized for high transaction throughput). */
    highVolume?: boolean;
}

export class CreateAccountOperation {
    private readonly validator = new CreateAccountValidator();

    constructor(private readonly context: IHieroContext) {}

    /** Create account execute handler. */
    async execute(options: CreateAccountOptions): Promise<Account> {
        const event: TransactionEvent = {
            type: "AccountCreate",
            serviceName: "AccountService",
            methodName: "createAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const keyType = options.keyType ?? AccountType.ED25519;
            const publicKey =
                keyType === AccountType.ED25519
                    ? PublicKey.fromStringED25519(options.publicKey)
                    : PublicKey.fromStringECDSA(options.publicKey);

            const tx = new AccountCreateTransaction();

            // Key + alias strategy
            if (options.alias === true) {
                tx.setECDSAKeyWithAlias(publicKey);
            } else if (
                typeof options.alias === "object" &&
                options.alias?.ecdsaPublicKey
            ) {
                // Two-key pattern: account controlled by publicKey, alias derived from a separate ECDSA key
                const aliasKey = PublicKey.fromStringECDSA(
                    options.alias.ecdsaPublicKey,
                );
                tx.setKeyWithAlias(publicKey, aliasKey);
            } else {
                tx.setKeyWithoutAlias(publicKey);
            }

            // Initial balance
            const hbarBalance =
                options.initialBalance instanceof Hbar
                    ? options.initialBalance
                    : new Hbar(options.initialBalance ?? 0);
            tx.setInitialBalance(hbarBalance);

            // Optional properties
            if (options.receiverSignatureRequired != null) {
                tx.setReceiverSignatureRequired(
                    options.receiverSignatureRequired,
                );
            }

            if (options.memo != null) {
                tx.setAccountMemo(options.memo);
            }

            if (options.maxAutomaticTokenAssociations != null) {
                tx.setMaxAutomaticTokenAssociations(
                    options.maxAutomaticTokenAssociations,
                );
            }

            if (options.stakedAccountId != null) {
                tx.setStakedAccountId(options.stakedAccountId);
            }

            if (options.stakedNodeId != null) {
                tx.setStakedNodeId(options.stakedNodeId);
            }

            if (options.declineStakingReward != null) {
                tx.setDeclineStakingReward(options.declineStakingReward);
            }

            if (options.autoRenewPeriod != null) {
                tx.setAutoRenewPeriod(options.autoRenewPeriod);
            }

            if (options.highVolume != null) {
                tx.setHighVolume(options.highVolume);
            }

            // Low-level transaction options (from Transaction base class)
            if (options.maxTransactionFee != null) {
                tx.setMaxTransactionFee(
                    options.maxTransactionFee instanceof Hbar
                        ? options.maxTransactionFee
                        : new Hbar(options.maxTransactionFee),
                );
            }

            if (options.transactionValidDuration != null) {
                tx.setTransactionValidDuration(
                    options.transactionValidDuration,
                );
            }

            if (options.transactionMemo != null) {
                tx.setTransactionMemo(options.transactionMemo);
            }

            if (options.nodeAccountIds != null) {
                tx.setNodeAccountIds(
                    options.nodeAccountIds.map((id) =>
                        AccountId.fromString(id),
                    ),
                );
            }

            if (options.regenerateTransactionId != null) {
                tx.setRegenerateTransactionId(options.regenerateTransactionId);
            }

            // Validate the fully-built transaction before submission
            this.validator.validate(tx, options);

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            const result: Account = {
                accountId: receipt.accountId!.toString(),
                publicKey: publicKey.toString(),
            };

            // Include EVM address if an alias was set
            if (options.alias === true) {
                result.evmAddress = publicKey.toEvmAddress();
            } else if (
                typeof options.alias === "object" &&
                options.alias?.ecdsaPublicKey
            ) {
                result.evmAddress = PublicKey.fromStringECDSA(
                    options.alias.ecdsaPublicKey,
                ).toEvmAddress();
            }

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return result;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "AccountService.createAccount");
        }
    }
}
