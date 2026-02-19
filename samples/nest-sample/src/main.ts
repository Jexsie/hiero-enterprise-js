import 'reflect-metadata';
import { Module, Controller, Get, Post, Param, Body, Injectable } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  HieroModule,
  AccountClient,
  TopicClient,
  AccountRepository,
  NftRepository,
  TokenRepository,
  TopicRepository,
  NetworkRepository,
} from '@hiero-enterprise/nest';

// ─── Controllers ──────────────────────────────────────────────

@Controller('api')
class AccountController {
  constructor(
    private readonly accountClient: AccountClient,
    private readonly accountRepo: AccountRepository,
    private readonly nftRepo: NftRepository,
  ) {}

  @Get('balance')
  getBalance() {
    return this.accountClient.getOperatorAccountBalance();
  }

  @Get('accounts/:id')
  getAccount(@Param('id') id: string) {
    return this.accountRepo.findByAccountId(id);
  }

  @Get('accounts/:id/nfts')
  getAccountNfts(@Param('id') id: string) {
    return this.nftRepo.findByOwner(id);
  }
}

@Controller('api/tokens')
class TokenController {
  constructor(private readonly tokenRepo: TokenRepository) {}

  @Get(':id')
  getToken(@Param('id') id: string) {
    return this.tokenRepo.findById(id);
  }
}

@Controller('api/topics')
class TopicController {
  constructor(
    private readonly topicClient: TopicClient,
    private readonly topicRepo: TopicRepository,
  ) {}

  @Get(':id/messages')
  getMessages(@Param('id') id: string) {
    return this.topicRepo.findByTopicId(id);
  }

  @Post()
  async createTopic(@Body() body: { memo?: string }) {
    const topicId = await this.topicClient.createTopic({ memo: body.memo });
    return { topicId };
  }

  @Post(':id/messages')
  async submitMessage(
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    await this.topicClient.submitMessage(id, body.message);
    return { status: 'submitted' };
  }
}

@Controller('api/network')
class NetworkController {
  constructor(private readonly networkRepo: NetworkRepository) {}

  @Get('exchange-rates')
  getExchangeRates() {
    return this.networkRepo.findExchangeRates();
  }

  @Get('supply')
  getSupply() {
    return this.networkRepo.findNetworkSupplies();
  }
}

// ─── App Module ───────────────────────────────────────────────

@Module({
  imports: [HieroModule.forRoot()],
  controllers: [
    AccountController,
    TokenController,
    TopicController,
    NetworkController,
  ],
})
class AppModule {}

// ─── Bootstrap ────────────────────────────────────────────────

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env['PORT'] ?? 3002;
  await app.listen(port);
  console.log(`🏗️  Hiero NestJS sample running on http://localhost:${port}`);
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
}

bootstrap();
