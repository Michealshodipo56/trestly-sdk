/**
 * Core types for the Trestly SDK
 */

/**
 * Represents an escrowed payment in the Trestly contract
 */
export interface EscrowedPayment {
  payer: string;
  payee: string;
  token: string;
  amount: bigint;
  disputeWindowEnd: bigint; // unix seconds
  arbiter: string;
  disputed: boolean;
  resolved: boolean;
}

/**
 * Configuration for connecting to the Trestly contract
 */
export interface TrestlyConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

/**
 * Transaction signer function - decouples SDK from specific wallet implementations
 */
export type SignTransaction = (xdr: string) => Promise<string>;

/**
 * Parameters for creating a new escrowed payment
 */
export interface CreatePaymentParams {
  payer: string;
  payee: string;
  token: string;
  amount: bigint;
  disputeWindowSecs: number;
  arbiter: string;
  signTransaction: SignTransaction;
}

/**
 * Result of creating a payment
 */
export interface CreatePaymentResult {
  paymentId: number;
  txHash: string;
}

/**
 * Parameters for raising a dispute
 */
export interface RaiseDisputeParams {
  paymentId: number;
  payer: string;
  signTransaction: SignTransaction;
}

/**
 * Parameters for resolving a dispute
 */
export interface ResolveDisputeParams {
  paymentId: number;
  arbiter: string;
  refundToPayer: boolean;
  signTransaction: SignTransaction;
}

/**
 * Generic transaction result
 */
export interface TransactionResult {
  txHash: string;
}

/**
 * Parameters for wrapping an x402 payment through Trestly escrow
 * This changes the payment recipient from "seller directly" to 
 * "the Trestly contract, on the seller's behalf, pending the dispute window"
 */
export interface X402PaymentParams {
  payer: string;
  payee: string;
  token: string;
  amount: bigint;
  disputeWindowSecs: number;
  arbiter: string;
  signTransaction: SignTransaction;
}
