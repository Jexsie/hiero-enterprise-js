import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    AccountBalanceQuery,
    TransferTransaction,
    AccountId,
    PublicKey,
    Hbar,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { AccountType } from "../types/index.js";
import type { Account, CreatedAccount, Balance } from "../types/index.js";
import type { IHieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

/**
 * Options for creating a new account with a newly generated key pair.
 */
export interface CreateAccountOptions {
    /** Initial balance in HBAR (default: 0). Accepts Hbar instance for tinybar precision. */
    initialBalance?: number | Hbar;
    /** Maximum automatic token associations (default: 0) */
    maxAutomaticTokenAssociations?: number;
    /** Account memo */
    memo?: string;
    /** Generate an EVM-compatible account (and underlying key). Defaults to HIERO NATIVE (ED25519). */
    evm?: boolean;
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
     * Create a new account on the network using a freshly generated local key pair.
     *
     * The private key is generated client-side before submitting the transaction.
     * Hiero returns the new account ID in the receipt, but never returns
     * the private key. This method therefore returns the generated private key so
     * the caller can persist it immediately.
     *
     * @param options - Optional account creation parameters
     * @returns The newly created account plus the generated private key
     */
    async createAccount(
        options: CreateAccountOptions = {},
    ): Promise<CreatedAccount> {
        const event: TransactionEvent = {
            type: "AccountCreate",
            serviceName: "AccountService",
            methodName: "createAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const newKey = options.evm
                ? PrivateKey.generateECDSA()
                : PrivateKey.generateED25519();

            const hbarBalance =
                options.initialBalance instanceof Hbar
                    ? options.initialBalance
                    : new Hbar(options.initialBalance ?? 0);

            const tx = new AccountCreateTransaction()
                .setKeyWithoutAlias(newKey.publicKey)
                .setInitialBalance(hbarBalance);

            if (options.evm) {
                tx.setAlias(newKey.publicKey.toEvmAddress());
            }

            if (options.maxAutomaticTokenAssociations) {
                tx.setMaxAutomaticTokenAssociations(
                    options.maxAutomaticTokenAssociations,
                );
            }
            if (options.memo) {
                tx.setAccountMemo(options.memo);
            }

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            const result: CreatedAccount = {
                accountId: receipt.accountId!.toString(),
                publicKey: newKey.publicKey.toString(),
                privateKey: newKey,
            };

            if (options.evm) {
                result.evmAddress = newKey.publicKey.toEvmAddress();
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
     * Create a new account using a caller-provided public key.
     * Supports both Ed25519 (Native) and ECDSA (EVM-compatible) keys.
     *
     * Use this when key management happens outside this library, for example in
     * a wallet, HSM, KMS, or another key-generation workflow. Since the caller
     * already controls the key, this method returns only public account fields.
     *
     * @param publicKeyStr - The public key string (raw or DER formatted)
     * @param type - The account type (EVM vs NATIVE)
     * @param initialBalance - The amount of HBAR to fund the account initially
     * @param memo - Optional memo
     * @returns The created account without private key material
     */
    async createAccountWithPublicKey(
        publicKeyStr: string,
        type: AccountType,
        initialBalance: number | Hbar = 0,
        memo?: string,
    ): Promise<Account> {
        const event: TransactionEvent = {
            type: "AccountCreate",
            serviceName: "AccountService",
            methodName: "createAccountWithPublicKey",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const publicKey =
                type === AccountType.EVM
                    ? PublicKey.fromStringECDSA(publicKeyStr)
                    : PublicKey.fromStringED25519(publicKeyStr);

            const hbarBalance =
                initialBalance instanceof Hbar
                    ? initialBalance
                    : new Hbar(initialBalance);

            const tx = new AccountCreateTransaction()
                .setKeyWithoutAlias(publicKey)
                .setInitialBalance(hbarBalance);

            if (type === AccountType.EVM) {
                tx.setAlias(publicKey.toEvmAddress());
            }
            if (memo) {
                tx.setAccountMemo(memo);
            }

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            const result: Account = {
                accountId: receipt.accountId!.toString(),
                publicKey: publicKey.toString(),
            };

            if (type === AccountType.EVM) {
                result.evmAddress = publicKey.toEvmAddress();
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
            throw normalizeError(
                error,
                "AccountService.createAccountWithPublicKey",
            );
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
