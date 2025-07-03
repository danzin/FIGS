import { Request, Response } from "express";
import { TickerService } from "../services/TickerService";
export declare class TickerController {
    private tickerService;
    constructor(tickerService: TickerService);
    addTicker: (req: Request, res: Response) => Promise<void>;
    removeTicker: (req: Request, res: Response) => void;
    listTickers: (req: Request, res: Response) => void;
    validateCoin: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=TickerController.d.ts.map