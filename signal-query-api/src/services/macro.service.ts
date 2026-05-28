import { Injectable } from '@nestjs/common';
import { Errors } from '../errors/errors';
import {
  GetMacroAnaloguesQueryDto,
  GetMacroEventsQueryDto,
  MacroAnalysisLatestDto,
  MacroEventAnalogueDto,
  MacroEventDetailDto,
  MacroEventListItemDto,
  MacroInsightsSummaryDto,
  MacroScenarioLatestDto,
} from '../models/macro.dto';
import { MacroRepository } from '../repositories/macro.repository';

@Injectable()
export class MacroService {
  constructor(private readonly macroRepository: MacroRepository) {}

  async getMacroEvents(
    query: GetMacroEventsQueryDto,
  ): Promise<MacroEventListItemDto[]> {
    return this.macroRepository.listMacroEvents(query);
  }

  async getInsightsSummary(): Promise<MacroInsightsSummaryDto> {
    return this.macroRepository.getInsightsSummary();
  }

  async getMacroEventById(eventId: string): Promise<MacroEventDetailDto> {
    const event = await this.macroRepository.getMacroEventById(eventId);

    if (!event) {
      throw Errors.notFound('Macro event', eventId, {
        context: {
          operation: 'getMacroEventById',
        },
      });
    }

    return event;
  }

  async getMacroAnalogues(
    eventId: string,
    query: GetMacroAnaloguesQueryDto,
  ): Promise<MacroEventAnalogueDto[]> {
    return this.macroRepository.listMacroAnalogues(eventId, query);
  }

  async getLatestAnalysisForEvent(
    eventId: string,
  ): Promise<MacroAnalysisLatestDto | null> {
    return this.macroRepository.getLatestAnalysisForEvent(eventId);
  }

  async getLatestScenarioForEvent(
    eventId: string,
  ): Promise<MacroScenarioLatestDto | null> {
    return this.macroRepository.getLatestScenarioForEvent(eventId);
  }
}
