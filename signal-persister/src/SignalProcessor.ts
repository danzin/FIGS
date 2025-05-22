import { RabbitMQService } from "./services/RabbitMQService";
import { TimescaleDBService } from "./services/TimescaleDBService";
import { Signal } from "./models/signal.interface";

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
			await this.dbService.connect(); // explicit connection test
			console.log("[SignalProcessor] Services connected.");

			await this.rabbitMQService.consume(
				this.queueName,
				this.exchangeName,
				this.handleIncomingSignal.bind(this) // ensure 'this' context
			);
			console.log("[SignalProcessor] Started consuming signals.");
		} catch (error) {
			console.error("[SignalProcessor] Failed to start:", error);
			throw error;
		}
	}

	private async handleIncomingSignal(signal: Signal): Promise<void> {
		try {
			console.log(`[SignalProcessor] Processing signal: ${signal.name}`);

			await this.dbService.insertSignal(signal);
			console.log(`[SignalProcessor] Successfully processed and persisted signal: ${signal.name}`);
		} catch (error) {
			console.error(`[SignalProcessor] Error handling signal ${signal.name}:`, error);
			// Error is thrown by dbService, RabbitMQService's consumer will nack it.
			throw error; // Re-throw to ensure message is nacked by RabbitMQService
		}
	}

	public async stop(): Promise<void> {
		console.log("[SignalProcessor] Stopping...");
		await this.rabbitMQService.close();
		await this.dbService.disconnect();
		console.log("[SignalProcessor] Stopped.");
	}
}
