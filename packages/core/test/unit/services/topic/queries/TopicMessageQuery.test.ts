import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicId } from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { TopicMessageQuery } from "../../../../../src/services/topic/queries/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const subscriptionHandle = { unsubscribe: vi.fn() };
    const mockQuery = {
        setTopicId: vi.fn().mockReturnThis(),
        setStartTime: vi.fn().mockReturnThis(),
        setEndTime: vi.fn().mockReturnThis(),
        setLimit: vi.fn().mockReturnThis(),
        setMaxAttempts: vi.fn().mockReturnThis(),
        setMaxBackoff: vi.fn().mockReturnThis(),
        setCompletionHandler: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue(subscriptionHandle),
    };
    return { mockQuery, subscriptionHandle };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TopicMessageQuery: vi.fn(function () {
            return mocks.mockQuery;
        }),
    };
});

const { TopicMessageQuery: SdkTopicMessageQuery } =
    await import("@hiero-ledger/sdk");

function buildSdkTopicMessage(overrides: Record<string, unknown> = {}) {
    return {
        sequenceNumber: { toString: () => "7" },
        consensusTimestamp: {
            toDate: () => new Date("2024-01-02T03:04:05.000Z"),
        },
        contents: new Uint8Array([10, 20, 30]),
        runningHash: new Uint8Array([1, 2, 3]),
        initialTransactionId: { toString: () => "0.0.2@1700000000.123456789" },
        ...overrides,
    };
}

