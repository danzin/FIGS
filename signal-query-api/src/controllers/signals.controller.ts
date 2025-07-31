import { Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
import { SignalsService } from '../services/signals.service';
import {
  GetOhlcQueryDto,
  OhlcDataDto,
  IndicatorDto,
  GetLatestIndicatorsQueryDto,
} from '../models/signal.dto';

@Controller('v1')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  /**
   * GET /v1/assets
   * Returns the list of available crypto asset names.
   */
  @Get('assets')
  async listAssets(): Promise<string[]> {
    const assets = await this.signalsService.listAssetNames(); // returns [{ name: string }, …]
    return assets.map((asset) => asset.name);
  }

  /**
   * GET /v1/assets/:symbol/ohlc
   * Returns OHLC data for the specified asset symbol and query parameters.
   */
  @Get('assets/:symbol/ohlc')
  async getOhlc(
    @Param('symbol') symbol: string,
    @Query(new ValidationPipe({ transform: true }))
    queryParams: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    return this.signalsService.getOhlcData(symbol, queryParams);
  }

  /**
   * GET /v1/indicators/latest
   * Returns latest indicator values.
   * Can be optionally filtered by indicator names.
   */
  @Get('indicators/latest')
  async getLatestIndicators(
    @Query(new ValidationPipe({ transform: true }))
    queryParams: GetLatestIndicatorsQueryDto,
  ): Promise<Record<string, IndicatorDto>> {
    // The queryParams.names is optional now in the service
    return this.signalsService.getLatestIndicators(queryParams?.names);
  }

  @Get('metric-change/:name')
  async getMetricChange(
    @Param('name') name: string,
    @Query('type') type: 'percent' | 'absolute' = 'percent',
  ) {
    return this.signalsService.getMetricWithChange(name, type);
  }

  @Get('latest-news')
  async getLatestNews() {
    return this.signalsService.getLatestNewsWithSentiment();
  }
}
