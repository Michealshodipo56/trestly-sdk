/**
 * Test suite for Trestly SDK client functions
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { Keypair, SorobanRpc, xdr, nativeToScVal, Address } from "@stellar/stellar-sdk";
import {
  createPayment,
  getPayment,
  raiseDispute,
  release,
  resolveDispute,
} from "../src/client.js";
import { wrapX402Payment } from "../src/x402-wrapper.js";
import { TrestlyConfig, CreatePaymentParams, EscrowedPayment } from "../src/types.js";
import * as contract from "../src/contract.js";

// Mock configuration
const mockConfig: TrestlyConfig = {
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
};

const mockPayer = Keypair.random();
const mockPayee = Keypair.random();
const mockArbiter = Keypair.random();
const mockToken = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

describe("Trestly SDK", () => {
  let mockSignTransaction: jest.Mock<(xdr: string) => Promise<string>>;

  beforeEach(() => {
    mockSignTransaction = jest.fn(async (xdr: string) => xdr);
  });

  describe("createPayment", () => {
    it("should build and submit a create_payment transaction", async () => {
      const mockPaymentId = 42;
      const mockTxHash = "mock_transaction_hash_12345";

      // Mock the contract functions
      const mockServer = {
        getAccount: jest.fn().mockResolvedValue({
          accountId: () => mockPayer.publicKey(),
          sequenceNumber: () => "1",
          incrementSequenceNumber: jest.fn(),
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: {
            retval: nativeToScVal(mockPaymentId, { type: "u64" }),
          },
          transactionData: new xdr.SorobanTransactionData({
            resources: new xdr.SorobanResources({
              footprint: new xdr.LedgerFootprint({
                readOnly: [],
                readWrite: [],
              }),
              instructions: 0,
              readBytes: 0,
              writeBytes: 0,
            }),
            resourceFee: xdr.Int64.fromString("0"),
            ext: new xdr.SorobanTransactionDataExt(0),
          }),
        }),
        sendTransaction: jest.fn().mockResolvedValue({
          status: "PENDING",
          hash: mockTxHash,
        }),
        getTransaction: jest.fn().mockResolvedValue({
          status: "SUCCESS",
          returnValue: nativeToScVal(mockPaymentId, { type: "u64" }),
        }),
        prepareTransaction: jest.fn((tx) => tx),
      } as unknown as SorobanRpc.Server;

      jest.spyOn(SorobanRpc, "Server").mockImplementation(() => mockServer);
      jest.spyOn(SorobanRpc.Api, "isSimulationError").mockReturnValue(false);

      const params: CreatePaymentParams = {
        payer: mockPayer.publicKey(),
        payee: mockPayee.publicKey(),
        token: mockToken,
        amount: 1000000n,
        disputeWindowSecs: 86400,
        arbiter: mockArbiter.publicKey(),
        signTransaction: mockSignTransaction,
      };

      const result = await createPayment(mockConfig, params);

      expect(result.paymentId).toBe(mockPaymentId);
      expect(result.txHash).toBe(mockTxHash);
      expect(mockSignTransaction).toHaveBeenCalled();
    });

    it("should handle simulation errors", async () => {
      const mockServer = {
        getAccount: jest.fn().mockResolvedValue({
          accountId: () => mockPayer.publicKey(),
          sequenceNumber: () => "1",
          incrementSequenceNumber: jest.fn(),
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          error: "InvalidAmount",
        }),
      } as unknown as SorobanRpc.Server;

      jest.spyOn(SorobanRpc, "Server").mockImplementation(() => mockServer);
      jest.spyOn(SorobanRpc.Api, "isSimulationError").mockReturnValue(true);

      const params: CreatePaymentParams = {
        payer: mockPayer.publicKey(),
        payee: mockPayee.publicKey(),
        token: mockToken,
        amount: 1000000n,
        disputeWindowSecs: 86400,
        arbiter: mockArbiter.publicKey(),
        signTransaction: mockSignTransaction,
      };

      await expect(createPayment(mockConfig, params)).rejects.toThrow(
        "Simulation failed"
      );
    });
  });

  describe("getPayment", () => {
    it("should retrieve and parse payment details", async () => {
      const mockPaymentData = {
        payer: mockPayer.publicKey(),
        payee: mockPayee.publicKey(),
        token: mockToken,
        amount: 1000000,
        dispute_window_end: 1234567890,
        arbiter: mockArbiter.publicKey(),
        disputed: false,
        resolved: false,
      };

      const mockServer = {
        getAccount: jest.fn().mockResolvedValue({
          accountId: () => Keypair.random().publicKey(),
          sequenceNumber: () => "1",
          incrementSequenceNumber: jest.fn(),
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: {
            retval: nativeToScVal(mockPaymentData, { type: "map" }),
          },
        }),
      } as unknown as SorobanRpc.Server;

      jest.spyOn(SorobanRpc, "Server").mockImplementation(() => mockServer);
      jest.spyOn(SorobanRpc.Api, "isSimulationError").mockReturnValue(false);

      const result = await getPayment(mockConfig, 1);

      expect(result.payer).toBe(mockPaymentData.payer);
      expect(result.payee).toBe(mockPaymentData.payee);
      expect(result.amount).toBe(BigInt(mockPaymentData.amount));
    });
  });

  describe("wrapX402Payment", () => {
    it("should delegate to createPayment with mapped parameters", async () => {
      const mockPaymentId = 99;
      const mockTxHash = "wrapped_tx_hash";

      // Mock createPayment
      jest.spyOn(contract, "buildContractTransaction").mockResolvedValue({
        transaction: {} as any,
        server: {
          simulateTransaction: jest.fn().mockResolvedValue({
            result: { retval: nativeToScVal(mockPaymentId, { type: "u64" }) },
            transactionData: new xdr.SorobanTransactionData({
              resources: new xdr.SorobanResources({
                footprint: new xdr.LedgerFootprint({
                  readOnly: [],
                  readWrite: [],
                }),
                instructions: 0,
                readBytes: 0,
                writeBytes: 0,
              }),
              resourceFee: xdr.Int64.fromString("0"),
              ext: new xdr.SorobanTransactionDataExt(0),
            }),
          }),
          sendTransaction: jest.fn().mockResolvedValue({
            status: "PENDING",
            hash: mockTxHash,
          }),
          getTransaction: jest.fn().mockResolvedValue({
            status: "SUCCESS",
            returnValue: nativeToScVal(mockPaymentId, { type: "u64" }),
          }),
        } as any,
      });

      const result = await wrapX402Payment(mockConfig, {
        payer: mockPayer.publicKey(),
        payee: mockPayee.publicKey(),
        token: mockToken,
        amount: 5000000n,
        disputeWindowSecs: 172800,
        arbiter: mockArbiter.publicKey(),
        signTransaction: mockSignTransaction,
      });

      expect(result.paymentId).toBe(mockPaymentId);
      expect(result.txHash).toBe(mockTxHash);
    });
  });

  describe("raiseDispute", () => {
    it("should build and submit a raise_dispute transaction", async () => {
      const mockTxHash = "dispute_tx_hash";

      const mockServer = {
        getAccount: jest.fn().mockResolvedValue({
          accountId: () => mockPayer.publicKey(),
          sequenceNumber: () => "1",
          incrementSequenceNumber: jest.fn(),
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: { retval: nativeToScVal(true, { type: "bool" }) },
          transactionData: new xdr.SorobanTransactionData({
            resources: new xdr.SorobanResources({
              footprint: new xdr.LedgerFootprint({
                readOnly: [],
                readWrite: [],
              }),
              instructions: 0,
              readBytes: 0,
              writeBytes: 0,
            }),
            resourceFee: xdr.Int64.fromString("0"),
            ext: new xdr.SorobanTransactionDataExt(0),
          }),
        }),
        sendTransaction: jest.fn().mockResolvedValue({
          status: "PENDING",
          hash: mockTxHash,
        }),
        getTransaction: jest.fn().mockResolvedValue({
          status: "SUCCESS",
        }),
      } as unknown as SorobanRpc.Server;

      jest.spyOn(SorobanRpc, "Server").mockImplementation(() => mockServer);
      jest.spyOn(SorobanRpc.Api, "isSimulationError").mockReturnValue(false);

      const result = await raiseDispute(mockConfig, {
        paymentId: 1,
        payer: mockPayer.publicKey(),
        signTransaction: mockSignTransaction,
      });

      expect(result.txHash).toBe(mockTxHash);
    });
  });

  describe("resolveDispute", () => {
    it("should build and submit a resolve_dispute transaction", async () => {
      const mockTxHash = "resolve_tx_hash";

      const mockServer = {
        getAccount: jest.fn().mockResolvedValue({
          accountId: () => mockArbiter.publicKey(),
          sequenceNumber: () => "1",
          incrementSequenceNumber: jest.fn(),
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: { retval: nativeToScVal(true, { type: "bool" }) },
          transactionData: new xdr.SorobanTransactionData({
            resources: new xdr.SorobanResources({
              footprint: new xdr.LedgerFootprint({
                readOnly: [],
                readWrite: [],
              }),
              instructions: 0,
              readBytes: 0,
              writeBytes: 0,
            }),
            resourceFee: xdr.Int64.fromString("0"),
            ext: new xdr.SorobanTransactionDataExt(0),
          }),
        }),
        sendTransaction: jest.fn().mockResolvedValue({
          status: "PENDING",
          hash: mockTxHash,
        }),
        getTransaction: jest.fn().mockResolvedValue({
          status: "SUCCESS",
        }),
      } as unknown as SorobanRpc.Server;

      jest.spyOn(SorobanRpc, "Server").mockImplementation(() => mockServer);
      jest.spyOn(SorobanRpc.Api, "isSimulationError").mockReturnValue(false);

      const result = await resolveDispute(mockConfig, {
        paymentId: 1,
        arbiter: mockArbiter.publicKey(),
        refundToPayer: false,
        signTransaction: mockSignTransaction,
      });

      expect(result.txHash).toBe(mockTxHash);
    });
  });

  describe("release", () => {
    it("should require a submitterKeypair", async () => {
      await expect(release(mockConfig, 1)).rejects.toThrow(
        "release() requires a submitterKeypair"
      );
    });

    it("should build and submit a release transaction with provided keypair", async () => {
      const mockTxHash = "release_tx_hash";
      const submitterKeypair = Keypair.random();

      const mockServer = {
        getAccount: jest.fn().mockResolvedValue({
          accountId: () => submitterKeypair.publicKey(),
          sequenceNumber: () => "1",
          incrementSequenceNumber: jest.fn(),
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: { retval: nativeToScVal(true, { type: "bool" }) },
          transactionData: new xdr.SorobanTransactionData({
            resources: new xdr.SorobanResources({
              footprint: new xdr.LedgerFootprint({
                readOnly: [],
                readWrite: [],
              }),
              instructions: 0,
              readBytes: 0,
              writeBytes: 0,
            }),
            resourceFee: xdr.Int64.fromString("0"),
            ext: new xdr.SorobanTransactionDataExt(0),
          }),
        }),
        sendTransaction: jest.fn().mockResolvedValue({
          status: "PENDING",
          hash: mockTxHash,
        }),
        getTransaction: jest.fn().mockResolvedValue({
          status: "SUCCESS",
        }),
        prepareTransaction: jest.fn((tx) => tx),
      } as unknown as SorobanRpc.Server;

      jest.spyOn(SorobanRpc, "Server").mockImplementation(() => mockServer);
      jest.spyOn(SorobanRpc.Api, "isSimulationError").mockReturnValue(false);

      const result = await release(mockConfig, 1, submitterKeypair);

      expect(result.txHash).toBe(mockTxHash);
    });
  });
});
