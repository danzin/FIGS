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
				if (this.isMarketDataPoint(message)) {
					await this.dbService.insertMarketData(message);
				} else if (this.isIndicatorDataPoint(message)) {
					await this.dbService.insertIndicator(message);
				} else {
					console.warn("[SignalProcessor] Unknown message type:", message);
				}
			}
		} catch (error) {
			console.error("[SignalProcessor] Error handling message:", error);
			throw error;
		}
	}

	private isMarketDataPoint(message: MarketDataPoint): message is MarketDataPoint {
		return (
			message && typeof message.asset_symbol === "string" && (message.type === "price" || message.type === "volume")
		);
	}

	private isIndicatorDataPoint(message: IndicatorDataPoint): message is IndicatorDataPoint {
		return (
			message && typeof message.name === "string" && typeof message.value === "number" && !("asset_symbol" in message)
		);
	}

	public async stop(): Promise<void> {
		console.log("[SignalProcessor] Stopping...");
		await this.rabbitMQService.close();
		console.log("[SignalProcessor] Stopped.");
	}
}
