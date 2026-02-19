import {
  TopicCreateTransaction,
  TopicUpdateTransaction,
  TopicDeleteTransaction,
  TopicMessageSubmitTransaction,
  PrivateKey,
} from '@hashgraph/sdk';
import type { HieroContext } from '../context/index.js';
import { normalizeError } from '../errors/index.js';

/**
 * Options for creating a topic.
 */
export interface CreateTopicOptions {
  /** Topic memo */
  memo?: string;
  /** Admin key (defaults to operator key) */
  adminKey?: string;
}

/**
 * Options for creating a private topic (requires submit key).
 */
export interface CreatePrivateTopicOptions extends CreateTopicOptions {
  /** Submit key for authorization */
  submitKey: string;
}

/**
 * Options for updating a topic.
 */
export interface UpdateTopicOptions {
  /** New memo */
  memo?: string;
  /** New admin key */
  newAdminKey?: string;
  /** New submit key */
  newSubmitKey?: string;
  /** Current admin key for authorization */
  adminKey?: string;
}

/**
 * Service for managing topics on the Hiero consensus service.
 * Maps to Java: com.openelements.hiero.base.TopicClient
 */
export class TopicClient {
  private readonly context: HieroContext;

  constructor(context: HieroContext) {
    this.context = context;
  }

  /**
   * Create a new public topic.
   *
   * @param options - Optional topic settings
   * @returns The topic ID
   */
  async createTopic(options: CreateTopicOptions = {}): Promise<string> {
    try {
      const adminKey = options.adminKey
        ? PrivateKey.fromString(options.adminKey)
        : this.context.operatorKey;

      const tx = new TopicCreateTransaction().setAdminKey(adminKey.publicKey);

      if (options.memo) {
        tx.setTopicMemo(options.memo);
      }

      const response = await tx.execute(this.context.client);
      const receipt = await response.getReceipt(this.context.client);
      return receipt.topicId!.toString();
    } catch (error) {
      throw normalizeError(error, 'TopicClient.createTopic');
    }
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
    try {
      const adminKey = options.adminKey
        ? PrivateKey.fromString(options.adminKey)
        : this.context.operatorKey;
      const submitKey = PrivateKey.fromString(options.submitKey);

      const tx = new TopicCreateTransaction()
        .setAdminKey(adminKey.publicKey)
        .setSubmitKey(submitKey.publicKey);

      if (options.memo) {
        tx.setTopicMemo(options.memo);
      }

      const response = await tx.execute(this.context.client);
      const receipt = await response.getReceipt(this.context.client);
      return receipt.topicId!.toString();
    } catch (error) {
      throw normalizeError(error, 'TopicClient.createPrivateTopic');
    }
  }

  /**
   * Update a topic's properties.
   *
   * @param topicId - Topic to update
   * @param options - Properties to update
   */
  async updateTopic(
    topicId: string,
    options: UpdateTopicOptions,
  ): Promise<void> {
    try {
      const tx = new TopicUpdateTransaction().setTopicId(topicId);

      if (options.memo !== undefined) {
        tx.setTopicMemo(options.memo);
      }
      if (options.newAdminKey) {
        tx.setAdminKey(PrivateKey.fromString(options.newAdminKey).publicKey);
      }
      if (options.newSubmitKey) {
        tx.setSubmitKey(PrivateKey.fromString(options.newSubmitKey).publicKey);
      }

      const frozenTx = tx.freezeWith(this.context.client);

      if (options.adminKey) {
        await (
          await frozenTx.sign(PrivateKey.fromString(options.adminKey))
        ).execute(this.context.client);
      } else {
        await frozenTx.execute(this.context.client);
      }
    } catch (error) {
      throw normalizeError(error, 'TopicClient.updateTopic');
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
    topicId: string,
    newAdminKey: string,
    currentAdminKey?: string,
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
    topicId: string,
    submitKey: string,
    adminKey?: string,
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
  async deleteTopic(topicId: string, adminKey?: string): Promise<void> {
    try {
      const tx = new TopicDeleteTransaction()
        .setTopicId(topicId)
        .freezeWith(this.context.client);

      if (adminKey) {
        await (
          await tx.sign(PrivateKey.fromString(adminKey))
        ).execute(this.context.client);
      } else {
        await tx.execute(this.context.client);
      }
    } catch (error) {
      throw normalizeError(error, 'TopicClient.deleteTopic');
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
    topicId: string,
    message: string | Uint8Array,
    submitKey?: string,
  ): Promise<void> {
    try {
      const tx = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(message)
        .freezeWith(this.context.client);

      if (submitKey) {
        await (
          await tx.sign(PrivateKey.fromString(submitKey))
        ).execute(this.context.client);
      } else {
        await tx.execute(this.context.client);
      }
    } catch (error) {
      throw normalizeError(error, 'TopicClient.submitMessage');
    }
  }
}
