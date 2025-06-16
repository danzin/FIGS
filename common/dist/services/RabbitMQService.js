"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQService = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
/** Apparently in v0.10.7 of amqplib types,
 * amqp.connect() now resolves to a ChannelModel, not a Connection.
 * A ChannelModel is essentially a lightweight connection + channel factory */
class RabbitMQService {
    constructor(url) {
        this.channelModel = null;
        this.channel = null;
        this.connection = null; // Store the actual connection for event handling
        this.isConnecting = false; // Prevent concurrent connection attempts
        this.reconnectTimeout = null;
        this.url = url;
    }
    async connect() {
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
            this.channelModel = await amqplib_1.default.connect(this.url); // Returns a ChannelModel
            this.connection = this.channelModel.connection; // Access the underlying connection
            this.channel = await this.channelModel.createChannel(); // Get a Channel
            console.log("[RabbitMQService] Connected to RabbitMQ and channel created.");
            // Setup event listeners on the actual connection object
            this.connection.on("error", (err) => {
                console.error("[RabbitMQService] Connection error:", err.message);
                this.handleConnectionLoss();
            });
            this.connection.on("close", (err) => {
                if (err) {
                    console.warn("[RabbitMQService] Connection closed due to an error:", err.message);
                }
                else {
                    console.log("[RabbitMQService] Connection closed gracefully by server or client.");
                }
                if (!this.connection?.expectSocketClose) {
                    this.handleConnectionLoss();
                }
            });
            this.channelModel.on("close", () => {
                console.log("[RabbitMQService] ChannelModel closed.");
            });
            this.channelModel.on("error", (err) => {
                console.error("[RabbitMQService] ChannelModel error:", err.message);
            });
            this.channel.on("error", (err) => {
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
        }
        catch (error) {
            this.isConnecting = false;
            console.error("[RabbitMQService] Failed to connect:", error);
            this.scheduleReconnect();
            throw error;
        }
    }
    handleConnectionLoss() {
        if (this.isConnecting || this.reconnectTimeout)
            return;
        this.channel = null;
        this.connection = null;
        this.channelModel = null; // ChannelModel is also gone if connection is lost
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        console.log("[RabbitMQService] Scheduling reconnect in 5 seconds...");
        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;
            try {
                await this.connect();
            }
            catch (err) {
                console.error("[RabbitMQService] Reconnect attempt failed:", err);
            }
        }, 5000);
    }
    async publish(exchangeName, routingKey, message, options) {
        if (!this.channel) {
            console.warn("[RabbitMQService] Channel not available for publish. Attempting to connect.");
            await this.connect(); // Try to connect if not connected
            if (!this.channel) {
                throw new Error("[RabbitMQService] Channel not available after connection attempt. Cannot publish.");
            }
        }
        const payload = Buffer.from(JSON.stringify(message));
        const success = this.channel.publish(exchangeName, routingKey, payload, { persistent: true, ...options });
        if (success) {
            console.log(`[RabbitMQService] Published to ${exchangeName}: ${message.name}`);
        }
        else {
            console.warn(`[RabbitMQService] Publish buffer full for ${exchangeName}. Message for ${message.name} might be dropped or queued by client.`);
        }
    }
    async consume(queueName, exchangeName, onMessageCallback, // Callback now directly takes Signal
    options) {
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
            const { consumerTag } = await this.channel.consume(q.queue, async (msg) => {
                if (msg) {
                    let signal = null;
                    try {
                        signal = JSON.parse(msg.content.toString());
                        if (typeof signal.timestamp === "string") {
                            signal.timestamp = new Date(signal.timestamp);
                        }
                        if (!signal.name ||
                            !(signal.timestamp instanceof Date) ||
                            isNaN(signal.timestamp.getTime()) ||
                            typeof signal.value !== "number") {
                            throw new Error(`Invalid signal structure: ${msg.content.toString()}`);
                        }
                        console.log(`[RabbitMQService] Consumed signal: ${signal.name}`);
                        await onMessageCallback(signal);
                        this.channel.ack(msg);
                        console.log(`[RabbitMQService] Acked signal: ${signal.name}`);
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error(`[RabbitMQService] Error processing message (id: ${msg.properties.messageId || "N/A"}, content: ${msg.content.toString().substring(0, 100)}...):`, errorMessage);
                        this.channel.nack(msg, false, false); // Don't requeue problematic messages
                        console.error(`[RabbitMQService] Nacked signal (id: ${msg.properties.messageId || "N/A"}, will not requeue)`);
                    }
                }
            }, { noAck: false, ...options });
            console.log(`[RabbitMQService] Consuming from queue '${q.queue}' with consumerTag '${consumerTag}'.`);
            return consumerTag;
        }
        catch (error) {
            console.error(`[RabbitMQService] Failed to setup consumer for queue '${queueName}':`, error);
            this.handleConnectionLoss();
            return null;
        }
    }
    async close() {
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
        }
        catch (error) {
            console.error("[RabbitMQService] Error during close:", error);
        }
        this.isConnecting = false; // Reset connection flag
    }
    isConnected() {
        return !!(this.connection && this.channel && !this.connection.expectSocketClose && !this.isConnecting);
    }
}
exports.RabbitMQService = RabbitMQService;
//# sourceMappingURL=RabbitMQService.js.map