import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenDissociateTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setAccountId", "setTokenIds"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenDissociateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenDissociateOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("dissociates a single token from an account", async () => {
        await service.dissociateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500"],
        });

        const tx = vi.mocked(TokenDissociateTransaction).mock.results[0].value;
        expect(tx.setAccountId).toHaveBeenCalledWith("0.0.700");
        expect(tx.setTokenIds).toHaveBeenCalledWith(["0.0.500"]);
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("dissociates multiple tokens in a single transaction", async () => {
        await service.dissociateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500", "0.0.501", "0.0.502"],
        });

        const tx = vi.mocked(TokenDissociateTransaction).mock.results[0].value;
        expect(tx.setTokenIds).toHaveBeenCalledWith([
            "0.0.500",
            "0.0.501",
            "0.0.502",
        ]);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.dissociateToken({
            accountId: "0.0.700",
            tokenIds: ["0.0.500"],
            transactionMemo: "dissociate memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenDissociateTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("dissociate memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("wraps dissociation in ScheduleCreateTransaction", async () => {
        const result = await service.scheduleDissociateToken(
            {
                accountId: "0.0.700",
                tokenIds: ["0.0.500"],
            },
            { scheduleMemo: "pending approval" },
        );

        expect(mocks.tx.schedule).toHaveBeenCalled();
        expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
            "pending approval",
        );
        expect(result.scheduleId).toBe("0.0.777");
        expect(result.transactionId).toBeDefined();
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.dissociateToken({
                accountId: "",
                tokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
    });

    it("throws when tokenIds is missing", async () => {
        await expect(
            service.dissociateToken({
                accountId: "0.0.700",
                tokenIds: undefined as unknown as string[],
            }),
        ).rejects.toThrow(/tokenIds is required/i);
    });

    it("throws when tokenIds is empty", async () => {
        await expect(
            service.dissociateToken({
                accountId: "0.0.700",
                tokenIds: [],
            }),
        ).rejects.toThrow(/tokenIds must contain at least one token id/i);
    });

    it("validates before scheduling", async () => {
        await expect(
            service.scheduleDissociateToken({
                accountId: "",
                tokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
    });
});
