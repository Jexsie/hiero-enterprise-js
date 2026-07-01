import { describe, it, expect, beforeAll } from "vitest";
import {
    setupIntegrationTestEnv,
    MIRROR_GRPC_ADDRESS,
    wait,
} from "../../../utils/env.js";
import { TopicService } from "../../../../src/services/index.js";
import type { SubscribedMessage } from "../../../../src/services/topic/index.js";

// The mirror node imports the
// record stream on a schedule, so subscriptions must be opened AFTER
// the topic-create record has been ingested and messages submitted
// AFTER the subscription is live.
const MIRROR_INGEST_MS = 5_000; // create → subscribe
const STREAM_ESTABLISH_MS = 2_000; // subscribe → first submit
const DELIVERY_WINDOW_MS = 5_000; // last submit → assertion

describe("TopicMessageQuery", () => {
    let topicService: TopicService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        // Consensus-stream subscriptions use the mirror node's gRPC
        // channel — the REST URL from HIERO_MIRROR_NODE_URL points at a
        // different port, so point the SDK at the local gRPC endpoint
        // explicitly here.
        ctx.client.setMirrorNetwork([MIRROR_GRPC_ADDRESS]);
        topicService = new TopicService(ctx);
    });

    it("delivers a single submitted message to the listener", async () => {
        const topicId = await topicService.createTopic({
            topicMemo: "integration: subscribe single",
        });

        // Give the mirror importer time to see the new topic before
        // opening the subscription — otherwise it responds NOT_FOUND
        // and the SDK falls into its 250ms→8s backoff loop.
        await wait(MIRROR_INGEST_MS);

        const received: SubscribedMessage[] = [];
        const handle = topicService.subscribeToMessages(
            {
                topicId,
                limit: 1,
                errorHandler: (_msg, err) =>
                    console.error(
                        `[TopicMessageQuery] subscribe error: ${err.message}`,
                    ),
            },
            (msg) => {
                received.push(msg);
            },
        );

        // Let the gRPC stream establish before pushing traffic through
        // the consensus node.
        await wait(STREAM_ESTABLISH_MS);

        await topicService.submitMessage({
            topicId,
            message: "hello subscribers",
        });

        // Wait for the mirror to publish the submitted message on the
        // open stream.
        await wait(DELIVERY_WINDOW_MS);
        handle.unsubscribe();

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

        await wait(MIRROR_INGEST_MS);

        const received: SubscribedMessage[] = [];
        const handle = topicService.subscribeToMessages(
            {
                topicId,
                limit: 3,
                errorHandler: (_msg, err) =>
                    console.error(
                        `[TopicMessageQuery] subscribe error: ${err.message}`,
                    ),
            },
            (msg) => {
                received.push(msg);
            },
        );

        await wait(STREAM_ESTABLISH_MS);

        await topicService.submitMessage({ topicId, message: "alpha" });
        await topicService.submitMessage({ topicId, message: "beta" });
        await topicService.submitMessage({ topicId, message: "gamma" });

        await wait(DELIVERY_WINDOW_MS);
        handle.unsubscribe();

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

        await wait(MIRROR_INGEST_MS);

        const received: SubscribedMessage[] = [];
        const handle = topicService.subscribeToMessages(
            {
                topicId,
                errorHandler: (_msg, err) =>
                    console.error(
                        `[TopicMessageQuery] subscribe error: ${err.message}`,
                    ),
            },
            (msg) => {
                received.push(msg);
            },
        );

        await wait(STREAM_ESTABLISH_MS);

        await topicService.submitMessage({ topicId, message: "one" });
        await wait(DELIVERY_WINDOW_MS);

        expect(received).toHaveLength(1);

        // Stop the stream, then submit another message — it must NOT
        // reach the (now-disposed) listener even after the delivery
        // window elapses.
        handle.unsubscribe();
        await topicService.submitMessage({ topicId, message: "two" });
        await wait(DELIVERY_WINDOW_MS);

        expect(received).toHaveLength(1);
    });
});
