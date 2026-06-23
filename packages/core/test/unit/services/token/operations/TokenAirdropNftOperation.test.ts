import { describe, it, expect, vi, beforeEach } from "vitest";
import { Long, PrivateKey, TokenAirdropTransaction } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["addNftTransfer"]);
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

describe("TokenAirdropNftOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("airdrops a single NFT serial from sender to receiver", async () => {
        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: 1,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                },
            ],
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;
        const calls = tx.addNftTransfer.mock.calls;

        expect(calls).toHaveLength(1);
        const [args] = calls as [[string, number, string, string]];
        expect(args[0]).toBe("0.0.500");
        expect(args[1]).toBe(1);
        expect(args[2]).toBe("0.0.700");
        expect(args[3]).toBe("0.0.800");

        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("batches multiple NFT airdrops across collections, senders, and receivers", async () => {
        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: 1,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.801",
                },
                {
                    tokenId: "0.0.500",
                    serial: 2,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.802",
                },
                {
                    tokenId: "0.0.600",
                    serial: 5,
                    senderAccountId: "0.0.701",
                    receiverAccountId: "0.0.803",
                },
            ],
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;
        const calls = tx.addNftTransfer.mock.calls as Array<
            [string, number, string, string]
        >;

        expect(calls).toHaveLength(3);
        expect(calls[0]).toEqual(["0.0.500", 1, "0.0.700", "0.0.801"]);
        expect(calls[1]).toEqual(["0.0.500", 2, "0.0.700", "0.0.802"]);
        expect(calls[2]).toEqual(["0.0.600", 5, "0.0.701", "0.0.803"]);

        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("accepts Long-valued serials", async () => {
        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: Long.fromNumber(7),
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                },
            ],
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;
        const [args] = tx.addNftTransfer.mock.calls as [
            [string, Long, string, string],
        ];
        expect(Long.isLong(args[1])).toBe(true);
        expect((args[1] as Long).toString()).toBe("7");
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.airdropNft({
            airdrops: [
                {
                    tokenId: "0.0.500",
                    serial: 1,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.800",
                },
            ],
            transactionMemo: "nft airdrop memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenAirdropTransaction).mock.results[0].value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("nft airdrop memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("throws when airdrops is empty", async () => {
        await expect(service.airdropNft({ airdrops: [] })).rejects.toThrow(
            /airdrops must not be empty/,
        );
    });

    it("throws when an airdrop's tokenId is empty", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "",
                        serial: 1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.800",
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[0\]\.tokenId cannot be empty/);
    });

    it("throws when an airdrop's serial is zero", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        serial: 0,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.800",
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[0\]\.serial must be a positive integer/);
    });

    it("throws when an airdrop's sender and receiver are the same account", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        serial: 1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.700",
                    },
                ],
            }),
        ).rejects.toThrow(
            /airdrops\[0\]: senderAccountId and receiverAccountId must be different/,
        );
    });

    it("includes the offending airdrop index in the error message", async () => {
        await expect(
            service.airdropNft({
                airdrops: [
                    {
                        tokenId: "0.0.500",
                        serial: 1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.801",
                    },
                    {
                        tokenId: "0.0.500",
                        serial: -1,
                        senderAccountId: "0.0.700",
                        receiverAccountId: "0.0.802",
                    },
                ],
            }),
        ).rejects.toThrow(/airdrops\[1\]\.serial must be a positive integer/);
    });
});
