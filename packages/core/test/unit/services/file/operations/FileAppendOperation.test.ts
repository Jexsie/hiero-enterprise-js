import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileAppendTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setFileId",
        "setContents",
        "setMaxChunks",
        "setChunkSize",
        "setChunkInterval",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        FileAppendTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("FileAppendOperation (via FileService)", () => {
    let context: IHieroContext;
    let service: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new FileService(context);
    });

    describe("appendToFile", () => {
        it("submits a FileAppendTransaction with fileId + contents", async () => {
            await service.appendToFile({
                fileId: "0.0.555",
                contents: "chunk one",
            });

            const tx = vi.mocked(FileAppendTransaction).mock.results[0].value;
            expect(tx.setFileId).toHaveBeenCalledWith("0.0.555");
            expect(tx.setContents).toHaveBeenCalledWith("chunk one");
            expect(tx.setMaxChunks).not.toHaveBeenCalled();
            expect(tx.setChunkSize).not.toHaveBeenCalled();
            expect(tx.setChunkInterval).not.toHaveBeenCalled();
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("forwards optional chunk-tuning fields", async () => {
            await service.appendToFile({
                fileId: "0.0.555",
                contents: new Uint8Array([1, 2, 3]),
                maxChunks: 30,
                chunkSize: 2048,
                chunkInterval: 25,
            });

            const tx = vi.mocked(FileAppendTransaction).mock.results[0].value;
            expect(tx.setMaxChunks).toHaveBeenCalledWith(30);
            expect(tx.setChunkSize).toHaveBeenCalledWith(2048);
            expect(tx.setChunkInterval).toHaveBeenCalledWith(25);
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.appendToFile({
                fileId: "0.0.555",
                contents: "x",
                transactionMemo: "append memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(FileAppendTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("append memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const key = PrivateKey.generateED25519();

            await service.appendToFile({
                fileId: "0.0.555",
                contents: "x",
                additionalSigners: [key],
            });

            const tx = vi.mocked(FileAppendTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(key);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.appendToFile({
                    fileId: "",
                    contents: "x",
                }),
            ).rejects.toThrow(/fileId cannot be empty/);

            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });

        it("rejects a zero/negative maxChunks before touching the SDK", async () => {
            await expect(
                service.appendToFile({
                    fileId: "0.0.555",
                    contents: "x",
                    maxChunks: 0,
                }),
            ).rejects.toThrow(/maxChunks must be a positive integer/);

            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });
    });
});
