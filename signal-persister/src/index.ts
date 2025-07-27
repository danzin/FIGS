import {
	RabbitMQService,
	MarketDataPoint,
	IndicatorDataPoint,
	SentimentResult,
	SupportedMessage,
} from "@financialsignalsgatheringsystem/common";
import { TimescaleDBService } from "./services/TimescaleDBService";
import { config } from "./utils/config";

class SignalPersisterApp {
	private readonly messageBroker: RabbitMQService;
	private readonly dbService: TimescaleDBService;

	constructor() {
		this.messageBroker = new RabbitMQService(config.RABBITMQ_URL!);
		this.dbService = new TimescaleDBService({
			host: config.DB_HOST,
			port: Number(config.DB_PORT),
			user: config.DB_USER,
			password: config.DB_PASSWORD,
			database: config.DB_NAME,
		});
	}

	public async start(): Promise<void> {
		console.log("[Signal Persister App] Starting...");
		await this.messageBroker.connect();

		await this.setupMarketDataConsumer();
		await this.setupIndicatorConsumer();
		await this.setupSentimentResultConsumer();

		console.log("[Signal Persister App] All consumers started.");
	}

	private async setupMarketDataConsumer(): Promise<void> {
		await this.messageBroker.consume(
			"market_data",
			"persist_market_data_queue",
			async (message: SupportedMessage): Promise<void> => {
				// Use a type guard to ensure right message type
				if (this.isMarketDataPoint(message)) {
					if (this.isValidMarketDataPoint(message)) {
						await this.dbService.insertMarketData(message);
					} else {
						console.warn("[Signal Persister App] Received invalid MarketDataPoint, discarding:", message);
					}
				}
			}
		);
	}

	private async setupIndicatorConsumer(): Promise<void> {
		await this.messageBroker.consume(
			"market_indicators",
			"persist_indicators_queue",
			async (message: SupportedMessage): Promise<void> => {
				if (this.isIndicatorDataPoint(message)) {
					if (this.isValidIndicatorPoint(message)) {
						await this.dbService.insertIndicator(message);
					} else {
						console.warn("[Signal Persister App] Received invalid IndicatorDataPoint, discarding:", message);
					}
				}
			}
		);
	}

	private async setupSentimentResultConsumer(): Promise<void> {
		// SentimentResult is not part of SupportedMessage
		// The RabbitMQService.consume method will pass it as `any`
		// Must cast and validate it here
		await this.messageBroker.consume(
			"sentiment_results",
			"persist_sentiment_queue",
			async (message: any): Promise<void> => {
				const result = message as SentimentResult; // Cast it
				// convert date strings for SentimentResult manually here
				// as it's not part of the SupportedMessage type
				if (result && typeof result.published_at === "string") {
					result.published_at = new Date(result.published_at) as any;
				}

				if (this.isValidSentimentResult(result)) {
					await this.dbService.insertArticleAndSentiment(result);
				} else {
					console.warn("[Signal Persister App] Received invalid SentimentResult, discarding:", result);
				}
			}
		);
	}

	private isMarketDataPoint(p: any): p is MarketDataPoint {
		return p && typeof p.asset_symbol === "string" && typeof p.type === "string";
	}

	private isIndicatorDataPoint(p: any): p is IndicatorDataPoint {
		return p && typeof p.name === "string" && !("asset_symbol" in p);
	}

	private isValidMarketDataPoint(p: MarketDataPoint): boolean {
		return p.time instanceof Date && !isNaN(p.time.getTime()) && typeof p.value === "number";
	}

	private isValidIndicatorPoint(p: IndicatorDataPoint): boolean {
		return p.time instanceof Date && !isNaN(p.time.getTime()) && (typeof p.value === "number" || p.value === null);
	}

	private isValidSentimentResult(p: any): p is SentimentResult {
		return p && p.external_id && p.title && p.url && p.published_at && typeof p.sentiment_score === "number";
	}
}

// Start the application
const app = new SignalPersisterApp();
app.start().catch((error) => {
	console.error("[Signal Persister App] Failed to start:", error);
	process.exit(1);
});
