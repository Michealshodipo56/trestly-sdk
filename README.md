# Trestly SDK

A TypeScript client library for routing x402 payments through the Trestly escrow contract on Stellar/Soroban.

## What is Trestly?

Trestly provides escrow protection for x402 payments. Instead of paying a seller directly, payments are held in escrow with a dispute window. If there's a problem, the payer can raise a dispute and have an arbiter resolve it. Otherwise, funds automatically release to the seller after the dispute window expires.

## Installation

```bash
npm install trestly-sdk
```

## Quick Start

The simplest way to use Trestly is with the `wrapX402Payment` function - a drop-in replacement for standard x402 payment calls:

```typescript
import { wrapX402Payment } from "trestly-sdk";
import { freighter } from "@stellar/freighter-api";

const config = {
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
};

// Create an escrowed payment
const result = await wrapX402Payment(config, {
  payer: "GAPAYER...",
  payee: "GASELLER...",
  token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // USDC
  amount: 1000000n, // 0.1 USDC (7 decimals)
  disputeWindowSecs: 86400, // 24 hours
  arbiter: "GAARBITER...",
  signTransaction: async (xdr) => await freighter.signTransaction(xdr),
});

console.log(`Payment created with ID: ${result.paymentId}`);
console.log(`Transaction hash: ${result.txHash}`);
```

**Important**: This changes the payment recipient from "seller directly" to "the Trestly contract, on the seller's behalf, pending the dispute window."

## Configuration

All functions require a `TrestlyConfig` object:

```typescript
interface TrestlyConfig {
  contractId: string;           // Trestly contract address
  rpcUrl: string;              // Soroban RPC endpoint
  networkPassphrase: string;   // Network identifier
}
```

Example configurations:

```typescript
// Testnet
const testnetConfig = {
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
};

// Mainnet (when deployed)
const mainnetConfig = {
  contractId: "YOUR_CONTRACT_ID",
  rpcUrl: "https://soroban-mainnet.stellar.org",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
};
```

## Core Functions

### createPayment

Create a new escrowed payment:

```typescript
import { createPayment } from "trestly-sdk";

const result = await createPayment(config, {
  payer: "GAPAYER...",
  payee: "GAPAYEE...",
  token: "GATOKEN...",
  amount: 1000000n,
  disputeWindowSecs: 86400, // 24 hours
  arbiter: "GAARBITER...",
  signTransaction: async (xdr) => {
    // Sign with Freighter (browser)
    return await freighter.signTransaction(xdr);
  },
});

console.log(`Payment ID: ${result.paymentId}`);
console.log(`TX Hash: ${result.txHash}`);
```

### getPayment

Retrieve payment details:

```typescript
import { getPayment } from "trestly-sdk";

const payment = await getPayment(config, paymentId);

console.log(`Payer: ${payment.payer}`);
console.log(`Payee: ${payment.payee}`);
console.log(`Amount: ${payment.amount}`);
console.log(`Disputed: ${payment.disputed}`);
console.log(`Resolved: ${payment.resolved}`);
console.log(`Dispute window ends: ${new Date(Number(payment.disputeWindowEnd) * 1000)}`);
```

### raiseDispute

Payer can raise a dispute before the window expires:

```typescript
import { raiseDispute } from "trestly-sdk";

const result = await raiseDispute(config, {
  paymentId: 42,
  payer: "GAPAYER...",
  signTransaction: async (xdr) => await freighter.signTransaction(xdr),
});

console.log(`Dispute raised: ${result.txHash}`);
```

### resolveDispute

Arbiter resolves a disputed payment:

```typescript
import { resolveDispute } from "trestly-sdk";

const result = await resolveDispute(config, {
  paymentId: 42,
  arbiter: "GAARBITER...",
  refundToPayer: true, // true = refund payer, false = release to payee
  signTransaction: async (xdr) => await arbiterSignFn(xdr),
});

console.log(`Dispute resolved: ${result.txHash}`);
```

### release

Anyone can release funds to the payee after the dispute window (if no dispute):

