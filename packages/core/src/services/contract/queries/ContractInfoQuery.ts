import type { ContractId, ContractInfo } from "@hiero-ledger/sdk";
import { ContractInfoQuery as SdkContractInfoQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Fetch the on-chain `ContractInfo` for a deployed contract.
 *
 * Returns the SDK's `ContractInfo` directly: admin key, memo, balance,
 * expiration, auto-renew configuration, staking metadata, token
 * relationships, and `isDeleted` flag.
 */
export class ContractInfoQuery {
    constructor(private readonly context: IHieroContext) {}

    async execute(contractId: string | ContractId): Promise<ContractInfo> {
        try {
            return await new SdkContractInfoQuery()
                .setContractId(contractId)
                .execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, "ContractService.getContractInfo");
        }
    }
}
