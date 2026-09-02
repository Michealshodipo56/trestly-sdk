/**
 * Trestly SDK client functions
 */

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
import {
  TrestlyConfig,
  CreatePaymentParams,
  CreatePaymentResult,
  RaiseDisputeParams,
  ResolveDisputeParams,
  TransactionResult,
  EscrowedPayment,
} from "./types.js";
import { SorobanRpc, Keypair } from "@stellar/stellar-sdk";

/**
 * Create a new escrowed payment through the Trestly contract
 * 
 * Builds a Soroban transaction invoking create_payment on the Trestly contract,
 * simulates it, then calls the provided signTransaction callback to sign,
 * submits the signed transaction, and polls for confirmation.
 * 
 * @param config - Trestly configuration (contract ID, RPC URL, network)
 * @param params - Payment parameters including payer, payee, amount, and signer
 * @returns The new payment ID and transaction hash
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

  // Simulate transaction
  const xdr = await simulateTransaction(server, transaction);

  // Sign transaction using provided callback
  const signedXdr = await params.signTransaction(xdr);

  // Submit and confirm
  const txHash = await submitAndConfirm(server, signedXdr);

  // Parse payment ID from transaction result
  const txResult = await server.getTransaction(txHash);
  
  if (txResult.status !== "SUCCESS" || !txResult.returnValue) {
    throw new Error("Failed to retrieve payment ID from transaction result");
  }

  const paymentId = parsePaymentId(txResult.returnValue);

  return { paymentId, txHash };
}

/**
 * Raise a dispute on an escrowed payment
 * 
 * Invokes raise_dispute on the Trestly contract to initiate a dispute
 * within the dispute window. Must be called by the payer.
 * 
 * @param config - Trestly configuration
 * @param params - Dispute parameters including payment ID and payer
 * @returns Transaction hash
 */
export async function raiseDispute(
  config: TrestlyConfig,
  params: RaiseDisputeParams
): Promise<TransactionResult> {
  // Build transaction
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

  // Simulate transaction
  const xdr = await simulateTransaction(server, transaction);

  // Sign transaction using provided callback
  const signedXdr = await params.signTransaction(xdr);

  // Submit and confirm
  const txHash = await submitAndConfirm(server, signedXdr);

  return { txHash };
}

/**
 * Release an escrowed payment to the payee
 * 
 * Invokes release on the Trestly contract to transfer funds to the payee
 * after the dispute window has passed without a dispute.
 * This is a public, unauthenticated contract call.
 * 
 * @param config - Trestly configuration
 * @param paymentId - The ID of the payment to release
 * @param submitterKeypair - Optional keypair for the account paying transaction fees
 * @returns Transaction hash
 */
export async function release(
  config: TrestlyConfig,
  paymentId: number,
  submitterKeypair?: Keypair
): Promise<TransactionResult> {
  // Build transaction
  const contractParams = buildReleaseParams(paymentId);

  // Use provided keypair or require caller to provide one
  if (!submitterKeypair) {
    throw new Error(
      "release() requires a submitterKeypair parameter to pay transaction fees. " +
      "This is a public contract call but still needs a fee-paying source account."
    );
  }

  const sourceAccount = submitterKeypair.publicKey();

  const { transaction, server } = await buildContractTransaction(
    config,
    sourceAccount,
    "release",
    contractParams
  );

  // Simulate transaction
  const xdr = await simulateTransaction(server, transaction);

  // Sign with the submitter keypair
  const built = transaction.build();
  const prepared = await server.prepareTransaction(built);
  prepared.sign(submitterKeypair);
  const signedXdr = prepared.toXDR();

  // Submit and confirm
  const txHash = await submitAndConfirm(server, signedXdr);

  return { txHash };
}

/**
 * Resolve a disputed payment
 * 
 * Invokes resolve_dispute on the Trestly contract. Must be called by the arbiter
 * to decide whether funds go to the payee or are refunded to the payer.
 * 
 * @param config - Trestly configuration
 * @param params - Resolution parameters including payment ID, arbiter, and decision
 * @returns Transaction hash
 */
export async function resolveDispute(
  config: TrestlyConfig,
  params: ResolveDisputeParams
): Promise<TransactionResult> {
  // Build transaction
  const contractParams = buildResolveDisputeParams({
    paymentId: params.paymentId,
    arbiter: params.arbiter,
    refundToPayer: params.refundToPayer,
  });

  const { transaction, server } = await buildContractTransaction(
    config,
    params.arbiter,
    "resolve_dispute",
    contractParams
  );

  // Simulate transaction
  const xdr = await simulateTransaction(server, transaction);

  // Sign transaction using provided callback
  const signedXdr = await params.signTransaction(xdr);

  // Submit and confirm
  const txHash = await submitAndConfirm(server, signedXdr);

  return { txHash };
}

/**
 * Get payment details from the contract
 * 
 * Read-only query to retrieve the current state of an escrowed payment.
 * No signing needed.
 * 
 * @param config - Trestly configuration
 * @param paymentId - The ID of the payment to retrieve
 * @returns The escrowed payment details
 */
export async function getPayment(
  config: TrestlyConfig,
  paymentId: number
): Promise<EscrowedPayment> {
  const server = new SorobanRpc.Server(config.rpcUrl);
  
  // Build a dummy transaction just for simulation (read-only, won't be submitted)
  // We need any valid source account for building, but it won't be used
  const dummyAccount = Keypair.random().publicKey();
  
  const contractParams = buildGetPaymentParams(paymentId);

  const { transaction } = await buildContractTransaction(
    config,
    dummyAccount,
    "get_payment",
    contractParams
  );

  // Simulate to get the return value
  const built = transaction.build();
  const simulated = await server.simulateTransaction(built);

  if (SorobanRpc.Api.isSimulationError(simulated)) {
    throw new Error(`Failed to get payment: ${simulated.error}`);
  }

  if (!simulated.result) {
    throw new Error("Simulation returned no result");
  }

  // Parse and return the payment
  return parseEscrowedPayment(simulated.result.retval);
}
