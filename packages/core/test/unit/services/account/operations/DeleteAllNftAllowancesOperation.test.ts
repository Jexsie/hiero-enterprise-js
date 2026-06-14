import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    PrivateKey,
    TokenId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["deleteTokenNftAllowanceAllSerials"]);
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

describe("DeleteAllNftAllowancesOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new AccountService(context);
    });

    it("revokes approve-for-all-serials with correct SDK arguments", async () => {
        await service.deleteAllNftAllowances([
            {
                tokenId: "0.0.600",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.200",
            },
        ]);

        const tx = vi.mocked(AccountAllowanceApproveTransaction).mock.results[0]
            .value;
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledTimes(1);
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
            TokenId.fromString("0.0.600"),
            "0.0.100",
            "0.0.200",
        );
    });

    it("handles multiple approve-for-all-serials revocations", async () => {
        await service.deleteAllNftAllowances([
            {
                tokenId: "0.0.600",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.200",
            },
            {
                tokenId: "0.0.700",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.300",
            },
        ]);

        const tx = vi.mocked(AccountAllowanceApproveTransaction).mock.results[0]
            .value;
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledTimes(2);
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
            TokenId.fromString("0.0.600"),
            "0.0.100",
            "0.0.200",
        );
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
            TokenId.fromString("0.0.700"),
            "0.0.100",
            "0.0.300",
        );
    });

    it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
        const ownerKey = PrivateKey.generateED25519();
        await service.deleteAllNftAllowances(
            [
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ],
            { additionalSigners: [ownerKey] },
        );

        const tx = vi.mocked(AccountAllowanceApproveTransaction).mock.results[0]
            .value;
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(ownerKey);
    });

    it("rejects when tokenId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]),
        ).rejects.toThrow(/tokenId is required/);
    });

    it("rejects when ownerAccountId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "",
                    spenderAccountId: "0.0.200",
                },
            ]),
        ).rejects.toThrow(/ownerAccountId is required/);
    });

    it("rejects when spenderAccountId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "",
                },
            ]),
        ).rejects.toThrow(/spenderAccountId is required/);
    });
});
