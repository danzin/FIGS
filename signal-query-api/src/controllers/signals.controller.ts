import { Controller, Get, Param, Query } from '@nestjs/common';
import { SignalsService } from './../services/signals.service';
import {
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

  @Get('assets')
  async listAssets(): Promise<string[]> {
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
}
