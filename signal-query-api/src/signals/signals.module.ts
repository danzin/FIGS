import { Module } from '@nestjs/common';
import { SignalsController } from '../controllers/signals.controller';
import { AnalyticsController } from '../controllers/analytics.controller';
import { IndicatorsController } from '../controllers/indicators.controller';
import { MacroController } from '../controllers/macro.controller';
import { SignalsService } from '../services/signals.service';
import { AnalyticsService } from '../services/analytics.service';
import { AdvancedIndicatorsService } from '../services/advanced-indicators.service';
import { MacroService } from '../services/macro.service';
import { CacheService } from '../services/cache.service';
import { SignalsRepository } from '../repositories/signals.repository';
import { MacroRepository } from '../repositories/macro.repository';
import { RealtimeGateway } from '../gateways/realtime.gateway';

@Module({
  controllers: [
    SignalsController,
    AnalyticsController,
    IndicatorsController,
    MacroController,
  ],
  providers: [
    SignalsService,
    AnalyticsService,
    AdvancedIndicatorsService,
    MacroService,
    CacheService,
    SignalsRepository,
    MacroRepository,
    RealtimeGateway,
  ],
  exports: [CacheService, RealtimeGateway],
})
export class SignalsModule {}
