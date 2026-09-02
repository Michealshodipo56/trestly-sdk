/**
 * Trestly SDK client functions
 */

import { SorobanRpc } from "@stellar/stellar-sdk";
import {
  TrestlyConfig,
  CreatePaymentParams,
  CreatePaymentResult,
  RaiseDisputeParams,
  ResolveDisputeParams,
  TransactionResult,
  EscrowedPayment,
} from "./types.js";
import {
  buildContractTransaction,
  simulateTransaction,
  submitAndConfirm,
  buildCreatePaymentParams,
  buildRaiseDisputeParams,
  buildReleaseParams,
  buildResolveDisputeParams,
  buildGetPaymentParams,
  parsePaymentId,
  parseEscrowedPayment,
} from "./contract.js";

/**
 * Create a new escrowed payment
 * 
 * Builds a Soroban transaction invoking create_payment on the Trestly contract.
 * Simulates the transaction, then calls the provided signTransaction callback
 * (this decouples the SDK from any specific wallet — the caller supplies their own signer,
 * whether that's Freighter in a browser or a server-side keypair).
 * Submits the signed transaction, polls for confirmation.
 * 
 * @param config - Trestly contract configuration
 * @param params - Payment parameters including signer callback
 * @returns The new paymentId and transaction hash
 */
export async function createPayment(
  config: TrestlyConfig,
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  // Build transaction
  const contractParams = buildCreatePaymentParams({
    payer: params.payer,
    payee: params.payee,
    token: params.token,
    amount: params.amount,
    disputeWindowSecs: params.disputeWindowSecs,
    arbiter: params.arbiter,
  });

  const { transaction, server } = await buildContractTransaction(
    config,
    params.payer,
    "create_payment",
    contractParams
  );

  // Simulate
  const xdr = await simulateTransaction(server, transaction);

  // Sign via callback
  const signedXdr = await params.signTransaction(xdr);

  // Submit and confirm
  const txHash = await submitAndConfirm(server, signedXdr);

  // Parse payment ID from transaction result
  const txResult = await server.getTransaction(txHash);
  
  if (txResult.status !== "SUCCESS" || !txResult.returnValue) {
    throw new Error("Failed to get payment ID from transaction result");
  }

  const paymentId = parsePaymentId(txResult.returnValue);

  return { paymentId, txHash };
}

/**
 * Raise a dispute for an escrowed payment
 * 
 * Same build → simulate → sign → submit → confirm pattern, invoking raise_dispute.
 * 
 * @param config - Trestly contract configuration
 * @param params - Dispute parameters including payment ID and signer
 * @returns Transaction hash
 */
export async function raiseDispute(
  config: TrestlyConfig,
  params: RaiseDisputeParams
): Promise<TransactionResult> {
  const contractParams = buildRaiseDisputeParams({
    paymentId: params.paymentId,
    payer: params.payer,
  });

  const { transaction, server } = await buildContractTransaction(
    config,
    params.payer,
    "raise_dispute",
    contractParams
  );

  const xdr = await simulateTransaction(server, transaction);
  const signedXdr = await params.signTransaction(xdr);
  const txHash = await submitAndConfirm(server, signedXdr);

  return { txHash };
}

/**
 * Release an escrowed payment after the dispute window
 * 
 * No signer required as a parameter beyond the submitting account — this is a public,
 * unauthenticated contract call. Still needs a fee-paying source account to submit the transaction.
 * 
 * @param config - Trestly contract configuration
 * @param paymentId - The payment to release
 * @param submitterAccount - The account that will pay transaction fees (must have funds)
 * @param signTransaction - Callback to sign the transaction with the submitter's key
 * @returns Transaction hash
 */
export async function release(
  config: TrestlyConfig,
  paymentId: number,
  submitterAccount: string,
  signTransaction: (xdr: string) => Promise<string>
): Promise<TransactionResult> {
  const contractParams = buildReleaseParams(paymentId);

  const { transaction, server } = await buildContractTransaction(
    config,
    submitterAccount,
    "release",
    contractParams
  );

  const xdr = await simulateTransaction(server, transaction);
  const signedXdr = await signTransaction(xdr);
  const txHash = await submitAndConfirm(server, signedXdr);

  return { txHash };
}


