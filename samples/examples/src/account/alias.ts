/**
 * Create Account — with EVM alias.
 *
 * Demonstrates the different alias strategies:
 *
 * 1. Single-key alias: ECDSA key derives both the account key and EVM alias
 * 2. Two-key alias: ED25519 controls the account, separate ECDSA key provides the alias
 *
 * Aliases are immutable once set. The derived EVM address (0x...) can be used
 * in Solidity contracts and EVM tooling (MetaMask, Hardhat, etc.).
 *
 * Run: pnpm tsx src/account/alias.ts
 */

import {
    AccountService,
    AccountType,
    HieroContext,
    PrivateKey,
    Hbar,
} from "@hiero-enterprise/core";

async function main() {
    if (
        process.env["HIERO_OPERATOR_ID"] == null ||
        process.env["HIERO_OPERATOR_KEY"] == null
    ) {
        throw new Error(
            "Environment variables HIERO_OPERATOR_ID and HIERO_OPERATOR_KEY are required.",
        );
    }

    const context = new HieroContext({
        network: process.env["HIERO_NETWORK"] ?? "testnet",
        operatorId: process.env["HIERO_OPERATOR_ID"],
        operatorKey: process.env["HIERO_OPERATOR_KEY"],
        operatorKeyType: process.env["HIERO_OPERATOR_KEY_TYPE"] ?? "ed25519",
        mirrorNodeUrl: process.env["HIERO_MIRROR_NODE_URL"],
    });

    const accountService = new AccountService(context);

    // Pattern 1: Single ECDSA key with alias
    // The same ECDSA key controls the account AND derives the EVM alias.
    // Simplest path for EVM-compatible accounts.
    const ecdsaKey = PrivateKey.generateECDSA();

    const aliasAccount = await accountService.createAccount({
        publicKey: ecdsaKey.publicKey.toStringRaw(),
        keyType: AccountType.ECDSA,
        alias: true, // derive EVM alias from this ECDSA key
        initialBalance: new Hbar(1),
        memo: "ECDSA account with alias",
    });

    console.log("1. Single-key alias");
    console.log("   Account ID:", aliasAccount.accountId);
    console.log("   EVM address:", aliasAccount.evmAddress);

    // Pattern 2: Two-key alias
    // An ED25519 key controls the account (for Hedera-native signing),
    // while a separate ECDSA key provides the EVM alias.
    // Use this when you want the security properties of ED25519 but still
    // need an EVM address for smart contract interaction.
    const controlKey = PrivateKey.generateED25519();
    const aliasKey = PrivateKey.generateECDSA();

    const twoKeyAccount = await accountService.createAccount({
        publicKey: controlKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        alias: { ecdsaPublicKey: aliasKey.publicKey.toStringRaw() },
        initialBalance: new Hbar(1),
        memo: "ED25519 account with ECDSA alias",
    });

    console.log("\n2. Two-key alias");
    console.log("   Account ID:", twoKeyAccount.accountId);
    console.log("   EVM address:", twoKeyAccount.evmAddress);
    console.log(
        "   Control key (ED25519):",
        controlKey.publicKey.toStringRaw(),
    );
    console.log("   Alias key (ECDSA):", aliasKey.publicKey.toStringRaw());

    context.client.close();
}

void main();
