import { Controller, Get, Param, Query } from '@nestjs/common';
import { SignalsService } from './../services/signals.service';
import {
  GetDashboardDataQueryDto,
  GetLatestPricesQueryDto,
  GetLatestSignalsQueryDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  PriceDTO,
  SignalDto,
} from '../models/signal.dto';

@Controller('v1')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  @Get('dashboard/latest')
  async getDashboardData(@Query() queryParams: GetDashboardDataQueryDto) {
    return this.signalsService.getLatestDashboardData(
      queryParams.assets,
      queryParams.indicators,
    );
  }

  @Get('assets') // Returns a list of all available assets
  async listAssets() {
    return this.signalsService.listAssets();
  }

  @Get('assets/:asset/ohlc')
  async getOhlc(
    @Param('asset') asset: string,
    @Query() queryParams: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    console.log('Received query params:', queryParams);
    return this.signalsService.getOhlcData(asset, queryParams);
  }

  @Get('assets/latest') // Latest asset prices
  // Example request: /api/v1/assets/latest?assets=brent_crude_oil
  async getLatestPrice(
    @Query() queryParams: GetLatestPricesQueryDto,
  ): Promise<Record<string, PriceDTO>> {
    return this.signalsService.getLatestPricesByNames(queryParams.assets);
  }

  @Get('signals') // For general signals
  async listGeneralSignals(): Promise<string[]> {
    return this.signalsService.listGeneralSignals();
  }

  @Get('signals/latest') // Latest general signals
  async getLatestSignals(
    @Query() queryParams: GetLatestSignalsQueryDto,
  ): Promise<Record<string, SignalDto>> {
    return this.signalsService.getLatestSignalsByNames(queryParams.names);
  }
}
