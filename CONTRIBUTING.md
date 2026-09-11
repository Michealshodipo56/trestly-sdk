# Contributing to trestly-sdk

Thanks for looking at this. This is the TypeScript client library that wraps
the Trestly Soroban contract — building, simulating, signing, and submitting
transactions for `create_payment`, `raise_dispute`, `release`,
`resolve_dispute`, and `get_payment`.

## Prerequisites

- Node.js 20+ (the SDK's `@stellar/stellar-sdk` dependency states Node 22+;
  20 has worked in practice, but if you hit something odd, try 22 first)

## Building and testing

```bash
npm install
npm test     # Jest, via jest.unstable_mockModule (this package is ESM --
             # classic jest.mock() factories don't hoist against real ES
             # module imports here, see test/client.test.ts)
npm run build
```

CI runs both on every push and pull request to `main`.

## Project layout

- `src/contract.ts` — low-level transaction building, ScVal param encoding,
  simulate/submit helpers
- `src/client.ts` — the public `createPayment`/`raiseDispute`/`release`/
  `resolveDispute`/`getPayment` functions
- `src/x402-wrapper.ts` — `wrapX402Payment`, the x402-flavored entrypoint
- `src/types.ts` — shared types (`TrestlyConfig`, `EscrowedPayment`, ...)
- `test/client.test.ts` — mocked unit tests for every client function

## A note on ScVal types

The contract's `payment_id` parameter is `u32`. If you add a new function
that takes a payment ID, make sure `contract.ts` encodes it as
`nativeToScVal(paymentId, { type: "u32" })` — encoding it as `u64` will pass
type-checking in TypeScript but fail at the RPC layer with a Soroban
type-mismatch error, since Soroban checks invocation args against the
contract's actual interface spec. (This exact mismatch was a real bug here
before — see git history on `contract.ts`.)

## Making a change

1. Fork and branch off `main`.
2. Add or update tests in `test/client.test.ts` for any behavior change.
3. Run `npm test` and `npm run build` locally before opening a PR.
4. Open a PR against `main`. CI must pass and the PR needs one approving
   review before it can merge (branch protection is on).

## Publishing

This package is not yet published to npm — `trestly-app` currently consumes
it via a vendored copy of `dist/` (see `trestly-app/vendor/trestly-sdk/`) to
work around Vercel building that repo in isolation. Publishing this to npm
properly (and switching `trestly-app` to a real npm dependency) is tracked as
an open issue — check the issue tracker before starting work on it.

## Reporting issues

Open a GitHub issue. If you're picking up an issue that's part of a
[Drips Wave](https://www.drips.network/wave/stellar) cycle, it'll be labeled
accordingly — read the acceptance criteria in the issue body before starting.
