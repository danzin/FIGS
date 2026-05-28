import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { Errors } from '../errors/errors';
import {
  GetMacroAnaloguesQueryDto,
  GetMacroEventsQueryDto,
  MacroAnalysisLatestDto,
  MacroAssetContextDto,
  MacroChannelPressureDto,
  MacroEventAnalogueDto,
  MacroEventDetailDto,
  MacroEventListItemDto,
  MacroInsightsSummaryDto,
  MacroScenarioLatestDto,
  MacroWindowSummaryDto,
} from '../models/macro.dto';
import {
  PgNumericValue,
  PgTimestampValue,
  readDate,
  readNullableDate,
  readNullableNumber,
  readNullableString,
  readNumber,
  readRecordOrEmpty,
  readString,
  readStringArray,
} from './pg-row.parsers';

type PriceTable = 'market_data_1h' | 'market_data_1d';

interface MacroEventListRow {
  id: unknown;
  event_time: PgTimestampValue;
  event_type: unknown;
  channel: unknown;
  severity: PgNumericValue;
  confidence: PgNumericValue;
  region: unknown;
  canonical_text: unknown;
  source: unknown;
  title: unknown;
  url: unknown;
  published_at: PgTimestampValue;
}

interface MacroEventDetailRow extends MacroEventListRow {
  raw_article_id: unknown;
  country_codes: unknown;
  affected_assets: unknown;
  extraction_model: unknown;
  extraction_version: unknown;
  metadata: unknown;
}

interface MacroAnalogueRow {
  id: unknown;
  historical_event_id: unknown;
  rank: PgNumericValue;
  composite_score: PgNumericValue;
  embedding_similarity: PgNumericValue;
  regime_score: PgNumericValue;
  channel_score: PgNumericValue;
  event_time: PgTimestampValue;
  event_type: unknown;
  channel: unknown;
  severity: PgNumericValue;
  confidence: PgNumericValue;
  region: unknown;
  canonical_text: unknown;
  source: unknown;
  title: unknown;
  url: unknown;
}

interface MacroAnalysisRow {
  id: unknown;
  event_id: unknown;
  run_version: unknown;
  methodology: unknown;
  result_json: unknown;
  confidence_score: PgNumericValue;
  created_at: PgTimestampValue;
}

interface MacroScenarioRow {
  id: unknown;
  event_id: unknown;
  analysis_run_id: unknown;
  llm_model: unknown;
  prompt_version: unknown;
  report_text: unknown;
  confidence_band: unknown;
  created_at: PgTimestampValue;
}

interface WindowTotalsRow {
  total_events: PgNumericValue;
  avg_severity: PgNumericValue;
}

interface ChannelPressureRow {
  channel: unknown;
  event_count: PgNumericValue;
  severity_sum: PgNumericValue;
  severity_avg: PgNumericValue;
}

interface AssetContextRow {
  current: PgNumericValue;
  previous: PgNumericValue;
  current_time: PgTimestampValue;
}

@Injectable()
export class MacroRepository {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  public async listMacroEvents(
    params: GetMacroEventsQueryDto,
  ): Promise<MacroEventListItemDto[]> {
    const limit = params.limit ?? 50;
    const query = `
      SELECT
        e.id,
        e.event_time,
        e.event_type,
        e.channel,
        e.severity::float8 AS severity,
        e.confidence::float8 AS confidence,
        e.region,
        e.canonical_text,
        a.source,
        a.title,
        a.url,
        a.published_at
      FROM public.macro_events e
      LEFT JOIN public.macro_raw_articles a ON a.id = e.raw_article_id
      WHERE ($1::text IS NULL OR e.channel = $1)
        AND ($2::float8 IS NULL OR e.severity >= $2)
      ORDER BY e.event_time DESC
      LIMIT $3;
    `;

    const rows = await this.queryRows<MacroEventListRow>(
      'listMacroEvents',
      query,
      [params.channel || null, params.severity_min ?? null, limit],
    );

    return rows.map((row) => ({
      id: readString(row.id, 'id', 'listMacroEvents'),
      event_time: readDate(row.event_time, 'event_time', 'listMacroEvents'),
      event_type: readString(row.event_type, 'event_type', 'listMacroEvents'),
      channel: readString(row.channel, 'channel', 'listMacroEvents'),
      severity: readNumber(row.severity, 'severity', 'listMacroEvents'),
      confidence: readNumber(row.confidence, 'confidence', 'listMacroEvents'),
      region: readNullableString(row.region, 'region', 'listMacroEvents'),
      canonical_text: readString(
        row.canonical_text,
        'canonical_text',
        'listMacroEvents',
      ),
      source: readNullableString(row.source, 'source', 'listMacroEvents'),
      title: readNullableString(row.title, 'title', 'listMacroEvents'),
      url: readNullableString(row.url, 'url', 'listMacroEvents'),
      published_at: readNullableDate(
        row.published_at,
        'published_at',
        'listMacroEvents',
      ),
    }));
  }

