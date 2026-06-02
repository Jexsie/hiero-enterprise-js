import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicService } from "../../../src/services/topic-service.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { IHieroContext } from "../../../src/context/index.js";
import {
    TopicCreateTransaction,
    TopicDeleteTransaction,
    TopicMessageSubmitTransaction,
    PrivateKey,
} from "@hiero-ledger/sdk";

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

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
        TopicCreateTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TopicUpdateTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TopicDeleteTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TopicMessageSubmitTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
    };
});

describe("TopicService", () => {
    let context: IHieroContext;
    let client: TopicService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        client = new TopicService(context);
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
            const submitKey = PrivateKey.generateED25519();
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
            const submitKey = PrivateKey.generateED25519();
            await client.submitMessage("0.0.888", "hello", submitKey);

            const txMock = vi.mocked(TopicMessageSubmitTransaction).mock
                .results[0].value;
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });
});
