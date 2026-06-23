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

    it("airdrops a single entry with a negated sender entry and positive receiver entry", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                    amount: 100,
                },
            ],
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

    it("batches multiple airdrops across tokens, senders, and receivers in one transaction", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.801",
                    amount: 10,
                },
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.802",
                    amount: 20,
                },
                {
                    tokenId: "0.0.600",
                    senderAccountId: "0.0.701",
                    receiverAccountId: "0.0.803",
                    amount: 30,
                },
            ],
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;
        const calls = tx.addTokenTransfer.mock.calls as Array<
            [string, string, Long]
        >;

        // 3 airdrops × 2 entries (sender + receiver) = 6 calls
        expect(calls).toHaveLength(6);

        expect(calls[0]).toEqual([
            "0.0.500",
            "0.0.700",
            expect.objectContaining({}),
        ]);
        expect(calls[0][2].toString()).toBe("-10");
        expect(calls[1][1]).toBe("0.0.801");
        expect(calls[1][2].toString()).toBe("10");

        expect(calls[2][1]).toBe("0.0.700");
        expect(calls[2][2].toString()).toBe("-20");
        expect(calls[3][1]).toBe("0.0.802");
        expect(calls[3][2].toString()).toBe("20");

        expect(calls[4][0]).toBe("0.0.600");
        expect(calls[4][1]).toBe("0.0.701");
        expect(calls[4][2].toString()).toBe("-30");
        expect(calls[5][0]).toBe("0.0.600");
        expect(calls[5][1]).toBe("0.0.803");
        expect(calls[5][2].toString()).toBe("30");

        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("uses addTokenTransferWithDecimals when expectedDecimals is provided", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                    amount: 250,
                    expectedDecimals: 2,
                },
            ],
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

    it("mixes plain and decimals-checked airdrops in a single batch", async () => {
        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.801",
                    amount: 5,
                },
                {
                    tokenId: "0.0.600",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.802",
                    amount: 6,
                    expectedDecimals: 3,
                },
            ],
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;
        expect(tx.addTokenTransfer.mock.calls).toHaveLength(2);
        expect(tx.addTokenTransferWithDecimals.mock.calls).toHaveLength(2);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                    amount: 5,
                },
            ],
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

    it("throws when airdrops is empty", async () => {
        await expect(
            service.airdropFungibleToken({ airdrops: [] }),
        ).rejects.toThrow(/airdrops must not be empty/);
    });

    it("throws when an airdrop's tokenId is empty", async () => {
        await expect(
            service.airdropFungibleToken({
                airdrops: [
                    {
                        tokenId: "",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.800",
                        amount: 1,
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[0\]\.tokenId cannot be empty/);
    });

    it("throws when an airdrop's sender and receiver are the same account", async () => {
        await expect(
            service.airdropFungibleToken({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.700",
                        amount: 1,
                    },
                ],
            }),
        ).rejects.toThrow(
            /airdrops\[0\]: senderAccountId and receiverAccountId must be different/,
        );
    });

    it("includes the offending airdrop index in the error message", async () => {
        await expect(
            service.airdropFungibleToken({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.801",
                        amount: 5,
                    },
                    {
                        tokenId: "0.0.500",
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.802",
                        amount: 0,
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[1\]\.amount must be a positive value/);
    });
});
