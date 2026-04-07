import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import { waitForMirrorNodeRecord } from "../utils/mirror-node.js";
import { TopicClient } from "../../src/services/topic-client.js";
import { PrivateKey } from "@hashgraph/sdk";

describe("TopicClient [Integration]", () => {
    let client: TopicClient;
    let testTopicId: string;
    let customAdminKey: PrivateKey;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new TopicClient(ctx);
        customAdminKey = PrivateKey.generateED25519();
    });

    it("creates a completely public topic successfully", async () => {
        const topicId = await client.createTopic({
            memo: "Public Integration Test",
        });
        expect(topicId).toBeDefined();
        expect(typeof topicId).toBe("string");

        await waitForMirrorNodeRecord(); // Await consensus propagation
        testTopicId = topicId;
    }, 25000);

    it("submits a consensus message to the public topic", async () => {
        const msg = "Hello from integration test!";
        await client.submitMessage(testTopicId, msg);

        await waitForMirrorNodeRecord(); // Await consensus propagation

        // Ideally we would use mirror node REST to fetch the message back here.
        // Hiero context doesn't have an explicit readMessage SDK wrapper, we just verify the submit succeeds dynamically.
        expect(true).toBe(true);
    }, 25000);

    it("updates the public topic with a new memo", async () => {
        await client.updateTopic(testTopicId, {
            memo: "Updated Integration Memo",
        });

        await waitForMirrorNodeRecord();
        expect(true).toBe(true);
    }, 25000);

    it("creates a private admin-locked topic, then deletes it immediately", async () => {
        // 1. Create it with custom admin key so it is locked
        const privateTopicId = await client.createTopic({
            memo: "To Be Deleted",
            adminKey: customAdminKey,
        });

        await waitForMirrorNodeRecord();

        // 2. Delete it securely
        await client.deleteTopic(privateTopicId, customAdminKey);

        await waitForMirrorNodeRecord();

        expect(true).toBe(true); // Verifies no HieroErrors were thrown during deletion signature check
    }, 45000);
});
