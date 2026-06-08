import { describe, it, expect } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { HieroContext } from "../../src/context/hiero-context.js";
import { OperatorKeyType } from "../../src/types/index.js";

/**
 * Integration tests verifying that each key type is loaded correctly
 * and produces valid signatures that can be verified with the derived public key.
 *
 * These tests use real SDK key material (no mocks) to ensure end-to-end correctness.
 */
describe("Key Type Parsing [Integration]", () => {
    const message = new Uint8Array([0x48, 0x69, 0x65, 0x72, 0x6f]); // "Hiero"

    describe("ED25519", () => {
        const ed25519Key = PrivateKey.generateED25519();

        it("loads an ED25519 key and derives the correct public key", () => {
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ed25519Key.toStringRaw(),
                operatorKeyType: OperatorKeyType.ED25519,
            });

            expect(ctx.operatorPublicKey.toString()).toBe(
                ed25519Key.publicKey.toString(),
            );
        });

        it("signs and verifies with ED25519 key", () => {
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ed25519Key.toStringRaw(),
                operatorKeyType: OperatorKeyType.ED25519,
            });

            const signature = ed25519Key.sign(message);
            const verified = ctx.operatorPublicKey.verify(message, signature);
            expect(verified).toBe(true);
        });

        it("loads an ED25519 key from DER encoding", () => {
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ed25519Key.toStringDer(),
                operatorKeyType: OperatorKeyType.DER,
            });

            expect(ctx.operatorPublicKey.toString()).toBe(
                ed25519Key.publicKey.toString(),
            );
        });
    });

    describe("ECDSA", () => {
        const ecdsaKey = PrivateKey.generateECDSA();

        it("loads an ECDSA key and derives the correct public key", () => {
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ecdsaKey.toStringRaw(),
                operatorKeyType: OperatorKeyType.ECDSA,
            });

            expect(ctx.operatorPublicKey.toString()).toBe(
                ecdsaKey.publicKey.toString(),
            );
        });

        it("signs and verifies with ECDSA key", () => {
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ecdsaKey.toStringRaw(),
                operatorKeyType: OperatorKeyType.ECDSA,
            });

            const signature = ecdsaKey.sign(message);
            const verified = ctx.operatorPublicKey.verify(message, signature);
            expect(verified).toBe(true);
        });

        it("loads an ECDSA key from DER encoding", () => {
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ecdsaKey.toStringDer(),
                operatorKeyType: OperatorKeyType.DER,
            });

            expect(ctx.operatorPublicKey.toString()).toBe(
                ecdsaKey.publicKey.toString(),
            );
        });
    });

    describe("Error cases", () => {
        it("produces wrong public key when ECDSA key is loaded as ED25519", () => {
            const ecdsaKey = PrivateKey.generateECDSA();
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ecdsaKey.toStringRaw(),
                operatorKeyType: OperatorKeyType.ED25519,
            });

            // The derived public key will NOT match the original ECDSA public key
            expect(ctx.operatorPublicKey.toString()).not.toBe(
                ecdsaKey.publicKey.toString(),
            );

            // Signature verification fails with the wrong key interpretation
            const signature = ecdsaKey.sign(message);
            const verified = ctx.operatorPublicKey.verify(message, signature);
            expect(verified).toBe(false);
        });

        it("produces wrong public key when ED25519 key is loaded as ECDSA", () => {
            const ed25519Key = PrivateKey.generateED25519();
            const ctx = new HieroContext({
                network: "testnet",
                operatorId: "0.0.1000",
                operatorKey: ed25519Key.toStringRaw(),
                operatorKeyType: OperatorKeyType.ECDSA,
            });

            // The derived public key will NOT match the original ED25519 public key
            expect(ctx.operatorPublicKey.toString()).not.toBe(
                ed25519Key.publicKey.toString(),
            );

            // Signature verification fails with the wrong key interpretation
            const signature = ed25519Key.sign(message);
            const verified = ctx.operatorPublicKey.verify(message, signature);
            expect(verified).toBe(false);
        });

        it("throws for garbage key material", () => {
            expect(
                () =>
                    new HieroContext({
                        network: "testnet",
                        operatorId: "0.0.1000",
                        operatorKey: "definitely-not-a-valid-key",
                        operatorKeyType: OperatorKeyType.ECDSA,
                    }),
            ).toThrow(/Invalid operator key/);
        });
    });
});
