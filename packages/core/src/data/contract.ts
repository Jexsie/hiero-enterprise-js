/**
 * Result of a smart contract function call.
 * Maps to Java: com.openelements.hiero.base.data.ContractCallResult
 */
export interface ContractCallResult {
  /** Gas consumed by the call */
  readonly gasUsed: number;
  /** HBAR result (in tinybars) */
  readonly hbarResult?: number;
  /** Contract ID that was called */
  readonly contractId: string;
  /** Raw result bytes (hex encoded) */
  readonly resultBytes?: string;
  /** Error message if the call failed */
  readonly errorMessage?: string;
}
