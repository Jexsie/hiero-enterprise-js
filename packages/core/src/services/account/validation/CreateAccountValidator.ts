import type { AccountCreateTransaction } from "@hiero-ledger/sdk";
import { AccountType } from "../../../types/index.js";
import { normalizeError } from "../../../errors/index.js";
import type { CreateAccountOptions } from "../operations/CreateAccountOperation.js";

/**
 * Validates a built `AccountCreateTransaction` and its options before execution.
 *
 * Separated from the operation so validation logic is independently testable
 * without requiring network interaction.
 */
export class CreateAccountValidator {
    /**
     * Validate the transaction and options prior to network submission.
     *
     * @param tx - The built (but not yet executed) `AccountCreateTransaction`
     * @param options - The original caller-provided options
     * @throws {HieroError} If validation fails
     */
    validate(
        tx: AccountCreateTransaction,
        options: CreateAccountOptions,
    ): void {
        this.validateAlias(options);
        this.validateInitialBalance(options);
        this.validateStakingOptions(options);
        this.validateMemo(options);
        this.validateAutoRenewPeriod(options);
        this.validateHighVolume(options);
    }

    private validateAlias(options: CreateAccountOptions): void {
        if (options.alias === true) {
            const keyType = options.keyType ?? AccountType.ED25519;
            if (keyType !== AccountType.ECDSA) {
                throw normalizeError(
                    new Error(
                        "alias: true requires keyType AccountType.ECDSA — ed25519 keys cannot derive an EVM alias.",
                    ),
                    "CreateAccountValidator",
                );
            }
        }
    }

    private validateInitialBalance(options: CreateAccountOptions): void {
        if (
            typeof options.initialBalance === "number" &&
            options.initialBalance < 0
        ) {
            throw normalizeError(
                new Error("Initial balance cannot be negative."),
                "CreateAccountValidator",
            );
        }
    }

    private validateStakingOptions(options: CreateAccountOptions): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw normalizeError(
                new Error(
                    "stakedAccountId and stakedNodeId are mutually exclusive — set only one.",
                ),
                "CreateAccountValidator",
            );
        }

        if (
            options.declineStakingReward === true &&
            options.stakedAccountId == null &&
            options.stakedNodeId == null
        ) {
            console.warn(
                "[CreateAccountValidator] declineStakingReward is true but no staking target is set — this has no effect.",
            );
        }
    }

    private validateMemo(options: CreateAccountOptions): void {
        if (options.memo && Buffer.byteLength(options.memo, "utf8") > 100) {
            throw normalizeError(
                new Error(
                    `Account memo exceeds 100 bytes (got ${Buffer.byteLength(options.memo, "utf8")}).`,
                ),
                "CreateAccountValidator",
            );
        }
    }

    private validateAutoRenewPeriod(options: CreateAccountOptions): void {
        if (options.autoRenewPeriod == null) return;

        const MIN_AUTO_RENEW = 2_592_000; // 30 days in seconds
        const MAX_AUTO_RENEW = 7_776_000; // 90 days in seconds

        if (
            options.autoRenewPeriod < MIN_AUTO_RENEW ||
            options.autoRenewPeriod > MAX_AUTO_RENEW
        ) {
            throw normalizeError(
                new Error(
                    `autoRenewPeriod must be between 30 days (${MIN_AUTO_RENEW}s) and 90 days (${MAX_AUTO_RENEW}s), got ${options.autoRenewPeriod}s.`,
                ),
                "CreateAccountValidator",
            );
        }
    }

    /**
     * Validates high-volume mode (HIP-1313).
     *
     * Setting highVolume: true routes the transaction through dedicated
     * high-volume throttle capacity with variable-rate pricing.
     * Users should always pair this with a maxTransactionFee to cap costs.
     */
    private validateHighVolume(options: CreateAccountOptions): void {
        if (options.highVolume === true && options.maxTransactionFee == null) {
            console.warn(
                "[CreateAccountValidator] highVolume is enabled (HIP-1313) without maxTransactionFee. " +
                    "This routes through dedicated high-volume throttle capacity with variable-rate pricing. " +
                    "Set maxTransactionFee to cap your costs.",
            );
        }
    }
}
