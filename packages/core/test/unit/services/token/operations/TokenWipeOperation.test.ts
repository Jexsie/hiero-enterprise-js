import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenWipeTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setTokenId",
        "setAccountId",
        "setAmount",
        "setSerials",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenWipeTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenWipeOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("wipes fungible supply from an account", async () => {
        await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            amount: 1_000,
        });

        const tx = vi.mocked(TokenWipeTransaction).mock.results[0].value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setAccountId).toHaveBeenCalledWith("0.0.700");
        expect(tx.setAmount).toHaveBeenCalledWith(1_000);
        expect(tx.setSerials).not.toHaveBeenCalled();
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("wipes NFT serials from an account", async () => {
        await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            serials: [1, 2, 3],
        });

        const tx = vi.mocked(TokenWipeTransaction).mock.results[0].value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setAccountId).toHaveBeenCalledWith("0.0.700");
        expect(tx.setSerials).toHaveBeenCalledWith([1, 2, 3]);
        expect(tx.setAmount).not.toHaveBeenCalled();
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            amount: 5,
            transactionMemo: "wipe memo",
            transactionValidDuration: 120,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenWipeTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("wipe memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(120);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("returns the new total supply from the receipt", async () => {
        const totalSupply = await service.wipeToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            amount: 10,
        });

        expect(totalSupply).toBe(mocks.receipt.totalSupply);
    });

    it("throws when the receipt is missing totalSupply", async () => {
        mocks.response.getReceipt.mockResolvedValueOnce({
            ...mocks.receipt,
            totalSupply: null,
        });

        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "0.0.700",
                amount: 10,
            }),
        ).rejects.toThrow(/TokenWipe receipt did not include totalSupply/);
    });

    it("throws when both amount and serials are missing", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "0.0.700",
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
    });

    it("throws when both amount and serials are provided", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "0.0.700",
                amount: 100,
                serials: [1],
            }),
        ).rejects.toThrow(/requires either amount \(fungible\) or serials/i);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.wipeToken({
                tokenId: "",
                accountId: "0.0.700",
                amount: 1,
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: "",
                amount: 1,
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
    });

    it("throws when accountId is missing", async () => {
        await expect(
            service.wipeToken({
                tokenId: "0.0.500",
                accountId: undefined as unknown as string,
                amount: 1,
            }),
        ).rejects.toThrow(/accountId is required/i);
    });
});
