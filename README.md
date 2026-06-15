# Hiero Enterprise JS

[![CI](../../actions/workflows/build.yml/badge.svg)](../../actions/workflows/build.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hiero-hackers/hiero-enterprise-js/badge)](https://scorecard.dev/viewer/?uri=github.com/hiero-hackers/hiero-enterprise-js)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

Integrating a Hiero sdk into a production Node.js service has historically meant a lot of glue code that has nothing to do with your actual business logic: instantiating clients, managing config, plumbing operator keys, handling errors. Hiero Enterprise JS does that work for you. Drop in the middleware or module for your framework of choice and your routes get typed access to accounts, tokens, NFTs, smart contracts, topics, and mirror node queries — without any of the setup code.

It gives each major Node.js framework a native integration that matches how developers already think about that framework — middleware for Express/Fastify, dependency injection for NestJS. Write operations (creating accounts, minting tokens) go through the network client directly. Read operations (looking up balances, browsing NFTs) go through the mirror node REST API, which is faster and doesn't carry transaction fees. Both are exposed through a consistent interface so you don't have to think about which path to use.

## Packages

| Package | Description |
|---------|-------------|
| `@hiero-enterprise/core` | Standalone services, repositories, and types — use directly or with any framework |
| `@hiero-enterprise/express` | Express middleware — `req.hiero.*` |
| `@hiero-enterprise/fastify` | Fastify plugin — `fastify.hiero.*` |
| `@hiero-enterprise/nest` | NestJS module — `HieroModule.forRoot()` with full DI |

## Quick Start

> **Note:** These packages are not yet published to npm. The guide below shows how installation will work once they are. To run the project locally for development, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Standalone (no framework)

```bash
npm install @hiero-enterprise/core
```

```ts
import { HieroContext, AccountService } from '@hiero-enterprise/core';

const context = new HieroContext({
  network: 'testnet',
  operatorId: '0.0.12345',
  operatorKey: 'your_private_key_here',
  operatorKeyType: 'ed25519',
});

const accounts = new AccountService(context);
const account = await accounts.createAccount({ publicKey: '...', initialBalance: 10 });
console.log(account.accountId);

context.close();
```

### With a framework

```bash
# Install your framework adapter 
npm install @hiero-enterprise/express
npm install @hiero-enterprise/fastify
npm install @hiero-enterprise/nest
```

Set your operator credentials as environment variables:

```bash
HIERO_NETWORK=testnet
HIERO_OPERATOR_ID=0.0.12345
HIERO_OPERATOR_KEY=your_private_key_here
HIERO_OPERATOR_KEY_TYPE=ECDSA
```

`HIERO_OPERATOR_KEY_TYPE` is **required** and tells the SDK how to parse your private key. Hiero supports multiple key algorithms and there is no reliable way to auto-detect the format from the raw key string alone. Accepted values:

| Value | Description |
|-------|-------------|
| `ECDSA` | ECDSA secp256k1 key — compatible with EVM wallets and most providers |
| `ED25519` | Ed25519 key — native Hiero key type |
| `DER` | DER-encoded key (hex with ASN.1 headers, e.g. `302e020100...`) |

Or pass config directly when registering the integration.

**Express**

```ts
import express from 'express';
import { hieroMiddleware } from '@hiero-enterprise/express';

const app = express();
app.use(hieroMiddleware());

app.get('/balance', async (req, res) => {
  const balance = await req.hiero.accountService.getOperatorAccountBalance();
  res.json(balance);
});
```

**Fastify**

```ts
import Fastify from 'fastify';
import { hieroPlugin } from '@hiero-enterprise/fastify';

const app = Fastify();
await app.register(hieroPlugin);

app.get('/balance', async () => {
  return app.hiero.accountService.getOperatorAccountBalance();
});
```

**NestJS**

```ts
import { Module } from '@nestjs/common';
import { HieroModule, AccountService } from '@hiero-enterprise/nest';

@Module({ imports: [HieroModule.forRoot()] })
export class AppModule {}

@Controller('balance')
export class BalanceController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  getBalance() {
    return this.accounts.getOperatorAccountBalance();
  }
}
```

## Architecture

```
  Standalone             Framework adapters
  ───────────    ────────────────────────────────────
  import from    Express / Fastify / NestJS
  core directly  req.hiero.* | fastify.hiero.* | @Inject()
       │                │                │
       │                ▼                ▼
       │         ┌────────────────────────────┐
       └───────► │   @hiero-enterprise/core   │
                 ├────────────┬───────────────┤
                 │  Services  │ Repositories  │
                 │  Account   │ Account       │
                 │  File      │ NFT           │
                 │  Token     │ Token         │
                 │  NFT       │ Topic         │
                 │  Contract  │ Transaction   │
                 │  Topic     │ Network       │
                 ├────────────┴───────────────┤
                 │  HieroContext │ MirrorNode  │
                 │  (Hiero SDK)  │ (REST/HTTP) │
                 └───────┬───────┴──────┬─────┘
                         │              │
                         └──────┬───────┘
                                ▼
                       Hiero Network
                    (testnet / mainnet)
```

`@hiero-enterprise/core` is the standalone package that owns all services, repositories, and types. Framework adapters (`express`, `fastify`, `nest`) are thin integration layers that wire core into their respective DI/middleware patterns. You can use core directly without any framework.

Clients handle write operations through the Hiero SDK — transactions that go on-chain. Repositories handle reads through the mirror node, which doesn't cost fees and returns historical or indexed data. `HieroContext` owns the SDK client and operator credentials; both sides share it so there's one config source.

## Services

| Client | What it covers |
|--------|---------------|
| `AccountService` | Create, update, delete, approve allowances, check balances |
| `FileService` | Store and retrieve file content on-chain |
| `FungibleTokenService` | Create, mint, burn, and transfer fungible tokens |
| `NftService` | Create NFT types, mint (single + batch), burn, transfer |
| `SmartContractService` | Deploy and call EVM-compatible smart contracts |
| `TopicService` | Create topics, manage keys, submit messages |

## Mirror Node Queries

| Repository | What it covers |
|------------|---------------|
| `AccountRepository` | Look up accounts by ID or alias, fetch balances |
| `NftRepository` | Browse NFTs by owner, type, or serial number |
| `TokenRepository` | Fetch token metadata or tokens held by an account |
| `TopicRepository` | Read topic messages by sequence number |
| `TransactionRepository` | Query transactions by account or type |
| `NetworkRepository` | Exchange rates, supply stats, staking rewards |

## Samples

Working examples are in [`samples/`](./samples). Each one is a minimal but real service you can run against testnet.

| Sample | Framework |
|--------|-----------|
| [examples](./samples/examples) | Standalone `@hiero-enterprise/core` scripts |
| [express-sample](./samples/express-sample) | Express |
| [fastify-sample](./samples/fastify-sample) | Fastify |
| [nest-sample](./samples/nest-sample) | NestJS |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to report bugs, request features, and submit pull requests. All commits require a DCO sign-off (`git commit -s`) and GPG signing.

## License

[Apache-2.0](./LICENSE)
