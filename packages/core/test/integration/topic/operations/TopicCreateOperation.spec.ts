import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import {
    waitForMirrorEntity,
    waitForMirrorNodeRecord,
} from "../../../utils/mirror-node.js";
import { queryTopicInfo } from "../../../utils/mirror-node-rest.js";
import { TopicService } from "../../../../src/services/index.js";

describe("TopicCreateOperation", () => {
    let topicService: TopicService;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        topicService = new TopicService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    it("creates a public, immutable topic with a memo", async () => {
        const topicId = await topicService.createTopic({
            topicMemo: "integration: public topic",
        });

        expect(topicId).toMatch(/^0\.0\.\d+$/);

        await waitForMirrorNodeRecord();
        const info = await waitForMirrorEntity(() => queryTopicInfo(topicId), {
            description: `topic ${topicId}`,
        });
        expect(info.topic_id).toBe(topicId);
        expect(info.memo).toBe("integration: public topic");
        expect(info.deleted).toBe(false);
        // No admin key was supplied — topic is immutable.
        expect(info.admin_key).toBeNull();
        // No submit key — topic is public.
        expect(info.submit_key).toBeNull();
    });

    it("creates a mutable, private topic with admin + submit keys", async () => {
        const adminKey = PrivateKey.generateED25519();
        const submitKey = PrivateKey.generateED25519();

        const topicId = await topicService.createTopic({
            topicMemo: "integration: private topic",
            adminKey: adminKey.publicKey,
            submitKey: submitKey.publicKey,
            autoRenewAccountId: operatorId,
            additionalSigners: [adminKey],
        });

        expect(topicId).toMatch(/^0\.0\.\d+$/);

        await waitForMirrorNodeRecord();
        const info = await waitForMirrorEntity(() => queryTopicInfo(topicId), {
            description: `topic ${topicId}`,
        });
        expect(info.topic_id).toBe(topicId);
        expect(info.memo).toBe("integration: private topic");
        expect(info.admin_key).not.toBeNull();
        expect(info.submit_key).not.toBeNull();
    });
});
