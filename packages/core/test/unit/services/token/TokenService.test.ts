import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../src/services/token/index.js";
import { createMockContext } from "../../../utils/mock-context.js";
import { reattachMockChain } from "../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../src/context/index.js";

// The facade tests verify the contract the service guarantees on top of the
// operation: tokenType/decimals/initialSupply auto-injection and
// supplyType auto-resolution. SDK calls are inspected to confirm the
// translation happens before reaching the executor.

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } = await import("../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setTokenName",
        "setTokenSymbol",
        "setTreasuryAccountId",
        "setTokenType",
        "setDecimals",
        "setInitialSupply",
        "setSupplyKey",
        "setSupplyType",
        "setMaxSupply",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenCreateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenService [facade contract]", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    describe("createFungibleToken", () => {
        it("always sets tokenType to FungibleCommon", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setTokenType).toHaveBeenCalledWith(
                TokenType.FungibleCommon,
            );
        });

        it("auto-sets supplyType to Finite when maxSupply is provided", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                maxSupply: 5_000,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setSupplyType).toHaveBeenCalledWith(
                TokenSupplyType.Finite,
            );
        });

        it("preserves an explicit supplyType over auto-resolution", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                supplyType: TokenSupplyType.Infinite,
                maxSupply: 5_000,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setSupplyType).toHaveBeenCalledWith(
                TokenSupplyType.Infinite,
            );
        });

        it("leaves supplyType unset when neither maxSupply nor supplyType is given", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setSupplyType).not.toHaveBeenCalled();
        });
    });

    describe("createNft", () => {
        const supplyKey = PrivateKey.generateED25519().publicKey;

        it("always sets tokenType to NonFungibleUnique", async () => {
            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setTokenType).toHaveBeenCalledWith(
                TokenType.NonFungibleUnique,
            );
        });

        it("forces decimals and initialSupply to 0", async () => {
            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setDecimals).toHaveBeenCalledWith(0);
            expect(tx.setInitialSupply).toHaveBeenCalledWith(0);
        });

        it("auto-sets supplyType to Finite when maxSupply is provided", async () => {
            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
                maxSupply: 1_000,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setSupplyType).toHaveBeenCalledWith(
                TokenSupplyType.Finite,
            );
            expect(tx.setMaxSupply).toHaveBeenCalledWith(1_000);
        });

        it("requires supplyKey at the type level (validator confirms)", async () => {
            // Type-level: TS forbids omitting `supplyKey`. Runtime: validator
            // also throws if it's somehow missing.
            await expect(
                service.createNft({
                    tokenName: "Acme Art",
                    tokenSymbol: "ART",
                    treasuryAccountId: "0.0.555",
                    supplyKey: undefined as unknown as ReturnType<
                        typeof PrivateKey.generateED25519
                    >["publicKey"],
                }),
            ).rejects.toThrow(/Non-fungible tokens require a supplyKey/);
        });
    });
});
