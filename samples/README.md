# Samples

Sample projects demonstrating how to use `@hiero-enterprise/*` packages with different Node.js frameworks.

| Sample | Framework | Port | Description |
|--------|-----------|------|-------------|
| [express-sample](./express-sample) | Express | 3000 | Middleware-based — `req.hiero.*` |
| [fastify-sample](./fastify-sample) | Fastify | 3001 | Plugin-based — `app.hiero.*` |
| [nest-sample](./nest-sample) | NestJS | 3002 | DI-based — `@Inject()` constructors |

## Quick Start

```bash
# 1. Install everything from the repo root
pnpm install

# 2. Set your credentials
export HIERO_NETWORK=testnet
export HIERO_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
export HIERO_OPERATOR_KEY=YOUR_PRIVATE_KEY

# 3. Run any sample
pnpm --filter hiero-express-sample dev
pnpm --filter hiero-fastify-sample dev
pnpm --filter hiero-nest-sample dev
```

Each sample exposes the same REST endpoints so you can compare framework usage patterns.
