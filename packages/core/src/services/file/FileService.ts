import type { FileId, Key } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import type { ScheduleOptions, ScheduledResult } from "../transaction/index.js";
import {
    FileCreateOperation,
    FileAppendOperation,
    FileUpdateOperation,
    FileDeleteOperation,
} from "./operations/index.js";
import type {
    FileCreateOperationOptions,
    FileAppendOperationOptions,
    FileUpdateOperationOptions,
    FileDeleteOperationOptions,
} from "./operations/index.js";
import { FileInfoQuery, FileContentsQuery } from "./queries/index.js";
import type { FileInfoResult } from "./queries/index.js";

/**
 * Per-transaction network limit for `FileCreate` / `FileUpdate` payloads.
 * Anything larger gets split into a leading create/update carrying this
 * many bytes, followed by a `FileAppendTransaction` for the remainder
 * (which the SDK further sub-chunks internally).
 */
const MAX_FILE_TX_BYTES = 4096;

/**
 * Options for creating a file via `FileCreateTransaction`.
 *
 * If `contents` is larger than the per-transaction network limit
 * (~4 KiB), the leading portion is submitted via `FileCreateTransaction`
 * and the remainder appended via `FileAppendTransaction`.
 *
 * If `keys` is omitted, the operator's public key is used — matches the
 * default a simple "upload a file I can later modify" caller expects.
 * Pass an empty array (`keys: []`) for an unmodifiable file.
 */
export type CreateFileOptions = FileCreateOperationOptions;

/**
 * Options for appending content to an existing file via
 * `FileAppendTransaction`. The SDK auto-chunks the payload against
 * `chunkSize` and `maxChunks`.
 */
export type AppendToFileOptions = FileAppendOperationOptions;

/**
 * Options for updating a file via `FileUpdateTransaction`.
 *
 * If `contents` is larger than the per-transaction network limit
 * (~4 KiB), the leading portion is submitted via `FileUpdateTransaction`
 * and the remainder appended via `FileAppendTransaction`.
 */
export type UpdateFileOptions = FileUpdateOperationOptions;

/** Options for deleting a file via `FileDeleteTransaction`. */
export type DeleteFileOptions = FileDeleteOperationOptions;

/** Plain-object result returned by `getFileInfo`. */
export type GetFileInfoResult = FileInfoResult;

/**
 * Service for managing files on the Hiero File Service (HFS).
 *
 * Wraps the underlying `FileCreate*` / `FileAppend*` / `FileUpdate*` /
 * `FileDelete*` SDK surface with validated, observability-aware
 * operations. Listeners registered on the surrounding `HieroContext`
 * see `before` / `after` events for every file transaction submitted
 * here.
 *
 * Operations are organised internally into per-transaction classes
 * under `services/file/operations/`; validators live alongside in
 * `services/file/validation/`. This facade routes typed option objects
 * to the right operation class so callers never have to think about
 * the SDK transaction class hierarchy — or the ~4 KiB per-transaction
 * chunking boundary.
 */
