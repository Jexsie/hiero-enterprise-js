import { Hbar, NftId, TokenId, TransferTransaction } from "@hiero-ledger/sdk";
import type { AccountId } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { TransferValidator } from "../validation/index.js";

/**
 * Options for HBAR transfers — inherits all base transaction options.
 *
 * The sender and receiver are passed positionally for a clear call site.
 * When the sender is not the operator, pass the sender's signing key via
 * `additionalSigners`.
 */
export type TransferHbarOptions = TransactionOptions;

/**
 * Options for fungible token transfers.
 */
export interface TransferTokenOptions extends TransactionOptions {
    /**
     * Expected decimal precision of the token. When set, the SDK verifies
     * that the token's on-chain decimals match — a safety check against
     * sending the wrong magnitude.
     */
    expectedDecimals?: number;
}

/**
 * Options for NFT transfers — inherits all base transaction options.
 */
export type TransferNftOptions = TransactionOptions;

/**
 * Options for scheduling an HBAR transfer — combines transaction options
 * with the schedule fields (`payerAccountId`, `adminKey`, `scheduleMemo`).
 */
export type ScheduleTransferHbarOptions = TransferHbarOptions & ScheduleOptions;

/**
 * Options for scheduling a fungible token transfer.
 */
export type ScheduleTransferTokenOptions = TransferTokenOptions &
    ScheduleOptions;

/**
 * Options for scheduling an NFT transfer.
 */
export type ScheduleTransferNftOptions = TransferNftOptions & ScheduleOptions;

/**
 * Split a combined `TransferOptions & ScheduleOptions` bag into its two
 * halves so the executor can receive them through their respective
 * parameters.
 */
function splitScheduleOptions<T extends TransactionOptions>(
    combined: T & ScheduleOptions,
): { transactionOptions: T; scheduleOptions: ScheduleOptions } {
    const { payerAccountId, adminKey, scheduleMemo, ...transactionOptions } =
        combined;
    return {
        transactionOptions: transactionOptions as unknown as T,
        scheduleOptions: { payerAccountId, adminKey, scheduleMemo },
    };
}

