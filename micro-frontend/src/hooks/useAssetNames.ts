import { useState, useEffect } from "react";
import { getAssetNames } from "../api/signalsApi";

export const useAssetNames = () => {
	const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				const names = await getAssetNames();
				const opts = names.map((name) => ({
					label: name,
					value: name.toLowerCase().replace(/\s+/g, "-"),
				}));
				setOptions(opts);
			} catch (e) {
				console.error("Failed to load assets:", e);
				setError("Could not load assets.");
			} finally {
				setLoading(false);
			}
		};

		load();
	}, []);

	return { options, loading, error };
};
