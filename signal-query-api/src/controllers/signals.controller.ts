import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { SignalsService } from './../services/signals.service';
import { GetSignalsQueryDto, OhlcDto, SignalDto } from '../models/signal.dto';

@Controller('signals')
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  @Get()
  async listAll(): Promise<string[]> {
    return this.signalsService.listAllNames();
  }

  @Get(':name')
  async getByName(
    @Param('name') name: string,
    @Query() queryParams: GetSignalsQueryDto,
  ): Promise<SignalDto[]> {
    console.log('Query Params:', queryParams);
    console.log('Signal Name:', name);
    return this.signalsService.getByName(name, queryParams);
  }

  @Get(':name/latest')
  async getLatest(@Param('name') name: string): Promise<SignalDto> {
    try {
      return await this.signalsService.getLatest(name);
    } catch (err) {
      if (err instanceof NotFoundException) {
        // rethrowing, nest turns it into 404
        throw err;
      }
      // bubble up
      throw err;
    }
  }
  @Get('ohlc/:name')
  async getOhlcData(
    @Param('name') name: string,
    @Query() queryParams: GetSignalsQueryDto,
  ): Promise<OhlcDto[]> {
    try {
      return await this.signalsService.getOhlcData(name, queryParams);
    } catch (err) {
      if (err instanceof NotFoundException) {
        // rethrowing, nest turns it into 404
        throw err;
      }
      // bubble up
      throw err;
    }
  }
}