export class TransferOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TransferValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TransferValidator();
    }

    /**
     * Transfer HBAR.
     *
     * @param receiverAccountId - Recipient account (string `"0.0.123"` or `AccountId`)
     * @param amount - Amount in HBAR (number) or `Hbar` instance for tinybar precision
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners` (or `options.externalSigners`
     *   for HSM/KMS keys) — otherwise the transaction will be rejected with
     *   `INVALID_SIGNATURE`.
     * @param options - Transaction options (fees, validity, signers, memo, etc.)
     */
    async transferHbar(
        receiverAccountId: string | AccountId,
        amount: number | Hbar,
        senderAccountId: string | AccountId,
        options: TransferHbarOptions = {},
    ): Promise<void> {
        this.validator.validateHbarTransfer({
            receiverAccountId,
            senderAccountId,
            amount,
        });
        const tx = this.buildHbarTransfer(
            receiverAccountId,
            amount,
            senderAccountId,
        );
        return await this.executor.run(
            tx,
            options,
            {
                type: "CryptoTransfer",
                serviceName: "AccountService",
                methodName: "transferHbar",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /**
     * Schedule an HBAR transfer.
     *
     * @param receiverAccountId - Recipient account
     * @param amount - Amount in HBAR or `Hbar`
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Combined transaction + schedule options
     *   (`payerAccountId`, `adminKey`, `scheduleMemo`, plus base transaction fields)
     */
    async scheduleTransferHbar(
        receiverAccountId: string | AccountId,
        amount: number | Hbar,
        senderAccountId: string | AccountId,
        options: ScheduleTransferHbarOptions = {},
    ): Promise<ScheduledResult> {
        this.validator.validateHbarTransfer({
            receiverAccountId,
            senderAccountId,
            amount,
        });
        const tx = this.buildHbarTransfer(
            receiverAccountId,
            amount,
            senderAccountId,
        );
        const { transactionOptions, scheduleOptions } =
            splitScheduleOptions(options);
        return await this.executor.scheduleRun(
            tx,
            transactionOptions,
            {
                type: "CryptoTransfer",
                serviceName: "AccountService",
                methodName: "transferHbar",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Transfer fungible tokens.
     *
     * @param tokenId - Token type (string `"0.0.456"` or `TokenId`)
     * @param receiverAccountId - Recipient account
     * @param amount - Amount in the token's smallest unit
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Transaction options; `expectedDecimals` enables magnitude safety check
     */
    async transferToken(
        tokenId: string | TokenId,
        receiverAccountId: string | AccountId,
        amount: number,
        senderAccountId: string | AccountId,
        options: TransferTokenOptions = {},
    ): Promise<void> {
        this.validator.validateTokenTransfer({
            tokenId,
            receiverAccountId,
            senderAccountId,
            amount,
            expectedDecimals: options.expectedDecimals,
        });
        const tx = this.buildTokenTransfer(
            tokenId,
            receiverAccountId,
            amount,
            senderAccountId,
            options.expectedDecimals,
        );
        return await this.executor.run(
            tx,
            options,
            {
                type: "CryptoTransfer",
                serviceName: "AccountService",
                methodName: "transferToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /**
     * Schedule a fungible token transfer.
     *
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     */
    async scheduleTransferToken(
        tokenId: string | TokenId,
        receiverAccountId: string | AccountId,
        amount: number,
        senderAccountId: string | AccountId,
        options: ScheduleTransferTokenOptions = {},
    ): Promise<ScheduledResult> {
        this.validator.validateTokenTransfer({
            tokenId,
            receiverAccountId,
            senderAccountId,
            amount,
            expectedDecimals: options.expectedDecimals,
        });
        const tx = this.buildTokenTransfer(
            tokenId,
            receiverAccountId,
            amount,
            senderAccountId,
            options.expectedDecimals,
        );
        const { transactionOptions, scheduleOptions } =
            splitScheduleOptions(options);
        return await this.executor.scheduleRun(
            tx,
            transactionOptions,
            {
                type: "CryptoTransfer",
                serviceName: "AccountService",
                methodName: "transferToken",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Transfer an NFT.
     *
     * @param tokenId - NFT collection token ID
     * @param serial - Serial number of the NFT
     * @param receiverAccountId - Recipient account
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Transaction options (fees, validity, signers, memo, etc.)
     */
    async transferNft(
        tokenId: string | TokenId,
        serial: number,
        receiverAccountId: string | AccountId,
        senderAccountId: string | AccountId,
        options: TransferNftOptions = {},
    ): Promise<void> {
        this.validator.validateNftTransfer({
            tokenId,
            serial,
            receiverAccountId,
            senderAccountId,
        });
        const tx = this.buildNftTransfer(
            tokenId,
            serial,
            receiverAccountId,
            senderAccountId,
        );
        return await this.executor.run(
            tx,
            options,
            {
                type: "CryptoTransfer",
                serviceName: "AccountService",
                methodName: "transferNft",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /**
     * Schedule an NFT transfer.
     *
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     */
    async scheduleTransferNft(
        tokenId: string | TokenId,
        serial: number,
        receiverAccountId: string | AccountId,
        senderAccountId: string | AccountId,
        options: ScheduleTransferNftOptions = {},
    ): Promise<ScheduledResult> {
        this.validator.validateNftTransfer({
            tokenId,
            serial,
            receiverAccountId,
            senderAccountId,
        });
        const tx = this.buildNftTransfer(
            tokenId,
            serial,
            receiverAccountId,
            senderAccountId,
        );
        const { transactionOptions, scheduleOptions } =
            splitScheduleOptions(options);
        return await this.executor.scheduleRun(
            tx,
            transactionOptions,
            {
                type: "CryptoTransfer",
                serviceName: "AccountService",
                methodName: "transferNft",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    private buildHbarTransfer(
        receiverAccountId: string | AccountId,
        amount: number | Hbar,
        senderAccountId: string | AccountId,
    ): TransferTransaction {
        const hbarAmount = amount instanceof Hbar ? amount : new Hbar(amount);

        return new TransferTransaction()
            .addHbarTransfer(senderAccountId, hbarAmount.negated())
            .addHbarTransfer(receiverAccountId, hbarAmount);
    }

    private buildTokenTransfer(
        tokenId: string | TokenId,
        receiverAccountId: string | AccountId,
        amount: number,
        senderAccountId: string | AccountId,
        expectedDecimals: number | undefined,
    ): TransferTransaction {
        const tx = new TransferTransaction();

        if (expectedDecimals != null) {
            tx.addTokenTransferWithDecimals(
                tokenId,
                senderAccountId,
                -amount,
                expectedDecimals,
            );
            tx.addTokenTransferWithDecimals(
                tokenId,
                receiverAccountId,
                amount,
                expectedDecimals,
            );
        } else {
            tx.addTokenTransfer(tokenId, senderAccountId, -amount);
            tx.addTokenTransfer(tokenId, receiverAccountId, amount);
        }

        return tx;
    }

    private buildNftTransfer(
        tokenId: string | TokenId,
        serial: number,
        receiverAccountId: string | AccountId,
        senderAccountId: string | AccountId,
    ): TransferTransaction {
        const resolvedTokenId =
            typeof tokenId === "string" ? TokenId.fromString(tokenId) : tokenId;
        const nftId = new NftId(resolvedTokenId, serial);

        return new TransferTransaction().addNftTransfer(
            nftId,
            senderAccountId,
            receiverAccountId,
        );
    }
}
