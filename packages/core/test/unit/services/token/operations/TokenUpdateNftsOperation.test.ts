import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    TokenUpdateNftsTransaction,
    PrivateKey,
    Long,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setTokenId", "setSerialNumbers", "setMetadata"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenUpdateNftsTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenUpdateNftsOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("submits with a single numeric serial coerced to Long", async () => {
        const metadata = new Uint8Array([1, 2, 3]);

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: [7],
            metadata,
        });

        const tx = vi.mocked(TokenUpdateNftsTransaction).mock.results[0].value;

        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setMetadata).toHaveBeenCalledWith(metadata);

        const passedSerials = tx.setSerialNumbers.mock.calls[0][0];
        expect(Array.isArray(passedSerials)).toBe(true);
        expect(passedSerials).toHaveLength(1);
        expect(Long.isLong(passedSerials[0])).toBe(true);
        expect((passedSerials[0] as Long).toNumber()).toBe(7);

        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("passes Long serials through unchanged", async () => {
        const serials = [Long.fromNumber(1), Long.fromNumber(2)];

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: serials,
            metadata: new Uint8Array([9]),
        });

        const tx = vi.mocked(TokenUpdateNftsTransaction).mock.results[0].value;
        const passedSerials = tx.setSerialNumbers.mock.calls[0][0] as Long[];

        expect(passedSerials).toHaveLength(2);
        expect(passedSerials[0]).toBe(serials[0]);
        expect(passedSerials[1]).toBe(serials[1]);
    });

    it("supports a mixed array of numbers and Long instances", async () => {
        const longSerial = Long.fromNumber(42);

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: [1, longSerial, 3],
            metadata: new Uint8Array([1]),
        });

        const tx = vi.mocked(TokenUpdateNftsTransaction).mock.results[0].value;
        const passedSerials = tx.setSerialNumbers.mock.calls[0][0] as Long[];

        expect(passedSerials).toHaveLength(3);
        expect(Long.isLong(passedSerials[0])).toBe(true);
        expect(passedSerials[0].toNumber()).toBe(1);
        expect(passedSerials[1]).toBe(longSerial);
        expect(Long.isLong(passedSerials[2])).toBe(true);
        expect(passedSerials[2].toNumber()).toBe(3);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const metadataSigner = PrivateKey.generateED25519();

        await service.updateNfts({
            tokenId: "0.0.500",
            serialNumbers: [1],
            metadata: new Uint8Array([1]),
            transactionMemo: "rotate metadata",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [metadataSigner],
        });

        const tx = vi.mocked(TokenUpdateNftsTransaction).mock.results[0].value;

        expect(tx.setTransactionMemo).toHaveBeenCalledWith("rotate metadata");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(metadataSigner);
    });

    it("throws and never constructs the transaction when serialNumbers is empty", async () => {
        await expect(
            service.updateNfts({
                tokenId: "0.0.500",
                serialNumbers: [],
                metadata: new Uint8Array([1]),
            }),
        ).rejects.toThrow(/serialNumbers must not be empty/);

        expect(TokenUpdateNftsTransaction).not.toHaveBeenCalled();
    });

    it("throws and never constructs the transaction when metadata is missing", async () => {
        await expect(
            service.updateNfts({
                tokenId: "0.0.500",
                serialNumbers: [1],
                metadata: undefined as unknown as Uint8Array,
            }),
        ).rejects.toThrow(/metadata is required/);

        expect(TokenUpdateNftsTransaction).not.toHaveBeenCalled();
    });
});
