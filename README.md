# x402-solana  
![License](https://img.shields.io/badge/license-AGPL--3.0-red) ![Status](https://img.shields.io/badge/status-Experimental-orange)

> Solana-native implementation of the x402 pay-per-request protocol.

## Why x402 on Solana?
Web APIs are increasingly metered by usage—why not extend that model to blockchain access itself? x402 on Solana allows clients to pay per request in SPL tokens, providing:
- **Trustless micropayments**: proof of payment is recorded on-chain.
- **Decentralization**: any facilitator server can verify payments without centralized billing.
- **Smooth UX**: simple SPL token transfers and HTTP proxying.

## Features
- **Facilitator Server** (`services/facilitator-server`): verifies SPL token payments and proxies RPC calls.
- **Demo Setup Script** (`scripts/setup-demo-env.ts`): bootstraps a USDC-like token, airdrops SOL, creates accounts.
- **Example Client** (`examples/paid-rpc-endpoint`): TypeScript demo of pay-and-query flow.
- **JavaScript SDK Stub** (`clients/js-sdk`): starter functions for future SDK.
- **Protocol Spec** (`docs/spec.md`): HTTP 402 flow, JSON schemas, memo conventions.
- **On-chain Program Stub** (`programs/facilitator`): placeholder for future Solana contract.

## Requirements
- Node.js ≥14.x
- npm or Yarn
- Solana CLI (`solana`)
- TypeScript & ts-node (installed via devDependencies)

## Demo Walkthrough
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/x402-solana.git
   cd x402-solana
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
4. **Bootstrap demo environment**
   ```bash
   npm run setup:demo
   ```
   - Generates or reuses `payer-keypair.json`
   - Airdrops SOL on devnet
   - Creates a USDC-like SPL token mint (6 decimals)
   - Creates associated token accounts for payer and recipient
   - Mints initial supply to payer
   - Updates `services/facilitator-server/src/config.json`
5. **Start the facilitator server**
   ```bash
   npm run start:server
   ```
6. **Run the example client**
   ```bash
   export PAYER_KEYPAIR_PATH=./payer-keypair.json
   npm run example
   ```

## Project Structure
```
├── programs/                 # On-chain program stub
│   └── facilitator/
├── services/                 # Backend facilitator server
│   └── facilitator-server/
│       └── src/              # TypeScript source
├── clients/                  # SDKs and helpers
│   └── js-sdk/               # JavaScript SDK stub
├── examples/                 # Demo clients
│   └── paid-rpc-endpoint/    # TypeScript example script
├── scripts/                  # Environment & deployment scripts
│   └── setup-demo-env.ts     # Demo bootstrap
├── docs/                     # Protocol specification and docs
│   └── spec.md
├── .env.example              # Sample environment variables
├── .gitignore
├── LICENSE                   # AGPL v3
├── README.md
├── package.json
└── tsconfig.json
```

## How It Works
1. **Metadata**: client fetches `/.well-known/cdp.json` to read price, token mint, and recipient.
2. **Payment**: client builds and signs an SPL token transfer of `price * 10^decimals` units.
3. **Proxy**: client calls protected endpoint with `?txSig=...`. Facilitator verifies on-chain payment.
4. **Response**: on valid payment, facilitator proxies the RPC call and returns the JSON result.

## Contributing
We welcome contributions! Please follow these steps:
1. Fork the repo and create a feature branch.
2. Install dependencies and ensure code compiles:
   ```bash
   npm install
   npm run build
   ```
3. Run the demo to verify functionality:
   ```bash
   npm run setup:demo
   npm run start:server
   npm run example
   ```
4. Submit a PR with clear description and tests (if applicable).

**Code style**: formatting is handled by Prettier and ESLint (if configured).

## License
This project is licensed under the [GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html).

## Resources
- Solana Docs: https://docs.solana.com
- SPL Token Program: https://spl.solana.com/token
- x402 Protocol Whitepaper: *TBD*
- AGPL v3 License: https://www.gnu.org/licenses/agpl-3.0.html