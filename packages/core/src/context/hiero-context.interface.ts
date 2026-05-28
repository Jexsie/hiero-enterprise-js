import type {
    Client,
    AccountId,
    PublicKey,
    Transaction,
} from "@hiero-ledger/sdk";
import type { TransactionEvent } from "../listeners/index.js";

/**
 * Public contract for the Hiero context that service clients depend on.
 *
 * This is implemented by the HieroContext class.
 */
export interface IHieroContext {
    /** The underlying Hiero SDK Client */
    readonly client: Client;

    /** The operator account ID */
    readonly operatorAccountId: AccountId;

    /** The operator's public key (safe to expose) */
    readonly operatorPublicKey: PublicKey;

    /** Sign a transaction with the operator key */
    signTransaction<T extends Transaction>(tx: T): Promise<T>;

    /** Emit a before-transaction event to all registered listeners */
    emitBeforeTransaction(event: TransactionEvent): Promise<void>;

    /** Emit an after-transaction event to all registered listeners */
    emitAfterTransaction(event: TransactionEvent): Promise<void>;
}
