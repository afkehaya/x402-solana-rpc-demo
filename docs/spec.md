# x402 Protocol Specification (Solana)

## 1. Metadata Endpoint

GET `/.well-known/cdp.json`

Response:
```json
{
  "protocol": "x402",
  "network": "devnet",
  "price": "1",
  "currency": "USDC",
  "mint": "TokenMintAddress",
  "recipient": "RecipientPublicKey"
}
```

- `protocol`: Protocol identifier (`"x402"`).
- `network`: Solana cluster or RPC URL.
- `price`: Cost per request (in whole tokens).
- `currency`: Token symbol (e.g., `"USDC"`).
- `mint`: SPL token mint address.
- `recipient`: Wallet address receiving payments.

## 2. Protected RPC Endpoint

Clients must pay before calling protected routes. If `txSig` query parameter is missing or invalid, server responds:
- HTTP 402 Payment Required
- Header `Location: /.well-known/cdp.json`
- JSON body:
```json
{ "error": "Payment required. Include txSig as query parameter." }
```

If payment is insufficient:
- HTTP 402
- JSON body:
```json
{ "error": "Insufficient payment" }
```

## 3. Payment Verification

1. Server fetches the confirmed transaction by `txSig`.
2. Calculates required amount: `price * 10^decimals`.
3. Derives associated token account (ATA) of the recipient for the specified mint.
4. Checks:
   - Balance increase in `postTokenBalances`, or
   - A `transfer` or `transferChecked` instruction transferring at least the required amount to the recipient ATA.
5. On success, server proxies the original RPC request and returns the JSON response.

## 4. Memo Field

Clients MAY include a `Memo` instruction with the RPC method name or other context:
- Program ID: `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
- Data: ASCII memo string (e.g., `"get-slot"`)

## 5. Future Extensions

- JWT or session tokens to cache payment proofs
- On-chain facilitator registry for decentralized discovery
- Staking economic security with $X402 governance token