describe("TopicMessageQuery (via TopicService)", () => {
    let context: IHieroContext;
    let service: TopicService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new TopicService(context);
    });

    it("subscribes to a topic and projects SDK messages to plain objects", () => {
        const received: unknown[] = [];

        const handle = service.subscribeToMessages(
            { topicId: "0.0.1234" },
            (msg) => received.push(msg),
        );

        expect(mocks.mockQuery.setTopicId).toHaveBeenCalledWith("0.0.1234");
        expect(mocks.mockQuery.subscribe).toHaveBeenCalledWith(
            context.client,
            null,
            expect.any(Function),
        );
        expect(handle).toBe(mocks.subscriptionHandle);

        // Invoke the listener wired into the SDK subscribe call.
        const sdkListener = mocks.mockQuery.subscribe.mock.calls[0][2];
        sdkListener(buildSdkTopicMessage());

        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({
            sequenceNumber: "7",
            consensusTimestamp: "2024-01-02T03:04:05.000Z",
            initialTransactionId: "0.0.2@1700000000.123456789",
        });
        expect((received[0] as { contents: Uint8Array }).contents).toEqual(
            new Uint8Array([10, 20, 30]),
        );
        expect(
            (received[0] as { runningHash: Uint8Array }).runningHash,
        ).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("projects null initialTransactionId to null in the result", () => {
        const listener = vi.fn();
        service.subscribeToMessages({ topicId: "0.0.1" }, listener);

        const sdkListener = mocks.mockQuery.subscribe.mock.calls[0][2];
        sdkListener(buildSdkTopicMessage({ initialTransactionId: null }));

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({ initialTransactionId: null }),
        );
    });

    it("forwards all optional filters to the SDK query", () => {
        const start = new Date("2024-01-01T00:00:00.000Z");
        const end = new Date("2024-12-31T00:00:00.000Z");
        const errorHandler = vi.fn();
        const completionHandler = vi.fn();

        service.subscribeToMessages(
            {
                topicId: TopicId.fromString("0.0.42"),
                startTime: start,
                endTime: end,
                limit: 5,
                maxAttempts: 3,
                maxBackoff: 8000,
                errorHandler,
                completionHandler,
            },
            () => {},
        );

        expect(mocks.mockQuery.setStartTime).toHaveBeenCalledWith(start);
        expect(mocks.mockQuery.setEndTime).toHaveBeenCalledWith(end);
        expect(mocks.mockQuery.setLimit).toHaveBeenCalledWith(5);
        expect(mocks.mockQuery.setMaxAttempts).toHaveBeenCalledWith(3);
        expect(mocks.mockQuery.setMaxBackoff).toHaveBeenCalledWith(8000);
        expect(mocks.mockQuery.setCompletionHandler).toHaveBeenCalledWith(
            completionHandler,
        );
        expect(mocks.mockQuery.subscribe).toHaveBeenCalledWith(
            context.client,
            errorHandler,
            expect.any(Function),
        );
    });

    it("skips optional setters when fields are omitted", () => {
        service.subscribeToMessages({ topicId: "0.0.1" }, () => {});

        expect(mocks.mockQuery.setStartTime).not.toHaveBeenCalled();
        expect(mocks.mockQuery.setEndTime).not.toHaveBeenCalled();
        expect(mocks.mockQuery.setLimit).not.toHaveBeenCalled();
        expect(mocks.mockQuery.setMaxAttempts).not.toHaveBeenCalled();
        expect(mocks.mockQuery.setMaxBackoff).not.toHaveBeenCalled();
        expect(mocks.mockQuery.setCompletionHandler).not.toHaveBeenCalled();
    });

    it("normalises subscribe-time errors with the TopicService.subscribeToMessages context", () => {
        mocks.mockQuery.subscribe.mockImplementationOnce(() => {
            throw new Error("subscribe failed");
        });

        expect(() =>
            service.subscribeToMessages({ topicId: "0.0.1" }, () => {}),
        ).toThrow(
            expect.objectContaining({
                name: "HieroError",
                context: "TopicService.subscribeToMessages",
                message: "subscribe failed",
            }),
        );
    });

    it("constructs a fresh SdkTopicMessageQuery on every subscribe call", () => {
        service.subscribeToMessages({ topicId: "0.0.1" }, () => {});
        service.subscribeToMessages({ topicId: "0.0.2" }, () => {});

        expect(vi.mocked(SdkTopicMessageQuery)).toHaveBeenCalledTimes(2);
    });

    describe("subscribeRaw", () => {
        it("passes the raw SDK message straight to the listener", () => {
            const query = new TopicMessageQuery(context);
            const listener = vi.fn();

            const handle = query.subscribeRaw(
                { topicId: "0.0.1234" },
                listener,
            );

            expect(handle).toBe(mocks.subscriptionHandle);
            expect(mocks.mockQuery.subscribe).toHaveBeenCalledWith(
                context.client,
                null,
                listener,
            );

            const sdkMessage = buildSdkTopicMessage();
            const wired = mocks.mockQuery.subscribe.mock.calls[0][2];
            wired(sdkMessage);

            expect(listener).toHaveBeenCalledWith(sdkMessage);
        });

        it("forwards optional filters and uses the provided errorHandler", () => {
            const query = new TopicMessageQuery(context);
            const errorHandler = vi.fn();

            query.subscribeRaw(
                {
                    topicId: "0.0.1",
                    startTime: 1700000000000,
                    endTime: 1800000000000,
                    limit: 10,
                    maxAttempts: 4,
                    maxBackoff: 16000,
                    completionHandler: vi.fn(),
                    errorHandler,
                },
                () => {},
            );

            expect(mocks.mockQuery.setStartTime).toHaveBeenCalledWith(
                1700000000000,
            );
            expect(mocks.mockQuery.setEndTime).toHaveBeenCalledWith(
                1800000000000,
            );
            expect(mocks.mockQuery.setLimit).toHaveBeenCalledWith(10);
            expect(mocks.mockQuery.setMaxAttempts).toHaveBeenCalledWith(4);
            expect(mocks.mockQuery.setMaxBackoff).toHaveBeenCalledWith(16000);
            expect(mocks.mockQuery.setCompletionHandler).toHaveBeenCalled();
            expect(mocks.mockQuery.subscribe).toHaveBeenCalledWith(
                context.client,
                errorHandler,
                expect.any(Function),
            );
        });

        it("normalises subscribe-time errors with the TopicService.subscribeToMessages context", () => {
            mocks.mockQuery.subscribe.mockImplementationOnce(() => {
                throw new Error("raw subscribe failed");
            });

            const query = new TopicMessageQuery(context);

            expect(() =>
                query.subscribeRaw({ topicId: "0.0.1" }, () => {}),
            ).toThrow(
                expect.objectContaining({
                    name: "HieroError",
                    context: "TopicService.subscribeToMessages",
                    message: "raw subscribe failed",
                }),
            );
        });
    });
});
