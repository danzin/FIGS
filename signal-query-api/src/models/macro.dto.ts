import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetMacroEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  severity_min?: number;
}

export class GetMacroAnaloguesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export interface MacroEventListItemDto {
  id: string;
  event_time: Date;
  event_type: string;
  channel: string;
  severity: number;
  confidence: number;
  region: string | null;
  canonical_text: string;
  source: string | null;
  title: string | null;
  url: string | null;
  published_at: Date | null;
}

export interface MacroChannelPressureDto {
  channel: string;
  eventCount: number;
  severitySum: number;
  severityAvg: number;
}

export interface MacroWindowSummaryDto {
  totalEvents: number;
  avgSeverity: number | null;
  channelPressure: MacroChannelPressureDto[];
}

export interface MacroAssetContextDto {
  current: number | null;
  previous: number | null;
  changePercent: number | null;
  time: Date | null;
}

export interface MacroInsightsSummaryDto {
  generatedAt: Date;
  windows: {
    last24h: MacroWindowSummaryDto;
    last7d: MacroWindowSummaryDto;
  };
  marketContext: {
    oil: MacroAssetContextDto;
    crypto: {
      bitcoin: MacroAssetContextDto;
      ethereum: MacroAssetContextDto;
    };
  };
}

export interface MacroEventDetailDto {
  id: string;
  raw_article_id: string | null;
  event_time: Date;
  event_type: string;
  channel: string;
  severity: number;
  confidence: number;
  region: string | null;
  country_codes: string[];
  affected_assets: string[];
  canonical_text: string;
  extraction_model: string;
  extraction_version: string;
  metadata: Record<string, unknown>;
  source: string | null;
  title: string | null;
  url: string | null;
  published_at: Date | null;
}

export interface MacroEventAnalogueDto {
  id: string;
  historical_event_id: string;
  rank: number;
  composite_score: number;
  embedding_similarity: number;
  regime_score: number;
  channel_score: number;
  event_time: Date;
  event_type: string;
  channel: string;
  severity: number;
  confidence: number;
  region: string | null;
  canonical_text: string;
  source: string | null;
  title: string | null;
  url: string | null;
}

export interface MacroAnalysisLatestDto {
  id: string;
  event_id: string;
  run_version: string;
  methodology: string;
  result_json: Record<string, unknown>;
  confidence_score: number;
  created_at: Date;
}

export interface MacroScenarioLatestDto {
  id: string;
  event_id: string;
  analysis_run_id: string;
  llm_model: string;
  prompt_version: string;
  report_text: string;
  confidence_band: string;
  created_at: Date;
}

