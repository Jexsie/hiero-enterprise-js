import type {
    AccountId,
    Key,
    Timestamp,
    Long,
    TokenKeyValidation,
    TokenId,
} from "@hiero-ledger/sdk";
import { TokenUpdateTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { TokenUpdateValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenUpdateTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenUpdateTransaction` 1:1. All update fields
 * are optional — only properties that are explicitly set are sent to the
 * network; omitted fields are left unchanged on the token.
 *
 * Extends `TransactionOptions` for fees, validity window, additional signers,
 * and scheduling.
 */
export interface TokenUpdateOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    tokenName?: string;
    tokenSymbol?: string;
    treasuryAccountId?: AccountId | string;
    adminKey?: Key;
    kycKey?: Key;
    freezeKey?: Key;
    wipeKey?: Key;
    supplyKey?: Key;
    autoRenewAccountId?: AccountId | string;
    expirationTime?: Timestamp | Date;
    autoRenewPeriod?: Long | number;
    tokenMemo?: string;
    feeScheduleKey?: Key;
    pauseKey?: Key;
    metadataKey?: Key;
    metadata?: Uint8Array;
    keyVerificationMode?: TokenKeyValidation;
}

export class TokenUpdateOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenUpdateValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenUpdateValidator();
    }

    /** Submit a `TokenUpdateTransaction`. */
    async execute(options: TokenUpdateOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenUpdate",
                serviceName: "TokenService",
                methodName: "updateToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /** Schedule a `TokenUpdateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenUpdateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "TokenUpdate",
                serviceName: "TokenService",
                methodName: "updateToken",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    private build(
        options: TokenUpdateOperationOptions,
    ): TokenUpdateTransaction {
        const tx = new TokenUpdateTransaction().setTokenId(options.tokenId);

        if (options.tokenName != null) {
            tx.setTokenName(options.tokenName);
        }

        if (options.tokenSymbol != null) {
            tx.setTokenSymbol(options.tokenSymbol);
        }

        if (options.treasuryAccountId != null) {
            tx.setTreasuryAccountId(options.treasuryAccountId);
        }

        if (options.adminKey != null) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.kycKey != null) {
            tx.setKycKey(options.kycKey);
        }

        if (options.freezeKey != null) {
            tx.setFreezeKey(options.freezeKey);
        }

        if (options.wipeKey != null) {
            tx.setWipeKey(options.wipeKey);
        }

        if (options.supplyKey != null) {
            tx.setSupplyKey(options.supplyKey);
        }

        if (options.autoRenewAccountId != null) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.tokenMemo != null) {
            tx.setTokenMemo(options.tokenMemo);
        }

        if (options.feeScheduleKey != null) {
            tx.setFeeScheduleKey(options.feeScheduleKey);
        }

        if (options.pauseKey != null) {
            tx.setPauseKey(options.pauseKey);
        }

        if (options.metadataKey != null) {
            tx.setMetadataKey(options.metadataKey);
        }

        if (options.metadata != null) {
            tx.setMetadata(options.metadata);
        }

        if (options.keyVerificationMode != null) {
            tx.setKeyVerificationMode(options.keyVerificationMode);
        }

        return tx;
    }
}
