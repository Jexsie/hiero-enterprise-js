import { normalizeError } from "../../../errors/index.js";
import type { FileAppendOperationOptions } from "../operations/index.js";

/**
 * Validates `FileAppendOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Enforces:
 *  - `fileId` is present and non-empty.
 *  - `contents` is present.
 *  - `maxChunks` / `chunkSize`, when provided, are positive integers —
 *    the SDK would silently produce nonsensical chunking otherwise.
 *
 * Signing rules (the file's `keys` must sign) are network-enforced —
 * they depend on the file's current state and the operator's identity,
 * neither of which the validator can see.
 */
export class FileAppendValidator {
    /**
     * @throws {HieroError} If validation fails
     */
    validate(options: FileAppendOperationOptions): void {
        this.validateFileId(options);
        this.validateContents(options);
        this.validateChunkBounds(options);
    }

    private validateFileId(options: FileAppendOperationOptions): void {
        if (options.fileId == null) {
            throw normalizeError(
                new Error("fileId is required."),
                "FileAppendValidator",
            );
        }

        if (
            typeof options.fileId === "string" &&
            options.fileId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("fileId cannot be empty."),
                "FileAppendValidator",
            );
        }
    }

    private validateContents(options: FileAppendOperationOptions): void {
        if (options.contents == null) {
            throw normalizeError(
                new Error("contents is required."),
                "FileAppendValidator",
            );
        }
    }

    private validateChunkBounds(options: FileAppendOperationOptions): void {
        if (options.maxChunks != null) {
            if (!Number.isInteger(options.maxChunks) || options.maxChunks < 1) {
                throw normalizeError(
                    new Error("maxChunks must be a positive integer."),
                    "FileAppendValidator",
                );
            }
        }

        if (options.chunkSize != null) {
            if (!Number.isInteger(options.chunkSize) || options.chunkSize < 1) {
                throw normalizeError(
                    new Error("chunkSize must be a positive integer."),
                    "FileAppendValidator",
                );
            }
        }
    }
}
