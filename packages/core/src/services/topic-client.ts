import {
    TopicCreateTransaction,
    TopicUpdateTransaction,
    TopicDeleteTransaction,
    TopicMessageSubmitTransaction,
    type PrivateKey,
    type TopicId,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../context/index.js";
import type { TransactionEvent } from "../listeners/index.js";
import { normalizeError } from "../errors/index.js";

/**
 * Options for creating a topic.
 */
export interface CreateTopicOptions {
    /** Topic memo */
    memo?: string;
    /** Admin key (defaults to operator key) */
    adminKey?: PrivateKey;
}

/**
 * Options for creating a private topic (requires submit key).
 */
export interface CreatePrivateTopicOptions extends CreateTopicOptions {
    /** Submit key for authorization */
    submitKey: PrivateKey;
}

/**
 * Options for updating a topic.
 */
export interface UpdateTopicOptions {
    /** New memo */
    memo?: string;
    /** New admin key */
    newAdminKey?: PrivateKey;
    /** New submit key */
    newSubmitKey?: PrivateKey;
    /** Current admin key for authorization */
    adminKey?: PrivateKey;
}

/**
 * Service for managing topics on the Hiero consensus service.
 */
export class TopicClient {
    private readonly context: IHieroContext;

    constructor(context: IHieroContext) {
        this.context = context;
    }

    private createEvent(type: string, methodName: string): TransactionEvent {
        return {
            type,
            serviceName: "TopicClient",
            methodName,
            timestamp: new Date(),
        };
    }

    /**
     * Create a new public topic.
     *
     * @param options - Optional topic settings
     * @returns The topic ID
     */
    async createTopic(options: CreateTopicOptions = {}): Promise<string> {
        return this._createTopicInternal(options, "TopicCreate", "createTopic");
    }

    /**
     * Create a new private topic (requires a submit key to send messages).
     *
     * @param options - Topic settings including required submit key
     * @returns The topic ID
     */
    async createPrivateTopic(
        options: CreatePrivateTopicOptions,
    ): Promise<string> {
        return this._createTopicInternal(
            options,
            "TopicCreatePrivate",
            "createPrivateTopic",
        );
    }

    /**
     * Update a topic's properties.
     *
     * @param topicId - Topic to update
     * @param options - Properties to update
     */
    async updateTopic(
        topicId: string | TopicId,
        options: UpdateTopicOptions,
    ): Promise<void> {
        const event = this.createEvent("TopicUpdate", "updateTopic");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TopicUpdateTransaction().setTopicId(topicId);

            if (options.memo !== undefined) {
                tx.setTopicMemo(options.memo);
            }
            if (options.newAdminKey) {
                tx.setAdminKey(options.newAdminKey.publicKey);
            }
            if (options.newSubmitKey) {
                tx.setSubmitKey(options.newSubmitKey.publicKey);
            }

            const frozenTx = tx.freezeWith(this.context.client);

            let response;
            if (options.adminKey) {
                response = await (
                    await frozenTx.sign(options.adminKey)
                ).execute(this.context.client);
            } else {
                response = await frozenTx.execute(this.context.client);
            }

            const receipt = await response.getReceipt(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "TopicClient.updateTopic");
        }
    }

    /**
     * Update the admin key of a topic.
     *
     * @param topicId - Topic to update
     * @param newAdminKey - New admin key
     * @param currentAdminKey - Current admin key for authorization
     */
    async updateAdminKey(
        topicId: string | TopicId,
        newAdminKey: PrivateKey,
        currentAdminKey?: PrivateKey,
    ): Promise<void> {
        return this.updateTopic(topicId, {
            newAdminKey,
            adminKey: currentAdminKey,
        });
    }

    /**
     * Update the submit key of a topic.
     *
     * @param topicId - Topic to update
     * @param submitKey - New submit key
     * @param adminKey - Admin key for authorization
     */
    async updateSubmitKey(
        topicId: string | TopicId,
        submitKey: PrivateKey,
        adminKey?: PrivateKey,
    ): Promise<void> {
        return this.updateTopic(topicId, {
            newSubmitKey: submitKey,
            adminKey,
        });
    }

    /**
     * Delete a topic.
     *
     * @param topicId - Topic to delete
     * @param adminKey - Admin key for authorization
     */
    async deleteTopic(
        topicId: string | TopicId,
        adminKey?: PrivateKey,
    ): Promise<void> {
        const event = this.createEvent("TopicDelete", "deleteTopic");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TopicDeleteTransaction()
                .setTopicId(topicId)
                .freezeWith(this.context.client);

            let response;
            if (adminKey) {
                response = await (
                    await tx.sign(adminKey)
                ).execute(this.context.client);
            } else {
                response = await tx.execute(this.context.client);
            }

            const receipt = await response.getReceipt(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "TopicClient.deleteTopic");
        }
    }

    /**
     * Submit a message to a topic.
     *
     * @param topicId - Topic to send to
     * @param message - Message content (string or bytes)
     * @param submitKey - Submit key (required for private topics)
     */
    async submitMessage(
        topicId: string | TopicId,
        message: string | Uint8Array,
        submitKey?: PrivateKey,
    ): Promise<void> {
        const event = this.createEvent("TopicSubmitMessage", "submitMessage");
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TopicMessageSubmitTransaction()
                .setTopicId(topicId)
                .setMessage(message)
                .freezeWith(this.context.client);

            let response;
            if (submitKey) {
                response = await (
                    await tx.sign(submitKey)
                ).execute(this.context.client);
            } else {
                response = await tx.execute(this.context.client);
            }

            const receipt = await response.getReceipt(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "TopicClient.submitMessage");
        }
    }

    // ─── Private Helpers ─────────────────────────────────────────

    private async _createTopicInternal(
        options: CreateTopicOptions & { submitKey?: PrivateKey },
        eventType: string,
        methodName: string,
    ): Promise<string> {
        const event = this.createEvent(eventType, methodName);
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const tx = new TopicCreateTransaction();
            let keyToSign: PrivateKey | undefined;

            if (options.adminKey) {
                keyToSign = options.adminKey;
                tx.setAdminKey(keyToSign.publicKey);
            } else {
                tx.setAdminKey(this.context.operatorPublicKey);
            }

            if ("submitKey" in options && options.submitKey) {
                tx.setSubmitKey(options.submitKey.publicKey);
            }

            if (options.memo) {
                tx.setTopicMemo(options.memo);
            }

            let response;
            if (keyToSign) {
                const frozenTx = tx.freezeWith(this.context.client);
                response = await (
                    await frozenTx.sign(keyToSign)
                ).execute(this.context.client);
            } else {
                response = await tx.execute(this.context.client);
            }

            const receipt = await response.getReceipt(this.context.client);
            const topicId = receipt.topicId!.toString();

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });

            return topicId;
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, `TopicClient.${methodName}`);
        }
    }
}
