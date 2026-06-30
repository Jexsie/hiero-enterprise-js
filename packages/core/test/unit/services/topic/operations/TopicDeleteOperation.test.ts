import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicDeleteTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TopicService } from "../../../../../src/services/topic/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setTopicId"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TopicDeleteTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TopicDeleteOperation (via TopicService)", () => {
    let context: IHieroContext;
    let service: TopicService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TopicService(context);
    });

    describe("deleteTopic", () => {
        it("submits a TopicDeleteTransaction with the provided topicId", async () => {
            const result = await service.deleteTopic({ topicId: "0.0.12345" });

            expect(result).toBeUndefined();

            const tx = vi.mocked(TopicDeleteTransaction).mock.results[0].value;
            expect(tx.setTopicId).toHaveBeenCalledWith("0.0.12345");
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.deleteTopic({
                topicId: "0.0.12345",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(TopicDeleteTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const adminKey = PrivateKey.generateED25519();

            await service.deleteTopic({
                topicId: "0.0.12345",
                additionalSigners: [adminKey],
            });

            const tx = vi.mocked(TopicDeleteTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(adminKey);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.deleteTopic(
                    {} as unknown as Parameters<typeof service.deleteTopic>[0],
                ),
            ).rejects.toThrow(/topicId is required/);

            expect(vi.mocked(TopicDeleteTransaction)).not.toHaveBeenCalled();
        });
    });
});
