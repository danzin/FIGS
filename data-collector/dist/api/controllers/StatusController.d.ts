import { Request, Response } from "express";
import { SchedulerConfigManager } from "../../SchedulerConfigManager";
import { HealthService } from "../../services/HealthService";
export declare class StatusController {
    private schedulerManager;
    private healthService;
    constructor(schedulerManager: SchedulerConfigManager, healthService: HealthService);
    getHealth: (req: Request, res: Response) => Promise<void>;
    getSchedulerStatus: (req: Request, res: Response) => void;
    triggerSource: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=StatusController.d.ts.map