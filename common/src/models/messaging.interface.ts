import { SupportedMessage } from "@financialsignalsgatheringsystem/common";
import { Options } from "amqplib";

// Union type for all supported message types

export interface MessageBroker {
	/**
	 * Establish connection to the message broker
	 */
	connect(): Promise<void>;

	/**
	 * Publish a message to an exchange
	 * @param exchangeName - Name of the exchange to publish to
	 * @param routingKey - Routing key for the message (empty string for fanout exchanges)
	 * @param message - The message to publish (Signal, MarketDataPoint, or IndicatorDataPoint)
	 * @param options - Additional publish options
	 */
	publish(
		exchangeName: string,
		routingKey: string,
		message: SupportedMessage,
		options?: Options.Publish
	): Promise<void>;

	/**
	 * Consume messages from a queue
	 * Note: Currently only supports Signal consumption for backward compatibility
	 * @param queueName - Name of the queue to consume from
	 * @param exchangeName - Name of the exchange to bind the queue to
	 * @param onMessageCallback - Callback function to handle incoming messages
	 * @param options - Additional consume options
	 * @returns Consumer tag or null if failed
	 */
	consume(
		queueName: string,
		exchangeName: string,
		onMessageCallback: (msg: SupportedMessage) => Promise<void>,
		options?: Options.Consume
	): Promise<string | null>;

	/**
	 * Close the connection to the message broker
	 */
	close(): Promise<void>;

	/**
	 * Check if the broker is connected
	 */
	isConnected(): boolean;
}
