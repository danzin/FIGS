import { useEffect, useState } from "react";
import { getMetricChange } from "../api/signalsApi";
import { MetricChange } from "../types/MetricChange";

export function useMetricChange(metricName: string, changeType: "percent" | "absolute" = "percent") {
	const [data, setData] = useState<MetricChange | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		getMetricChange(metricName, changeType)
			.then(setData)
			.finally(() => setLoading(false));
	}, [metricName, changeType]);

	return { data, loading };
}
