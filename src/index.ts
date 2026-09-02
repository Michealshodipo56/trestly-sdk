/**
 * Trestly SDK - TypeScript client library for routing x402 payments through Trestly escrow
 * 
 * This package provides a drop-in replacement for standard x402 payment calls that routes
 * payments through the Trestly escrow contract instead of paying the seller directly.
 * 
 * @packageDocumentation
 */

// Core client functions
export {
  createPayment,
  raiseDispute,
  release,
  resolveDispute,
  getPayment,
} from "./client.js";

// X402 wrapper (most common integration point)
export { wrapX402Payment } from "./x402-wrapper.js";

// Types
export type {
  EscrowedPayment,
  TrestlyConfig,
  SignTransaction,
  CreatePaymentParams,
  CreatePaymentResult,
  RaiseDisputeParams,
  ResolveDisputeParams,
  TransactionResult,
  X402PaymentParams,
} from "./types.js";

// Contract utilities (for advanced usage)
export {
  buildContractTransaction,
  simulateTransaction,
  submitAndConfirm,
  parseEscrowedPayment,
  parsePaymentId,
} from "./contract.js";
