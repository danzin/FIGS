import amqp, { ChannelModel, Connection, Channel, ConsumeMessage, Options } from "amqplib";
import { MessageBroker } from "../models/messaging.interface";
import { Signal } from "../models/signal.interface";
/** Apparently in v0.10.7 of amqplib types,
 * amqp.connect() now resolves to a ChannelModel, not a Connection.
 * A ChannelModel is essentially a lightweight connection + channel factory */
export class RabbitMQService implements MessageBroker {
	private channelModel: ChannelModel | null = null;
	private channel: Channel | null = null;
	private connection: Connection | null = null; // Store the actual connection for event handling
	private readonly url: string;
	private isConnecting: boolean = false; // Prevent concurrent connection attempts
	private reconnectTimeout: NodeJS.Timeout | null = null;

	constructor(url: string) {
		this.url = url;
	}

	public async connect(): Promise<void> {
		// Indempotence checks
		if (this.channel && this.channelModel && this.connection) {
			console.log("[RabbitMQService] Already connected.");
			return;
		}
		if (this.isConnecting) {
			console.log("[RabbitMQService] Connection attempt already in progress.");
			return;
		}

		// Clear previous reconnect timers
		this.isConnecting = true;
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		try {
			this.channelModel = await amqp.connect(this.url); // Returns a ChannelModel
			this.connection = this.channelModel.connection; // Access the underlying connection
			this.channel = await this.channelModel.createChannel(); // Get a Channel

			console.log("[RabbitMQService] Connected to RabbitMQ and channel created.");

			// Setup event listeners on the actual connection object
			this.connection.on("error", (err: Error) => {
				console.error("[RabbitMQService] Connection error:", err.message);
				this.handleConnectionLoss();
			});

			this.connection.on("close", (err?: Error) => {
				if (err) {
					console.warn("[RabbitMQService] Connection closed due to an error:", err.message);
				} else {
					console.log("[RabbitMQService] Connection closed gracefully by server or client.");
				}
				if (!this.connection?.expectSocketClose) {
					this.handleConnectionLoss();
				}
			});

			this.channelModel.on("close", () => {
				console.log("[RabbitMQService] ChannelModel closed.");
			});
			this.channelModel.on("error", (err: Error) => {
				console.error("[RabbitMQService] ChannelModel error:", err.message);
			});

			this.channel.on("error", (err: Error) => {
				console.error("[RabbitMQService] Channel error:", err.message);
				this.handleConnectionLoss();
			});

			this.channel.on("close", () => {
				console.log("[RabbitMQService] Channel closed.");
				if (this.connection && !this.connection.expectSocketClose) {
					console.warn("[RabbitMQService] Channel closed unexpectedly. Connection might still be up or closing.");
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
		this.channelModel = null; // ChannelModel is also gone if connection is lost

		this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}
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

	public async publish(
		exchangeName: string,
		routingKey: string,
		message: Signal,
		options?: Options.Publish
	): Promise<void> {
		if (!this.channel) {
			console.warn("[RabbitMQService] Channel not available for publish. Attempting to connect.");
			await this.connect(); // Try to connect if not connected
			if (!this.channel) {
				throw new Error("[RabbitMQService] Channel not available after connection attempt. Cannot publish.");
			}
		}
		const payload = Buffer.from(JSON.stringify(message)); // RabbitMQ transmits frames of binary data, channel.sendToQueue() and channel.publish() expect a Buffer
		const success = this.channel.publish(exchangeName, routingKey, payload, { persistent: true, ...options });
		if (success) {
			console.log(`[RabbitMQService] Published to ${exchangeName}: ${message.name}`);
		} else {
			console.warn(
				`[RabbitMQService] Publish buffer full for ${exchangeName}. Message for ${message.name} might be dropped or queued by client.`
			);
		}
	}

	public async consume(
		queueName: string,
		exchangeName: string,
		onMessageCallback: (signal: Signal) => Promise<void>, // Callback now directly takes Signal
		options?: Options.Consume
	): Promise<string | null> {
		// Returns consumerTag or null
		if (!this.channel) {
			console.warn("[RabbitMQService] Channel not available for consume. Attempting to connect.");
			await this.connect();
			if (!this.channel) {
				throw new Error("[RabbitMQService] Channel not available after connection attempt. Cannot consume.");
			}
		}

		try {
			await this.channel.assertExchange(exchangeName, "fanout", { durable: true });
			const q = await this.channel.assertQueue(queueName, { durable: true });
			await this.channel.bindQueue(q.queue, exchangeName, "");
			console.log(`[RabbitMQService] Queue '${q.queue}' bound to exchange '${exchangeName}'`);

			this.channel.prefetch(1);

			const { consumerTag } = await this.channel.consume(
				q.queue,
				async (msg: ConsumeMessage | null) => {
					if (msg) {
						let signal: Signal | null = null;
						try {
							signal = JSON.parse(msg.content.toString()) as Signal;
							if (typeof signal.timestamp === "string") {
								signal.timestamp = new Date(signal.timestamp);
							}
							if (
								!signal.name ||
								!(signal.timestamp instanceof Date) ||
								isNaN(signal.timestamp.getTime()) ||
								typeof signal.value !== "number"
							) {
								throw new Error(`Invalid signal structure: ${msg.content.toString()}`);
							}

							console.log(`[RabbitMQService] Consumed signal: ${signal.name}`);
							await onMessageCallback(signal);
							this.channel!.ack(msg);
							console.log(`[RabbitMQService] Acked signal: ${signal.name}`);
						} catch (error) {
							const errorMessage = error instanceof Error ? error.message : String(error);
							console.error(
								`[RabbitMQService] Error processing message (id: ${msg.properties.messageId || "N/A"}, content: ${msg.content.toString().substring(0, 100)}...):`,
								errorMessage
							);
							this.channel!.nack(msg, false, false); // Don't requeue problematic messages
							console.error(
								`[RabbitMQService] Nacked signal (id: ${msg.properties.messageId || "N/A"}, will not requeue)`
							);
						}
					}
				},
				{ noAck: false, ...options }
			);

			console.log(`[RabbitMQService] Consuming from queue '${q.queue}' with consumerTag '${consumerTag}'.`);
			return consumerTag;
		} catch (error) {
			console.error(`[RabbitMQService] Failed to setup consumer for queue '${queueName}':`, error);
			this.handleConnectionLoss();
			return null;
		}
	}

	public async close(): Promise<void> {
		console.log("[RabbitMQService] Initiating graceful shutdown...");
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		try {
			if (this.channel) {
				await this.channel.close();
				this.channel = null;
				console.log("[RabbitMQService] Channel closed.");
			}
			if (this.channelModel) {
				await this.channelModel.close();
				this.channelModel = null;
				this.connection = null; // Connection is part of ChannelModel
				console.log("[RabbitMQService] ChannelModel and Connection closed.");
			}
		} catch (error) {
			console.error("[RabbitMQService] Error during close:", error);
		}
		this.isConnecting = false; // Reset connection flag
	}

	public isConnected(): boolean {
		return !!(this.connection && this.channel && !this.connection.expectSocketClose && !this.isConnecting);
	}
}
