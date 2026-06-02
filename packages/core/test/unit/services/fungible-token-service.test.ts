import { describe, it, expect, vi, beforeEach } from "vitest";
import { FungibleTokenService } from "../../../src/services/fungible-token-service.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { IHieroContext } from "../../../src/context/index.js";
import {
    TokenCreateTransaction,
    TokenType,
    TokenAssociateTransaction,
    TokenDissociateTransaction,
    TokenMintTransaction,
    TokenBurnTransaction,
    TransferTransaction,
    PrivateKey,
} from "@hiero-ledger/sdk";

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    const mockTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setMaxSupply: vi.fn().mockReturnThis(),
        setTokenMemo: vi.fn().mockReturnThis(),
        setAccountId: vi.fn().mockReturnThis(),
        setTokenIds: vi.fn().mockReturnThis(),
        setTokenId: vi.fn().mockReturnThis(),
        setAmount: vi.fn().mockReturnThis(),
        addTokenTransfer: vi.fn().mockReturnThis(),
        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: { toString: () => "0.0.123@1234567890" },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    tokenId: { toString: () => "0.0.999" },
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                tokenId: { toString: () => "0.0.999" },
            }),
        }),
    };

    return {
        ...actual,
        TokenCreateTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TokenAssociateTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TokenDissociateTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TokenMintTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TokenBurnTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
        TransferTransaction: vi.fn(function () {
            return { ...mockTx };
        }),
    };
});

describe("FungibleTokenService", () => {
    let context: IHieroContext;
    let client: FungibleTokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        client = new FungibleTokenService(context);
    });

    describe("createToken", () => {
        it("creates a token with default options", async () => {
            const tokenId = await client.createToken({
                name: "Test Token",
                symbol: "TST",
                treasuryAccountId: context.operatorAccountId,
                treasuryKey: PrivateKey.generateED25519(),
            });

            expect(tokenId).toBe("0.0.999");

            const txMock = vi.mocked(TokenCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setTokenName).toHaveBeenCalledWith("Test Token");
            expect(txMock.setTokenSymbol).toHaveBeenCalledWith("TST");
            expect(txMock.setTokenType).toHaveBeenCalledWith(
                TokenType.FungibleCommon,
            );
            expect(txMock.setDecimals).toHaveBeenCalledWith(0);
            expect(txMock.setTreasuryAccountId).toHaveBeenCalledWith(
                context.operatorAccountId,
            );
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });

        it("creates a token with custom options", async () => {
            await client.createToken({
                name: "Custom",
                symbol: "CST",
                decimals: 2,
                initialSupply: 1000,
                maxSupply: 5000,
                memo: "the memo",
                treasuryAccountId: "0.0.555",
                treasuryKey: PrivateKey.generateED25519(),
            });

            const txMock = vi.mocked(TokenCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setDecimals).toHaveBeenCalledWith(2);
            expect(txMock.setInitialSupply).toHaveBeenCalledWith(1000);
            expect(txMock.setMaxSupply).toHaveBeenCalledWith(5000);
            expect(txMock.setTokenMemo).toHaveBeenCalledWith("the memo");
            expect(txMock.setTreasuryAccountId).toHaveBeenCalledWith("0.0.555");
        });
    });

    describe("associateToken", () => {
        it("associates a token with an account", async () => {
            const dummyKey = PrivateKey.generateED25519();
            await client.associateToken("0.0.999", "0.0.555", dummyKey);

            const txMock = vi.mocked(TokenAssociateTransaction).mock.results[0]
                .value;
            expect(txMock.setAccountId).toHaveBeenCalledWith("0.0.555");
            expect(txMock.setTokenIds).toHaveBeenCalledWith(["0.0.999"]);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("dissociateToken", () => {
        it("dissociates a token from an account", async () => {
            const dummyKey = PrivateKey.generateED25519();
            await client.dissociateToken("0.0.999", "0.0.555", dummyKey);

            const txMock = vi.mocked(TokenDissociateTransaction).mock.results[0]
                .value;
            expect(txMock.setAccountId).toHaveBeenCalledWith("0.0.555");
            expect(txMock.setTokenIds).toHaveBeenCalledWith(["0.0.999"]);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("mintToken", () => {
        it("mints additional token supply", async () => {
            await client.mintToken(
                "0.0.999",
                500,
                PrivateKey.generateED25519(),
            );

            const txMock =
                vi.mocked(TokenMintTransaction).mock.results[0].value;
            expect(txMock.setTokenId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setAmount).toHaveBeenCalledWith(500);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("burnToken", () => {
        it("burns token supply", async () => {
            await client.burnToken(
                "0.0.999",
                100,
                PrivateKey.generateED25519(),
            );

            const txMock =
                vi.mocked(TokenBurnTransaction).mock.results[0].value;
            expect(txMock.setTokenId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setAmount).toHaveBeenCalledWith(100);
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });

    describe("transferToken", () => {
        it("transfers tokens between accounts", async () => {
            const dummyKey = PrivateKey.generateED25519();

            await client.transferToken(
                "0.0.999",
                "0.0.555",
                dummyKey,
                "0.0.2",
                100,
            );

            const txMock = vi.mocked(TransferTransaction).mock.results[0].value;
            expect(txMock.addTokenTransfer).toHaveBeenCalledWith(
                "0.0.999",
                "0.0.555",
                -100,
            );
            expect(txMock.addTokenTransfer).toHaveBeenCalledWith(
                "0.0.999",
                "0.0.2",
                100,
            );
            expect(txMock.freezeWith).toHaveBeenCalledWith(context.client);
            expect(txMock.sign).toHaveBeenCalled();
        });
    });
});
