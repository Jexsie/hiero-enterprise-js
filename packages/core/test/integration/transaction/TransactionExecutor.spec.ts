import { describe, it, expect, beforeAll, vi } from "vitest";
import { TopicCreateTransaction } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../utils/env.js";
import { TransactionExecutor } from "../../../src/services/transaction/index.js";
import type { HieroContext } from "../../../src/context/index.js";

describe("TransactionExecutor [Integration]", () => {
    let context: HieroContext;
    let executor: TransactionExecutor;

    beforeAll(() => {
        context = setupIntegrationTestEnv();
        executor = new TransactionExecutor(context);
    });

    describe("run()", () => {
        it("executes a transaction end-to-end and returns the processReceipt result", async () => {
            const tx = new TopicCreateTransaction().setTopicMemo(
                "executor integration",
            );

            const topicId = await executor.run(
                tx,
                {},
                {
                    type: "TopicCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "createTopic",
                    timestamp: new Date(),
                },
                (receipt) => receipt.topicId!.toString(),
            );

            expect(topicId).toMatch(/^0\.0\.\d+$/);
        }, 60_000);

        it("emits before and after lifecycle events with SUCCESS status", async () => {
            const before = vi.fn();
            const after = vi.fn();
            context.addTransactionListener({
                onBeforeTransaction: before,
                onAfterTransaction: after,
            });

            const tx = new TopicCreateTransaction().setTopicMemo(
                "executor events",
            );

            await executor.run(
                tx,
                {},
                {
                    type: "TopicCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "createTopic",
                    timestamp: new Date(),
                },
                (receipt) => receipt.topicId!.toString(),
            );

            expect(before).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TopicCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "createTopic",
                }),
            );
            expect(after).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TopicCreateTransaction",
                    status: "SUCCESS",
                    transactionId: expect.stringMatching(/^0\.0\.\d+@/),
                    durationMs: expect.any(Number),
                }),
            );
        }, 60_000);
    });

    describe("scheduleRun()", () => {
        it("wraps a transaction in a schedule and returns the schedule ID", async () => {
            const inner = new TopicCreateTransaction().setTopicMemo(
                "executor schedule",
            );

            const result = await executor.scheduleRun(
                inner,
                {},
                {
                    type: "ScheduleCreateTransaction",
                    serviceName: "IntegrationTest",
                    methodName: "scheduleCreateTopic",
                    timestamp: new Date(),
                },
                { scheduleMemo: "executor integration schedule" },
            );

            expect(result.scheduleId).toMatch(/^0\.0\.\d+$/);
            expect(result.transactionId).toMatch(/^0\.0\.\d+@/);
        }, 60_000);
    });
});
