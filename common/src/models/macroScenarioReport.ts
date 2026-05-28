export interface MacroScenarioReport {
    id: string;
    event_id: string;
    analysis_run_id: string;
    llm_model: string;
    prompt_version: string;
    report_text: string;
    confidence_band: string;
    created_at: Date;
}
