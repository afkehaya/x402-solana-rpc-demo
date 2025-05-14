#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";
import { Keypair, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

async function bootstrap() {
  // Network (devnet or RPC URL)
  const network = process.env.SOLANA_NETWORK || "devnet";
  const rpcUrl = network === "devnet" ? clusterApiUrl("devnet") : network;
  const connection = new Connection(rpcUrl, "confirmed");

  // Payer keypair (reuse if exists)
  const payerPath = path.join(__dirname, "payer-keypair.json");
  let payer: Keypair;
  if (fs.existsSync(payerPath)) {
    const secret = JSON.parse(fs.readFileSync(payerPath, "utf-8"));
    payer = Keypair.fromSecretKey(Uint8Array.from(secret));
    console.log("Using existing payer keypair at:", payerPath);
  } else {
    payer = Keypair.generate();
    fs.writeFileSync(payerPath, JSON.stringify(Array.from(payer.secretKey)));
    console.log("Generated new payer keypair at:", payerPath);
  }

  // Airdrop SOL for fees (skip if SKIP_AIRDROP=1)
  const skipAirdrop = process.env.SKIP_AIRDROP === "1";
  if (!skipAirdrop) {
    console.log("Requesting airdrop of 2 SOL...");
    const airdropSig = await connection.requestAirdrop(
      payer.publicKey,
      LAMPORTS_PER_SOL * 2
    );
    await connection.confirmTransaction(airdropSig, "confirmed");
    console.log("Airdrop confirmed:", airdropSig);
  } else {
    console.log("Skipping SOL airdrop (SKIP_AIRDROP=1)");
  }

  // Create new SPL token mint (6 decimals)
  console.log("Creating new USDC-like token mint...");
  const mint = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log("Mint created:", mint.toBase58());

  // Create associated token account for payer
  console.log("Creating associated token account for payer...");
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey, true);
  console.log("Associated token account:", ata.address.toBase58());

  // Mint initial supply to payer ATA (1 USDC = 1 * 10^6 units)
  const initialAmount = 1 * 10 ** 6;
  console.log(`Minting initial supply of ${initialAmount} units to payer ATA...`);
  const mintSig = await mintTo(
    connection,
    payer,
    mint,
    ata.address,
    payer,
    initialAmount
  );
  console.log("Mint transaction signature:", mintSig);

  // Generate a separate recipient keypair for payments
  console.log("Generating recipient keypair...");
  const recipientKeypair = Keypair.generate();
  const recipientPath = path.join(__dirname, "recipient-keypair.json");
  fs.writeFileSync(recipientPath, JSON.stringify(Array.from(recipientKeypair.secretKey)));
  console.log("Saved recipient keypair at:", recipientPath);

  // Create associated token account for recipient
  console.log("Creating associated token account for recipient...");
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    recipientKeypair.publicKey,
    true
  );
  console.log("Recipient ATA:", recipientAta.address.toBase58());

  // Update x402/config.json
  const config = {
    price: 1,
    mint: mint.toBase58(),
    recipient: recipientKeypair.publicKey.toBase58(),
    network,
  };
  const configPath = path.join(__dirname, "x402", "config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("Updated config.json at:", configPath);

  console.log("Bootstrap complete.");
  console.log("Use PAYER_KEYPAIR_PATH=" + payerPath + " when running the client script.");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});