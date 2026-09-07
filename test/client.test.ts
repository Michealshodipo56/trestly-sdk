/**
 * Tests for Trestly SDK client functions
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { SorobanRpc, xdr, nativeToScVal } from "@stellar/stellar-sdk";
import {
  createPayment,
  raiseDispute,
  release,
  resolveDispute,
  getPayment,
} from "../src/client.js";
import { wrapX402Payment } from "../src/x402-wrapper.js";
import { TrestlyConfig } from "../src/types.js";
import * as contract from "../src/contract.js";

// Mock the contract module
jest.mock("../src/contract.js", () => ({
  buildCreatePaymentParams: jest.fn(),
  buildRaiseDisputeParams: jest.fn(),
  buildReleaseParams: jest.fn(),
  buildResolveDisputeParams: jest.fn(),
  buildGetPaymentParams: jest.fn(),
  buildContractTransaction: jest.fn(),
  simulateTransaction: jest.fn(),
  submitAndConfirm: jest.fn(),
  parsePaymentId: jest.fn(),
  parseEscrowedPayment: jest.fn(),
}));

const mockConfig: TrestlyConfig = {
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
};

const mockSignTransaction = jest.fn<(xdr: string) => Promise<string>>();

// Get mocked functions
const buildCreatePaymentParams = contract.buildCreatePaymentParams as jest.MockedFunction<typeof contract.buildCreatePaymentParams>;
const buildRaiseDisputeParams = contract.buildRaiseDisputeParams as jest.MockedFunction<typeof contract.buildRaiseDisputeParams>;
const buildReleaseParams = contract.buildReleaseParams as jest.MockedFunction<typeof contract.buildReleaseParams>;
const buildResolveDisputeParams = contract.buildResolveDisputeParams as jest.MockedFunction<typeof contract.buildResolveDisputeParams>;
const buildGetPaymentParams = contract.buildGetPaymentParams as jest.MockedFunction<typeof contract.buildGetPaymentParams>;
const buildContractTransaction = contract.buildContractTransaction as jest.MockedFunction<typeof contract.buildContractTransaction>;
const simulateTransaction = contract.simulateTransaction as jest.MockedFunction<typeof contract.simulateTransaction>;
const submitAndConfirm = contract.submitAndConfirm as jest.MockedFunction<typeof contract.submitAndConfirm>;
const parsePaymentId = contract.parsePaymentId as jest.MockedFunction<typeof contract.parsePaymentId>;
const parseEscrowedPayment = contract.parseEscrowedPayment as jest.MockedFunction<typeof contract.parseEscrowedPayment>;

describe("createPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should build and submit a transaction, returning paymentId and txHash", async () => {
    const mockServer = {
      getTransaction: jest.fn<any>().mockResolvedValue({
        status: "SUCCESS",
        returnValue: nativeToScVal(42, { type: "u64" }),
      }),
    } as any;

    const mockTransaction = {} as any;

    buildCreatePaymentParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: mockTransaction,
      server: mockServer,
    });
    simulateTransaction.mockResolvedValue("mock_xdr");
    mockSignTransaction.mockResolvedValue("signed_xdr");
    submitAndConfirm.mockResolvedValue("mock_tx_hash");
    parsePaymentId.mockReturnValue(42);

    const result = await createPayment(mockConfig, {
      payer: "GAPAYER...",
      payee: "GAPAYEE...",
      token: "GATOKEN...",
      amount: 1000000n,
      disputeWindowSecs: 86400,
      arbiter: "GAARBITER...",
      signTransaction: mockSignTransaction,
    });

    expect(result).toEqual({
      paymentId: 42,
      txHash: "mock_tx_hash",
    });

    expect(buildCreatePaymentParams).toHaveBeenCalledWith({
      payer: "GAPAYER...",
      payee: "GAPAYEE...",
      token: "GATOKEN...",
      amount: 1000000n,
      disputeWindowSecs: 86400,
      arbiter: "GAARBITER...",
    });

    expect(buildContractTransaction).toHaveBeenCalledWith(
      mockConfig,
      "GAPAYER...",
      "create_payment",
      []
    );

    expect(mockSignTransaction).toHaveBeenCalledWith("mock_xdr");
    expect(submitAndConfirm).toHaveBeenCalledWith(mockServer, "signed_xdr");
  });

  it("should throw if transaction result has no returnValue", async () => {
    const mockServer = {
      getTransaction: jest.fn<any>().mockResolvedValue({
        status: "SUCCESS",
        returnValue: undefined,
      }),
    } as any;

    buildCreatePaymentParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: {} as any,
      server: mockServer,
    });
    simulateTransaction.mockResolvedValue("mock_xdr");
    mockSignTransaction.mockResolvedValue("signed_xdr");
    submitAndConfirm.mockResolvedValue("mock_tx_hash");

    await expect(
      createPayment(mockConfig, {
        payer: "GAPAYER...",
        payee: "GAPAYEE...",
        token: "GATOKEN...",
        amount: 1000000n,
        disputeWindowSecs: 86400,
        arbiter: "GAARBITER...",
        signTransaction: mockSignTransaction,
      })
    ).rejects.toThrow("Failed to get payment ID from transaction result");
  });
});

describe("raiseDispute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should build and submit a raise_dispute transaction", async () => {
    const mockServer = {} as SorobanRpc.Server;
    const mockTransaction = {} as any;

    buildRaiseDisputeParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: mockTransaction,
      server: mockServer,
    });
    simulateTransaction.mockResolvedValue("mock_xdr");
    mockSignTransaction.mockResolvedValue("signed_xdr");
    submitAndConfirm.mockResolvedValue("dispute_tx_hash");

    const result = await raiseDispute(mockConfig, {
      paymentId: 42,
      payer: "GAPAYER...",
      signTransaction: mockSignTransaction,
    });

    expect(result).toEqual({ txHash: "dispute_tx_hash" });
    expect(buildRaiseDisputeParams).toHaveBeenCalledWith({
      paymentId: 42,
      payer: "GAPAYER...",
    });
    expect(buildContractTransaction).toHaveBeenCalledWith(
      mockConfig,
      "GAPAYER...",
      "raise_dispute",
      []
    );
  });
});

describe("release", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should build and submit a release transaction", async () => {
    const mockServer = {} as SorobanRpc.Server;
    const mockTransaction = {} as any;

    buildReleaseParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: mockTransaction,
      server: mockServer,
    });
    simulateTransaction.mockResolvedValue("mock_xdr");
    mockSignTransaction.mockResolvedValue("signed_xdr");
    submitAndConfirm.mockResolvedValue("release_tx_hash");

    const result = await release(
      mockConfig,
      42,
      "GASUBMITTER...",
      mockSignTransaction
    );

    expect(result).toEqual({ txHash: "release_tx_hash" });
    expect(buildReleaseParams).toHaveBeenCalledWith(42);
    expect(buildContractTransaction).toHaveBeenCalledWith(
      mockConfig,
      "GASUBMITTER...",
      "release",
      []
    );
  });
});

describe("resolveDispute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should build and submit a resolve_dispute transaction", async () => {
    const mockServer = {} as SorobanRpc.Server;
    const mockTransaction = {} as any;

    buildResolveDisputeParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: mockTransaction,
      server: mockServer,
    });
    simulateTransaction.mockResolvedValue("mock_xdr");
    mockSignTransaction.mockResolvedValue("signed_xdr");
    submitAndConfirm.mockResolvedValue("resolve_tx_hash");

    const result = await resolveDispute(mockConfig, {
      paymentId: 42,
      arbiter: "GAARBITER...",
      refundToPayer: true,
      signTransaction: mockSignTransaction,
    });

    expect(result).toEqual({ txHash: "resolve_tx_hash" });
    expect(buildResolveDisputeParams).toHaveBeenCalledWith({
      paymentId: 42,
      arbiter: "GAARBITER...",
      refundToPayer: true,
    });
    expect(buildContractTransaction).toHaveBeenCalledWith(
      mockConfig,
      "GAARBITER...",
      "resolve_dispute",
      []
    );
  });
});

describe("getPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should correctly parse and return EscrowedPayment", async () => {
    const mockPayment = {
      payer: "GAPAYER...",
      payee: "GAPAYEE...",
      token: "GATOKEN...",
      amount: 1000000n,
      disputeWindowEnd: 1234567890n,
      arbiter: "GAARBITER...",
      disputed: false,
      resolved: false,
    };

    const mockRetval = nativeToScVal(mockPayment, { type: "map" });
    const mockSimulation = {
      result: { retval: mockRetval },
    };

    const mockServer = {
      simulateTransaction: jest.fn<any>().mockResolvedValue(mockSimulation),
    } as any;

    buildGetPaymentParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: { build: jest.fn().mockReturnValue({}) } as any,
      server: mockServer,
    });
    parseEscrowedPayment.mockReturnValue(mockPayment);

    const result = await getPayment(mockConfig, 42);

    expect(result).toEqual(mockPayment);
    expect(buildGetPaymentParams).toHaveBeenCalledWith(42);
    expect(parseEscrowedPayment).toHaveBeenCalledWith(mockRetval);
  });
});

describe("wrapX402Payment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should correctly delegate to createPayment with mapped parameters", async () => {
    const mockServer = {
      getTransaction: jest.fn<any>().mockResolvedValue({
        status: "SUCCESS",
        returnValue: nativeToScVal(99, { type: "u64" }),
      }),
    } as any;

    buildCreatePaymentParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: {} as any,
      server: mockServer,
    });
    simulateTransaction.mockResolvedValue("mock_xdr");
    mockSignTransaction.mockResolvedValue("signed_xdr");
    submitAndConfirm.mockResolvedValue("wrapped_tx_hash");
    parsePaymentId.mockReturnValue(99);

    const result = await wrapX402Payment(mockConfig, {
      payer: "GAPAYER...",
      payee: "GASELLER...",
      token: "GATOKEN...",
      amount: 5000000n,
      disputeWindowSecs: 172800,
      arbiter: "GAARBITER...",
      signTransaction: mockSignTransaction,
    });

    expect(result).toEqual({
      paymentId: 99,
      txHash: "wrapped_tx_hash",
    });

    expect(buildCreatePaymentParams).toHaveBeenCalledWith({
      payer: "GAPAYER...",
      payee: "GASELLER...",
      token: "GATOKEN...",
      amount: 5000000n,
      disputeWindowSecs: 172800,
      arbiter: "GAARBITER...",
    });
  });
});

describe("Error propagation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should propagate contract errors when simulation fails", async () => {
    buildCreatePaymentParams.mockReturnValue([]);
    buildContractTransaction.mockResolvedValue({
      transaction: {} as any,
      server: {} as any,
    });
    simulateTransaction.mockRejectedValue(
      new Error("Simulation failed: InvalidAmount")
    );

    await expect(
      createPayment(mockConfig, {
        payer: "GAPAYER...",
        payee: "GAPAYEE...",
        token: "GATOKEN...",
        amount: -1n,
        disputeWindowSecs: 86400,
        arbiter: "GAARBITER...",
        signTransaction: mockSignTransaction,
      })
    ).rejects.toThrow("Simulation failed: InvalidAmount");
  });
});
