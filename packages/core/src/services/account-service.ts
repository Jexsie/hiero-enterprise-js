import type { PrivateKey } from "@hiero-ledger/sdk";
import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    AccountBalanceQuery,
    TransferTransaction,
    AccountId,
    PublicKey,
    Hbar,
} from "@hiero-ledger/sdk";
import type { Account, Balance } from "../types/index.js";
import { AccountType } from "../types/index.js";
import type { IHieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

/**
 * Options for creating a new account on the Hiero network.
 *
 * The caller is responsible for key generation (e.g. via HSM, KMS, or wallet).
 * Only the public key is provided here — private key material never enters
 * this library.
 */
export interface CreateAccountOptions {
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
}

/**
 * Service for managing accounts on the Hiero network.
 */
export class AccountService {
    private readonly context: IHieroContext;

    constructor(context: IHieroContext) {
        this.context = context;
    }

    /**
     * Create a new account on the network using a caller-provided public key.
     *
     * Key generation is the caller's responsibility (HSM, KMS, wallet, etc.).
     * This method accepts only the public key and submits the
     * `AccountCreateTransaction` to the network.
     *
     * @param options.publicKey - The public key (raw hex or DER-encoded hex)
     * @param options.keyType - Key algorithm: `AccountType.ED25519` (default) or `AccountType.ECDSA`
     * @param options.alias - `true` to derive EVM alias from key, or `{ ecdsaPublicKey }` for two-key pattern
     * @param options.initialBalance - Initial HBAR balance (default: 0)
     * @param options.receiverSignatureRequired - Require receiver sig for inbound transfers
     * @param options.memo - Account memo (max 100 bytes)
     * @param options.maxAutomaticTokenAssociations - Max auto token associations (0 = none, -1 = unlimited)
     * @param options.stakedAccountId - Account ID to stake to (mutually exclusive with stakedNodeId)
     * @param options.stakedNodeId - Node ID to stake to (mutually exclusive with stakedAccountId)
     * @param options.declineStakingReward - Whether to decline staking rewards
     * @returns The created account (ID, public key, and optional EVM address)
     */
    async createAccount(options: CreateAccountOptions): Promise<Account> {
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
                if (keyType !== AccountType.ECDSA) {
                    throw new Error(
                        "alias: true requires keyType AccountType.ECDSA — ed25519 keys cannot derive an EVM alias.",
                    );
                }
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

    /**
     * Auto-creates a "Hollow Account" by transferring HBAR to an EVM address.
     * Useful for onboarding MetaMask users who don't have a Hedera ID yet.
     *
     * @param evmAddress - The EVM address (e.g., 0x...)
     * @param amount - The amount of HBAR to transfer
     */
    async autoCreateEvmAccount(
        evmAddress: string,
        amount: number | Hbar,
    ): Promise<void> {
        const event: TransactionEvent = {
            type: "AccountAutoCreate",
            serviceName: "AccountService",
            methodName: "autoCreateEvmAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const hbarAmount =
                amount instanceof Hbar ? amount : new Hbar(amount);

            const transferTx = new TransferTransaction()
                .addHbarTransfer(
                    this.context.operatorAccountId,
                    hbarAmount.negated(),
                )
                .addHbarTransfer(
                    AccountId.fromEvmAddress(0, 0, evmAddress),
                    hbarAmount,
                );

            const response = await transferTx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "AccountService.autoCreateEvmAccount");
        }
    }

    /**
     * Delete an account, transferring remaining balance to another account.
     *
     * @param accountId - Account to delete
     * @param accountKey - Private key of the account being deleted
     * @param transferAccountId - Account to receive remaining balance (defaults to operator)
     */
    async deleteAccount(
        accountId: string | AccountId,
        accountKey: PrivateKey,
        transferAccountId?: string | AccountId,
    ): Promise<void> {
        const event: TransactionEvent = {
            type: "AccountDelete",
            serviceName: "AccountService",
            methodName: "deleteAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const transferTo =
                transferAccountId ?? this.context.operatorAccountId.toString();

            const tx = new AccountDeleteTransaction()
                .setAccountId(accountId)
                .setTransferAccountId(transferTo)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(accountKey)
            ).execute(this.context.client);

            const receipt = await response.getReceipt(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "AccountService.deleteAccount");
        }
    }

    /**
     * Get the balance of an account.
     *
     * @param accountId - Account to query
     * @returns The account balance
     */
    async getAccountBalance(accountId: string | AccountId): Promise<Balance> {
        try {
            const balance = await new AccountBalanceQuery()
                .setAccountId(accountId)
                .execute(this.context.client);

            const tokens = [];
            if (balance.tokens) {
                for (const [tokenId, amount] of balance.tokens) {
                    tokens.push({
                        tokenId: tokenId.toString(),
                        balance: amount.toString(),
                        decimals: balance.tokenDecimals?.get(tokenId) ?? 0,
                    });
                }
            }

            return {
                accountId: accountId.toString(),
                hbars: balance.hbars.toTinybars().toString(),
                tokens,
            };
        } catch (error) {
            throw normalizeError(error, "AccountService.getAccountBalance");
        }
    }

    /**
     * Get the balance of the operator account.
     *
     * @returns The operator account balance
     */
    async getOperatorAccountBalance(): Promise<Balance> {
        return this.getAccountBalance(this.context.operatorAccountId);
    }
}
