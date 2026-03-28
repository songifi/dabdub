export interface SimulatedTransaction {
  readonly id: string;
  readonly method: string;
  readonly args: readonly unknown[];
  readonly sourceAccount: string;
}

export interface SimulationResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
  readonly contractErrorCode?: number;
  readonly contractErrorXdr?: string;
}

export interface SubmitResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
  readonly contractErrorCode?: number;
  readonly contractErrorXdr?: string;
}

export interface AssembledTransaction extends SimulatedTransaction {
  readonly simulation: SimulationResult;
}

export interface SignedTransaction extends AssembledTransaction {
  readonly signature: string;
}

/**
 * Lightweight Soroban client facade used by service tests and higher-level logic.
 * This is intentionally transport-agnostic: callers can replace methods in tests.
 */
export namespace SorobanClient {
  export class Server {
    constructor(public readonly rpcUrl: string) {}

    async simulateTransaction(
      tx: SimulatedTransaction,
    ): Promise<SimulationResult> {
      return { ok: true, result: tx };
    }

    assembleTransaction(
      tx: SimulatedTransaction,
      simulation: SimulationResult,
    ): AssembledTransaction {
      return { ...tx, simulation };
    }

    async sendTransaction(tx: SignedTransaction): Promise<SubmitResult> {
      return { ok: true, result: tx };
    }
  }
}

export class CheesePayContractClient {
  constructor(public readonly contractId: string) {}

  buildInvokeTransaction(
    method: string,
    args: readonly unknown[],
    sourceAccount: string,
  ): SimulatedTransaction {
    return {
      id: `${this.contractId}:${method}`,
      method,
      args,
      sourceAccount,
    };
  }
}
