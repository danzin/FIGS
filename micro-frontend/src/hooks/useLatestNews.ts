import { useEffect, useState } from "react";
import { getLatestNews } from "../api/signalsApi";
import { NewsItem } from "../types/NewsItem";

export function useLatestNews() {
	const [news, setNews] = useState<NewsItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getLatestNews()
			.then(setNews)
			.finally(() => setLoading(false));
	}, []);

	return { news, loading };
}
