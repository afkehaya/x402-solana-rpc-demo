// x402 Solana JS SDK (stub)

export interface Metadata {
  protocol: string;
  network: string;
  price: string;
  currency: string;
  mint: string;
  recipient: string;
}

/**
 * Fetch payment metadata from the facilitator server
 */
export async function getMetadata(proxyUrl: string): Promise<Metadata> {
  throw new Error('getMetadata not implemented');
}

/**
 * Pay using SPL tokens and query a protected RPC endpoint
 */
export async function payAndQuery(
  proxyUrl: string,
  method: string,
  params: any[],
  payerKeypair: Uint8Array
): Promise<any> {
  throw new Error('payAndQuery not implemented');
}