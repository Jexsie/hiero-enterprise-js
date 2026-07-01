import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileDeleteTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setFileId"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        FileDeleteTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("FileDeleteOperation (via FileService)", () => {
    let context: IHieroContext;
    let service: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new FileService(context);
    });

    describe("deleteFile", () => {
        it("submits a FileDeleteTransaction with the provided fileId", async () => {
            await service.deleteFile({ fileId: "0.0.555" });

            const tx = vi.mocked(FileDeleteTransaction).mock.results[0].value;
            expect(tx.setFileId).toHaveBeenCalledWith("0.0.555");
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.deleteFile({
                fileId: "0.0.555",
                transactionMemo: "delete memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(FileDeleteTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("delete memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const key = PrivateKey.generateED25519();

            await service.deleteFile({
                fileId: "0.0.555",
                additionalSigners: [key],
            });

            const tx = vi.mocked(FileDeleteTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(key);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.deleteFile(
                    {} as unknown as Parameters<typeof service.deleteFile>[0],
                ),
            ).rejects.toThrow(/fileId is required/);

            expect(vi.mocked(FileDeleteTransaction)).not.toHaveBeenCalled();
        });
    });
});
