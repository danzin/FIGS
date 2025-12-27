import { Module } from '@nestjs/common';
import { SignalsController } from '../controllers/signals.controller';
import { AnalyticsController } from '../controllers/analytics.controller';
import { IndicatorsController } from '../controllers/indicators.controller';
import { SignalsService } from '../services/signals.service';
import { AnalyticsService } from '../services/analytics.service';
import { AdvancedIndicatorsService } from '../services/advanced-indicators.service';
import { CacheService } from '../services/cache.service';
import { SignalsRepository } from '../repositories/signals.repository';
import { RealtimeGateway } from '../gateways/realtime.gateway';

@Module({
  controllers: [SignalsController, AnalyticsController, IndicatorsController],
  providers: [
    SignalsService,
    AnalyticsService,
    AdvancedIndicatorsService,
    CacheService,
    SignalsRepository,
    RealtimeGateway,
  ],
  exports: [CacheService, RealtimeGateway],
})
export class SignalsModule {}
