#!/usr/bin/env ts-node
import fs from 'fs';
import axios from 'axios';
import { Keypair, Connection, clusterApiUrl, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import 'dotenv/config';

async function main() {
  // Load payer keypair path and facilitator proxy URL from environment
  const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;
  const proxyUrl = process.env.PROXY_URL || 'http://localhost:3000';
  if (!payerKeypairPath) {
    console.error('Please set PAYER_KEYPAIR_PATH environment variable to the payer keypair JSON file');
    process.exit(1);
  }
  // Read and parse the payer's secret key
  const secret = JSON.parse(fs.readFileSync(payerKeypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secret));

  // 1. Fetch payment metadata (price, mint, recipient)
  const meta = (await axios.get(`${proxyUrl}/.well-known/cdp.json`)).data;
  console.log('Metadata:', meta);
  const { network, price, mint, recipient } = meta;
  const rpcUrl = network === 'devnet' ? clusterApiUrl('devnet') : network;
  const connection = new Connection(rpcUrl, { commitment: 'confirmed' });

  // 2. Derive or create associated token accounts for payer and recipient
  const mintPubkey = new PublicKey(mint);
  const recipientPubkey = new PublicKey(recipient);
  const payerTokenAddress = await getAssociatedTokenAddress(mintPubkey, payer.publicKey);
  const recipientTokenAddress = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

  // 3. Calculate payment amount in smallest unit (price * 10^decimals)
  const amount = BigInt(price) * BigInt(10 ** 6); // decimals fixed at 6 for USDC-like token
  console.log(`Transferring ${amount.toString()} base units to ${recipientTokenAddress.toBase58()}`);
  // 4. Build SPL Token transfer instruction (transferChecked enforces correct mint & decimals)
  const transferIx = createTransferCheckedInstruction(
    payerTokenAddress,
    mintPubkey,
    recipientTokenAddress,
    payer.publicKey,
    Number(amount),
    6,
    [],
    TOKEN_PROGRAM_ID
  );
  // 5. (Optional) Add a Memo instruction with the RPC method name for context
  const memoIx = new TransactionInstruction({
    keys: [],
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    data: Buffer.from('get-slot', 'utf8'),
  });
  // 6. Send the transaction and confirm
  const tx = new Transaction().add(transferIx, memoIx);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log('Payment transaction signature:', signature);

  // 7. Query the protected RPC endpoint with the payment signature
  const response = (await axios.get(`${proxyUrl}/get-slot?txSig=${signature}`)).data;
  console.log('RPC response:', response);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});