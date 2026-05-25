import { describe, it, expect, beforeEach, vi } from "vitest";
import { TopicRepository } from "../../../src/repositories/topic-repository.js";
import { createMockMirrorNodeClient } from "../../../src/testing/index.js";

describe("TopicRepository", () => {
    let repo: TopicRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new TopicRepository(mockClient as any);
    });

    it("delegates findByTopicId to queryTopicMessages", async () => {
        const spy = vi.spyOn(mockClient, "queryTopicMessages");
        await repo.findByTopicId("0.0.100");
        expect(spy).toHaveBeenCalledWith("0.0.100");
    });

    it("delegates findByTopicIdAndSequenceNumber to queryTopicMessageBySequence", async () => {
        const spy = vi.spyOn(mockClient, "queryTopicMessageBySequence");
        await repo.findByTopicIdAndSequenceNumber("0.0.100", 5);
        expect(spy).toHaveBeenCalledWith("0.0.100", 5);
    });
});
