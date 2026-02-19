import express from 'express';
import { hieroMiddleware } from '@hiero-enterprise/express';

const app = express();
app.use(express.json());

// ─── Hiero Integration ────────────────────────────────────────
// All Hiero services are injected into req.hiero by the middleware.
// No additional setup required — config is read from env vars.
app.use(hieroMiddleware());

// ─── Account Routes ───────────────────────────────────────────

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

/** Query NFTs owned by an account */
app.get('/api/accounts/:id/nfts', async (req, res) => {
  try {
    const page = await req.hiero.nftRepository.findByOwner(req.params.id);
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Token Routes ─────────────────────────────────────────────

/** Query a token by ID */
app.get('/api/tokens/:id', async (req, res) => {
  try {
    const info = await req.hiero.tokenRepository.findById(req.params.id);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Topic Routes ─────────────────────────────────────────────

/** Query topic messages */
app.get('/api/topics/:id/messages', async (req, res) => {
  try {
    const page = await req.hiero.topicRepository.findByTopicId(req.params.id);
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/** Create a new public topic */
app.post('/api/topics', async (req, res) => {
  try {
    const { memo } = req.body as { memo?: string };
    const topicId = await req.hiero.topicClient.createTopic({ memo });
    res.status(201).json({ topicId });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/** Submit a message to a topic */
app.post('/api/topics/:id/messages', async (req, res) => {
  try {
    const { message } = req.body as { message: string };
    await req.hiero.topicClient.submitMessage(req.params.id, message);
    res.status(202).json({ status: 'submitted' });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Network Routes ───────────────────────────────────────────

/** Query exchange rates */
app.get('/api/network/exchange-rates', async (req, res) => {
  try {
    const rates = await req.hiero.networkRepository.findExchangeRates();
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

/** Query network supply */
app.get('/api/network/supply', async (req, res) => {
  try {
    const supply = await req.hiero.networkRepository.findNetworkSupplies();
    res.json(supply);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ─── Start ────────────────────────────────────────────────────

const port = process.env['PORT'] ?? 3000;
app.listen(port, () => {
  console.log(`🌐 Hiero Express sample running on http://localhost:${port}`);
  console.log();
  console.log('  Endpoints:');
  console.log('    GET  /api/balance');
  console.log('    GET  /api/accounts/:id');
  console.log('    GET  /api/accounts/:id/nfts');
  console.log('    GET  /api/tokens/:id');
  console.log('    GET  /api/topics/:id/messages');
  console.log('    POST /api/topics');
  console.log('    POST /api/topics/:id/messages');
  console.log('    GET  /api/network/exchange-rates');
  console.log('    GET  /api/network/supply');
});
