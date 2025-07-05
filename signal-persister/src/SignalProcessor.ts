import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import { TimescaleDBService } from "./services/TimescaleDBService";
import { MarketDataPoint, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

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
			await this.rabbitMQService.connect();
			// await this.dbService.connect(); // explicit connection test
			console.log("[SignalProcessor] Services connected.");

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
			// The payload could be a single object or an array of objects
			const dataPoints = Array.isArray(payload) ? payload : [payload];

			for (const point of dataPoints) {
				// Use a type guard to determine which service method to call
				if (this.isMarketDataPoint(point)) {
					await this.dbService.insertMarketData(point);
				} else if (this.isIndicatorDataPoint(point)) {
					await this.dbService.insertIndicator(point);
				} else {
					console.warn("[SignalProcessor] Received unknown data point structure:", point);
				}
			}
		} catch (error) {
			console.error("[SignalProcessor] Error handling message:", error);
			// Re-throw to ensure RabbitMQ nacks the message
			throw error;
		}
	}

	private isMarketDataPoint(point: MarketDataPoint): point is MarketDataPoint {
		return (
			point &&
			typeof point.asset_symbol === "string" &&
			(point.type === "price" || point.type === "volume") &&
			typeof point.value === "number"
		);
	}

	private isIndicatorDataPoint(point: IndicatorDataPoint): point is IndicatorDataPoint {
		return point && typeof point.name === "string" && typeof point.value === "number" && !("asset_symbol" in point); // Differentiate from market data
	}

	public async stop(): Promise<void> {
		console.log("[SignalProcessor] Stopping...");
		await this.rabbitMQService.close();
		await this.dbService.disconnect();
		console.log("[SignalProcessor] Stopped.");
	}
}
