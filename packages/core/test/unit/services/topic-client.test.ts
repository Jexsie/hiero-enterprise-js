import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicClient } from "../../../src/services/topic-client.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { HieroContext } from "../../../src/config/context/hiero-context.js";
import {
    TopicCreateTransaction,
    TopicUpdateTransaction,
    TopicDeleteTransaction,
    TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hiero-ledger/sdk")>();

    const mockTx = {
        setTopicMemo: vi.fn().mockReturnThis(),
        setSubmitKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setTopicId: vi.fn().mockReturnThis(),
        setMessage: vi.fn().mockReturnThis(),
        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: { toString: () => "0.0.123@1234567890" },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    topicId: { toString: () => "0.0.888" },
                    topicSequenceNumber: { toNumber: () => 1 },
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                topicId: { toString: () => "0.0.888" },
                topicSequenceNumber: { toNumber: () => 1 },
            }),
        }),
    };

    return {
        ...actual,
        TopicCreateTransaction: vi.fn(() => ({ ...mockTx })),
        TopicUpdateTransaction: vi.fn(() => ({ ...mockTx })),
        TopicDeleteTransaction: vi.fn(() => ({ ...mockTx })),
        TopicMessageSubmitTransaction: vi.fn(() => ({ ...mockTx })),
    };
});

describe("TopicClient", () => {
    let context: HieroContext;
    let client: TopicClient;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        client = new TopicClient(context);
    });

    describe("createTopic", () => {
        it("creates a public topic", async () => {
            const topicId = await client.createTopic();

            expect(topicId).toBe("0.0.888");

            const txMock = vi.mocked(TopicCreateTransaction).mock.results[0]
                .value;
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });

        it("creates a public topic with memo", async () => {
            await client.createTopic({ memo: "test topic" });

            const txMock = vi.mocked(TopicCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setTopicMemo).toHaveBeenCalledWith("test topic");
        });
    });

    describe("createPrivateTopic", () => {
        it("creates a private topic with submit key", async () => {
            const submitKey = context.getOperatorKey();
            const topicId = await client.createPrivateTopic({ submitKey });

            expect(topicId).toBe("0.0.888");

            const txMock = vi.mocked(TopicCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setSubmitKey).toHaveBeenCalled();
        });
    });

    describe("deleteTopic", () => {
        it("deletes a topic", async () => {
            await client.deleteTopic("0.0.888");

            const txMock = vi.mocked(TopicDeleteTransaction).mock.results[0]
                .value;
            expect(txMock.setTopicId).toHaveBeenCalledWith("0.0.888");
        });
    });

    describe("submitMessage", () => {
        it("submits a message", async () => {
            await client.submitMessage("0.0.888", "hello");

            const txMock = vi.mocked(TopicMessageSubmitTransaction).mock
                .results[0].value;
            expect(txMock.setTopicId).toHaveBeenCalledWith("0.0.888");
            expect(txMock.setMessage).toHaveBeenCalledWith("hello");
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
        });

        it("submits a message with submit key signing", async () => {
            const submitKey = context.getOperatorKey();
            await client.submitMessage("0.0.888", "hello", submitKey);

            const txMock = vi.mocked(TopicMessageSubmitTransaction).mock
                .results[0].value;
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });
});
