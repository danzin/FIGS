"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusController = void 0;
class StatusController {
    constructor(schedulerManager, healthService) {
        this.schedulerManager = schedulerManager;
        this.healthService = healthService;
        this.getHealth = async (req, res) => {
            try {
                const health = await this.healthService.getSystemHealth();
                const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503; // Service Unavailable for unhealthy
                res.status(statusCode).json(health);
            }
            catch (error) {
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
        this.getSchedulerStatus = (req, res) => {
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
        this.triggerSource = async (req, res) => {
            const { sourceKey } = req.params;
            try {
                await this.schedulerManager.getScheduler().triggerSource(sourceKey);
                res.json({
                    success: true,
                    message: `Triggered ${sourceKey}`,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                res.status(400).json({
                    success: false,
                    error: errorMessage,
                });
            }
        };
    }
}
exports.StatusController = StatusController;
//# sourceMappingURL=StatusController.js.map