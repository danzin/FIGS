export type NewsItem = {
	title: string;
	source: string;
	url: string;
	published_at: string;
	sentiment: string;
	sentiment_score: number | null;
};
