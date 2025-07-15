import { Request, Response } from "express";
import { TickerService } from "../services/TickerService";
import { AddTickerRequest } from "../types/ticker.types";

export class TickerController {
	constructor(private tickerService: TickerService) {}

	addTicker = async (req: Request, res: Response): Promise<void> => {
		try {
			const request: AddTickerRequest = req.body;
			const result = await this.tickerService.addTicker(request);

			if (result.success) {
				res.status(201).json(result);
			} else {
				res.status(400).json(result);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			res.status(500).json({
				success: false,
				error: `Internal server error: ${errorMessage}`,
			});
		}
	};

	removeTicker = (req: Request, res: Response): void => {
		const { sourceKey } = req.params;
		const result = this.tickerService.removeTicker(sourceKey);

		if (result.success) {
			res.json({
				...result,
				timestamp: new Date().toISOString(),
			});
		} else {
			res.status(400).json(result);
		}
	};

	listTickers = (req: Request, res: Response): void => {
		const result = this.tickerService.listTickers();
		res.json(result);
	};

	// Unavailable until I decide how to handle this
	// getSupportedOptions = (req: Request, res: Response): void => {
	// 	const result = this.tickerService.getSupportedOptions();
	// 	res.json(result);
	// };

	validateCoin = async (req: Request, res: Response): Promise<void> => {
		const { coinId } = req.params;
		const result = await this.tickerService.validateCoin(coinId);
		res.json(result);
	};
}
