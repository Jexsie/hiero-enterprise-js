import { describe, it, expect, vi, beforeEach } from "vitest";
import { Long, PrivateKey, TokenAirdropTransaction } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "addTokenTransfer",
        "addTokenTransferWithDecimals",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenAirdropTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenAirdropOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("airdrops fungible tokens with a negated sender entry and positive receiver entry", async () => {
        await service.airdropFungibleToken({
            tokenId: "0.0.500",
            senderAccountId: "0.0.700",
            receiverAccountId: "0.0.800",
            amount: 100,
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;

        const calls = tx.addTokenTransfer.mock.calls;
        expect(calls).toHaveLength(2);

        const [senderArgs, receiverArgs] = calls as [
            [string, string, Long],
            [string, string, Long],
        ];
        expect(senderArgs[0]).toBe("0.0.500");
        expect(senderArgs[1]).toBe("0.0.700");
        expect((senderArgs[2] as Long).toString()).toBe("-100");

        expect(receiverArgs[0]).toBe("0.0.500");
        expect(receiverArgs[1]).toBe("0.0.800");
        expect((receiverArgs[2] as Long).toString()).toBe("100");

        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("uses addTokenTransferWithDecimals when expectedDecimals is provided", async () => {
        await service.airdropFungibleToken({
            tokenId: "0.0.500",
            senderAccountId: "0.0.700",
            receiverAccountId: "0.0.800",
            amount: 250,
            expectedDecimals: 2,
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;

        expect(tx.addTokenTransfer).not.toHaveBeenCalled();
        const calls = tx.addTokenTransferWithDecimals.mock.calls;
        expect(calls).toHaveLength(2);

        const [senderArgs, receiverArgs] = calls as [
            [string, string, Long, number],
            [string, string, Long, number],
        ];
        expect(senderArgs[0]).toBe("0.0.500");
        expect(senderArgs[1]).toBe("0.0.700");
        expect((senderArgs[2] as Long).toString()).toBe("-250");
        expect(senderArgs[3]).toBe(2);

        expect(receiverArgs[1]).toBe("0.0.800");
        expect((receiverArgs[2] as Long).toString()).toBe("250");
        expect(receiverArgs[3]).toBe(2);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.airdropFungibleToken({
            tokenId: "0.0.500",
            senderAccountId: "0.0.700",
            receiverAccountId: "0.0.800",
            amount: 5,
            transactionMemo: "airdrop memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("airdrop memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.airdropFungibleToken({
                tokenId: "",
                senderAccountId: "0.0.700",
                receiverAccountId: "0.0.800",
                amount: 1,
            }),
        ).rejects.toThrow(/tokenId cannot be empty/);
    });

    it("throws when senderAccountId is missing", async () => {
        await expect(
            service.airdropFungibleToken({
                tokenId: "0.0.500",
                senderAccountId: undefined as unknown as string,
                receiverAccountId: "0.0.800",
                amount: 1,
            }),
        ).rejects.toThrow(/senderAccountId is required/);
    });

    it("throws when sender and receiver are the same account", async () => {
        await expect(
            service.airdropFungibleToken({
                tokenId: "0.0.500",
                senderAccountId: "0.0.700",
                receiverAccountId: "0.0.700",
                amount: 1,
            }),
        ).rejects.toThrow(
            /senderAccountId and receiverAccountId must be different/,
        );
    });

    it("throws when amount is zero", async () => {
        await expect(
            service.airdropFungibleToken({
                tokenId: "0.0.500",
                senderAccountId: "0.0.700",
                receiverAccountId: "0.0.800",
                amount: 0,
            }),
        ).rejects.toThrow(/amount must be a positive value/);
    });

    it("throws when expectedDecimals is negative", async () => {
        await expect(
            service.airdropFungibleToken({
                tokenId: "0.0.500",
                senderAccountId: "0.0.700",
                receiverAccountId: "0.0.800",
                amount: 1,
                expectedDecimals: -1,
            }),
        ).rejects.toThrow(/expectedDecimals must be a non-negative integer/);
    });
});
