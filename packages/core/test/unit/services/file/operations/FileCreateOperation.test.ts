import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    FileCreateTransaction,
    FileAppendTransaction,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import {
    HieroError,
    HieroErrorCodes,
} from "../../../../../src/errors/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return {
        create: buildMockTxBundle([
            "setContents",
            "setKeys",
            "setFileMemo",
            "setExpirationTime",
        ]),
        append: buildMockTxBundle([
            "setFileId",
            "setContents",
            "setMaxChunks",
            "setChunkSize",
            "setChunkInterval",
        ]),
    };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        FileCreateTransaction: vi.fn(function () {
            return mocks.create.tx;
        }),
        FileAppendTransaction: vi.fn(function () {
            return mocks.append.tx;
        }),
    };
});

describe("FileCreateOperation (via FileService)", () => {
    let context: IHieroContext;
    let service: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks.create);
        reattachMockChain(mocks.append);
        context = createMockContext();
        service = new FileService(context);
    });

    describe("createFile", () => {
        it("submits a FileCreateTransaction with the operator's key by default", async () => {
            const result = await service.createFile({ contents: "hello" });

            expect(result).toBe("0.0.555");

            const tx = vi.mocked(FileCreateTransaction).mock.results[0].value;
            expect(tx.setContents).toHaveBeenCalledWith("hello");
            expect(tx.setKeys).toHaveBeenCalledWith([
                context.operatorPublicKey,
            ]);
            expect(tx.setFileMemo).not.toHaveBeenCalled();
            expect(tx.setExpirationTime).not.toHaveBeenCalled();
            expect(tx.execute).toHaveBeenCalledWith(context.client);
            // No append when contents fit in a single transaction.
            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });

        it("forwards fileMemo + expirationTime + explicit keys", async () => {
            const key = PrivateKey.generateED25519().publicKey;
            const expirationTime = new Date("2099-01-01T00:00:00Z");

            await service.createFile({
                contents: new Uint8Array([1, 2, 3]),
                keys: [key],
                fileMemo: "greeting",
                expirationTime,
            });

            const tx = vi.mocked(FileCreateTransaction).mock.results[0].value;
            expect(tx.setContents).toHaveBeenCalledWith(
                new Uint8Array([1, 2, 3]),
            );
            expect(tx.setKeys).toHaveBeenCalledWith([key]);
            expect(tx.setFileMemo).toHaveBeenCalledWith("greeting");
            expect(tx.setExpirationTime).toHaveBeenCalledWith(expirationTime);
        });

        it("passes an empty keys array through unchanged (unmodifiable file)", async () => {
            await service.createFile({ contents: "immutable", keys: [] });

            const tx = vi.mocked(FileCreateTransaction).mock.results[0].value;
            expect(tx.setKeys).toHaveBeenCalledWith([]);
        });

        it("applies base TransactionOptions to the create transaction", async () => {
            await service.createFile({
                contents: "x",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(FileCreateTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const signer = PrivateKey.generateED25519();

            await service.createFile({
                contents: "x",
                additionalSigners: [signer],
            });

            const tx = vi.mocked(FileCreateTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(signer);
        });

        it("chains a FileAppendTransaction when contents exceed the per-tx limit", async () => {
            // 4096 (single-tx limit) + 500 spillover.
            const large = Buffer.alloc(4596, 0x61);

            const result = await service.createFile({ contents: large });

            expect(result).toBe("0.0.555");

            const createTx = vi.mocked(FileCreateTransaction).mock.results[0]
                .value;
            const appendTx = vi.mocked(FileAppendTransaction).mock.results[0]
                .value;

            // Leading 4096 bytes went into the create.
            const createArg = vi.mocked(createTx.setContents).mock
                .calls[0][0] as Uint8Array;
            expect(createArg.byteLength).toBe(4096);

            // Remainder went into the append, keyed by the new fileId.
            expect(appendTx.setFileId).toHaveBeenCalledWith("0.0.555");
            const appendArg = vi.mocked(appendTx.setContents).mock
                .calls[0][0] as Uint8Array;
            expect(appendArg.byteLength).toBe(500);
            expect(appendTx.execute).toHaveBeenCalledWith(context.client);
        });

        it("splits a string payload at 4096 UTF-8 bytes for the follow-up append", async () => {
            const large = "x".repeat(4200); // 4200 single-byte chars > 4096

            await service.createFile({ contents: large });

            const createTx = vi.mocked(FileCreateTransaction).mock.results[0]
                .value;
            const appendTx = vi.mocked(FileAppendTransaction).mock.results[0]
                .value;

            const createArg = vi.mocked(createTx.setContents).mock
                .calls[0][0] as Uint8Array;
            expect(createArg.byteLength).toBe(4096);

            const appendArg = vi.mocked(appendTx.setContents).mock
                .calls[0][0] as Uint8Array;
            expect(appendArg.byteLength).toBe(4200 - 4096);
        });

        it("propagates validator errors before touching the SDK", async () => {
            // Every field is optional today, but we still exercise the
            // validator hookup: rotating the validator to a reject-all
            // stub should surface as a rejection with no SDK contact.
            const rejectAll = vi
                .spyOn(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (service as any).createOperation.validator,
                    "validate",
                )
                .mockImplementationOnce(() => {
                    throw new Error("stub validation error");
                });

            await expect(service.createFile({ contents: "x" })).rejects.toThrow(
                /stub validation error/,
            );

            expect(rejectAll).toHaveBeenCalled();
            expect(vi.mocked(FileCreateTransaction)).not.toHaveBeenCalled();
            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });

        it("creates an empty file when contents is omitted (SDK parity)", async () => {
            const result = await service.createFile();

            expect(result).toBe("0.0.555");

            const tx = vi.mocked(FileCreateTransaction).mock.results[0].value;
            // No contents → setContents is never called (matches the SDK's
            // own constructor pattern for empty files).
            expect(tx.setContents).not.toHaveBeenCalled();
            // Facade still defaults keys so the file is modifiable.
            expect(tx.setKeys).toHaveBeenCalledWith([
                context.operatorPublicKey,
            ]);
            expect(tx.execute).toHaveBeenCalledWith(context.client);
            // No append — nothing to chunk.
            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });

        it("creates an empty operator-modifiable file when called with no arguments", async () => {
            // DX shortcut: `createFile()` with no options behaves like
            const result = await service.createFile();

            expect(result).toBe("0.0.555");

            const tx = vi.mocked(FileCreateTransaction).mock.results[0].value;
            expect(tx.setContents).not.toHaveBeenCalled();
            expect(tx.setKeys).toHaveBeenCalledWith([
                context.operatorPublicKey,
            ]);
            expect(tx.execute).toHaveBeenCalledWith(context.client);
            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });

        it("surfaces the created fileId when the follow-up append fails", async () => {
            // FileCreate succeeded on-chain, but the FileAppend for the
            // tail chunk fails. The caller needs the fileId to retry the
            // append or delete the partial file — it must be attached to
            // the thrown HieroError.
            const appendFailure = new Error("append boom");
            mocks.append.tx.execute.mockRejectedValueOnce(appendFailure);

            const large = Buffer.alloc(4200, 0x61); // > 4096 → triggers append

            const promise = service.createFile({ contents: large });

            await expect(promise).rejects.toThrow(HieroError);
            await expect(promise).rejects.toMatchObject({
                code: HieroErrorCodes.SdkError,
                context: "FileService.createFile",
                fileId: "0.0.555",
                message: expect.stringMatching(
                    /File 0\.0\.555 was created, but appending the remainder/,
                ),
            });
            // The underlying append failure is preserved as `cause` for
            // debugging (TransactionExecutor normalises it first).
            await expect(promise).rejects.toHaveProperty(
                "cause",
                expect.any(Error),
            );

            // FileCreate did run to completion.
            expect(vi.mocked(FileCreateTransaction)).toHaveBeenCalledTimes(1);
            expect(mocks.create.tx.execute).toHaveBeenCalled();
            // FileAppend was attempted (and rejected).
            expect(vi.mocked(FileAppendTransaction)).toHaveBeenCalledTimes(1);
        });
    });
});
