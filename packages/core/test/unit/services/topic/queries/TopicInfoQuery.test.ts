import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicId } from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const mockQuery = {
        setTopicId: vi.fn().mockReturnThis(),
        execute: vi.fn(),
    };
    return { mockQuery };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TopicInfoQuery: vi.fn(function () {
            return mocks.mockQuery;
        }),
    };
});

// Re-imported after vi.mock so the SdkTopicInfoQuery constructor is the mock.
const { TopicInfoQuery: SdkTopicInfoQuery } = await import("@hiero-ledger/sdk");

function buildSdkTopicInfo(overrides: Record<string, unknown> = {}) {
    return {
        topicId: TopicId.fromString("0.0.1234"),
        topicMemo: "demo topic",
        runningHash: new Uint8Array([1, 2, 3]),
        sequenceNumber: { toString: () => "42" },
        expirationTime: {
            toDate: () => new Date("2099-01-02T03:04:05.000Z"),
        },
        adminKey: { _adminKeySentinel: true },
        submitKey: { _submitKeySentinel: true },
        feeScheduleKey: { _feeScheduleKeySentinel: true },
        feeExemptKeys: [{ _exemptKeySentinel: true }],
        autoRenewPeriod: { seconds: { toNumber: () => 7776000 } },
        autoRenewAccountId: { toString: () => "0.0.555" },
        customFees: [],
        ledgerId: { toString: () => "mainnet" },
        ...overrides,
    };
}

describe("TopicInfoQuery (via TopicService)", () => {
    let context: IHieroContext;
    let service: TopicService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new TopicService(context);
    });

    it("fetches and projects topic info to a plain object", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(buildSdkTopicInfo());

        const info = await service.getTopicInfo("0.0.1234");

        expect(mocks.mockQuery.setTopicId).toHaveBeenCalledWith("0.0.1234");
        expect(mocks.mockQuery.execute).toHaveBeenCalledWith(context.client);

        expect(info).toMatchObject({
            topicId: "0.0.1234",
            topicMemo: "demo topic",
            sequenceNumber: "42",
            expirationTime: "2099-01-02T03:04:05.000Z",
            autoRenewAccountId: "0.0.555",
            autoRenewPeriod: 7776000,
            customFees: [],
            ledgerId: "mainnet",
        });
        expect(info.runningHash).toEqual(new Uint8Array([1, 2, 3]));
        // Keys pass through as the original SDK references.
        expect(info.adminKey).toEqual({ _adminKeySentinel: true });
        expect(info.submitKey).toEqual({ _submitKeySentinel: true });
        expect(info.feeScheduleKey).toEqual({ _feeScheduleKeySentinel: true });
        expect(info.feeExemptKeys).toEqual([{ _exemptKeySentinel: true }]);
    });

    it("accepts a TopicId instance", async () => {
        const topicId = TopicId.fromString("0.0.999");
        mocks.mockQuery.execute.mockResolvedValueOnce(
            buildSdkTopicInfo({ topicId }),
        );

        const info = await service.getTopicInfo(topicId);

        expect(mocks.mockQuery.setTopicId).toHaveBeenCalledWith(topicId);
        expect(info.topicId).toBe("0.0.999");
    });

    it("returns null for optional fields when the SDK reports them as null", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(
            buildSdkTopicInfo({
                expirationTime: null,
                adminKey: null,
                submitKey: null,
                feeScheduleKey: null,
                feeExemptKeys: null,
                autoRenewAccountId: null,
                autoRenewPeriod: null,
                customFees: null,
                ledgerId: null,
            }),
        );

        const info = await service.getTopicInfo("0.0.1234");

        expect(info.expirationTime).toBeNull();
        expect(info.adminKey).toBeNull();
        expect(info.submitKey).toBeNull();
        expect(info.feeScheduleKey).toBeNull();
        expect(info.feeExemptKeys).toBeNull();
        expect(info.autoRenewAccountId).toBeNull();
        expect(info.autoRenewPeriod).toBeNull();
        expect(info.customFees).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("normalises SDK errors with the TopicService.getTopicInfo context", async () => {
        mocks.mockQuery.execute.mockRejectedValueOnce(
            new Error("boom from network"),
        );

        await expect(service.getTopicInfo("0.0.1234")).rejects.toMatchObject({
            name: "HieroError",
            context: "TopicService.getTopicInfo",
            message: "boom from network",
        });
    });

    it("constructs a fresh SdkTopicInfoQuery on every execute call", async () => {
        mocks.mockQuery.execute.mockResolvedValue(buildSdkTopicInfo());

        await service.getTopicInfo("0.0.1");
        await service.getTopicInfo("0.0.2");

        expect(vi.mocked(SdkTopicInfoQuery)).toHaveBeenCalledTimes(2);
    });
});
