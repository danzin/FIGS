export interface MacroEvent {
	id: string;
	raw_article_id?: string;
	event_time: Date;
	event_type: string;
	channel: string;
	severity: number;
	region?: string;
	country_codes?: string[];
	affected_assets?: string[];
	canonical_text: string;
	extraction_model: string;
	extraction_version: string;
	confidence: number;
	metadata?: Record<string, unknown>;
}

export interface MacroEventAnalogue {
	id: string;
	event_id: string;
	historical_event_id: string;
	embedding_similarity: number;
	regime_score: number;
	channel_score: number;
	composite_score: number;
	rank: number;
	created_at: Date;
}
