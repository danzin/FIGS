import { SchedulerConfigManager } from "../../SchedulerConfigManager";
import { AddTickerRequest, AddTickerResponse, TickerListResponse, ValidationResponse } from "../types/ticker.types";
export declare class TickerService {
    private schedulerManager;
    constructor(schedulerManager: SchedulerConfigManager);
    addTicker(request: AddTickerRequest): Promise<AddTickerResponse>;
    removeTicker(sourceKey: string): {
        success: boolean;
        message: string;
        error?: string;
    };
    listTickers(): TickerListResponse;
    validateCoin(coinId: string): Promise<ValidationResponse>;
}
//# sourceMappingURL=TickerService.d.ts.map