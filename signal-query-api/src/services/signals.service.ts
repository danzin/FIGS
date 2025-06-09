import { Injectable, NotFoundException } from '@nestjs/common';
import { SignalsRepository } from '../repositories/signals.repository';
import { SignalDto, GetSignalsQueryDto } from '../models/signal.dto';

@Injectable()
export class SignalsService {
  constructor(private readonly repo: SignalsRepository) {}

  /**
   * Fetch either raw or bucketed signals, depending on queryParams.granularity.
   */
  async getByName(
    signalName: string,
    queryParams: GetSignalsQueryDto,
  ): Promise<SignalDto[]> {
    if (queryParams.granularity) {
      // Bucketed query
      return this.repo.findBucketed(signalName, queryParams);
    } else {
      // Raw query
      return this.repo.findRaw(signalName, queryParams);
    }
  }

  /**
   * Get the single latest data point.
   */
  async getLatest(signalName: string): Promise<SignalDto> {
    const latest = await this.repo.findLatest(signalName);
    if (!latest) {
      throw new NotFoundException(`No latest signal found for '${signalName}'`);
    }
    return latest;
  }

  /**
   * List all distinct signal names.
   */
  async listAllNames(): Promise<string[]> {
    return this.repo.listSignalNames();
  }
}
