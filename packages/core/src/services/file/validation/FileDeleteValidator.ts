import { normalizeError } from "../../../errors/index.js";
import type { FileDeleteOperationOptions } from "../operations/index.js";

/**
 * Validates `FileDeleteOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class FileDeleteValidator {
    /**
     * @throws {HieroError} If validation fails
     */
    validate(options: FileDeleteOperationOptions): void {
        this.validateFileId(options);
    }

    private validateFileId(options: FileDeleteOperationOptions): void {
        if (options.fileId == null) {
            throw normalizeError(
                new Error("fileId is required."),
                "FileDeleteValidator",
            );
        }

        if (
            typeof options.fileId === "string" &&
            options.fileId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("fileId cannot be empty."),
                "FileDeleteValidator",
            );
        }
    }
}
