import { Controller, Get, Param, Query, ValidationPipe } from '@nestjs/common';
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
import { MacroService } from '../services/macro.service';

@Controller('v1/macro')
export class MacroController {
  constructor(private readonly macroService: MacroService) {}

  @Get('events')
  async getMacroEvents(
    @Query(new ValidationPipe({ transform: true }))
    query: GetMacroEventsQueryDto,
  ): Promise<MacroEventListItemDto[]> {
    return this.macroService.getMacroEvents(query);
  }

  @Get('events/:id')
  async getMacroEventById(
    @Param('id') id: string,
  ): Promise<MacroEventDetailDto> {
    return this.macroService.getMacroEventById(id);
  }

  @Get('events/:id/analogues')
  async getMacroAnalogues(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true }))
    query: GetMacroAnaloguesQueryDto,
  ): Promise<MacroEventAnalogueDto[]> {
    return this.macroService.getMacroAnalogues(id, query);
  }

  @Get('events/:id/analysis/latest')
  async getLatestAnalysis(
    @Param('id') id: string,
  ): Promise<MacroAnalysisLatestDto | null> {
    return this.macroService.getLatestAnalysisForEvent(id);
  }

  @Get('events/:id/scenario/latest')
  async getLatestScenario(
    @Param('id') id: string,
  ): Promise<MacroScenarioLatestDto | null> {
    return this.macroService.getLatestScenarioForEvent(id);
  }

  @Get('insights/summary')
  async getInsightsSummary(): Promise<MacroInsightsSummaryDto> {
    return this.macroService.getInsightsSummary();
  }
}
