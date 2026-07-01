import type { FileId } from "@hiero-ledger/sdk";
import { FileDeleteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { FileDeleteValidator } from "../validation/index.js";

/**
 * Low-level options for the `FileDelete` SDK transaction.
 *
 * Mirrors the surface of `FileDeleteTransaction` 1:1. Deletion clears
 * the file contents to zero bytes and marks the entity as deleted;
 * subsequent `FileContentsQuery` calls return an empty payload and
 * `FileInfoQuery` reports `isDeleted: true`.
 *
 * Signing: every key in the file's `keys` MUST sign — pass them via
 * `additionalSigners`. A file created with an empty `keys` list is
 * only deletable via network expiration.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface FileDeleteOperationOptions extends TransactionOptions {
    fileId: string | FileId;
}

export class FileDeleteOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: FileDeleteValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new FileDeleteValidator();
    }

    /** Submit a `FileDeleteTransaction`. */
    async execute(options: FileDeleteOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        await this.executor.run(
            tx,
            options,
            {
                type: "FileDelete",
                serviceName: "FileService",
                methodName: "deleteFile",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private build(options: FileDeleteOperationOptions): FileDeleteTransaction {
        return new FileDeleteTransaction().setFileId(options.fileId);
    }
}
