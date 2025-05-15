# x402-solana

Solana-native implementation of the x402 protocol.

## Overview

x402 is a pay-per-request protocol: clients must include a payment on-chain before accessing protected API endpoints.

This repository provides:
- A facilitator HTTP server (`services/facilitator-server`) that checks for SPL token payments.
- A demo environment setup script (`scripts/setup-demo-env.ts`).
- A minimal example client (`examples/paid-rpc-endpoint`).
- A stub JavaScript SDK (`clients/js-sdk`).
- Protocol spec (`docs/spec.md`).
- Placeholder for On-chain Solana program (`programs/facilitator`).

## How x402 on Solana Works

1. Client requests metadata at `/.well-known/cdp.json` to retrieve price, mint, and recipient info.
2. Client creates and submits an SPL token transfer of the required `price` from payer to recipient, optionally adding a memo for the RPC method.
3. Client requests the protected RPC endpoint with `?txSig=` parameter.
4. Facilitator server verifies the payment on-chain, and if valid, proxies the RPC request and returns the JSON response.

## Setup Demo Environment

Install dependencies and run the setup script:
```bash
npm install
npm run setup:demo
```

This will:
1. Generate or reuse a payer keypair (`payer-keypair.json`).
2. Airdrop SOL on devnet.
3. Create a USDC-like SPL token mint with 6 decimals.
4. Create associated token accounts for payer and recipient.
5. Mint initial supply to payer.
6. Update `services/facilitator-server/src/config.json`.

## Running the Facilitator Server

```bash
npm run start:server
```

By default, listens on port `3000`. You can customize via `.env` or environment variables.

## Running the Example Client

```bash
# Set the path to your payer keypair
export PAYER_KEYPAIR_PATH=./payer-keypair.json
npm run example
```

## Payment Flow Using SPL Tokens

1. The client fetches the payment terms (mint, price, recipient).
2. The client builds and signs an SPL token transfer transaction for `price * 10^decimals` units.
3. The client submits the transaction to the Solana network.
4. The client calls the protected endpoint including `?txSig=...`.
5. The facilitator checks the transaction on-chain and proxies the request if payment is valid.

## Roadmap

- On-chain Solana program (`programs/facilitator`)
- $X402 governance token
- Access token (JWT) support to reduce on-chain queries
- Decentralized facilitator registry
- Staking and economic security