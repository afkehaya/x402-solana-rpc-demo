#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { Keypair, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import 'dotenv/config';

async function main() {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  const rpcUrl = network === 'devnet' ? clusterApiUrl('devnet') : network;
  const connection = new Connection(rpcUrl, 'confirmed');

  const rootDir = path.resolve(__dirname, '..');
  const payerPath = path.join(rootDir, 'payer-keypair.json');
  let payer: Keypair;
  if (fs.existsSync(payerPath)) {
    const secret = JSON.parse(fs.readFileSync(payerPath, 'utf-8'));
    payer = Keypair.fromSecretKey(Uint8Array.from(secret));
    console.log(`Using existing payer keypair at ${payerPath}`);
  } else {
    payer = Keypair.generate();
    fs.writeFileSync(payerPath, JSON.stringify(Array.from(payer.secretKey)));
    console.log(`Generated payer keypair at ${payerPath}`);
  }

  if (!process.env.SKIP_AIRDROP) {
    console.log('Requesting airdrop of 2 SOL...');
    const sig = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL * 2);
    await connection.confirmTransaction(sig, 'confirmed');
    console.log(`Airdrop successful: ${sig}`);
  } else {
    console.log('Skipping airdrop (SKIP_AIRDROP=1)');
  }

  console.log('Creating USDC-like token mint (6 decimals)...');
  const mint = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log(`Mint: ${mint.toBase58()}`);

  console.log('Creating associated token account for payer...');
  const payerAta = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
  console.log(`Payer ATA: ${payerAta.address.toBase58()}`);

  console.log('Minting initial supply to payer...');
  const initialAmount = 1 * 10 ** 6;
  const mintSig = await mintTo(connection, payer, mint, payerAta.address, payer, initialAmount);
  console.log(`Mint tx: ${mintSig}`);

  console.log('Generating recipient keypair...');
  const recipientKeypair = Keypair.generate();
  const recipientPath = path.join(rootDir, 'recipient-keypair.json');
  fs.writeFileSync(recipientPath, JSON.stringify(Array.from(recipientKeypair.secretKey)));
  console.log(`Recipient keypair at ${recipientPath}`);

  console.log('Creating associated token account for recipient...');
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    recipientKeypair.publicKey
  );
  console.log(`Recipient ATA: ${recipientAta.address.toBase58()}`);

  console.log('Updating config.json with mint and recipient...');
  const configPath = path.join(
    rootDir,
    'services',
    'facilitator-server',
    'src',
    'config.json'
  );
  const config = {
    price: 1,
    mint: mint.toBase58(),
    recipient: recipientKeypair.publicKey.toBase58(),
    network,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Updated config.json at ${configPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});