  public async getMacroEventById(
    eventId: string,
  ): Promise<MacroEventDetailDto | null> {
    const query = `
      SELECT
        e.id,
        e.raw_article_id,
        e.event_time,
        e.event_type,
        e.channel,
        e.severity::float8 AS severity,
        e.confidence::float8 AS confidence,
        e.region,
        e.country_codes,
        e.affected_assets,
        e.canonical_text,
        e.extraction_model,
        e.extraction_version,
        e.metadata,
        a.source,
        a.title,
        a.url,
        a.published_at
      FROM public.macro_events e
      LEFT JOIN public.macro_raw_articles a ON a.id = e.raw_article_id
      WHERE e.id = $1
      LIMIT 1;
    `;

    const rows = await this.queryRows<MacroEventDetailRow>(
      'getMacroEventById',
      query,
      [eventId],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: readString(row.id, 'id', 'getMacroEventById', { eventId }),
      raw_article_id: readNullableString(
        row.raw_article_id,
        'raw_article_id',
        'getMacroEventById',
        { eventId },
      ),
      event_time: readDate(row.event_time, 'event_time', 'getMacroEventById', {
        eventId,
      }),
      event_type: readString(
        row.event_type,
        'event_type',
        'getMacroEventById',
        { eventId },
      ),
      channel: readString(row.channel, 'channel', 'getMacroEventById', {
        eventId,
      }),
      severity: readNumber(row.severity, 'severity', 'getMacroEventById', {
        eventId,
      }),
      confidence: readNumber(
        row.confidence,
        'confidence',
        'getMacroEventById',
        { eventId },
      ),
      region: readNullableString(row.region, 'region', 'getMacroEventById', {
        eventId,
      }),
      country_codes: readStringArray(
        row.country_codes,
        'country_codes',
        'getMacroEventById',
        { eventId },
      ),
      affected_assets: readStringArray(
        row.affected_assets,
        'affected_assets',
        'getMacroEventById',
        { eventId },
      ),
      canonical_text: readString(
        row.canonical_text,
        'canonical_text',
        'getMacroEventById',
        { eventId },
      ),
      extraction_model: readString(
        row.extraction_model,
        'extraction_model',
        'getMacroEventById',
        { eventId },
      ),
      extraction_version: readString(
        row.extraction_version,
        'extraction_version',
        'getMacroEventById',
        { eventId },
      ),
      metadata: readRecordOrEmpty(row.metadata),
      source: readNullableString(row.source, 'source', 'getMacroEventById', {
        eventId,
      }),
      title: readNullableString(row.title, 'title', 'getMacroEventById', {
        eventId,
      }),
      url: readNullableString(row.url, 'url', 'getMacroEventById', {
        eventId,
      }),
      published_at: readNullableDate(
        row.published_at,
        'published_at',
        'getMacroEventById',
        { eventId },
      ),
    };
  }

