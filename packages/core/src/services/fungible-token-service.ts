import {
    TokenCreateTransaction,
    TokenType,
    TokenAssociateTransaction,
    TokenDissociateTransaction,
    TokenMintTransaction,
    TokenBurnTransaction,
    TransferTransaction,
    type Long,
    type PrivateKey,
    type TokenId,
    type AccountId,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

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
    /** Treasury account ID */
    treasuryAccountId: string | AccountId;
    /** Treasury account private key */
    treasuryKey: PrivateKey;
    /** Supply key (required if the key is meant to be mutable) */
    supplyKey?: PrivateKey;
    /** Admin key (required if the key is meant to be mutable) */
    adminKey?: PrivateKey;
    /** Maximum supply (0 = infinite) */
    maxSupply?: number;
    /** Token memo */
    memo?: string;
}

/**
 * Service for managing fungible tokens on the Hiero network (HTS).
 */
export class FungibleTokenService {
    private readonly context: IHieroContext;

    constructor(context: IHieroContext) {
        this.context = context;
    }

    private createEvent(type: string, methodName: string): TransactionEvent {
        return {
            type,
            serviceName: "FungibleTokenService",
            methodName,
            timestamp: new Date(),
        };
    }

    /**
     * Create a new fungible token.
     *
     * @param options - Token creation options
     * @returns The token ID of the created token
     *
     * @example
     * ```typescript
     * const tokenClient = new FungibleTokenService(context);
     * const tokenId = await tokenClient.createToken({
     *   name: "Test Token",
     *   symbol: "TST",
     *   decimals: 2,
     *   initialSupply: 1000,
     *   maxSupply: 5000,
     *   memo: "the memo",
     *   treasuryAccountId: "0.0.555",
     * });
     * ```
     */
    async createToken(options: CreateTokenOptions): Promise<string> {
        const event = this.createEvent("TokenCreate", "createToken");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TokenCreateTransaction()
                .setTokenName(options.name)
                .setTokenSymbol(options.symbol)
                .setTokenType(TokenType.FungibleCommon)
                .setDecimals(options.decimals ?? 0)
                .setInitialSupply(options.initialSupply ?? 0)
                .setTreasuryAccountId(options.treasuryAccountId);

            if (options.supplyKey) {
                tx.setSupplyKey(options.supplyKey.publicKey);
            }

            if (options.adminKey) {
                tx.setAdminKey(options.adminKey.publicKey);
            }

            if (options.maxSupply && options.maxSupply > 0) {
                tx.setMaxSupply(options.maxSupply);
            }
            if (options.memo) {
                tx.setTokenMemo(options.memo);
            }

            tx.freezeWith(this.context.client);
            await tx.sign(options.treasuryKey);

            const response = await tx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);
            const tokenId = receipt.tokenId!.toString();

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return tokenId;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "FungibleTokenService.createToken");
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
        tokenId: string | TokenId,
        accountId: string | AccountId,
        accountKey: PrivateKey,
    ): Promise<void> {
        const event = this.createEvent("TokenAssociate", "associateToken");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
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
            throw normalizeError(error, "FungibleTokenService.associateToken");
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
        tokenId: string | TokenId,
        accountId: string | AccountId,
        accountKey: PrivateKey,
    ): Promise<void> {
        const event = this.createEvent("TokenDissociate", "dissociateToken");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TokenDissociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
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
            throw normalizeError(error, "FungibleTokenService.dissociateToken");
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
        tokenId: string | TokenId,
        amount: number,
        supplyKey: PrivateKey,
    ): Promise<void> {
        const event = this.createEvent("TokenMint", "mintToken");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TokenMintTransaction()
                .setTokenId(tokenId)
                .setAmount(amount)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(supplyKey)
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
            throw normalizeError(error, "FungibleTokenService.mintToken");
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
        tokenId: string | TokenId,
        amount: number | bigint | Long,
        supplyKey: PrivateKey,
    ): Promise<void> {
        const event = this.createEvent("TokenBurn", "burnToken");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TokenBurnTransaction()
                .setTokenId(tokenId)
                .setAmount(amount)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(supplyKey)
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
            throw normalizeError(error, "FungibleTokenService.burnToken");
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
        tokenId: string | TokenId,
        fromAccountId: string | AccountId,
        fromKey: PrivateKey,
        toAccountId: string | AccountId,
        amount: number,
    ): Promise<void> {
        const event = this.createEvent("TokenTransfer", "transferToken");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TransferTransaction()
                .addTokenTransfer(tokenId, fromAccountId, -amount)
                .addTokenTransfer(tokenId, toAccountId, amount)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(fromKey)
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
            throw normalizeError(error, "FungibleTokenService.transferToken");
        }
    }
}
