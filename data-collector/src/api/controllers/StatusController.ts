import { Request, Response } from "express";
import { SchedulerConfigManager } from "../../SchedulerConfigManager";

export class StatusController {
	constructor(private schedulerManager: SchedulerConfigManager) {}

	getHealth = (req: Request, res: Response): void => {
		res.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		});
	};

	getSchedulerStatus = (req: Request, res: Response): void => {
		const status = this.schedulerManager.getScheduler().getStatus();
		res.json({
			sources: status,
			summary: {
				total: status.length,
				enabled: status.filter((s) => s.enabled).length,
				healthy: status.filter((s) => s.isHealthy).length,
				failing: status.filter((s) => s.consecutiveFailures > 0).length,
			},
		});
	};

	triggerSource = async (req: Request, res: Response): Promise<void> => {
		const { sourceKey } = req.params;

		try {
			await this.schedulerManager.getScheduler().triggerSource(sourceKey);
			res.json({
				success: true,
				message: `Triggered ${sourceKey}`,
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			res.status(400).json({
				success: false,
				error: errorMessage,
			});
		}
	};
}
