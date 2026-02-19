# NestJS Sample

A REST API built with [NestJS](https://nestjs.com/) and `@hiero-enterprise/nest` demonstrating dependency injection of Hiero services into controllers.

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
pnpm --filter hiero-nest-sample dev

# Production
pnpm --filter hiero-nest-sample build
pnpm --filter hiero-nest-sample start
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

Import `HieroModule.forRoot()` in your `AppModule`:

```ts
import { HieroModule } from '@hiero-enterprise/nest';

@Module({
  imports: [HieroModule.forRoot()],
})
export class AppModule {}
```

Then inject any service into your controllers:

```ts
@Controller('api')
export class AccountController {
  constructor(
    private readonly accountClient: AccountClient,
    private readonly accountRepo: AccountRepository,
  ) {}

  @Get('balance')
  getBalance() {
    return this.accountClient.getOperatorAccountBalance();
  }
}
```

All 15 services (6 clients + 6 repositories + context + mirror client + config) are available for injection.
