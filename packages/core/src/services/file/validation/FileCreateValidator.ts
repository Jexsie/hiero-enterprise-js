import type { FileCreateOperationOptions } from "../operations/index.js";

/**
 * Validates `FileCreateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Every field on `FileCreateOperationOptions` is optional (matching
 * the SDK's `FileCreateTransaction` — omitting `contents` yields an
 * empty file). File-memo length, key validity, expiration bounds, and
 * per-transaction byte limits are left to the SDK / network so we
 * don't drift from upstream constants.
 *
 * Kept as a stable extension point for future create-time invariants
 * (e.g. rejecting a top-level `KeyList` with a `threshold`).
 */
export class FileCreateValidator {
    /**
     * @throws {HieroError} If validation fails
     */
    validate(_options: FileCreateOperationOptions): void {
        // No invariants to enforce today — every field is optional and
        // the SDK/network handle the remaining constraints.
    }
}
