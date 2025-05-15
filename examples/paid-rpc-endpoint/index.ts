#!/usr/bin/env ts-node
import fs from 'fs';
import axios from 'axios';
import { Keypair, Connection, clusterApiUrl, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import 'dotenv/config';

async function main() {
  const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;
  const proxyUrl = process.env.PROXY_URL || 'http://localhost:3000';
  if (!payerKeypairPath) {
    console.error('Please set PAYER_KEYPAIR_PATH environment variable');
    process.exit(1);
  }
  const secret = JSON.parse(fs.readFileSync(payerKeypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secret));

  // Fetch payment terms
  const meta = (await axios.get(`${proxyUrl}/.well-known/cdp.json`)).data;
  console.log('Metadata:', meta);
  const { network, price, mint, recipient } = meta;
  const rpcUrl = network === 'devnet' ? clusterApiUrl('devnet') : network;
  const connection = new Connection(rpcUrl, { commitment: 'confirmed' });

  // Derive token accounts
  const mintPubkey = new PublicKey(mint);
  const recipientPubkey = new PublicKey(recipient);
  const payerTokenAddress = await getAssociatedTokenAddress(mintPubkey, payer.publicKey);
  const recipientTokenAddress = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

  // Calculate amount (in smallest unit)
  const amount = BigInt(price) * BigInt(10 ** 6);
  console.log(`Transferring ${amount.toString()} units to ${recipientTokenAddress.toBase58()}`);
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
  const memoIx = new TransactionInstruction({
    keys: [],
    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    data: Buffer.from('get-slot', 'utf8'),
  });
  const tx = new Transaction().add(transferIx, memoIx);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log('Payment txSig:', signature);

  // Query protected endpoint
  const response = (await axios.get(`${proxyUrl}/get-slot?txSig=${signature}`)).data;
  console.log('RPC response:', response);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});