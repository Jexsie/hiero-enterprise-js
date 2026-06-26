import type { PendingAirdropId } from "@hiero-ledger/sdk";
import { TokenCancelAirdropTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenCancelAirdropValidator } from "../validation/index.js";

/**
 * Low-level options for a `TokenCancelAirdropTransaction`.
 *
 * Cancels one or more previously-created pending airdrops, releasing the
 * sender's escrowed assets back to its available balance. A pending
 * airdrop exists whenever a `TokenAirdropTransaction` could not
 * immediately credit the receiver (receiver not associated and no
 * auto-association slots available, or receiver-sig-required).
 *
 * A single cancel transaction can mix fungible and NFT pending airdrops
 * freely — `PendingAirdropId` encodes both kinds (`tokenId` for
 * fungible, `nftId` for NFT) and the SDK transaction handles them
 * uniformly.
 *
 * **Signing:** each distinct sender named in the pending airdrops must
 * sign — supply their keys via `additionalSigners`. The operator pays
 * the transaction fee. (Contrast with `TokenClaimAirdropTransaction`,
 * which requires the receivers' signatures.)
 *
 * **Sources of `PendingAirdropId`:** instances can be constructed
 * directly, or discovered after the originating airdrop transaction via
 * the mirror node (`/api/v1/accounts/{id}/airdrops/outstanding`) or by
 * inspecting account state. Constructing them directly is cheaper when
 * the sender already knows `(senderId, receiverId, tokenId | nftId)`.
 *
 * Extends `TransactionOptions` for fees, validity window, and signers.
 * Note: `TokenCancelAirdrop` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenCancelAirdropOperationOptions extends TransactionOptions {
    pendingAirdropIds: PendingAirdropId[];
}

export class TokenCancelAirdropOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenCancelAirdropValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenCancelAirdropValidator();
    }

    /** Submit a `TokenCancelAirdropTransaction`. */
    async execute(options: TokenCancelAirdropOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenCancelAirdrop",
                serviceName: "TokenService",
                methodName: "cancelAirdrop",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private build(
        options: TokenCancelAirdropOperationOptions,
    ): TokenCancelAirdropTransaction {
        return new TokenCancelAirdropTransaction().setPendingAirdropIds(
            options.pendingAirdropIds,
        );
    }
}
