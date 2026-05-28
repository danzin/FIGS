export interface MacroAnalysisRun {
	id: string;
	event_id: string;
	run_version: string;
	methodology: string;
	result_json: Record<string, unknown>;
	confidence_score: number;
	created_at: Date;
}
