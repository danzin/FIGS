import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { TimescaleDBService } from "./services/TimescaleDBService";

export class SignalProcessor {
	private rabbitMQService: RabbitMQService;
	private dbService: TimescaleDBService;
	private readonly queueName: string;
	private readonly exchangeName: string;

	constructor(
		rabbitMQService: RabbitMQService,
		dbService: TimescaleDBService,
		queueName: string,
		exchangeName: string
	) {
		this.rabbitMQService = rabbitMQService;
		this.dbService = dbService;
		this.queueName = queueName;
		this.exchangeName = exchangeName;
	}

	public async start(): Promise<void> {
		try {
			await this.rabbitMQService.consume(
				this.queueName,
				this.exchangeName,
				this.handleIncomingMessage.bind(this) // ensure 'this' context
			);
			console.log("[SignalProcessor] Started consuming signals.");
		} catch (error) {
			console.error("[SignalProcessor] Failed to start:", error);
			throw error;
		}
	}

	private async handleIncomingMessage(payload: unknown): Promise<void> {
		try {
			// Handle both single objects and arrays
			const messages = Array.isArray(payload) ? payload : [payload];

			for (const message of messages) {
				const messageType = this.getDataPointType(message);
				switch (messageType) {
					case "MarketDataPoint":
						await this.dbService.insertMarketData(message);
						break;
					case "IndicatorDataPoint":
						await this.dbService.insertIndicator(message);
						break;
					case "Unknown":
					default:
						console.warn("[SignalProcessor] Unknown message type:", message);
						break;
				}
			}
			console.log("[SignalProcessor] Successfully processed messages:", messages.length);
		} catch (error) {
			console.error("[SignalProcessor] Error handling message:", error);
			throw error;
		}
	}

	private getDataPointType(point: any): "MarketDataPoint" | "IndicatorDataPoint" | "Unknown" {
		const hasAssetSymbol = "asset_symbol" in point && typeof point.asset_symbol === "string";
		const hasName = "name" in point && typeof point.name === "string";
		const hasTime = "time" in point && point.time instanceof Date;
		const hasValue = "value" in point;

		if (hasAssetSymbol && hasTime && hasValue) {
			return "MarketDataPoint";
		}
		if (hasName && hasTime && hasValue) {
			return "IndicatorDataPoint";
		}
		return "Unknown";
	}

	public async stop(): Promise<void> {
		console.log("[SignalProcessor] Stopping...");
		await this.rabbitMQService.close();
		console.log("[SignalProcessor] Stopped.");
	}
}
