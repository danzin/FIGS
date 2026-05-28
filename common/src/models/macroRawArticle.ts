export interface MacroRawArticle {
	id: string;
	source: string;
	external_id?: string;
	url?: string;
	title?: string;
	body?: string;
	language?: string;
	published_at?: Date;
	fetched_at: Date;
	content_hash: string;
	metadata?: Record<string, unknown>;
}
