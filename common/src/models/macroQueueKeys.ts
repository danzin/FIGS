export const MACRO_EXCHANGES = {
	RAW: "macro.raw",
	EVENT: "macro.event",
	ANALYSIS: "macro.analysis",
	SCENARIO: "macro.scenario",
} as const;

export const MACRO_ROUTING_KEYS = {
	RAW_ARTICLE: "macro.raw.article",
	STRUCTURED_EVENT: "macro.event.structured",
	EMBEDDING_READY: "macro.event.embedding.ready",
	ANALYSIS_REQUEST: "macro.analysis.request",
	ANALYSIS_RESULT: "macro.analysis.result",
	SCENARIO_REQUEST: "macro.scenario.request",
	SCENARIO_RESULT: "macro.scenario.result",
} as const;

export const MACRO_QUEUES = {
	RAW_ARTICLE: "macro_raw_article_queue",
	EVENT_STRUCTURED: "macro_event_structured_queue",
	EVENT_EMBEDDING: "macro_event_embedding_queue",
	ANALYSIS_REQUEST: "macro_analysis_request_queue",
	ANALYSIS_RESULT: "macro_analysis_result_queue",
	SCENARIO_REQUEST: "macro_scenario_request_queue",
	SCENARIO_RESULT: "macro_scenario_result_queue",
} as const;
