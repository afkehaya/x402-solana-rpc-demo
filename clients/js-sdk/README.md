# x402 Solana JS SDK

This is a stub for the x402 Solana JavaScript SDK. It will provide helper functions to:
- Fetch payment metadata
- Construct and submit SPL token payments
- Query protected RPC endpoints

Installation:
```bash
npm install @x402/solana-js-sdk
```

Usage:
```typescript
import { getMetadata, payAndQuery } from '@x402/solana-js-sdk';

async function example() {
  const meta = await getMetadata('http://localhost:3000');
  // TODO: implement SDK
}
```