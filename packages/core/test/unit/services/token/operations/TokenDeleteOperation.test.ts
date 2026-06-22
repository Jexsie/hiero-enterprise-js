import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenDeleteTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setTokenId"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenDeleteTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenDeleteOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("submits a deletion with tokenId", async () => {
        await service.deleteToken({ tokenId: "0.0.500" });

        const tx = vi.mocked(TokenDeleteTransaction).mock.results[0].value;

        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const adminSigner = PrivateKey.generateED25519();

        await service.deleteToken({
            tokenId: "0.0.500",
            transactionMemo: "delete memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [adminSigner],
        });

        const tx = vi.mocked(TokenDeleteTransaction).mock.results[0].value;

        expect(tx.setTransactionMemo).toHaveBeenCalledWith("delete memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(adminSigner);
    });

    it("wraps the deletion in a ScheduleCreateTransaction", async () => {
        const result = await service.scheduleDeleteToken(
            { tokenId: "0.0.500" },
            { scheduleMemo: "pending approval" },
        );

        expect(mocks.tx.schedule).toHaveBeenCalled();
        expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
            "pending approval",
        );
        expect(result.scheduleId).toBe("0.0.777");
        expect(result.transactionId).toBeDefined();
    });

    it("throws when tokenId is missing", async () => {
        await expect(
            service.deleteToken({
                tokenId: undefined as unknown as string,
            }),
        ).rejects.toThrow(/tokenId is required/);
    });

    it("throws when tokenId is empty", async () => {
        await expect(service.deleteToken({ tokenId: "" })).rejects.toThrow(
            /tokenId cannot be empty/,
        );
    });

    it("validates before scheduling", async () => {
        await expect(
            service.scheduleDeleteToken({
                tokenId: undefined as unknown as string,
            }),
        ).rejects.toThrow(/tokenId is required/);
    });
});
