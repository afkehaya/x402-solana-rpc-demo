#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import { Keypair, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import 'dotenv/config';

async function main() {
  // 1. Determine network (devnet or custom RPC URL) and set up connection
  const network = process.env.SOLANA_NETWORK || 'devnet';
  const rpcUrl = network === 'devnet' ? clusterApiUrl('devnet') : network;
  const connection = new Connection(rpcUrl, 'confirmed');

  // 2. Load or generate a keypair to pay for fees and transactions
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

  // 3. Airdrop SOL for transaction fees (devnet only; skip with SKIP_AIRDROP=1)
  if (!process.env.SKIP_AIRDROP) {
    console.log('Requesting airdrop of 2 SOL...');
    const sig = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL * 2);
    await connection.confirmTransaction(sig, 'confirmed');
    console.log(`Airdrop successful: ${sig}`);
  } else {
    console.log('Skipping airdrop (SKIP_AIRDROP=1)');
  }

  // 4. Create a new SPL token mint (USDC-like with 6 decimal places)
  console.log('Creating USDC-like token mint (6 decimals)...');
  const mint = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log(`Mint address: ${mint.toBase58()}`);

  // 5. Create or fetch the associated token account for the payer
  console.log('Creating associated token account for payer...');
  const payerAta = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
  console.log(`Payer ATA: ${payerAta.address.toBase58()}`);

  // 6. Mint initial token supply to the payer account (adjust amount as needed)
  console.log('Minting initial supply to payer...');
  const initialAmount = 1 * 10 ** 6; // 1 token = 1 * 10^6 base units
  const mintSig = await mintTo(connection, payer, mint, payerAta.address, payer, initialAmount);
  console.log(`Mint transaction signature: ${mintSig}`);

  // 7. Generate a recipient keypair for receiving payments
  console.log('Generating recipient keypair...');
  const recipientKeypair = Keypair.generate();
  const recipientPath = path.join(rootDir, 'recipient-keypair.json');
  fs.writeFileSync(recipientPath, JSON.stringify(Array.from(recipientKeypair.secretKey)));
  console.log(`Recipient keypair saved at: ${recipientPath}`);

  // 8. Create the associated token account for the recipient keypair
  console.log('Creating associated token account for recipient...');
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    recipientKeypair.publicKey
  );
  console.log(`Recipient ATA: ${recipientAta.address.toBase58()}`);

  // 9. Write the facilitator server config (price in whole tokens, mint, recipient, network)
  console.log('Updating facilitator server config...');
  const configPath = path.join(
    rootDir,
    'services',
    'facilitator-server',
    'src',
    'config.json'
  );
  const config = {
    price: 1, // cost per request in tokens
    mint: mint.toBase58(),
    recipient: recipientKeypair.publicKey.toBase58(),
    network,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Facilitator server config updated at: ${configPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});