import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenBurnTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setTokenId", "setAmount", "setSerials"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenBurnTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenBurnOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        // Ensure the mock receipt carries a `totalSupply` so burn's
        // extractor doesn't throw.
        mocks.receipt.totalSupply = { toString: () => "1000" };
        mocks.response.getReceipt.mockResolvedValue(mocks.receipt);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("burns fungible supply with amount", async () => {
        await service.burnToken({
            tokenId: "0.0.500",
            amount: 1_000,
        });

        const tx = vi.mocked(TokenBurnTransaction).mock.results[0].value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setAmount).toHaveBeenCalledWith(1_000);
        expect(tx.setSerials).not.toHaveBeenCalled();
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("burns NFT serials", async () => {
        await service.burnToken({
            tokenId: "0.0.500",
            serials: [1, 2, 3],
        });

        const tx = vi.mocked(TokenBurnTransaction).mock.results[0].value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setSerials).toHaveBeenCalledWith([1, 2, 3]);
        expect(tx.setAmount).not.toHaveBeenCalled();
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.burnToken({
            tokenId: "0.0.500",
            amount: 5,
            transactionMemo: "burn memo",
            transactionValidDuration: 120,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenBurnTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("burn memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(120);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("wraps burn in ScheduleCreateTransaction", async () => {
        const result = await service.scheduleBurnToken(
            {
                tokenId: "0.0.500",
                amount: 10,
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

    it("returns the new total supply from the receipt", async () => {
        const totalSupply = await service.burnToken({
            tokenId: "0.0.500",
            amount: 10,
        });

        expect(totalSupply).toBe(mocks.receipt.totalSupply);
    });

    it("throws when both amount and serials are missing", async () => {
        await expect(
            service.burnToken({
                tokenId: "0.0.500",
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
    });

    it("throws when both amount and serials are provided", async () => {
        await expect(
            service.burnToken({
                tokenId: "0.0.500",
                amount: 100,
                serials: [1],
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.burnToken({
                tokenId: "",
                amount: 1,
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });
});
