/**
 * X402 payment wrapper for Trestly escrow
 * 
 * This is the integration convenience function: given the parameters a standard x402 payment
 * call would normally take (payer, payee/seller address, amount, token), this function calls
 * createPayment under the hood instead of a direct transfer.
 * 
 * IMPORTANT: This changes the payment recipient from "seller directly" to "the Trestly contract,
 * on the seller's behalf, pending the dispute window."
 */

import { TrestlyConfig, X402PaymentParams, CreatePaymentResult } from "./types.js";
import { createPayment } from "./client.js";

/**
 * Wrap a standard x402 payment to route through Trestly escrow
 * 
 * Instead of paying the seller directly, this routes the payment through the Trestly
 * escrow contract. The seller can claim funds after the dispute window, or the payer
 * can raise a dispute before the window expires.
 * 
 * This is the one function most integrators will actually reach for - it provides a
 * drop-in replacement for standard x402 payment calls that adds escrow protection.
 * 
 * @param config - Trestly contract configuration
 * @param params - X402 payment parameters (same as standard x402 but routed through escrow)
 * @returns Payment ID and transaction hash
 * 
 * @example
 * ```typescript
 * // Standard x402 payment (direct to seller):
 * // await transferToken(seller, amount, token, payer);
 * 
 * // Trestly-wrapped x402 payment (through escrow):
 * const result = await wrapX402Payment(config, {
 *   payer: payerAddress,
 *   payee: sellerAddress,
 *   token: tokenAddress,
 *   amount: 1000000n,
 *   disputeWindowSecs: 86400, // 24 hours
 *   arbiter: arbiterAddress,
 *   signTransaction: async (xdr) => await freighter.signTransaction(xdr)
 * });
 * ```
 */
export async function wrapX402Payment(
  config: TrestlyConfig,
  params: X402PaymentParams
): Promise<CreatePaymentResult> {
  // This is a simple wrapper around createPayment with clear documentation
  // that this changes payment flow from direct transfer to escrowed transfer
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
