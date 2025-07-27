export interface SentimentResult {
	external_id: string;
	source: string;
	title: string;
	url: string;
	published_at: string; // The service sends an ISO string
	sentiment_score: number;
	sentiment_label: string;
	analyzed_at: string; // ISO string
}
