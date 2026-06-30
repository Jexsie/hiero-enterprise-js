import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicCreateTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setTopicMemo",
        "setAdminKey",
        "setSubmitKey",
        "setAutoRenewAccountId",
        "setAutoRenewPeriod",
        "setFeeScheduleKey",
        "setFeeExemptKeys",
        "setCustomFees",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TopicCreateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TopicCreateOperation (via TopicService)", () => {
    let context: IHieroContext;
    let service: TopicService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TopicService(context);
    });

    describe("createTopic", () => {
        it("creates a fully public, immutable topic with empty options", async () => {
            const result = await service.createTopic();

            expect(result).toBe("0.0.888");

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.setTopicMemo).not.toHaveBeenCalled();
            expect(tx.setAdminKey).not.toHaveBeenCalled();
            expect(tx.setSubmitKey).not.toHaveBeenCalled();
            expect(tx.setAutoRenewAccountId).not.toHaveBeenCalled();
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("forwards a topicMemo", async () => {
            await service.createTopic({ topicMemo: "audit log" });

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.setTopicMemo).toHaveBeenCalledWith("audit log");
        });

        it("forwards a submitKey for a private topic", async () => {
            const submitKey = PrivateKey.generateED25519().publicKey;

            await service.createTopic({ submitKey });

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.setSubmitKey).toHaveBeenCalledWith(submitKey);
        });

        it("forwards adminKey + autoRenewAccountId for a mutable topic", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;

            await service.createTopic({
                adminKey,
                autoRenewAccountId: "0.0.99",
                autoRenewPeriod: 7_776_000,
            });

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.setAdminKey).toHaveBeenCalledWith(adminKey);
            expect(tx.setAutoRenewAccountId).toHaveBeenCalledWith("0.0.99");
            expect(tx.setAutoRenewPeriod).toHaveBeenCalledWith(7_776_000);
        });

        it("forwards HIP-991 fee schedule, exempt keys, and custom fees", async () => {
            const feeScheduleKey = PrivateKey.generateED25519().publicKey;
            const exemptKey = PrivateKey.generateED25519().publicKey;
            const customFees: never[] = []; // shape-only; SDK validates payload contents

            await service.createTopic({
                feeScheduleKey,
                feeExemptKeys: [exemptKey],
                customFees,
            });

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.setFeeScheduleKey).toHaveBeenCalledWith(feeScheduleKey);
            expect(tx.setFeeExemptKeys).toHaveBeenCalledWith([exemptKey]);
            expect(tx.setCustomFees).toHaveBeenCalledWith(customFees);
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.createTopic({
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const adminKey = PrivateKey.generateED25519();

            await service.createTopic({
                adminKey: adminKey.publicKey,
                autoRenewAccountId: "0.0.99",
                additionalSigners: [adminKey],
            });

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(adminKey);
        });

        it("rejects when adminKey is set without autoRenewAccountId", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;

            await expect(service.createTopic({ adminKey })).rejects.toThrow(
                /autoRenewAccountId is required/,
            );

            expect(vi.mocked(TopicCreateTransaction)).not.toHaveBeenCalled();
        });
    });

    describe("scheduleCreateTopic", () => {
        it("schedules a topic create and returns the scheduleId", async () => {
            const result = await service.scheduleCreateTopic({
                topicMemo: "scheduled topic",
            });

            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");

            const tx = vi.mocked(TopicCreateTransaction).mock.results[0].value;
            expect(tx.schedule).toHaveBeenCalled();
        });

        it("forwards schedule options to the scheduling transaction", async () => {
            await service.scheduleCreateTopic(
                {},
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "deferred topic create",
                },
            );

            expect(mocks.scheduleTx.setPayerAccountId).toHaveBeenCalled();
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "deferred topic create",
            );
        });
    });
});
