import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicUpdateTransaction, PrivateKey, KeyList } from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setTopicId",
        "setTopicMemo",
        "clearTopicMemo",
        "setAdminKey",
        "clearAdminKey",
        "setSubmitKey",
        "clearSubmitKey",
        "setFeeScheduleKey",
        "clearFeeScheduleKey",
        "setFeeExemptKeys",
        "clearFeeExemptKeys",
        "setAutoRenewAccountId",
        "clearAutoRenewAccountId",
        "setAutoRenewPeriod",
        "setCustomFees",
        "clearCustomFees",
        "setExpirationTime",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TopicUpdateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TopicUpdateOperation (via TopicService)", () => {
    let context: IHieroContext;
    let service: TopicService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TopicService(context);
    });

    describe("updateTopic", () => {
        it("submits a TopicUpdateTransaction with only the topic ID when no other fields are set", async () => {
            const result = await service.updateTopic({ topicId: "0.0.12345" });

            expect(result).toBeUndefined();

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setTopicId).toHaveBeenCalledWith("0.0.12345");
            expect(tx.execute).toHaveBeenCalledWith(context.client);

            // No optional setters touched.
            expect(tx.setTopicMemo).not.toHaveBeenCalled();
            expect(tx.clearTopicMemo).not.toHaveBeenCalled();
            expect(tx.setAdminKey).not.toHaveBeenCalled();
            expect(tx.clearAdminKey).not.toHaveBeenCalled();
            expect(tx.setSubmitKey).not.toHaveBeenCalled();
            expect(tx.clearSubmitKey).not.toHaveBeenCalled();
            expect(tx.setFeeScheduleKey).not.toHaveBeenCalled();
            expect(tx.clearFeeScheduleKey).not.toHaveBeenCalled();
            expect(tx.setFeeExemptKeys).not.toHaveBeenCalled();
            expect(tx.clearFeeExemptKeys).not.toHaveBeenCalled();
            expect(tx.setAutoRenewAccountId).not.toHaveBeenCalled();
            expect(tx.clearAutoRenewAccountId).not.toHaveBeenCalled();
            expect(tx.setAutoRenewPeriod).not.toHaveBeenCalled();
            expect(tx.setCustomFees).not.toHaveBeenCalled();
            expect(tx.clearCustomFees).not.toHaveBeenCalled();
            expect(tx.setExpirationTime).not.toHaveBeenCalled();
        });

        it("forwards every optional setter when fields are provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const submitKey = PrivateKey.generateED25519().publicKey;
            const feeScheduleKey = PrivateKey.generateED25519().publicKey;
            const exemptKey = PrivateKey.generateED25519().publicKey;
            const customFees: never[] = [];
            const expirationTime = new Date(Date.now() + 7 * 86400 * 1000);

            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: "renamed",
                adminKey,
                submitKey,
                feeScheduleKey,
                feeExemptKeys: [exemptKey],
                autoRenewAccountId: "0.0.99",
                autoRenewPeriod: 7_776_000,
                customFees,
                expirationTime,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setTopicMemo).toHaveBeenCalledWith("renamed");
            expect(tx.setAdminKey).toHaveBeenCalledWith(adminKey);
            expect(tx.setSubmitKey).toHaveBeenCalledWith(submitKey);
            expect(tx.setFeeScheduleKey).toHaveBeenCalledWith(feeScheduleKey);
            expect(tx.setFeeExemptKeys).toHaveBeenCalledWith([exemptKey]);
            expect(tx.setAutoRenewAccountId).toHaveBeenCalledWith("0.0.99");
            expect(tx.setAutoRenewPeriod).toHaveBeenCalledWith(7_776_000);
            expect(tx.setCustomFees).toHaveBeenCalledWith(customFees);
            expect(tx.setExpirationTime).toHaveBeenCalledWith(expirationTime);
        });

        it("writes the empty-string memo sentinel when topicMemo is null", async () => {
            // The JS SDK's `clearTopicMemo()` is buggy (no-op on the
            // network), so the operation routes `null` through
            // `setTopicMemo("")` — the canonical Hedera clear sentinel.
            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: null,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setTopicMemo).toHaveBeenCalledWith("");
            expect(tx.clearTopicMemo).not.toHaveBeenCalled();
        });

        it("writes an empty KeyList when adminKey is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                adminKey: null,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setAdminKey).toHaveBeenCalledTimes(1);
            const arg = vi.mocked(tx.setAdminKey).mock.calls[0][0];
            expect(arg).toBeInstanceOf(KeyList);
            expect((arg as KeyList).toArray()).toHaveLength(0);
            expect(tx.clearAdminKey).not.toHaveBeenCalled();
        });

        it("writes an empty KeyList when submitKey is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                submitKey: null,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setSubmitKey).toHaveBeenCalledTimes(1);
            const arg = vi.mocked(tx.setSubmitKey).mock.calls[0][0];
            expect(arg).toBeInstanceOf(KeyList);
            expect((arg as KeyList).toArray()).toHaveLength(0);
            expect(tx.clearSubmitKey).not.toHaveBeenCalled();
        });

        it("writes an empty KeyList when feeScheduleKey is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                feeScheduleKey: null,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setFeeScheduleKey).toHaveBeenCalledTimes(1);
            const arg = vi.mocked(tx.setFeeScheduleKey).mock.calls[0][0];
            expect(arg).toBeInstanceOf(KeyList);
            expect((arg as KeyList).toArray()).toHaveLength(0);
            expect(tx.clearFeeScheduleKey).not.toHaveBeenCalled();
        });

        it("invokes clearFeeExemptKeys when feeExemptKeys is null", async () => {
            // `clearFeeExemptKeys()` correctly emits the empty-list
            // sentinel — no need to route around it.
            await service.updateTopic({
                topicId: "0.0.12345",
                feeExemptKeys: null,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.clearFeeExemptKeys).toHaveBeenCalled();
            expect(tx.setFeeExemptKeys).not.toHaveBeenCalled();
        });

        it("writes the 0.0.0 sentinel when autoRenewAccountId is null", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                autoRenewAccountId: null,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setAutoRenewAccountId).toHaveBeenCalledWith("0.0.0");
            expect(tx.clearAutoRenewAccountId).not.toHaveBeenCalled();
        });

        it("invokes clearCustomFees when customFees is null", async () => {
            // `clearCustomFees()` correctly emits the empty-list
            // sentinel — no need to route around it.
            await service.updateTopic({
                topicId: "0.0.12345",
                customFees: null,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.clearCustomFees).toHaveBeenCalled();
            expect(tx.setCustomFees).not.toHaveBeenCalled();
        });

        it("forwards an empty-string memo verbatim (same network effect as null)", async () => {
            // `""` and `null` both reach the network as the clear
            // sentinel; callers may use either.
            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: "",
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setTopicMemo).toHaveBeenCalledWith("");
            expect(tx.clearTopicMemo).not.toHaveBeenCalled();
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.updateTopic({
                topicId: "0.0.12345",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const adminKey = PrivateKey.generateED25519();

            await service.updateTopic({
                topicId: "0.0.12345",
                topicMemo: "renamed",
                additionalSigners: [adminKey],
            });

            const tx = vi.mocked(TopicUpdateTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(adminKey);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.updateTopic(
                    {} as unknown as Parameters<typeof service.updateTopic>[0],
                ),
            ).rejects.toThrow(/topicId is required/);

            expect(vi.mocked(TopicUpdateTransaction)).not.toHaveBeenCalled();
        });
    });
});
