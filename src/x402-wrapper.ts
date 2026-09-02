/**
 * x402 payment wrapper for Trestly escrow
 * 
 * This module provides a convenience function for integrators who want to route
 * standard x402 payments through the Trestly escrow contract instead of paying
 * the seller directly.
 */

import { createPayment } from "./client.js";
import {
  TrestlyConfig,
  X402PaymentParams,
  CreatePaymentResult,
} from "./types.js";

/**
 * Wrap a standard x402 payment call to route through Trestly escrow
 * 
 * This is the integration convenience function most integrators will reach for.
 * 
 * **IMPORTANT**: This changes the payment recipient from "seller directly" to
 * "the Trestly contract, on the seller's behalf, pending the dispute window."
 * 
 * Instead of transferring funds immediately to the payee/seller, this function
 * creates an escrowed payment that:
 * - Holds funds in the Trestly contract
 * - Allows the payer to raise a dispute within the dispute window
 * - Releases funds to the payee after the dispute window (if no dispute)
 * - Enables an arbiter to resolve disputes if raised
 * 
 * @param config - Trestly configuration (contract ID, RPC URL, network)
 * @param params - Standard x402 payment parameters with escrow additions
 * @returns The new payment ID and transaction hash
 * 
 * @example
 * ```typescript
 * import { wrapX402Payment } from 'trestly-sdk';
 * 
 * // Instead of a direct x402 payment to the seller:
 * // await directTransfer(seller, amount);
 * 
 * // Route through Trestly escrow:
 * const result = await wrapX402Payment(config, {
 *   payer: buyerAddress,
 *   payee: sellerAddress,
 *   token: tokenAddress,
 *   amount: 1000000n,
 *   disputeWindowSecs: 86400, // 24 hours
 *   arbiter: arbiterAddress,
 *   signTransaction: async (xdr) => await freighter.signTransaction(xdr)
 * });
 * 
 * console.log(`Payment ${result.paymentId} created, tx: ${result.txHash}`);
 * ```
 */
export async function wrapX402Payment(
  config: TrestlyConfig,
  params: X402PaymentParams
): Promise<CreatePaymentResult> {
  // Delegate directly to createPayment - the wrapper is primarily for
  // documentation clarity and semantic naming for x402 integrators
  return createPayment(config, {
    payer: params.payer,
    payee: params.payee,
    token: params.token,
    amount: params.amount,
    disputeWindowSecs: params.disputeWindowSecs,
    arbiter: params.arbiter,
    signTransaction: params.signTransaction,
  });
}
