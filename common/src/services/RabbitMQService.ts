import amqp, { ChannelModel, Connection, Channel, ConsumeMessage, Options } from "amqplib";
import { MessageBroker } from "../models/messaging.interface";
import { MarketDataPoint, IndicatorDataPoint, SupportedMessage } from "@financialsignalsgatheringsystem/common";

export class RabbitMQService implements MessageBroker {
	private channelModel: ChannelModel | null = null;
	private channel: Channel | null = null;
	private connection: Connection | null = null;
	private readonly url: string;
	private isConnecting: boolean = false;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private createdExchanges: Set<string> = new Set();

	constructor(url: string) {
		this.url = url;
	}

	public async connect(): Promise<void> {
		if (this.channel && this.channelModel && this.connection) {
			console.log("[RabbitMQService] Already connected.");
			return;
		}
		if (this.isConnecting) {
			console.log("[RabbitMQService] Connection attempt already in progress.");
			return;
		}

		this.isConnecting = true;
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		try {
			this.channelModel = await amqp.connect(this.url);
			this.connection = this.channelModel.connection;
			this.channel = await this.channelModel.createChannel();

			console.log("[RabbitMQService] Connected to RabbitMQ and channel created.");
			this.createdExchanges.clear();

			this.connection.on("error", (err) => {
				console.error("[RabbitMQService] Connection error:", err.message);
				this.handleConnectionLoss();
			});
			this.connection.on("close", (err) => {
				console.warn(
					err
						? `[RabbitMQService] Connection closed due to an error: ${err.message}`
						: `[RabbitMQService] Connection closed gracefully.`
				);
				if (!this.connection?.expectSocketClose) {
					this.handleConnectionLoss();
				}
			});

			this.channelModel.on("error", (err) => console.error("[RabbitMQService] ChannelModel error:", err.message));
			this.channelModel.on("close", () => console.log("[RabbitMQService] ChannelModel closed."));

			this.channel.on("error", (err) => {
				console.error("[RabbitMQService] Channel error:", err.message);
				this.handleConnectionLoss();
			});
			this.channel.on("close", () => {
				console.log("[RabbitMQService] Channel closed.");
				if (this.connection && !this.connection.expectSocketClose) {
					console.warn("[RabbitMQService] Channel closed unexpectedly.");
				}
			});

			this.isConnecting = false;
		} catch (error) {
			this.isConnecting = false;
			console.error("[RabbitMQService] Failed to connect:", error);
			this.scheduleReconnect();
			throw error;
		}
	}

	private handleConnectionLoss(): void {
		if (this.isConnecting || this.reconnectTimeout) return;
		this.channel = null;
		this.connection = null;
		this.channelModel = null;
		this.createdExchanges.clear();
		this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		console.log("[RabbitMQService] Scheduling reconnect in 5 seconds...");
		this.reconnectTimeout = setTimeout(async () => {
			this.reconnectTimeout = null;
			try {
				await this.connect();
			} catch (err) {
				console.error("[RabbitMQService] Reconnect attempt failed:", err);
			}
		}, 5000);
	}

	private async ensureExchange(exchangeName: string): Promise<void> {
		if (!this.channel) throw new Error("[RabbitMQService] Channel not available.");
		if (this.createdExchanges.has(exchangeName)) return;
		await this.channel.assertExchange(exchangeName, "fanout", { durable: true });
		this.createdExchanges.add(exchangeName);
		console.log(`[RabbitMQService] Exchange '${exchangeName}' created/confirmed`);
	}

	private getMessageIdentifier(msg: SupportedMessage): string {
		if ((msg as MarketDataPoint).asset_symbol) {
			const m = msg as MarketDataPoint;
			return `${m.asset_symbol} ${m.type}`;
		}
		const i = msg as IndicatorDataPoint;
		return i.name;
	}

	public async publish(
		exchangeName: string,
		routingKey: string,
		message: SupportedMessage,
		options?: Options.Publish
	): Promise<void> {
		if (!this.channel) {
			console.warn("[RabbitMQService] Channel not available for publish. Attempting to connect.");
			await this.connect();
			if (!this.channel) throw new Error("[RabbitMQService] Cannot publish, no channel.");
		}

		await this.ensureExchange(exchangeName);
		const payload = Buffer.from(JSON.stringify(message));
		const ok = this.channel.publish(exchangeName, routingKey, payload, { persistent: true, ...options });
		const id = this.getMessageIdentifier(message);
		ok
			? console.log(`[RabbitMQService] Published to ${exchangeName}: ${id}`)
			: console.warn(`[RabbitMQService] Publish buffer full for ${id}`);
	}

	public async consume(
		queueName: string,
		exchangeName: string,
		onMessageCallback: (msg: SupportedMessage) => Promise<void>,
		options?: Options.Consume
	): Promise<string | null> {
		if (!this.channel) {
			console.warn("[RabbitMQService] Channel not available for consume. Attempting to connect.");
			await this.connect();
			if (!this.channel) throw new Error("[RabbitMQService] Cannot consume, no channel.");
		}

		await this.ensureExchange(exchangeName);
		const q = await this.channel.assertQueue(queueName, { durable: true });
		await this.channel.bindQueue(q.queue, exchangeName, "");
		console.log(`[RabbitMQService] Queue '${q.queue}' bound to '${exchangeName}'`);
		this.channel.prefetch(1);

		const { consumerTag } = await this.channel.consume(
			q.queue,
			async (msg: ConsumeMessage | null) => {
				if (!msg) return;
				try {
					const parsed = JSON.parse(msg.content.toString()) as SupportedMessage;
					// convert any string timestamps to Date if present
					if ((parsed as any).time && typeof (parsed as any).time === "string") {
						(parsed as any).time = new Date((parsed as any).time);
					}
					const id = this.getMessageIdentifier(parsed);
					console.log(`[RabbitMQService] Consumed: ${id}`);
					await onMessageCallback(parsed);
					this.channel!.ack(msg);
					console.log(`[RabbitMQService] Acked: ${id}`);
				} catch (err) {
					console.error(`[RabbitMQService] Error processing message:`, err);
					this.channel!.nack(msg, false, false);
				}
			},
			{ noAck: false, ...options }
		);

		console.log(`[RabbitMQService] Consuming with tag '${consumerTag}'.`);
		return consumerTag;
	}

	public async close(): Promise<void> {
		console.log("[RabbitMQService] Initiating graceful shutdown...");
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.channel) {
			await this.channel.close();
			console.log("[RabbitMQService] Channel closed.");
			this.channel = null;
		}
		if (this.channelModel) {
			await this.channelModel.close();
			console.log("[RabbitMQService] ChannelModel closed.");
			this.channelModel = null;
			this.connection = null;
		}
		this.createdExchanges.clear();
		this.isConnecting = false;
	}

	public isConnected(): boolean {
		return !!(this.connection && this.channel && !this.connection.expectSocketClose && !this.isConnecting);
	}
}
