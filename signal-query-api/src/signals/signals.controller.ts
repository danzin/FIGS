import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalDto, GetSignalsQueryDto } from '../models/signal.dto';

@Controller('signals') // Base path for this controller will be /signals
export class SignalsController {
  constructor(private readonly signalsService: SignalsService) {}

  @Get(':name')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  ) // Validate query params
  async getSignalByName(
    @Param('name') signalName: string,
    @Query() queryParams: GetSignalsQueryDto,
  ): Promise<SignalDto[]> {
    const signals = await this.signalsService.findByName(
      signalName,
      queryParams,
    );
    // if (signals.length === 0) { // Service handles this
    //   throw new NotFoundException(`No signals found for name '${signalName}' with the given criteria.`);
    // }
    return signals;
  }

  @Get(':name/latest')
  async getLatestSignalByName(
    @Param('name') signalName: string,
  ): Promise<SignalDto> {
    const signal = await this.signalsService.findLatestByName(signalName);
    if (!signal) {
      throw new NotFoundException(
        `No latest signal found for name '${signalName}'.`,
      );
    }
    return signal;
  }
}
