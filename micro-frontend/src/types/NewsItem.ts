export type NewsItem = {
	title: string;
	source: string;
	url: string;
	published_at: string;
	summary?: string | null;
	image_url?: string | null;
	sentiment: string;
	sentiment_score: number | null;
};
