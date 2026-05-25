import type { MirrorTopicMessage, Page } from "../types/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";

/**
 * Repository for querying topic messages from the mirror node.
 */
export class TopicRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find all messages for a topic.
     */
    async findByTopicId(topicId: string): Promise<Page<MirrorTopicMessage>> {
        return this.mirrorNodeClient.queryTopicMessages(topicId);
    }

    /**
     * Find a specific message by topic ID and sequence number.
     */
    async findByTopicIdAndSequenceNumber(
        topicId: string,
        sequenceNumber: number,
    ): Promise<MirrorTopicMessage> {
        return this.mirrorNodeClient.queryTopicMessageBySequence(
            topicId,
            sequenceNumber,
        );
    }
}
