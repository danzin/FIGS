import { Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
import { SignalsService } from '../services/signals.service';
import {
  AssetDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  IndicatorDto,
  GetLatestIndicatorsQueryDto,
} from '../models/signal.dto';

@Controller('v1')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  @Get('assets')
  async listAssets(): Promise<AssetDto[]> {
    return this.signalsService.listAssets();
  }

  @Get('assets/:symbol/ohlc')
  async getOhlc(
    @Param('symbol') symbol: string,
    @Query(new ValidationPipe({ transform: true }))
    queryParams: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    return this.signalsService.getOhlcData(symbol, queryParams);
  }

  @Get('indicators/latest')
  async getLatestIndicators(
    @Query(new ValidationPipe({ transform: true }))
    queryParams: GetLatestIndicatorsQueryDto,
  ): Promise<Record<string, IndicatorDto>> {
    // The queryParams.names is optional now in the service
    return this.signalsService.getLatestIndicators(queryParams?.names);
  }
}
