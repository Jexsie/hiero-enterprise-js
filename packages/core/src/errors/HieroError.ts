/**
 * Custom error class for Hiero operations.
 * Wraps SDK and network errors with additional context.
 */
export const HieroErrorCodes = {
    ConfigInvalid: "CONFIG_INVALID",
    MirrorNodeError: "MIRROR_NODE_ERROR",
    MirrorNodeHttpError: "MIRROR_NODE_HTTP_ERROR",
    MirrorNodeSchemaMismatch: "MIRROR_NODE_SCHEMA_MISMATCH",
    NotFound: "NOT_FOUND",
    TimedOut: "TIMED_OUT",
    SdkError: "SDK_ERROR",
    Unknown: "UNKNOWN",
} as const;

export type HieroErrorCode =
    (typeof HieroErrorCodes)[keyof typeof HieroErrorCodes];

export class HieroError extends Error {
    /** Machine-readable error code */
    public readonly code: HieroErrorCode;
    /** SDK-specific status string when the failure originated from the SDK/network */
    public readonly sdkStatus?: string;
    /** Additional context about what operation was being performed */
    public readonly context?: string;
    /** The original error that caused this error */
    public override readonly cause?: Error;
    /** Transaction ID if available (from ReceiptStatusError) */
    public readonly transactionId?: string;
    /** File entity ID when the failure occurred mid-way through a multi-step file operation */
    public readonly fileId?: string;

    constructor(
        message: string,
        options: {
            code?: HieroErrorCode;
            sdkStatus?: string;
            context?: string;
            cause?: Error;
            transactionId?: string;
            fileId?: string;
        } = {},
    ) {
        super(message);
        this.name = "HieroError";
        this.code = options.code ?? HieroErrorCodes.Unknown;
        this.sdkStatus = options.sdkStatus;
        this.context = options.context;
        this.cause = options.cause;
        this.transactionId = options.transactionId;
        this.fileId = options.fileId;
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
                code: HieroErrorCodes.SdkError,
                sdkStatus: receiptError.status.toString(),
                context,
                cause: error,
                transactionId: receiptError.transactionId.toString(),
            });
        }

        // Generic SDK error with a status field
        const sdkError = error as { status?: { toString(): string } };

        return new HieroError(error.message, {
            code: HieroErrorCodes.SdkError,
            sdkStatus: sdkError.status?.toString(),
            context,
            cause: error,
        });
    }

    return new HieroError(String(error), {
        code: HieroErrorCodes.Unknown,
        context,
    });
}
