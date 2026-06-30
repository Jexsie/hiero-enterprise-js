import type { ContractId } from "@hiero-ledger/sdk";
import { ContractByteCodeQuery as SdkContractByteCodeQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Fetch the deployed runtime bytecode for a contract.
 *
 * Returns the raw bytes (not hex-encoded). Useful for proxy detection,
 * implementation comparison, or off-chain verification against a known
 * source build.
 */
export class ContractBytecodeQuery {
    constructor(private readonly context: IHieroContext) {}

    async execute(contractId: string | ContractId): Promise<Uint8Array> {
        try {
            return await new SdkContractByteCodeQuery()
                .setContractId(contractId)
                .execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, "ContractService.getContractBytecode");
        }
    }
}
