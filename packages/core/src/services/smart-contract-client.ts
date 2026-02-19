import type { ContractFunctionParameters } from '@hashgraph/sdk';
import {
  ContractCreateTransaction,
  ContractCreateFlow,
  ContractExecuteTransaction,
  ContractDeleteTransaction,
  FileId,
  Hbar,
} from '@hashgraph/sdk';
import type { ContractCallResult } from '../data/index.js';
import type { HieroContext } from '../context/index.js';
import { normalizeError } from '../errors/index.js';

/**
 * Service for managing smart contracts on the Hiero network.
 * Maps to Java: com.openelements.hiero.base.SmartContractClient
 */
export class SmartContractClient {
  private readonly context: HieroContext;

  constructor(context: HieroContext) {
    this.context = context;
  }

  /**
   * Deploy a smart contract from an on-chain file containing bytecode.
   *
   * @param fileId - File ID containing the contract bytecode
   * @param gas - Gas limit for the constructor call (default: 100_000)
   * @param constructorParams - Optional constructor parameters
   * @returns The contract ID
   */
  async createContract(
    fileId: string,
    gas: number = 100_000,
    constructorParams?: ContractFunctionParameters,
  ): Promise<string> {
    try {
      const tx = new ContractCreateTransaction()
        .setBytecodeFileId(FileId.fromString(fileId))
        .setGas(gas);

      if (constructorParams) {
        tx.setConstructorParameters(constructorParams);
      }

      const response = await tx.execute(this.context.client);
      const receipt = await response.getReceipt(this.context.client);
      return receipt.contractId!.toString();
    } catch (error) {
      throw normalizeError(error, 'SmartContractClient.createContract');
    }
  }

  /**
   * Deploy a contract from raw bytecode.
   * Uses ContractCreateFlow which handles file creation automatically.
   *
   * @param bytecode - Contract bytecode (hex string or Uint8Array)
   * @param gas - Gas limit (default: 100_000)
   * @param constructorParams - Optional constructor parameters
   * @returns The contract ID
   */
  async createContractFromBytecode(
    bytecode: string | Uint8Array,
    gas: number = 100_000,
    constructorParams?: ContractFunctionParameters,
  ): Promise<string> {
    try {
      const tx = new ContractCreateFlow().setBytecode(bytecode).setGas(gas);

      if (constructorParams) {
        tx.setConstructorParameters(constructorParams);
      }

      const response = await tx.execute(this.context.client);
      const receipt = await response.getReceipt(this.context.client);
      return receipt.contractId!.toString();
    } catch (error) {
      throw normalizeError(
        error,
        'SmartContractClient.createContractFromBytecode',
      );
    }
  }

  /**
   * Call a function on a deployed smart contract.
   *
   * @param contractId - Contract to call
   * @param functionName - Function name
   * @param gas - Gas limit (default: 100_000)
   * @param params - Optional function parameters
   * @param payableAmount - HBAR to send with the call
   * @returns The call result
   */
  async callContractFunction(
    contractId: string,
    functionName: string,
    gas: number = 100_000,
    params?: ContractFunctionParameters,
    payableAmount?: number,
  ): Promise<ContractCallResult> {
    try {
      const tx = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(gas)
        .setFunction(functionName, params);

      if (payableAmount !== undefined) {
        tx.setPayableAmount(new Hbar(payableAmount));
      }

      const response = await tx.execute(this.context.client);
      const record = await response.getRecord(this.context.client);
      const result = record.contractFunctionResult!;

      return {
        gasUsed: result.gasUsed.toNumber(),
        contractId: result.contractId?.toString() ?? contractId,
        resultBytes: Buffer.from(result.bytes).toString('hex'),
        errorMessage: result.errorMessage || undefined,
      };
    } catch (error) {
      throw normalizeError(error, 'SmartContractClient.callContractFunction');
    }
  }

  /**
   * Delete a smart contract, transferring any remaining balance.
   *
   * @param contractId - Contract to delete
   * @param transferAccountId - Account to receive remaining balance
   */
  async deleteContract(
    contractId: string,
    transferAccountId: string,
  ): Promise<void> {
    try {
      await new ContractDeleteTransaction()
        .setContractId(contractId)
        .setTransferAccountId(transferAccountId)
        .execute(this.context.client);
    } catch (error) {
      throw normalizeError(error, 'SmartContractClient.deleteContract');
    }
  }
}
