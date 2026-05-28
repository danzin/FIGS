import { SupportedMessage } from "@financialsignalsgatheringsystem/common";
import { Options } from "amqplib";

// Union type for all supported message types

export type BrokerExchangeType = "direct" | "fanout" | "headers" | "topic";

export interface BrokerExchangeOptions {
  type?: BrokerExchangeType;
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  alternateExchange?: string;
}

export interface BrokerDeadLetterOptions {
  enabled?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  deadLetterExchangeName?: string;
  deadLetterQueueName?: string;
  deadLetterRoutingKey?: string;
  retryExchangeName?: string;
  retryQueueName?: string;
  retryRoutingKey?: string;
}

export interface BrokerPublishOptions extends Options.Publish {
  exchange?: BrokerExchangeOptions;
}

export interface BrokerConsumeOptions extends Omit<Options.Consume, "noAck"> {
  exchange?: BrokerExchangeOptions;
  bindingKeys?: readonly string[];
  prefetch?: number;
  queueOptions?: Options.AssertQueue;
  deadLettering?: BrokerDeadLetterOptions;
}

export interface MessageBroker {
  /**
   * Establish connection to the message broker
   */
  connect(): Promise<void>;

  /**
   * Publish a message to an exchange
   * @param exchangeName - Name of the exchange to publish to
   * @param routingKey - Routing key for the message (empty string for fanout exchanges)
   * @param message - The message to publish ( MarketDataPoint, or IndicatorDataPoint)
   * @param options - Additional publish options
   */
  publish(
    exchangeName: string,
    routingKey: string,
    message: SupportedMessage,
    options?: BrokerPublishOptions,
  ): Promise<void>;

  /**
   * Consume messages from a queue
   * Note: Currently only supports consumption for backward compatibility
   * @param queueName - Name of the queue to consume from
   * @param exchangeName - Name of the exchange to bind the queue to
   * @param onMessageCallback - Callback function to handle incoming messages
   * @param options - Additional consume options
   * @returns Consumer tag or null if failed
   */
  consume<TMessage = SupportedMessage>(
    queueName: string,
    exchangeName: string,
    onMessageCallback: (msg: TMessage) => Promise<void>,
    options?: BrokerConsumeOptions,
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
