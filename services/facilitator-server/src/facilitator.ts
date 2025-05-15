import { Connection, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export interface FacilitatorConfig {
  price: number;
  mint: string;
  recipient: string;
  network: string;
}

export class Facilitator {
  private config: FacilitatorConfig;
  private connection: Connection;

  constructor(config: FacilitatorConfig, connection: Connection) {
    this.config = config;
    this.connection = connection;
  }

  metadataHandler(req: any, res: any) {
    const { network, price, mint, recipient } = this.config;
    res.json({
      protocol: "x402",
      network,
      price: price.toString(),
      currency: "USDC",
      mint,
      recipient,
    });
  }

  async verifyPayment(req: any, res: any, next: any) {
    const txSig = String(req.query.txSig || "");
    if (!txSig) {
      res.set("Location", "/.well-known/cdp.json");
      res.status(402).json({ error: "Payment required. Include txSig as query parameter." });
      return;
    }
    let tx: ParsedTransactionWithMeta | null;
    try {
      tx = await this.connection.getParsedTransaction(txSig, { commitment: "confirmed" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch transaction", details: err });
      return;
    }
    if (!tx) {
      res.status(400).json({ error: "Transaction not found or not confirmed" });
      return;
    }
    const rawAmount = BigInt(this.config.price) * BigInt(10 ** 6);
    const mintPubkey = new PublicKey(this.config.mint);
    const ownerPubkey = new PublicKey(this.config.recipient);
    let recipientAta: PublicKey;
    try {
      recipientAta = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
    } catch (err) {
      res.status(500).json({ error: "Failed to derive associated token address", details: err });
      return;
    }
    let paid = false;
    const postBalances = tx.meta?.postTokenBalances || [];
    for (const bal of postBalances) {
      if (
        bal.mint === this.config.mint &&
        bal.owner === this.config.recipient &&
        BigInt(bal.uiTokenAmount.amount) >= rawAmount
      ) {
        paid = true;
        break;
      }
    }
    if (!paid) {
      const topLevel = tx.transaction.message.instructions as any[];
      const innerInstrs = (tx.meta?.innerInstructions || []).flatMap((ii: any) => ii.instructions as any[]);
      const allInstrs = [...topLevel, ...innerInstrs];
      for (const inst of allInstrs) {
        const parsed: any = inst.parsed;
        if (!parsed || (parsed.type !== "transfer" && parsed.type !== "transferChecked")) continue;
        const info = parsed.info;
        if (
          BigInt(info.amount) >= rawAmount &&
          info.destination === recipientAta.toBase58()
        ) {
          paid = true;
          break;
        }
      }
    }
    if (!paid) {
      res.status(402).json({ error: "Insufficient payment" });
      return;
    }
    next();
  }
}