#!/usr/bin/env ts-node
import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import { Connection } from '@solana/web3.js';
import { Facilitator, FacilitatorConfig } from './facilitator';
import config from './config.json';

const app = express();
app.use(bodyParser.json());

// RPC endpoint from environment or fallback to public Devnet RPC
const rpcEndpoint = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';
console.log(`Using RPC endpoint: ${rpcEndpoint}`);

// Setup Solana connection for payment verification
const solanaRpcUrl =
  config.network === 'devnet' ? 'https://api.devnet.solana.com' : config.network;
const connection = new Connection(solanaRpcUrl, { commitment: 'confirmed' });

const facilitator = new Facilitator(config as FacilitatorConfig, connection);

// Metadata endpoint
app.get('/.well-known/cdp.json', (req, res) => facilitator.metadataHandler(req, res));

// Protected get-slot endpoint
app.get(
  '/get-slot',
  (req, res, next) => facilitator.verifyPayment(req, res, next),
  async (req, res) => {
    try {
      const response = await axios.post(
        rpcEndpoint,
        { jsonrpc: '2.0', id: 1, method: 'getSlot', params: [] },
        { headers: { 'Content-Type': 'application/json' } }
      );
      res.json(response.data);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'RPC call failed', details: message });
    }
  }
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`RPC Proxy server listening on port ${port}`);
});