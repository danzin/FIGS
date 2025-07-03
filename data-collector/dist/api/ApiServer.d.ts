import { Application } from "express";
import { SchedulerConfigManager } from "../SchedulerConfigManager";
import { HealthService } from "../services/HealthService";
export declare class ApiServer {
    private schedulerManager;
    private app;
    private tickerService;
    private tickerController;
    private statusController;
    constructor(schedulerManager: SchedulerConfigManager, healthService: HealthService);
    private setupMiddleware;
    private setupRoutes;
    getApp(): Application;
    listen(port: number): void;
}
//# sourceMappingURL=ApiServer.d.ts.map