# Hiero Enterprise JS

A TypeScript library that simplifies building Node.js applications on the [Hiero](https://hiero.org) (Hedera) distributed ledger network. Provides managed services for accounts, tokens, NFTs, smart contracts, topics, and mirror node queries — with first-class integrations for Express, Fastify, and NestJS.

> **Port of [hiero-enterprise-java](https://github.com/OpenElements/hiero-enterprise-java)** — same concepts, idiomatic TypeScript API.

## Packages

| Package | Description |
|---------|-------------|
| `@hiero-enterprise/core` | Data models, services, repositories, config, context, errors |
| `@hiero-enterprise/express` | Express middleware — `req.hiero.*` |
| `@hiero-enterprise/fastify` | Fastify plugin — `fastify.hiero.*` |
| `@hiero-enterprise/nest` | NestJS module — `HieroModule.forRoot()` with DI |

## Quick Start

### 1. Install

```bash
# Pick your framework package (each depends on core)
npm install @hiero-enterprise/express
# or
npm install @hiero-enterprise/fastify
# or
npm install @hiero-enterprise/nest
```

### 2. Configure

Set environment variables:

```bash
HIERO_NETWORK=testnet
HIERO_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
HIERO_OPERATOR_KEY=302e020100300506032b6570042204...
```

Or pass config explicitly:

```ts
{ network: 'testnet', operatorId: '0.0.12345', operatorKey: '302e...' }
```

### 3. Use

#### Express

```ts
import express from 'express';
import { hieroMiddleware } from '@hiero-enterprise/express';

const app = express();
app.use(hieroMiddleware());

app.get('/balance', async (req, res) => {
  const balance = await req.hiero.accountClient.getOperatorAccountBalance();
  res.json(balance);
});
```

#### Fastify

```ts
import Fastify from 'fastify';
import { hieroPlugin } from '@hiero-enterprise/fastify';

const app = Fastify();
await app.register(hieroPlugin);

app.get('/balance', async () => {
  return app.hiero.accountClient.getOperatorAccountBalance();
});
```

#### NestJS

```ts
import { Module } from '@nestjs/common';
import { HieroModule, AccountClient } from '@hiero-enterprise/nest';

@Module({ imports: [HieroModule.forRoot()] })
export class AppModule {}

@Controller('balance')
export class BalanceController {
  constructor(private readonly accounts: AccountClient) {}

  @Get()
  getBalance() {
    return this.accounts.getOperatorAccountBalance();
  }
}
```

## Available Services

| Service | Methods |
|---------|---------|
| `AccountClient` | `createAccount`, `deleteAccount`, `getAccountBalance`, `getOperatorAccountBalance` |
| `FileClient` | `createFile`, `readFile`, `updateFile`, `deleteFile`, `updateExpirationTime`, `isDeleted`, `getSize`, `getExpirationTime` |
| `FungibleTokenClient` | `createToken`, `associateToken`, `dissociateToken`, `mintToken`, `burnToken`, `transferToken` |
| `NftClient` | `createNftType`, `associateNft`, `dissociateNft`, `mintNft`, `mintNfts`, `burnNft`, `burnNfts`, `transferNft`, `transferNfts` |
| `SmartContractClient` | `createContract`, `createContractFromBytecode`, `callContractFunction`, `deleteContract` |
| `TopicClient` | `createTopic`, `createPrivateTopic`, `updateTopic`, `updateAdminKey`, `updateSubmitKey`, `deleteTopic`, `submitMessage` |

## Available Repositories (Mirror Node Queries)

| Repository | Methods |
|------------|---------|
| `AccountRepository` | `findByAccountId`, `findByAlias`, `getBalance` |
| `NftRepository` | `findByOwner`, `findByType`, `findBySerial`, `findByOwnerAndType` |
| `TokenRepository` | `findById`, `findByAccountId` |
| `TopicRepository` | `findByTopicId`, `findByTopicIdAndSequenceNumber` |
| `TransactionRepository` | `findByAccount`, `findByAccountAndType`, `findById` |
| `NetworkRepository` | `findExchangeRates`, `findNetworkSupplies`, `findStakingRewards` |

## Testing

```ts
import { testConfig, createMockMirrorNodeClient } from '@hiero-enterprise/core/testing';
```

The testing subpath provides:
- `testConfig` — safe dummy credentials for test environments
- `createMockMirrorNodeClient()` — fully typed mock returning sensible defaults

## Architecture

```
┌──────────────────────────────────────────────┐
│  Framework Integration                       │
│  (Express / Fastify / NestJS)                │
├──────────────────────────────────────────────┤
│  Services                    Repositories    │
│  (AccountClient, ...)       (AccountRepo,..) │
├──────────────────────────────────────────────┤
│  HieroContext         MirrorNodeClient       │
│  (SDK Client)         (REST HTTP)            │
├──────────────────────────────────────────────┤
│  HieroConfig    HieroError    Data Models    │
└──────────────────────────────────────────────┘
```

## Development

```bash
pnpm install          # Install dependencies
pnpm run build        # Build all packages
pnpm run test         # Run unit tests
pnpm run clean        # Clean build artifacts
```

## License

[Apache-2.0](./LICENSE)
