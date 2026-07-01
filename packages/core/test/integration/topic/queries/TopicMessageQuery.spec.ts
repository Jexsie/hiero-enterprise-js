import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { TopicService } from "../../../../src/services/index.js";
import type { SubscribedMessage } from "../../../../src/services/topic/index.js";

describe("TopicMessageQuery", () => {
    let topicService: TopicService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        topicService = new TopicService(ctx);
    });

    it("delivers a single submitted message to the listener", async () => {
        const topicId = await topicService.createTopic({
            topicMemo: "integration: subscribe single",
        });

        await topicService.submitMessage({
            topicId,
            message: "hello subscribers",
        });

        const received: SubscribedMessage[] = [];

        await new Promise<void>((resolve) => {
            const handle = topicService.subscribeToMessages(
                { topicId, limit: 1 },
                (msg) => {
                    received.push(msg);
                    handle.unsubscribe();
                    resolve();
                },
            );
        });

        expect(received).toHaveLength(1);
        const msg = received[0];
        expect(msg.sequenceNumber).toBe("1");
        expect(msg.consensusTimestamp).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
        expect(Buffer.from(msg.contents).toString("utf8")).toBe(
            "hello subscribers",
        );
        expect(msg.runningHash.byteLength).toBeGreaterThan(0);
    });

    it("delivers multiple messages in consensus order up to the limit", async () => {
        const topicId = await topicService.createTopic({
            topicMemo: "integration: subscribe ordered",
        });

        await topicService.submitMessage({ topicId, message: "alpha" });
        await topicService.submitMessage({ topicId, message: "beta" });
        await topicService.submitMessage({ topicId, message: "gamma" });

        const received: SubscribedMessage[] = [];

        await new Promise<void>((resolve) => {
            const handle = topicService.subscribeToMessages(
                { topicId, limit: 3 },
                (msg) => {
                    received.push(msg);
                    if (received.length === 3) {
                        handle.unsubscribe();
                        resolve();
                    }
                },
            );
        });

        const payloads = received.map((m) =>
            Buffer.from(m.contents).toString("utf8"),
        );
        expect(payloads).toEqual(["alpha", "beta", "gamma"]);
        expect(received.map((m) => m.sequenceNumber)).toEqual(["1", "2", "3"]);
    });

    it("unsubscribe stops further deliveries", async () => {
        const topicId = await topicService.createTopic({
            topicMemo: "integration: subscribe unsubscribe",
        });

        await topicService.submitMessage({ topicId, message: "one" });

        const received: SubscribedMessage[] = [];

        await new Promise<void>((resolve) => {
            const handle = topicService.subscribeToMessages(
                { topicId, limit: 1 },
                (msg) => {
                    received.push(msg);
                    handle.unsubscribe();
                    resolve();
                },
            );
        });

        expect(received).toHaveLength(1);

        // Submit another message after unsubscribing — should NOT be
        // delivered to the (already-disposed) listener.
        await topicService.submitMessage({ topicId, message: "two" });
        expect(received).toHaveLength(1);
    });
});
