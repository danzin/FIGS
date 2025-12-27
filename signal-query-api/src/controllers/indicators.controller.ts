import { Controller, Get } from '@nestjs/common';
import {
  AdvancedIndicatorsService,
  PowerLawData,
  StablecoinLiquidityData,
  OpenInterestData,
  MVRVData,
  HashRateData,
  MomentumCoalescenceData,
  CompositeIndicatorData,
} from '../services/advanced-indicators.service';

@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicatorsService: AdvancedIndicatorsService) {}

  @Get('power-law')
  async getPowerLaw(): Promise<PowerLawData> {
    return this.indicatorsService.getPowerLawData();
  }

  @Get('stablecoin-liquidity')
  async getStablecoinLiquidity(): Promise<StablecoinLiquidityData> {
    return this.indicatorsService.getStablecoinLiquidity();
  }

  @Get('open-interest')
  async getOpenInterest(): Promise<OpenInterestData> {
    return this.indicatorsService.getOpenInterest();
  }

  @Get('mvrv')
  async getMVRV(): Promise<MVRVData> {
    return this.indicatorsService.getMVRVData();
  }

  @Get('hash-rate')
  async getHashRate(): Promise<HashRateData> {
    return this.indicatorsService.getHashRateData();
  }

  @Get('momentum-coalescence')
  async getMomentumCoalescence(): Promise<MomentumCoalescenceData> {
    return this.indicatorsService.getMomentumCoalescence();
  }

  @Get('composite')
  async getComposite(): Promise<CompositeIndicatorData> {
    return this.indicatorsService.getCompositeIndicator();
  }

  @Get()
  async getAllIndicators() {
    const [
      powerLaw,
      stablecoin,
      openInterest,
      mvrv,
      hashRate,
      momentum,
      composite,
    ] = await Promise.all([
      this.indicatorsService.getPowerLawData(),
      this.indicatorsService.getStablecoinLiquidity(),
      this.indicatorsService.getOpenInterest(),
      this.indicatorsService.getMVRVData(),
      this.indicatorsService.getHashRateData(),
      this.indicatorsService.getMomentumCoalescence(),
      this.indicatorsService.getCompositeIndicator(),
    ]);

    return {
      powerLaw,
      stablecoin,
      openInterest,
      mvrv,
      hashRate,
      momentum,
      composite,
    };
  }
}
