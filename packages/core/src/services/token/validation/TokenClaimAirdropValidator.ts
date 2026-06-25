import { normalizeError } from "../../../errors/index.js";
import type { TokenClaimAirdropOperationOptions } from "../operations/TokenClaimAirdropOperation.js";

/**
 * Validates `TokenClaimAirdropOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenClaimAirdropValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenClaimAirdropOperationOptions): void {
        this.validatePendingAirdropIdsList(options);
        options.pendingAirdropIds.forEach((id, index) => {
            this.validatePendingAirdropId(id, index);
        });
    }

    private validatePendingAirdropIdsList(
        options: TokenClaimAirdropOperationOptions,
    ): void {
        if (options.pendingAirdropIds == null) {
            throw normalizeError(
                new Error("pendingAirdropIds is required."),
                "TokenClaimAirdropValidator",
            );
        }

        if (!Array.isArray(options.pendingAirdropIds)) {
            throw normalizeError(
                new Error("pendingAirdropIds must be an array."),
                "TokenClaimAirdropValidator",
            );
        }

        if (options.pendingAirdropIds.length === 0) {
            throw normalizeError(
                new Error("pendingAirdropIds must not be empty."),
                "TokenClaimAirdropValidator",
            );
        }
    }

    private validatePendingAirdropId(id: unknown, index: number): void {
        const prefix = `pendingAirdropIds[${index}]`;

        if (id == null) {
            throw normalizeError(
                new Error(`${prefix} is required.`),
                "TokenClaimAirdropValidator",
            );
        }
    }
}