export class FileService {
    private readonly createOperation: FileCreateOperation;
    private readonly appendOperation: FileAppendOperation;
    private readonly updateOperation: FileUpdateOperation;
    private readonly deleteOperation: FileDeleteOperation;
    private readonly infoQuery: FileInfoQuery;
    private readonly contentsQuery: FileContentsQuery;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new FileCreateOperation(context);
        this.appendOperation = new FileAppendOperation(context);
        this.updateOperation = new FileUpdateOperation(context);
        this.deleteOperation = new FileDeleteOperation(context);
        this.infoQuery = new FileInfoQuery(context);
        this.contentsQuery = new FileContentsQuery(context);
    }

    /**
     * Create a file with the given contents.
     *
     * If `contents` exceeds the per-transaction network limit
     * (~4 KiB) the facade automatically splits the payload: the
     * leading chunk is submitted via `FileCreateTransaction`, and the
     * remainder is appended via a single `FileAppendTransaction`
     * (which the SDK further sub-chunks internally).
     *
     * If `keys` is omitted the file is created with `[operatorPublicKey]`
     * so the operator can later update or delete it. Pass `keys: []`
     * for an unmodifiable file.
     *
     * @returns The new file's entity ID (e.g., `"0.0.12345"`).
     *
     * @example
     * ```typescript
     * const fileId = await fileService.createFile({
     *     contents: Buffer.from("hello", "utf8"),
     *     fileMemo: "greeting",
     * });
     * ```
     */
    async createFile(options: CreateFileOptions): Promise<string> {
        const [head, tail] = splitContents(options.contents);
        const keys = options.keys ?? [this.context.operatorPublicKey as Key];

        const fileId = await this.createOperation.execute({
            ...options,
            contents: head,
            keys,
        });

        if (tail !== null) {
            await this.appendOperation.execute({
                fileId,
                contents: tail,
                additionalSigners: options.additionalSigners,
                externalSigners: options.externalSigners,
                legacySignatures: options.legacySignatures,
                maxTransactionFee: options.maxTransactionFee,
                transactionValidDuration: options.transactionValidDuration,
                nodeAccountIds: options.nodeAccountIds,
                regenerateTransactionId: options.regenerateTransactionId,
                highVolume: options.highVolume,
            });
        }

        return fileId;
    }

    /**
     * Schedule a file creation for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign via
     * `ScheduleService` before the file creation executes automatically.
     *
     * Note: only the leading `FileCreate` chunk is scheduled. Large
     * payloads that require follow-up `FileAppend` cannot be atomically
     * scheduled today — the facade rejects `contents` exceeding the
     * per-transaction limit for this method.
     */
    async scheduleCreateFile(
        options: CreateFileOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        const [, tail] = splitContents(options.contents);
        if (tail !== null) {
            throw new Error(
                "scheduleCreateFile does not support contents larger than the per-transaction network limit " +
                    `(~${MAX_FILE_TX_BYTES} bytes). Create the file directly and schedule follow-up updates instead.`,
            );
        }

        const keys = options.keys ?? [this.context.operatorPublicKey as Key];
        return await this.createOperation.schedule(
            { ...options, keys },
            scheduleOptions,
        );
    }

    /**
     * Append content to an existing file. The SDK auto-chunks the
     * payload — no size cap beyond what `maxChunks * chunkSize` allows.
     */
    async appendToFile(options: AppendToFileOptions): Promise<void> {
        return await this.appendOperation.execute(options);
    }

    /**
     * Update file properties. Any subset of `contents`, `keys`,
     * `fileMemo`, or `expirationTime` may be supplied — see
     * `UpdateFileOptions` for the three-state (undefined / null / value)
     * convention.
     *
     * When `contents` exceeds the per-transaction network limit
     * (~4 KiB), the leading chunk goes into the `FileUpdate` and the
     * remainder into a single follow-up `FileAppendTransaction`.
     */
    async updateFile(options: UpdateFileOptions): Promise<void> {
        if (options.contents === undefined) {
            return await this.updateOperation.execute(options);
        }

        const [head, tail] = splitContents(options.contents);

        await this.updateOperation.execute({ ...options, contents: head });

        if (tail !== null) {
            await this.appendOperation.execute({
                fileId: options.fileId,
                contents: tail,
                additionalSigners: options.additionalSigners,
                externalSigners: options.externalSigners,
                legacySignatures: options.legacySignatures,
                maxTransactionFee: options.maxTransactionFee,
                transactionValidDuration: options.transactionValidDuration,
                nodeAccountIds: options.nodeAccountIds,
                regenerateTransactionId: options.regenerateTransactionId,
                highVolume: options.highVolume,
            });
        }
    }

    /** Schedule a `FileUpdateTransaction` for deferred multi-sig execution. */
    async scheduleUpdateFile(
        options: UpdateFileOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        if (options.contents !== undefined) {
            const [, tail] = splitContents(options.contents);
            if (tail !== null) {
                throw new Error(
                    "scheduleUpdateFile does not support contents larger than the per-transaction network limit " +
                        `(~${MAX_FILE_TX_BYTES} bytes). Update the file directly and schedule follow-up updates instead.`,
                );
            }
        }

        return await this.updateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Delete a file. Contents are zeroed and the entity is marked
     * `isDeleted: true` for the remainder of its expiration window.
     */
    async deleteFile(options: DeleteFileOptions): Promise<void> {
        return await this.deleteOperation.execute(options);
    }

    /** Schedule a `FileDeleteTransaction` for deferred multi-sig execution. */
    async scheduleDeleteFile(
        options: DeleteFileOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.deleteOperation.schedule(options, scheduleOptions);
    }

    /**
     * Fetch the current contents of a file from the consensus nodes.
     * Returns a zero-length payload for deleted files.
     */
    async getFileContents(fileId: string | FileId): Promise<Uint8Array> {
        return await this.contentsQuery.execute(fileId);
    }

    /**
     * Fetch a file's metadata (size, expiration, keys, `isDeleted`,
     * memo, ledger) as a plain object decoupled from SDK primitives.
     */
    async getFileInfo(fileId: string | FileId): Promise<GetFileInfoResult> {
        return await this.infoQuery.execute(fileId);
    }
}

/**
 * Split `contents` into the leading chunk that fits inside a single
 * `FileCreate` / `FileUpdate` transaction and the remainder that should
 * be appended.
 *
 * Returns `[head, null]` when the payload already fits and no append is
 * needed. The split is byte-accurate for `Uint8Array` inputs and
 * UTF-8-byte-accurate for `string` inputs (the network's limit is on
 * the serialized byte length, not the string's `.length`).
 */
function splitContents(
    contents: Uint8Array | string,
): [Uint8Array | string, Uint8Array | string | null] {
    if (typeof contents === "string") {
        const encoded = Buffer.from(contents, "utf8");
        if (encoded.byteLength <= MAX_FILE_TX_BYTES) {
            return [contents, null];
        }
        return [
            encoded.subarray(0, MAX_FILE_TX_BYTES),
            encoded.subarray(MAX_FILE_TX_BYTES),
        ];
    }

    if (contents.byteLength <= MAX_FILE_TX_BYTES) {
        return [contents, null];
    }
    return [
        contents.subarray(0, MAX_FILE_TX_BYTES),
        contents.subarray(MAX_FILE_TX_BYTES),
    ];
}