  public async listMacroAnalogues(
    eventId: string,
    params: GetMacroAnaloguesQueryDto,
  ): Promise<MacroEventAnalogueDto[]> {
    const limit = params.limit ?? 10;
    const query = `
      SELECT
        a.id,
        a.historical_event_id,
        a.rank,
        a.composite_score::float8 AS composite_score,
        a.embedding_similarity::float8 AS embedding_similarity,
        a.regime_score::float8 AS regime_score,
        a.channel_score::float8 AS channel_score,
        e.event_time,
        e.event_type,
        e.channel,
        e.severity::float8 AS severity,
        e.confidence::float8 AS confidence,
        e.region,
        e.canonical_text,
        r.source,
        r.title,
        r.url
      FROM public.macro_event_analogues a
      JOIN public.macro_events e ON e.id = a.historical_event_id
      LEFT JOIN public.macro_raw_articles r ON r.id = e.raw_article_id
      WHERE a.event_id = $1
      ORDER BY a.rank ASC
      LIMIT $2;
    `;

    const rows = await this.queryRows<MacroAnalogueRow>(
      'listMacroAnalogues',
      query,
      [eventId, limit],
    );

    return rows.map((row) => ({
      id: readString(row.id, 'id', 'listMacroAnalogues', { eventId }),
      historical_event_id: readString(
        row.historical_event_id,
        'historical_event_id',
        'listMacroAnalogues',
        { eventId },
      ),
      rank: readNumber(row.rank, 'rank', 'listMacroAnalogues', { eventId }),
      composite_score: readNumber(
        row.composite_score,
        'composite_score',
        'listMacroAnalogues',
        { eventId },
      ),
      embedding_similarity: readNumber(
        row.embedding_similarity,
        'embedding_similarity',
        'listMacroAnalogues',
        { eventId },
      ),
      regime_score: readNumber(
        row.regime_score,
        'regime_score',
        'listMacroAnalogues',
        { eventId },
      ),
      channel_score: readNumber(
        row.channel_score,
        'channel_score',
        'listMacroAnalogues',
        { eventId },
      ),
      event_time: readDate(row.event_time, 'event_time', 'listMacroAnalogues', {
        eventId,
      }),
      event_type: readString(
        row.event_type,
        'event_type',
        'listMacroAnalogues',
        { eventId },
      ),
      channel: readString(row.channel, 'channel', 'listMacroAnalogues', {
        eventId,
      }),
      severity: readNumber(row.severity, 'severity', 'listMacroAnalogues', {
        eventId,
      }),
      confidence: readNumber(
        row.confidence,
        'confidence',
        'listMacroAnalogues',
        { eventId },
      ),
      region: readNullableString(row.region, 'region', 'listMacroAnalogues', {
        eventId,
      }),
      canonical_text: readString(
        row.canonical_text,
        'canonical_text',
        'listMacroAnalogues',
        { eventId },
      ),
      source: readNullableString(row.source, 'source', 'listMacroAnalogues', {
        eventId,
      }),
      title: readNullableString(row.title, 'title', 'listMacroAnalogues', {
        eventId,
      }),
      url: readNullableString(row.url, 'url', 'listMacroAnalogues', {
        eventId,
      }),
    }));
  }

