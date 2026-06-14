import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    AccountAllowanceDeleteTransaction,
    PrivateKey,
    Hbar,
    TokenId,
    NftId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Covers `deleteHbarAllowance` + `deleteTokenAllowance` (both go through the
// approve-with-amount=0 trick on `AccountAllowanceApproveTransaction`) and
// `deleteNftAllowance` (per-serial revocation on
// `AccountAllowanceDeleteTransaction`). Both SDK classes resolve to the same
// mock `tx` since their assertion lookups go through
// `vi.mocked(Class).mock.results[0].value`.

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "approveHbarAllowance",
        "approveTokenAllowance",
        "deleteAllTokenNftAllowances",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccountAllowanceApproveTransaction: vi.fn(function () {
            return mocks.tx;
        }),
        AccountAllowanceDeleteTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("DeleteAllowanceOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new AccountService(context);
    });

    describe("deleteHbarAllowance", () => {
        it("revokes HBAR allowance by approving with amount=0", async () => {
            await service.deleteHbarAllowance([
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveHbarAllowance).toHaveBeenCalledTimes(1);
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.200",
                new Hbar(0),
            );
        });

        it("handles multiple HBAR allowance deletions", async () => {
            await service.deleteHbarAllowance([
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.300",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveHbarAllowance).toHaveBeenCalledTimes(2);
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.200",
                new Hbar(0),
            );
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.300",
                new Hbar(0),
            );
        });

        it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
            const ownerKey = PrivateKey.generateED25519();
            await service.deleteHbarAllowance(
                [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                    },
                ],
                { additionalSigners: [ownerKey] },
            );

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(ownerKey);
        });
    });

    describe("deleteTokenAllowance", () => {
        it("revokes fungible token allowance by approving with amount=0", async () => {
            await service.deleteTokenAllowance([
                {
                    tokenId: "0.0.500",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenAllowance).toHaveBeenCalledTimes(1);
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.500",
                "0.0.100",
                "0.0.200",
                BigInt(0),
            );
        });

        it("handles multiple token allowance deletions for different tokens", async () => {
            await service.deleteTokenAllowance([
                {
                    tokenId: "0.0.500",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
                {
                    tokenId: "0.0.501",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.300",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenAllowance).toHaveBeenCalledTimes(2);
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.500",
                "0.0.100",
                "0.0.200",
                BigInt(0),
            );
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.501",
                "0.0.100",
                "0.0.300",
                BigInt(0),
            );
        });

        it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
            const ownerKey = PrivateKey.generateED25519();
            await service.deleteTokenAllowance(
                [
                    {
                        tokenId: "0.0.500",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                    },
                ],
                { additionalSigners: [ownerKey] },
            );

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(ownerKey);
        });
    });

    describe("deleteNftAllowance", () => {
        it("deletes NFT allowance with correct SDK arguments per serial", async () => {
            await service.deleteNftAllowance([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [1, 2, 3],
                },
            ]);

            const tx = vi.mocked(AccountAllowanceDeleteTransaction).mock
                .results[0].value;
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledTimes(3);
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 2),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 3),
                "0.0.100",
            );
        });

        it("handles multiple NFT allowance deletions for different tokens", async () => {
            await service.deleteNftAllowance([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [1],
                },
                {
                    tokenId: "0.0.700",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [5, 6],
                },
            ]);

            const tx = vi.mocked(AccountAllowanceDeleteTransaction).mock
                .results[0].value;
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledTimes(3);
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.700"), 5),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.700"), 6),
                "0.0.100",
            );
        });

        it("rejects when tokenId is missing", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [1],
                    },
                ]),
            ).rejects.toThrow(/tokenId is required/);
        });

        it("rejects when ownerAccountId is missing", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "",
                        serialNumbers: [1],
                    },
                ]),
            ).rejects.toThrow(/ownerAccountId is required/);
        });

        it("rejects when serialNumbers is empty", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [],
                    },
                ]),
            ).rejects.toThrow(/serialNumbers must contain at least one entry/);
        });

        it("rejects with invalid serial numbers", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [0],
                    },
                ]),
            ).rejects.toThrow(/positive integers/);

            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [-1],
                    },
                ]),
            ).rejects.toThrow(/positive integers/);

            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [1.5],
                    },
                ]),
            ).rejects.toThrow(/positive integers/);
        });
    });
});
