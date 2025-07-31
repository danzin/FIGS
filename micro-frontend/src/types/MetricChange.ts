export type MetricChange = {
	name: string;
	current: number | null;
	change: number | null;
	changeType: "percent" | "absolute";
};
