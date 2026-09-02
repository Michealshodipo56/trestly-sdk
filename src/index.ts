/**
 * Trestly SDK - TypeScript client library for Stellar/Soroban escrow payments
 * 
 * A standalone library that routes x402 payments through the Trestly escrow contract.
 * Install with: npm install trestly-sdk
 */

// Core client functions
export {
  createPayment,
  raiseDispute,
  release,
  resolveDispute,
  getPayment,
} from "./client.js";

// x402 integration wrapper
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