  public async getLatestAnalysisForEvent(
    eventId: string,
  ): Promise<MacroAnalysisLatestDto | null> {
    const query = `
      SELECT
        id,
        event_id,
        run_version,
        methodology,
        result_json,
        confidence_score::float8 AS confidence_score,
        created_at
      FROM public.macro_analysis_runs
      WHERE event_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const rows = await this.queryRows<MacroAnalysisRow>(
      'getLatestAnalysisForEvent',
      query,
      [eventId],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: readString(row.id, 'id', 'getLatestAnalysisForEvent', { eventId }),
      event_id: readString(
        row.event_id,
        'event_id',
        'getLatestAnalysisForEvent',
        { eventId },
      ),
      run_version: readString(
        row.run_version,
        'run_version',
        'getLatestAnalysisForEvent',
        { eventId },
      ),
      methodology: readString(
        row.methodology,
        'methodology',
        'getLatestAnalysisForEvent',
        { eventId },
      ),
      result_json: readRecordOrEmpty(row.result_json),
      confidence_score: readNumber(
        row.confidence_score,
        'confidence_score',
        'getLatestAnalysisForEvent',
        { eventId },
      ),
      created_at: readDate(
        row.created_at,
        'created_at',
        'getLatestAnalysisForEvent',
        { eventId },
      ),
    };
  }

  public async getLatestScenarioForEvent(
    eventId: string,
  ): Promise<MacroScenarioLatestDto | null> {
    const query = `
      SELECT
        id,
        event_id,
        analysis_run_id,
        llm_model,
        prompt_version,
        report_text,
        confidence_band,
        created_at
      FROM public.macro_scenario_reports
      WHERE event_id = $1
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const rows = await this.queryRows<MacroScenarioRow>(
      'getLatestScenarioForEvent',
      query,
      [eventId],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: readString(row.id, 'id', 'getLatestScenarioForEvent', { eventId }),
      event_id: readString(
        row.event_id,
        'event_id',
        'getLatestScenarioForEvent',
        { eventId },
      ),
      analysis_run_id: readString(
        row.analysis_run_id,
        'analysis_run_id',
        'getLatestScenarioForEvent',
        { eventId },
      ),
      llm_model: readString(
        row.llm_model,
        'llm_model',
        'getLatestScenarioForEvent',
        { eventId },
      ),
      prompt_version: readString(
        row.prompt_version,
        'prompt_version',
        'getLatestScenarioForEvent',
        { eventId },
      ),
      report_text: readString(
        row.report_text,
        'report_text',
        'getLatestScenarioForEvent',
        { eventId },
      ),
      confidence_band: readString(
        row.confidence_band,
        'confidence_band',
        'getLatestScenarioForEvent',
        { eventId },
      ),
      created_at: readDate(
        row.created_at,
        'created_at',
        'getLatestScenarioForEvent',
        { eventId },
      ),
    };
  }

  public async getInsightsSummary(): Promise<MacroInsightsSummaryDto> {
    const [last24h, last7d, oil, bitcoin, ethereum] = await Promise.all([
      this.getWindowSummary('24 hours'),
      this.getWindowSummary('7 days'),
      this.getIndicatorContext('brent_crude_oil_price'),
      this.getAssetPriceContext('bitcoin'),
      this.getAssetPriceContext('ethereum'),
    ]);

    return {
      generatedAt: new Date(),
      windows: {
        last24h,
        last7d,
      },
      marketContext: {
        oil,
        crypto: {
          bitcoin,
          ethereum,
        },
      },
    };
  }

  private async getWindowSummary(
    interval: string,
  ): Promise<MacroWindowSummaryDto> {
    const totalsQuery = `
      SELECT
        COUNT(*)::int AS total_events,
        AVG(severity)::float8 AS avg_severity
      FROM public.macro_events
      WHERE event_time >= NOW() - $1::interval;
    `;
    const pressureQuery = `
      SELECT
        channel,
        COUNT(*)::int AS event_count,
        COALESCE(SUM(severity), 0)::float8 AS severity_sum,
        COALESCE(AVG(severity), 0)::float8 AS severity_avg
      FROM public.macro_events
      WHERE event_time >= NOW() - $1::interval
      GROUP BY channel
      ORDER BY severity_sum DESC, event_count DESC;
    `;

    const [totalsRows, pressureRows] = await Promise.all([
      this.queryRows<WindowTotalsRow>('getWindowSummary.totals', totalsQuery, [
        interval,
      ]),
      this.queryRows<ChannelPressureRow>(
        'getWindowSummary.pressure',
        pressureQuery,
        [interval],
      ),
    ]);

    const totalsRow = totalsRows[0] || {
      total_events: 0,
      avg_severity: null,
    };

    const channelPressure: MacroChannelPressureDto[] = pressureRows.map(
      (row) => ({
        channel: readString(row.channel, 'channel', 'getWindowSummary'),
        eventCount: readNumber(
          row.event_count,
          'event_count',
          'getWindowSummary',
        ),
        severitySum: readNumber(
          row.severity_sum,
          'severity_sum',
          'getWindowSummary',
        ),
        severityAvg: readNumber(
          row.severity_avg,
          'severity_avg',
          'getWindowSummary',
        ),
      }),
    );

    return {
      totalEvents: readNumber(
        totalsRow.total_events,
        'total_events',
        'getWindowSummary',
      ),
      avgSeverity: readNullableNumber(
        totalsRow.avg_severity,
        'avg_severity',
        'getWindowSummary',
      ),
      channelPressure,
    };
  }

