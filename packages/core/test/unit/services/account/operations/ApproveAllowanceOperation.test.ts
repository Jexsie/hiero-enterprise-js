import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    PrivateKey,
    Hbar,
    TokenId,
    NftId,
    AccountId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "approveHbarAllowance",
        "approveTokenAllowance",
        "approveTokenNftAllowance",
        "approveTokenNftAllowanceAllSerials",
        "approveTokenNftAllowanceWithDelegatingSpender",
        "deleteTokenNftAllowanceAllSerials",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccountAllowanceApproveTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("ApproveAllowanceOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new AccountService(context);
    });

    describe("approveHbarAllowance", () => {
        it("approves an HBAR allowance with correct SDK arguments", async () => {
            await service.approveHbarAllowance({
                hbarAllowances: [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 10,
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.200",
                new Hbar(10),
            );
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("freezes and signs with additionalSigners", async () => {
            const ownerKey = PrivateKey.generateED25519();

            await service.approveHbarAllowance({
                hbarAllowances: [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 5,
                    },
                ],
                additionalSigners: [ownerKey],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(ownerKey);
        });
    });

    describe("approveTokenAllowance", () => {
        it("approves a fungible token allowance with correct SDK arguments", async () => {
            await service.approveTokenAllowance({
                tokenAllowances: [
                    {
                        tokenId: "0.0.500",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 5000,
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.500",
                "0.0.100",
                "0.0.200",
                BigInt(5000),
            );
        });
    });

    describe("approveNftAllowance", () => {
        it("approves NFT allowance with correct SDK arguments per serial", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        serialNumbers: [1, 2, 3],
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledTimes(3);
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
                "0.0.200",
            );
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 2),
                "0.0.100",
                "0.0.200",
            );
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 3),
                "0.0.100",
                "0.0.200",
            );
        });

        it("approves NFT allowance for all serials with correct SDK arguments", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        allSerials: true,
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
                TokenId.fromString("0.0.600"),
                "0.0.100",
                "0.0.200",
            );
        });

        it("calls approveTokenNftAllowanceWithDelegatingSpender with correct SDK arguments", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        serialNumbers: [1, 2],
                        delegatingSpender: "0.0.300",
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).toHaveBeenCalledTimes(2);
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
                AccountId.fromString("0.0.200"),
                "0.0.300",
            );
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 2),
                "0.0.100",
                AccountId.fromString("0.0.200"),
                "0.0.300",
            );
            expect(tx.approveTokenNftAllowance).not.toHaveBeenCalled();
        });

        it("ignores delegatingSpender when allSerials is true", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        allSerials: true,
                        delegatingSpender: "0.0.300",
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenNftAllowanceAllSerials).toHaveBeenCalled();
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).not.toHaveBeenCalled();
        });
    });
});
