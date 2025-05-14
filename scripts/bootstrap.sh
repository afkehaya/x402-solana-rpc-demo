#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PAYER_KEYPAIR="$ROOT_DIR/payer-keypair.json"
# Optionally skip CLI config or SOL airdrop by setting these env vars to 1
SKIP_CLI_CONFIG="${SKIP_CLI_CONFIG:-0}"
SKIP_AIRDROP="${SKIP_AIRDROP:-0}"

echo "Generating fee-payer keypair at $PAYER_KEYPAIR..."
if [ ! -f "$PAYER_KEYPAIR" ]; then
  solana-keygen new --no-passphrase -o "$PAYER_KEYPAIR"
else
  echo "$PAYER_KEYPAIR already exists, skipping key generation"
fi

if [ "$SKIP_CLI_CONFIG" != "1" ]; then
  echo "Configuring Solana CLI: devnet endpoint and keypair..."
  solana config set --url devnet --keypair "$PAYER_KEYPAIR"
else
  echo "Skipping Solana CLI config (SKIP_CLI_CONFIG=1)"
fi

if [ "$SKIP_AIRDROP" != "1" ]; then
  echo "Requesting 2 SOL airdrop for fee-payer wallet..."
  solana airdrop 2 --url devnet
else
  echo "Skipping SOL airdrop (SKIP_AIRDROP=1)"
fi

echo "Creating new SPL token mint (6 decimals)..."
MINT=$(spl-token create-token --url devnet --owner "$PAYER_KEYPAIR")
echo "Mint address: $MINT"

echo "Creating associated token account for fee-payer..."
RECIPIENT_ATA=$(spl-token create-account "$MINT" --url devnet --owner "$PAYER_KEYPAIR")
echo "Recipient ATA: $RECIPIENT_ATA"

echo "Determining fee-payer public key..."
RECIPIENT=$(solana-keygen pubkey "$PAYER_KEYPAIR")
echo "Recipient wallet public key: $RECIPIENT"

echo "Updating x402/config.json with mint and recipient..."
if ! command -v jq &>/dev/null; then
  echo "Please install jq to automatically update config.json: https://stedolan.github.io/jq/"
  exit 1
fi
jq --arg mint "$MINT" --arg recipient "$RECIPIENT" '.mint=$mint | .recipient=$recipient' \
  "$ROOT_DIR/x402/config.json" > "$ROOT_DIR/x402/config.tmp.json" && mv "$ROOT_DIR/x402/config.tmp.json" "$ROOT_DIR/x402/config.json"

echo "Bootstrap complete."
echo "Payer keypair: $PAYER_KEYPAIR"
echo "Use PAYER_KEYPAIR_PATH=$PAYER_KEYPAIR when running the client script."