  private async getIndicatorContext(
    name: string,
  ): Promise<MacroAssetContextDto> {
    const query = `
      WITH ranked AS (
        SELECT
          value::float8 AS value,
          time,
          ROW_NUMBER() OVER (ORDER BY time DESC) AS rn
        FROM public.market_indicators
        WHERE name = $1
      )
      SELECT
        MAX(CASE WHEN rn = 1 THEN value END) AS current,
        MAX(CASE WHEN rn = 2 THEN value END) AS previous,
        MAX(CASE WHEN rn = 1 THEN time END) AS current_time
      FROM ranked;
    `;

    const rows = await this.queryRows<AssetContextRow>(
      'getIndicatorContext',
      query,
      [name],
    );
    const row = rows[0] || {
      current: null,
      previous: null,
      current_time: null,
    };
    const current = readNullableNumber(
      row.current,
      'current',
      'getIndicatorContext',
      {
        name,
      },
    );
    const previous = readNullableNumber(
      row.previous,
      'previous',
      'getIndicatorContext',
      { name },
    );

    return {
      current,
      previous,
      changePercent: this.calculatePercentChange(current, previous),
      time: readNullableDate(
        row.current_time,
        'current_time',
        'getIndicatorContext',
        { name },
      ),
    };
  }

  private async getAssetPriceContext(
    assetSymbol: string,
  ): Promise<MacroAssetContextDto> {
    const hourly = await this.getAssetPriceContextFromTable(
      assetSymbol,
      'market_data_1h',
    );

    if (hourly.current !== null) {
      return hourly;
    }

    return this.getAssetPriceContextFromTable(assetSymbol, 'market_data_1d');
  }

  private async getAssetPriceContextFromTable(
    assetSymbol: string,
    tableName: PriceTable,
  ): Promise<MacroAssetContextDto> {
    const query = `
      WITH ranked AS (
        SELECT
          close::float8 AS close,
          time,
          ROW_NUMBER() OVER (ORDER BY time DESC) AS rn
        FROM public.${tableName}
        WHERE asset_symbol = $1 AND type = 'price'
      )
      SELECT
        MAX(CASE WHEN rn = 1 THEN close END) AS current,
        MAX(CASE WHEN rn = 2 THEN close END) AS previous,
        MAX(CASE WHEN rn = 1 THEN time END) AS current_time
      FROM ranked;
    `;

    const rows = await this.queryRows<AssetContextRow>(
      'getAssetPriceContextFromTable',
      query,
      [assetSymbol],
    );
    const row = rows[0] || {
      current: null,
      previous: null,
      current_time: null,
    };
    const current = readNullableNumber(
      row.current,
      'current',
      'getAssetPriceContextFromTable',
      { assetSymbol, tableName },
    );
    const previous = readNullableNumber(
      row.previous,
      'previous',
      'getAssetPriceContextFromTable',
      { assetSymbol, tableName },
    );

    return {
      current,
      previous,
      changePercent: this.calculatePercentChange(current, previous),
      time: readNullableDate(
        row.current_time,
        'current_time',
        'getAssetPriceContextFromTable',
        { assetSymbol, tableName },
      ),
    };
  }

  private async queryRows<T extends QueryResultRow>(
    operation: string,
    query: string,
    values: readonly unknown[] = [],
  ): Promise<T[]> {
    try {
      const { rows } = await this.pool.query<T>(query, [...values]);
      return rows;
    } catch (error) {
      throw Errors.database(`Failed to execute ${operation}.`, {
        cause: error,
        context: { operation },
      });
    }
  }

  private calculatePercentChange(
    current: number | null,
    previous: number | null,
  ): number | null {
    if (current === null || previous === null || previous === 0) {
      return null;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  }
}
