"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TickerController = void 0;
class TickerController {
    constructor(tickerService) {
        this.tickerService = tickerService;
        this.addTicker = async (req, res) => {
            try {
                const request = req.body;
                const result = await this.tickerService.addTicker(request);
                if (result.success) {
                    res.status(201).json(result);
                }
                else {
                    res.status(400).json(result);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                res.status(500).json({
                    success: false,
                    error: `Internal server error: ${errorMessage}`,
                });
            }
        };
        this.removeTicker = (req, res) => {
            const { sourceKey } = req.params;
            const result = this.tickerService.removeTicker(sourceKey);
            if (result.success) {
                res.json({
                    ...result,
                    timestamp: new Date().toISOString(),
                });
            }
            else {
                res.status(400).json(result);
            }
        };
        this.listTickers = (req, res) => {
            const result = this.tickerService.listTickers();
            res.json(result);
        };
        // Unavailable until I decide how to handle this
        // getSupportedOptions = (req: Request, res: Response): void => {
        // 	const result = this.tickerService.getSupportedOptions();
        // 	res.json(result);
        // };
        this.validateCoin = async (req, res) => {
            const { coinId } = req.params;
            const result = await this.tickerService.validateCoin(coinId);
            res.json(result);
        };
    }
}
exports.TickerController = TickerController;
//# sourceMappingURL=TickerController.js.map