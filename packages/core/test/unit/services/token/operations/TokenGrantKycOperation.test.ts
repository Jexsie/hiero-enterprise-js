import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenGrantKycTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setTokenId", "setAccountId"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenGrantKycTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenGrantKycOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("grants KYC on a token relationship to an account", async () => {
        await service.grantKycToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
        });

        const tx = vi.mocked(TokenGrantKycTransaction).mock.results[0].value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setAccountId).toHaveBeenCalledWith("0.0.700");
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.grantKycToken({
            tokenId: "0.0.500",
            accountId: "0.0.700",
            transactionMemo: "grant kyc memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenGrantKycTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("grant kyc memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.grantKycToken({
                tokenId: "",
                accountId: "0.0.700",
            }),
        ).rejects.toThrow(/tokenId cannot be empty/i);
    });

    it("throws when accountId is empty", async () => {
        await expect(
            service.grantKycToken({
                tokenId: "0.0.500",
                accountId: "",
            }),
        ).rejects.toThrow(/accountId cannot be empty/i);
    });
});
