import { Module } from '@nestjs/common';
import { SignalsController } from '../controllers/signals.controller';
import { AnalyticsController } from '../controllers/analytics.controller';
import { SignalsService } from '../services/signals.service';
import { AnalyticsService } from '../services/analytics.service';
import { CacheService } from '../services/cache.service';
import { SignalsRepository } from '../repositories/signals.repository';
import { RealtimeGateway } from '../gateways/realtime.gateway';

@Module({
  controllers: [SignalsController, AnalyticsController],
  providers: [
    SignalsService,
    AnalyticsService,
    CacheService,
    SignalsRepository,
    RealtimeGateway,
  ],
  exports: [CacheService, RealtimeGateway],
})
export class SignalsModule {}
