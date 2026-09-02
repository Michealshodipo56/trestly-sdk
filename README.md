# Trestly SDK

TypeScript client library for routing x402 payments through the Trestly escrow contract on Stellar/Soroban.

## Overview

Trestly SDK is a standalone library that enables developers to integrate escrowed payments into their applications. Instead of paying a seller directly, payments are routed through the Trestly smart contract, providing:

- **Dispute protection**: Buyers can raise disputes within a configurable time window
- **Arbiter resolution**: Third-party arbiters can resolve disputes fairly
- **Automatic release**: Funds automatically release to sellers after the dispute window expires
- **Type-safe**: Full TypeScript support with comprehensive types

## Installation

```bash
npm install trestly-sdk
```

## Requirements

- Node.js >= 18.0.0
- Works in both Node.js and browser environments
- Stellar testnet or mainnet account with XLM for transaction fees

## Quick Start

```typescript
import { wrapX402Payment, TrestlyConfig } from 'trestly-sdk';

// Configure connection to Trestly contract
const config: TrestlyConfig = {
  contractId: 'YOUR_CONTRACT_ID',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015'
};

// Route a payment through escrow instead of paying directly
const result = await wrapX402Payment(config, {
  payer: buyerAddress,
  payee: sellerAddress,
  token: tokenContractAddress,
  amount: 1000000n, // Amount in token's smallest unit
  disputeWindowSecs: 86400, // 24 hours
  arbiter: arbiterAddress,
  signTransaction: async (xdr) => {
    // Use your preferred signing method (Freighter, Albedo, server keypair, etc.)
    return await freighter.signTransaction(xdr);
  }
});

console.log(`Payment ${result.paymentId} created: ${result.txHash}`);
```

## Configuration

The `TrestlyConfig` object connects the SDK to your deployed Trestly contract:

```typescript
interface TrestlyConfig {
  contractId: string;        // Trestly contract address
  rpcUrl: string;            // Soroban RPC endpoint
  networkPassphrase: string; // Network identifier
}
```

### Network Examples

**Testnet:**
```typescript
{
  contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015'
}
```

**Mainnet (coming soon):**
```typescript
{
  contractId: 'YOUR_MAINNET_CONTRACT_ID',
  rpcUrl: 'https://soroban-mainnet.stellar.org',
  networkPassphrase: 'Public Global Stellar Network ; September 2015'
}
```

## API Reference

### Core Functions

#### `wrapX402Payment(config, params)`

The main integration function for routing x402 payments through escrow.

**Important**: This changes the payment recipient from "seller directly" to "the Trestly contract, on the seller's behalf, pending the dispute window."

```typescript
import { wrapX402Payment } from 'trestly-sdk';

const result = await wrapX402Payment(config, {
  payer: string;              // Buyer's Stellar address
  payee: string;              // Seller's Stellar address
  token: string;              // Token contract address
  amount: bigint;             // Amount in smallest unit
  disputeWindowSecs: number;  // Dispute window in seconds
  arbiter: string;            // Arbiter's Stellar address
  signTransaction: (xdr: string) => Promise<string>
});
// Returns: { paymentId: number, txHash: string }
```

#### `createPayment(config, params)`

Lower-level function to create an escrowed payment (called by `wrapX402Payment`).

```typescript
import { createPayment } from 'trestly-sdk';

const result = await createPayment(config, params);
```

#### `getPayment(config, paymentId)`

Retrieve payment details (read-only, no signing required).

```typescript
import { getPayment } from 'trestly-sdk';

const payment = await getPayment(config, 42);
console.log(payment.amount);        // bigint
console.log(payment.disputed);      // boolean
console.log(payment.resolved);      // boolean
console.log(payment.disputeWindowEnd); // bigint (unix timestamp)
```

#### `raiseDispute(config, params)`

Raise a dispute on a payment (must be called by payer within dispute window).

```typescript
import { raiseDispute } from 'trestly-sdk';

const result = await raiseDispute(config, {
  paymentId: 42,
  payer: payerAddress,
  signTransaction: async (xdr) => await signer(xdr)
});
```

#### `resolveDispute(config, params)`

Resolve a disputed payment (must be called by arbiter).

```typescript
import { resolveDispute } from 'trestly-sdk';

const result = await resolveDispute(config, {
  paymentId: 42,
  arbiter: arbiterAddress,
  refundToPayer: true, // true = refund, false = release to payee
  signTransaction: async (xdr) => await signer(xdr)
});
```

