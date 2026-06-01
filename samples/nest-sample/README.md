# NestJS Sample

A REST API built with [NestJS](https://nestjs.com/) and `@hiero-enterprise/nest` demonstrating dependency injection of Hiero services into controllers.

## Setup

```bash
# From the monorepo root
pnpm install

# Copy the example env and fill in your credentials
cp .env.example .env
```

Edit the `.env` file — fill in the required fields (`HIERO_OPERATOR_ID`, `HIERO_OPERATOR_KEY`, `HIERO_OPERATOR_KEY_TYPE`) and uncomment any optional fields you need.

You can get a free Hiero testnet account at https://portal.hedera.com.

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