```typescript
import { release } from "trestly-sdk";

const result = await release(
  config,
  paymentId,
  "GASUBMITTER...", // Account paying transaction fees
  async (xdr) => await signFn(xdr)
);

console.log(`Payment released: ${result.txHash}`);
```

## Signing Transactions

The SDK is wallet-agnostic. You provide a `signTransaction` callback that returns a signed XDR string.

### Browser with Freighter

```typescript
import { freighter } from "@stellar/freighter-api";

const signTransaction = async (xdr: string) => {
  return await freighter.signTransaction(xdr);
};
```

### Server-side with Keypair

```typescript
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("SXXXXXXX...");

const signTransaction = async (xdr: string) => {
  const transaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  transaction.sign(keypair);
  return transaction.toXDR();
};
```

### Other Wallets

Any wallet that can sign Stellar transactions works - just implement the callback:

```typescript
type SignTransaction = (xdr: string) => Promise<string>;
```

## TypeScript Support

The SDK is written in TypeScript with full type definitions:

```typescript
import type {
  TrestlyConfig,
  EscrowedPayment,
  CreatePaymentParams,
  CreatePaymentResult,
  TransactionResult,
} from "trestly-sdk";
```

## Error Handling

The SDK throws descriptive errors:

```typescript
try {
  const result = await createPayment(config, params);
} catch (error) {
  if (error instanceof Error) {
    console.error(`Payment failed: ${error.message}`);
    // Examples:
    // - "Simulation failed: InvalidAmount"
    // - "Transaction failed: ..."
    // - "Transaction confirmation timeout"
  }
}
```

## Complete Integration Example

```typescript
import {
  wrapX402Payment,
  getPayment,
  raiseDispute,
  resolveDispute,
  release,
  type TrestlyConfig,
} from "trestly-sdk";
import { freighter } from "@stellar/freighter-api";

const config: TrestlyConfig = {
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
};

// 1. Buyer creates payment through escrow
const payment = await wrapX402Payment(config, {
  payer: buyerAddress,
  payee: sellerAddress,
  token: usdcAddress,
  amount: 100_0000000n, // 100 USDC
  disputeWindowSecs: 172800, // 48 hours
  arbiter: arbiterAddress,
  signTransaction: async (xdr) => await freighter.signTransaction(xdr),
});

console.log(`Payment ${payment.paymentId} created`);

// 2. Check payment status
const status = await getPayment(config, payment.paymentId);
console.log(`Dispute window ends: ${new Date(Number(status.disputeWindowEnd) * 1000)}`);

// 3a. If there's a problem, buyer raises dispute
if (problemOccurred) {
  await raiseDispute(config, {
    paymentId: payment.paymentId,
    payer: buyerAddress,
    signTransaction: async (xdr) => await freighter.signTransaction(xdr),
  });

  // 3b. Arbiter resolves the dispute
  await resolveDispute(config, {
    paymentId: payment.paymentId,
    arbiter: arbiterAddress,
    refundToPayer: shouldRefund,
    signTransaction: async (xdr) => await arbiterSignFn(xdr),
  });
}

// 4. Otherwise, anyone can release after dispute window
else {
  await release(
    config,
    payment.paymentId,
    releaserAddress,
    async (xdr) => await signerFn(xdr)
  );
}
```

## Package Exports

The package is dual-module (ESM + CommonJS):

```typescript
// ESM
import { wrapX402Payment } from "trestly-sdk";

// CommonJS
const { wrapX402Payment } = require("trestly-sdk");
```

## Development

```bash
# Install dependencies
npm install

# Build (ESM + CJS + types)
npm run build

# Run tests
npm test

# Type check
npx tsc --noEmit
```

## Environment Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (for development)

## Dependencies

- `@stellar/stellar-sdk` - Soroban RPC and transaction building
- `@stellar/freighter-api` - Wallet signing (browser only, optional)

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [trestly-sdk/issues](https://github.com/Trestly-team/trestly-sdk/issues)
- Documentation: This README
- Contract Spec: See `trestly-contract` repository

## Related Projects

- `trestly-contract` - The Soroban smart contract (separate repo)
- `trestly-app` - Reference implementation demo app (separate repo)
