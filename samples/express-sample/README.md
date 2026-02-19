# Express Sample

A REST API built with [Express](https://expressjs.com/) and `@hiero-enterprise/express` demonstrating how to query accounts, tokens, NFTs, topics, and network data from a Hiero/Hedera network.

## Setup

```bash
# From the monorepo root
pnpm install

# Set your credentials
export HIERO_NETWORK=testnet
export HIERO_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
export HIERO_OPERATOR_KEY=YOUR_PRIVATE_KEY
```

## Run

```bash
# Development (with hot reload)
pnpm --filter hiero-express-sample dev

# Production
pnpm --filter hiero-express-sample build
pnpm --filter hiero-express-sample start
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/balance` | Operator account balance |
| `GET` | `/api/accounts/:id` | Account info from mirror node |
| `GET` | `/api/accounts/:id/nfts` | NFTs owned by an account |
| `GET` | `/api/tokens/:id` | Token info |
| `GET` | `/api/topics/:id/messages` | Topic messages |
| `POST` | `/api/topics` | Create a new topic |
| `POST` | `/api/topics/:id/messages` | Submit a message to a topic |
| `GET` | `/api/network/exchange-rates` | Current exchange rates |
| `GET` | `/api/network/supply` | Network supply info |

## How It Works

The key integration point is `hieroMiddleware()`:

```ts
import { hieroMiddleware } from '@hiero-enterprise/express';

app.use(hieroMiddleware());
```

This single line injects all Hiero services into every request at `req.hiero`, giving you access to:

- **Services**: `accountClient`, `fileClient`, `fungibleTokenClient`, `nftClient`, `smartContractClient`, `topicClient`
- **Repositories**: `accountRepository`, `nftRepository`, `tokenRepository`, `topicRepository`, `transactionRepository`, `networkRepository`
- **Infra**: `context`, `mirrorNodeClient`
