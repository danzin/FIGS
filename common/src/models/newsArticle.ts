export interface NewsArticle {
	id: string; // URL or GUID
	source: string; // e.g. "CoinDesk"
	title: string;
	url: string;
	publishedAt: Date;
	summary?: string;
	imageUrl?: string;
	body?: string;
}
