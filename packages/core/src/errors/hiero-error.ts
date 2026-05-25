/**
 * Custom error class for Hiero operations.
 * Wraps SDK and network errors with additional context.
 */
export class HieroError extends Error {
    /** Machine-readable error code */
    public readonly code: string;
    /** Additional context about what operation was being performed */
    public readonly context?: string;
    /** The original error that caused this error */
    public override readonly cause?: Error;
    /** Transaction ID if available (from ReceiptStatusError) */
    public readonly transactionId?: string;

    constructor(
        message: string,
        options: {
            code?: string;
            context?: string;
            cause?: Error;
            transactionId?: string;
        } = {},
    ) {
        super(message);
        this.name = "HieroError";
        this.code = options.code ?? "UNKNOWN";
        this.context = options.context;
        this.cause = options.cause;
        this.transactionId = options.transactionId;
    }
}

/**
 * Normalize any error into a HieroError.
 * If the error is already a HieroError, it is returned as-is.
 * Otherwise, it is wrapped in a new HieroError.
 *
 * Specifically handles ReceiptStatusError from the SDK, preserving
 * the transaction ID and status code.
 *
 * @param error - The error to normalize
 * @param context - Optional context string describing the operation
 * @returns A HieroError
 */
export function normalizeError(error: unknown, context?: string): HieroError {
    if (error instanceof HieroError) {
        return error;
    }

    if (error instanceof Error) {
        // Detect ReceiptStatusError (has .status and .transactionId)
        const receiptError = error as {
            status?: { toString(): string };
            transactionId?: { toString(): string };
        };

        if (receiptError.status && receiptError.transactionId) {
            return new HieroError(error.message, {
                code: receiptError.status.toString(),
                context,
                cause: error,
                transactionId: receiptError.transactionId.toString(),
            });
        }

        // Generic SDK error with a status field
        const sdkError = error as { status?: { toString(): string } };
        const code = sdkError.status?.toString() ?? "SDK_ERROR";

        return new HieroError(error.message, {
            code,
            context,
            cause: error,
        });
    }

    return new HieroError(String(error), {
        code: "UNKNOWN",
        context,
    });
}
