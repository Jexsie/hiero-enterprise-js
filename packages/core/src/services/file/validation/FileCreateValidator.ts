import { normalizeError } from "../../../errors/index.js";
import type { FileCreateOperationOptions } from "../operations/index.js";

/**
 * Validates `FileCreateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Most of the file-create surface is fully optional; this validator
 * intentionally enforces only the invariant the SDK / network doesn't
 * catch cleanly:
 *
 *  - `contents` must be provided (a file with no initial contents is a
 *    programmer mistake — the SDK would submit an empty
 *    `FileCreateTransaction` which the network accepts but yields a
 *    zero-byte file, almost certainly unintended).
 *
 * File-memo length, key validity, expiration bounds, and per-transaction
 * byte limits are left to the SDK / network so we don't drift from
 * upstream constants.
 */
export class FileCreateValidator {
    /**
     * @throws {HieroError} If validation fails
     */
    validate(options: FileCreateOperationOptions): void {
        if (options.contents == null) {
            throw normalizeError(
                new Error("contents is required."),
                "FileCreateValidator",
            );
        }
    }
}
