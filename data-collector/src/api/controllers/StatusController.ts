import { Request, Response } from "express";
import { SchedulerConfigManager } from "../../SchedulerConfigManager";
import { HealthService } from "../../services/HealthService";

export class StatusController {
	constructor(
		private schedulerManager: SchedulerConfigManager,
		private healthService: HealthService
	) {}

	getHealth = async (req: Request, res: Response): Promise<void> => {
		try {
			const health = await this.healthService.getSystemHealth();
			const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503; // Service Unavailable for unhealthy
			res.status(statusCode).json(health);
		} catch (error) {
			res.status(503).json({
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				error: error instanceof Error ? error.message : "Unknown error conducting health check",
				uptime: process.uptime(),
				components: {},
				summary: {},
			});
		}
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
