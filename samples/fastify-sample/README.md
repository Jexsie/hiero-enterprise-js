# Fastify Sample

A REST API built with [Fastify](https://fastify.dev/) and `@hiero-enterprise/fastify` demonstrating how to query accounts, tokens, NFTs, topics, and network data from a Hiero/Hedera network.

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
pnpm --filter hiero-fastify-sample dev

# Production
pnpm --filter hiero-fastify-sample build
pnpm --filter hiero-fastify-sample start
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

Register the Hiero plugin with your Fastify instance:

```ts
import { hieroPlugin } from '@hiero-enterprise/fastify';

await app.register(hieroPlugin);
```

All services become available at `app.hiero`:

- **Services**: `accountClient`, `fileClient`, `fungibleTokenClient`, `nftClient`, `smartContractClient`, `topicClient`
- **Repositories**: `accountRepository`, `nftRepository`, `tokenRepository`, `topicRepository`, `transactionRepository`, `networkRepository`
- **Infra**: `context`, `mirrorNodeClient`

The plugin automatically cleans up the SDK client when the Fastify server shuts down.
