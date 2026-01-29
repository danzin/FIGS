import { useEffect, useState } from "react";
import { getLatestNews } from "../api/signalsApi";
import { NewsItem } from "../types/NewsItem";

export function useLatestNews() {
	const [news, setNews] = useState<NewsItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const pageSize = 10;

	useEffect(() => {
		getLatestNews(pageSize, 0)
			.then((items) => {
				const sorted = [...items].sort(
					(a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
				);
				setNews(sorted);
				setHasMore(items.length === pageSize);
			})
			.finally(() => setLoading(false));
	}, []);

	const loadMore = async () => {
		if (loadingMore || !hasMore) return;
		setLoadingMore(true);
		try {
			const offset = news.length;
			const items = await getLatestNews(pageSize, offset);
			const sorted = [...items].sort(
				(a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
			);
			const merged = [...news, ...sorted].sort(
				(a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
			);
			setNews(merged);
			setHasMore(items.length === pageSize);
		} finally {
			setLoadingMore(false);
		}
	};

	return { news, loading, loadMore, loadingMore, hasMore };
}
