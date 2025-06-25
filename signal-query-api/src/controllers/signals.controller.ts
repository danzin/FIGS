import { Controller, Get, Param, Query } from '@nestjs/common';
import { SignalsService } from './../services/signals.service';
import {
  GetLatestSignalsQueryDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  SignalDto,
} from '../models/signal.dto';

@Controller('v1')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

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

  @Get('assets/:asset/latest')
  async getLatestPrice(@Param('asset') asset: string): Promise<SignalDto> {
    return this.signalsService.getLatestPrice(asset);
  }
}