#### `release(config, paymentId, submitterKeypair)`

Release payment to payee after dispute window (public function, requires fee-paying keypair).

```typescript
import { release, Keypair } from 'trestly-sdk';

const submitter = Keypair.fromSecret('SXXX...');
const result = await release(config, 42, submitter);
```

## Wallet Integration

The SDK is wallet-agnostic and accepts a `signTransaction` callback, making it compatible with any Stellar wallet:

### Browser: Freighter

```typescript
import { setAllowed } from '@stellar/freighter-api';

const signTransaction = async (xdr: string) => {
  await setAllowed();
  const { signedTxXdr } = await window.freighter.signTransaction(xdr, {
    networkPassphrase: config.networkPassphrase
  });
  return signedTxXdr;
};
```

### Browser: Albedo

```typescript
import albedo from '@albedo-link/intent';

const signTransaction = async (xdr: string) => {
  const result = await albedo.tx({
    xdr,
    network: 'testnet'
  });
  return result.signed_envelope_xdr;
};
```

### Server: Keypair

```typescript
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

const keypair = Keypair.fromSecret('SXXX...');

const signTransaction = async (xdr: string) => {
  const tx = TransactionBuilder.fromXDR(xdr, config.networkPassphrase);
  tx.sign(keypair);
  return tx.toXDR();
};
```

## Complete Example

```typescript
import {
  wrapX402Payment,
  getPayment,
  raiseDispute,
  TrestlyConfig
} from 'trestly-sdk';

const config: TrestlyConfig = {
  contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015'
};

// 1. Create escrowed payment
const payment = await wrapX402Payment(config, {
  payer: 'GBUYER...',
  payee: 'GSELLER...',
  token: 'CTOKEN...',
  amount: 1000000n,
  disputeWindowSecs: 86400, // 24 hours
  arbiter: 'GARBITER...',
  signTransaction: async (xdr) => await freighter.signTransaction(xdr)
});

console.log(`Payment ${payment.paymentId} created`);

// 2. Check payment status
const details = await getPayment(config, payment.paymentId);
console.log('Dispute window ends:', new Date(Number(details.disputeWindowEnd) * 1000));

// 3. Optionally raise a dispute (within dispute window)
if (/* buyer has issue */) {
  await raiseDispute(config, {
    paymentId: payment.paymentId,
    payer: 'GBUYER...',
    signTransaction: async (xdr) => await freighter.signTransaction(xdr)
  });
}

// 4. After dispute window, payment auto-releases or arbiter resolves
```

## Types

```typescript
interface EscrowedPayment {
  payer: string;
  payee: string;
  token: string;
  amount: bigint;
  disputeWindowEnd: bigint; // Unix timestamp in seconds
  arbiter: string;
  disputed: boolean;
  resolved: boolean;
}

type SignTransaction = (xdr: string) => Promise<string>;
```

## Error Handling

The SDK throws descriptive errors for common failure cases:

```typescript
try {
  const result = await createPayment(config, params);
} catch (error) {
  if (error.message.includes('Simulation failed')) {
    // Contract rejected the transaction (e.g., invalid parameters)
    console.error('Contract error:', error.message);
  } else if (error.message.includes('confirmation timeout')) {
    // Transaction submitted but not confirmed in time
    console.error('Network delay:', error.message);
  } else {
    // Other errors (network, RPC, etc.)
    console.error('Unexpected error:', error);
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build for both ESM and CJS
npm run build

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## Architecture

This SDK is designed as infrastructure for other developers to install and import. It:

- Provides a pure client library (no UI, no server)
- Works in both Node.js and browser environments
- Exports dual ESM/CJS packages for maximum compatibility
- Decouples from specific wallets via the `signTransaction` callback pattern
- Matches the Trestly contract interface exactly

## Use Cases

- **Marketplaces**: Protect buyers and sellers in peer-to-peer transactions
- **Freelance platforms**: Hold payment until work is delivered and approved
- **Crowdfunding**: Escrow backer funds with refund mechanisms
- **Rental agreements**: Hold deposits with arbiter-based dispute resolution
- **Any x402 payment**: Drop-in replacement for direct transfers

## License

MIT

## Links

- [Trestly Contract](https://github.com/yourusername/trestly-contract)
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)

## Support

For issues and questions:
- GitHub Issues: [https://github.com/yourusername/trestly-sdk/issues](https://github.com/yourusername/trestly-sdk/issues)
- Stellar Discord: [https://discord.gg/stellar](https://discord.gg/stellar)
