import type { Key, KeyList, Timestamp } from "@hiero-ledger/sdk";
import { FileCreateTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { FileCreateValidator } from "../validation/index.js";

/**
 * Low-level options for the `FileCreate` SDK transaction.
 *
 * Mirrors the surface of `FileCreateTransaction`. Callers usually go
 * through `FileService.createFile`, which additionally chains a
 * `FileAppendTransaction` when `contents` exceeds the per-transaction
 * network limit (~4 KiB).
 *
 * A file is an immutable-by-default binary blob stored on every
 * consensus node. Common uses:
 *
 *  - Uploading contract bytecode before `ContractCreate` (large or
 *    small — the `ContractCreateFlow` helper handles this internally).
 *  - Anchoring small documents on-chain with consensus guarantees.
 *  - Multi-sig document storage (via a `KeyList` in `keys`).
 *
 * Signing:
 *  - Every key in `keys` MUST sign the `FileCreate` transaction —
 *    supply their private keys via `additionalSigners` (or
 *    `externalSigners`), otherwise the network rejects with
 *    `INVALID_SIGNATURE`. When `keys` is omitted the facade defaults
 *    to `[operatorPublicKey]`, which the operator client signs
 *    automatically.
 *  - The same keys MUST also sign any later *modify* or *delete* —
 *    supply them via `additionalSigners` on those calls.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface FileCreateOperationOptions extends TransactionOptions {
    /**
     * Initial file contents. Optional — omitting it creates an empty
     *
     * Sized against the single-transaction limit (~4 KiB); larger
     * payloads should be created via `FileService.createFile`, which
     * chains a `FileAppendTransaction`.
     */
    contents?: Uint8Array | string;
    /**
     * Keys required to later modify or delete the file. Defaults to
     * `[operatorPublicKey]` at the facade layer so simple flows don't
     * have to think about it; pass `[]` for an unmodifiable file (only
     * deletable by network expiration).
     */
    keys?: Key[] | KeyList;
    /** Short memo attached to the file entity itself. */
    fileMemo?: string;
    /** Timestamp at which the file expires and is auto-deleted. */
    expirationTime?: Date | Timestamp;
}

export class FileCreateOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: FileCreateValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new FileCreateValidator();
    }

    /** Submit a `FileCreateTransaction` and return the new file ID. */
    async execute(options: FileCreateOperationOptions): Promise<string> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "FileCreate",
                serviceName: "FileService",
                methodName: "createFile",
                timestamp: new Date(),
            },
            (receipt) => receipt.fileId!.toString(),
        );
    }

    private build(options: FileCreateOperationOptions): FileCreateTransaction {
        const tx = new FileCreateTransaction();

        if (options.contents !== undefined) {
            tx.setContents(options.contents);
        }

        if (options.keys != null) {
            tx.setKeys(options.keys);
        }

        if (options.fileMemo != null) {
            tx.setFileMemo(options.fileMemo);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        return tx;
    }
}
