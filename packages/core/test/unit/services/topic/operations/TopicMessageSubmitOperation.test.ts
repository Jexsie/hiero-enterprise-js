import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicMessageSubmitTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setTopicId",
        "setMessage",
        "setMaxChunks",
        "setChunkSize",
        "setCustomFeeLimits",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TopicMessageSubmitTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TopicMessageSubmitOperation (via TopicService)", () => {
    let context: IHieroContext;
    let service: TopicService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TopicService(context);
    });

    describe("submitMessage", () => {
        it("submits a string message and returns the receipt fields", async () => {
            const result = await service.submitMessage({
                topicId: "0.0.12345",
                message: "hello world",
            });

            expect(result.sequenceNumber.toString()).toBe("1");
            expect(result.runningHash).toEqual(new Uint8Array([1, 2, 3, 4]));
            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");

            const tx = vi.mocked(TopicMessageSubmitTransaction).mock.results[0]
                .value;
            expect(tx.setTopicId).toHaveBeenCalledWith("0.0.12345");
            expect(tx.setMessage).toHaveBeenCalledWith("hello world");
            expect(tx.setMaxChunks).not.toHaveBeenCalled();
            expect(tx.setChunkSize).not.toHaveBeenCalled();
            expect(tx.setCustomFeeLimits).not.toHaveBeenCalled();
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("submits a Uint8Array message", async () => {
            const payload = new Uint8Array([10, 20, 30]);

            await service.submitMessage({
                topicId: "0.0.12345",
                message: payload,
            });

            const tx = vi.mocked(TopicMessageSubmitTransaction).mock.results[0]
                .value;
            expect(tx.setMessage).toHaveBeenCalledWith(payload);
        });

        it("forwards maxChunks when provided", async () => {
            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                maxChunks: 50,
            });

            const tx = vi.mocked(TopicMessageSubmitTransaction).mock.results[0]
                .value;
            expect(tx.setMaxChunks).toHaveBeenCalledWith(50);
        });

        it("forwards chunkSize when provided", async () => {
            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                chunkSize: 2048,
            });

            const tx = vi.mocked(TopicMessageSubmitTransaction).mock.results[0]
                .value;
            expect(tx.setChunkSize).toHaveBeenCalledWith(2048);
        });

        it("forwards customFeeLimits when provided (HIP-991)", async () => {
            const customFeeLimits: never[] = []; // shape-only; SDK validates payload contents

            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                customFeeLimits,
            });

            const tx = vi.mocked(TopicMessageSubmitTransaction).mock.results[0]
                .value;
            expect(tx.setCustomFeeLimits).toHaveBeenCalledWith(customFeeLimits);
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.submitMessage({
                topicId: "0.0.12345",
                message: "x",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(TopicMessageSubmitTransaction).mock.results[0]
                .value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const submitKey = PrivateKey.generateED25519();

            await service.submitMessage({
                topicId: "0.0.12345",
                message: "private payload",
                additionalSigners: [submitKey],
            });

            const tx = vi.mocked(TopicMessageSubmitTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(submitKey);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.submitMessage({
                    topicId: "",
                    message: "x",
                }),
            ).rejects.toThrow(/topicId cannot be empty/);

            expect(
                vi.mocked(TopicMessageSubmitTransaction),
            ).not.toHaveBeenCalled();
        });

        it("rejects an empty message before touching the SDK", async () => {
            await expect(
                service.submitMessage({
                    topicId: "0.0.12345",
                    message: "",
                }),
            ).rejects.toThrow(/message cannot be empty/);

            expect(
                vi.mocked(TopicMessageSubmitTransaction),
            ).not.toHaveBeenCalled();
        });
    });
});
