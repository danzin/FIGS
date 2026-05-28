-- ====================================================================
-- Macro event pipeline schema
-- ====================================================================

-- Raw ingestion
CREATE TABLE IF NOT EXISTS public.macro_raw_articles (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT,
  url TEXT,
  title TEXT,
  body TEXT,
  language TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_macro_raw_source_ext
  ON public.macro_raw_articles (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_macro_raw_hash
  ON public.macro_raw_articles (content_hash);

CREATE INDEX IF NOT EXISTS ix_macro_raw_published_at
  ON public.macro_raw_articles (published_at DESC);

-- Canonical events
CREATE TABLE IF NOT EXISTS public.macro_events (
  id UUID PRIMARY KEY,
  raw_article_id UUID REFERENCES public.macro_raw_articles(id),
  event_time TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  severity NUMERIC NOT NULL CHECK (severity >= 0 AND severity <= 1),
  region TEXT,
  country_codes TEXT[],
  affected_assets TEXT[],
  canonical_text TEXT NOT NULL,
  extraction_model TEXT NOT NULL,
  extraction_version TEXT NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_macro_events_time
  ON public.macro_events (event_time DESC);
CREATE INDEX IF NOT EXISTS ix_macro_events_type
  ON public.macro_events (event_type);
CREATE INDEX IF NOT EXISTS ix_macro_events_channel
  ON public.macro_events (channel);

-- Similar historical matches
CREATE TABLE IF NOT EXISTS public.macro_event_analogues (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.macro_events(id),
  historical_event_id UUID NOT NULL REFERENCES public.macro_events(id),
  embedding_similarity NUMERIC NOT NULL,
  regime_score NUMERIC NOT NULL,
  channel_score NUMERIC NOT NULL,
  composite_score NUMERIC NOT NULL,
  rank INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, historical_event_id)
);

CREATE INDEX IF NOT EXISTS ix_macro_event_analogues_event_rank
  ON public.macro_event_analogues (event_id, rank);

-- Numeric analysis output
CREATE TABLE IF NOT EXISTS public.macro_analysis_runs (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.macro_events(id),
  run_version TEXT NOT NULL,
  methodology TEXT NOT NULL,
  result_json JSONB NOT NULL,
  confidence_score NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_macro_analysis_runs_event_time
  ON public.macro_analysis_runs (event_id, created_at DESC);

-- Final narrative reports
CREATE TABLE IF NOT EXISTS public.macro_scenario_reports (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.macro_events(id),
  analysis_run_id UUID NOT NULL REFERENCES public.macro_analysis_runs(id),
  llm_model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  report_text TEXT NOT NULL,
  confidence_band TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_macro_scenario_reports_event_time
  ON public.macro_scenario_reports (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_macro_scenario_reports_analysis_run
  ON public.macro_scenario_reports (analysis_run_id);

-- Optional: enable pgvector only when available in the database image.
-- CREATE EXTENSION IF NOT EXISTS vector;
