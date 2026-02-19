/**
 * Hiero Enterprise JS — Express Sample Application
 *
 * Demonstrates using @hiero-enterprise/express with a simple REST API.
 *
 * To run:
 *   HIERO_NETWORK=testnet \
 *   HIERO_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID \
 *   HIERO_OPERATOR_KEY=YOUR_PRIVATE_KEY \
 *   npx tsx examples/express-sample.ts
 */

import express from 'express';
import { hieroMiddleware } from '../packages/express/src/index.js';

const app = express();
app.use(express.json());
app.use(hieroMiddleware());

// ─── Account Routes ────────────────────────────────────────────

/** Get the operator account balance */
app.get('/api/balance', async (req, res) => {
  try {
    const balance = await req.hiero.accountClient.getOperatorAccountBalance();
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/** Query an account from the mirror node */
app.get('/api/accounts/:id', async (req, res) => {
  try {
    const info = await req.hiero.accountRepository.findByAccountId(
      req.params.id,
    );
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Token Routes ──────────────────────────────────────────────

/** Query a token by ID */
app.get('/api/tokens/:id', async (req, res) => {
  try {
    const info = await req.hiero.tokenRepository.findById(req.params.id);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/** Query NFTs owned by an account */
app.get('/api/accounts/:id/nfts', async (req, res) => {
  try {
    const page = await req.hiero.nftRepository.findByOwner(req.params.id);
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Topic Routes ──────────────────────────────────────────────

/** Query topic messages */
app.get('/api/topics/:id/messages', async (req, res) => {
  try {
    const page = await req.hiero.topicRepository.findByTopicId(req.params.id);
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Network Routes ────────────────────────────────────────────

/** Query exchange rates */
app.get('/api/network/exchange-rates', async (req, res) => {
  try {
    const rates = await req.hiero.networkRepository.findExchangeRates();
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Start Server ──────────────────────────────────────────────

const port = process.env['PORT'] ?? 3000;
app.listen(port, () => {
  console.log(`🌐 Hiero Express sample running on http://localhost:${port}`);
  console.log('   GET /api/balance');
  console.log('   GET /api/accounts/:id');
  console.log('   GET /api/tokens/:id');
  console.log('   GET /api/accounts/:id/nfts');
  console.log('   GET /api/topics/:id/messages');
  console.log('   GET /api/network/exchange-rates');
});
