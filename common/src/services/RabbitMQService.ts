import amqp, {
  ChannelModel,
  ConfirmChannel,
  Connection,
  Channel,
  ConsumeMessage,
  Options,
} from "amqplib";
import {
  BrokerConsumeOptions,
  BrokerDeadLetterOptions,
  BrokerExchangeOptions,
  BrokerExchangeType,
  BrokerPublishOptions,
  MessageBroker,
} from "../models/messaging.interface";
import { AppError, Errors, isAppError, wrapError } from "../errors/errors";
import {
  MarketDataPoint,
  IndicatorDataPoint,
  SupportedMessage,
} from "@financialsignalsgatheringsystem/common";

interface ResolvedExchangeOptions {
  alternateExchange?: string;
  autoDelete: boolean;
  durable: boolean;
  internal: boolean;
  type: BrokerExchangeType;
}

interface ResolvedDeadLetterOptions {
  deadLetterExchangeName: string;
  deadLetterQueueName: string;
  deadLetterRoutingKey: string;
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
  retryExchangeName: string;
  retryQueueName: string;
  retryRoutingKey: string;
}

export class RabbitMQService implements MessageBroker {
  private channelModel: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connection: Connection | null = null;
  private readonly url: string;
  private isConnecting: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private createdExchanges: Map<string, BrokerExchangeType> = new Map();

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
      this.channel = await this.channelModel.createConfirmChannel();

      console.log(
        "[RabbitMQService] Connected to RabbitMQ and channel created.",
      );
      this.createdExchanges.clear();
      this.reconnectAttempts = 0;

      this.connection.on("error", (err) => {
        console.error("[RabbitMQService] Connection error:", err.message);
        this.handleConnectionLoss();
      });
      this.connection.on("close", (err) => {
        console.warn(
          err
            ? `[RabbitMQService] Connection closed due to an error: ${err.message}`
            : `[RabbitMQService] Connection closed gracefully.`,
        );
        if (!this.connection?.expectSocketClose) {
          this.handleConnectionLoss();
        }
      });

      this.channelModel.on("error", (err) =>
        console.error("[RabbitMQService] ChannelModel error:", err.message),
      );
      this.channelModel.on("close", () =>
        console.log("[RabbitMQService] ChannelModel closed."),
      );

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
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000) + Math.random() * 1000;
    this.reconnectAttempts++;
    console.log(`[RabbitMQService] Scheduling reconnect in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`);
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      try {
        await this.connect();
      } catch (err) {
        console.error("[RabbitMQService] Reconnect attempt failed:", err);
      }
    }, delay);
  }

  private async ensureExchange(exchangeName: string): Promise<void> {
    return this.ensureExchangeWithOptions(exchangeName);
  }

  private normalizeExchangeOptions(
    options?: BrokerExchangeOptions,
  ): ResolvedExchangeOptions {
    return {
      alternateExchange: options?.alternateExchange,
      autoDelete: options?.autoDelete ?? false,
      durable: options?.durable ?? true,
      internal: options?.internal ?? false,
      type: options?.type ?? "fanout",
    };
  }

  private async ensureExchangeWithOptions(
    exchangeName: string,
    options?: BrokerExchangeOptions,
  ): Promise<void> {
    if (!this.channel) {
      throw Errors.configuration("RabbitMQ channel not available.", {
        context: {
          exchangeName,
          operation: "ensureExchange",
          service: "common",
        },
      });
    }

    const exchangeOptions = this.normalizeExchangeOptions(options);
    const existingExchangeType = this.createdExchanges.get(exchangeName);
    if (
      existingExchangeType !== undefined &&
      existingExchangeType !== exchangeOptions.type
    ) {
      throw Errors.configuration(
        `Exchange '${exchangeName}' was already declared as '${existingExchangeType}' and cannot be redeclared as '${exchangeOptions.type}'.`,
        {
          context: {
            exchangeName,
            existingExchangeType,
            operation: "ensureExchange",
            requestedExchangeType: exchangeOptions.type,
            service: "common",
          },
        },
      );
    }

    if (existingExchangeType === exchangeOptions.type) {
      return;
    }

    await this.channel.assertExchange(exchangeName, exchangeOptions.type, {
      alternateExchange: exchangeOptions.alternateExchange,
      autoDelete: exchangeOptions.autoDelete,
      durable: exchangeOptions.durable,
      internal: exchangeOptions.internal,
    });
    this.createdExchanges.set(exchangeName, exchangeOptions.type);
    console.log(
      `[RabbitMQService] Exchange '${exchangeName}' created/confirmed as '${exchangeOptions.type}'.`,
    );
  }

  private async requireChannel(operation: string): Promise<ConfirmChannel> {
    if (!this.channel) {
      console.warn(
        `[RabbitMQService] Channel not available for ${operation}. Attempting to connect.`,
      );
      await this.connect();
    }

    if (!this.channel) {
      throw Errors.configuration(
        `RabbitMQ channel unavailable during ${operation}.`,
        {
          context: {
            operation,
            service: "common",
          },
        },
      );
    }

    return this.channel;
  }

  private resolveBindingKeys(
    exchangeType: BrokerExchangeType,
    bindingKeys: readonly string[] | undefined,
    queueName: string,
  ): readonly string[] {
    if (exchangeType === "fanout") {
      return bindingKeys && bindingKeys.length > 0 ? bindingKeys : [""];
    }

    if (!bindingKeys || bindingKeys.length === 0) {
      throw Errors.configuration(
        `Queue '${queueName}' uses exchange type '${exchangeType}' and must declare at least one binding key.`,
        {
          context: {
            exchangeType,
            operation: "resolveBindingKeys",
            queueName,
            service: "common",
          },
        },
      );
    }

    return bindingKeys;
  }

  private resolveDeadLetterOptions(
    queueName: string,
    options?: BrokerDeadLetterOptions,
  ): ResolvedDeadLetterOptions {
    return {
      deadLetterExchangeName:
        options?.deadLetterExchangeName ?? `${queueName}.dlx`,
      deadLetterQueueName: options?.deadLetterQueueName ?? `${queueName}.dlq`,
      deadLetterRoutingKey:
        options?.deadLetterRoutingKey ?? `${queueName}.dead-letter`,
      enabled: options?.enabled ?? true,
      maxRetries: Math.max(0, options?.maxRetries ?? 3),
      retryDelayMs: Math.max(1000, options?.retryDelayMs ?? 30_000),
      retryExchangeName: options?.retryExchangeName ?? `${queueName}.retry`,
      retryQueueName: options?.retryQueueName ?? `${queueName}.retry`,
      retryRoutingKey: options?.retryRoutingKey ?? `${queueName}.retry`,
    };
  }

  private validateQueueOptionsForDeadLettering(
    queueName: string,
    queueOptions: Options.AssertQueue | undefined,
  ): void {
    if (!queueOptions) {
      return;
    }

    const conflictingOptions = [
      ["deadLetterExchange", queueOptions.deadLetterExchange],
      ["deadLetterRoutingKey", queueOptions.deadLetterRoutingKey],
      ["messageTtl", queueOptions.messageTtl],
    ].filter(([, value]) => value !== undefined);

    if (conflictingOptions.length === 0) {
      return;
    }

    throw Errors.configuration(
      `Queue '${queueName}' cannot define ${conflictingOptions
        .map(([name]) => name)
        .join(
          ", ",
        )} in queueOptions when automatic dead-letter handling is enabled.`,
      {
        context: {
          conflictingOptions: conflictingOptions.map(([name]) => name),
          operation: "validateQueueOptionsForDeadLettering",
          queueName,
          service: "common",
        },
      },
    );
  }

  private async ensureDeadLetterTopology(
    exchangeName: string,
    bindingKeys: readonly string[],
    deadLettering: ResolvedDeadLetterOptions,
  ): Promise<void> {
    if (!this.channel) {
      throw Errors.configuration("RabbitMQ channel not available.", {
        context: {
          exchangeName,
          operation: "ensureDeadLetterTopology",
          service: "common",
        },
      });
    }

    if (bindingKeys.length !== 1) {
      throw Errors.configuration(
        `Dead-letter retry topology for exchange '${exchangeName}' requires exactly one binding key per queue.`,
        {
          context: {
            bindingKeys,
            exchangeName,
            operation: "ensureDeadLetterTopology",
            service: "common",
          },
        },
      );
    }

    await this.ensureExchangeWithOptions(deadLettering.deadLetterExchangeName, {
      durable: true,
      type: "direct",
    });
    const deadLetterQueue = await this.channel.assertQueue(
      deadLettering.deadLetterQueueName,
      { durable: true },
    );
    await this.channel.bindQueue(
      deadLetterQueue.queue,
      deadLettering.deadLetterExchangeName,
      deadLettering.deadLetterRoutingKey,
    );

    await this.ensureExchangeWithOptions(deadLettering.retryExchangeName, {
      durable: true,
      type: "direct",
    });
    const retryQueue = await this.channel.assertQueue(
      deadLettering.retryQueueName,
      {
        deadLetterExchange: exchangeName,
        deadLetterRoutingKey: bindingKeys[0],
        durable: true,
        messageTtl: deadLettering.retryDelayMs,
      },
    );
    await this.channel.bindQueue(
      retryQueue.queue,
      deadLettering.retryExchangeName,
      deadLettering.retryRoutingKey,
    );
  }

  private buildQueueOptions(
    queueOptions: Options.AssertQueue | undefined,
    deadLettering: ResolvedDeadLetterOptions,
  ): Options.AssertQueue {
    return deadLettering.enabled
      ? {
          ...queueOptions,
          deadLetterExchange: deadLettering.retryExchangeName,
          deadLetterRoutingKey: deadLettering.retryRoutingKey,
          durable: queueOptions?.durable ?? true,
        }
      : {
          ...queueOptions,
          durable: queueOptions?.durable ?? true,
        };
  }

  private buildPublishOptions(options?: BrokerPublishOptions): Options.Publish {
    const { exchange, ...publishOptions } = options ?? {};
    return {
      contentType: publishOptions.contentType ?? "application/json",
      persistent: publishOptions.persistent ?? true,
      timestamp: publishOptions.timestamp ?? Date.now(),
      ...publishOptions,
    };
  }

  private buildConsumeOptions(options?: BrokerConsumeOptions): Options.Consume {
    const {
      bindingKeys,
      deadLettering,
      exchange,
      prefetch,
      queueOptions,
      ...consumeOptions
    } = options ?? {};

    return {
      noAck: false,
      ...consumeOptions,
    };
  }

  private parseJsonMessage<TMessage>(msg: ConsumeMessage): TMessage {
    try {
      const parsedMessage = JSON.parse(msg.content.toString()) as Record<
        string,
        unknown
      >;

      if (parsedMessage.time)
        parsedMessage.time = new Date(parsedMessage.time as string);
      if (parsedMessage.timestamp)
        parsedMessage.timestamp = new Date(parsedMessage.timestamp as string);
      if (parsedMessage.publishedAt)
        parsedMessage.publishedAt = new Date(
          parsedMessage.publishedAt as string,
        );
      if (parsedMessage.fetched_at)
        parsedMessage.fetched_at = new Date(parsedMessage.fetched_at as string);
      if (parsedMessage.published_at)
        parsedMessage.published_at = new Date(
          parsedMessage.published_at as string,
        );
      if (parsedMessage.event_time)
        parsedMessage.event_time = new Date(parsedMessage.event_time as string);
      if (parsedMessage.created_at)
        parsedMessage.created_at = new Date(parsedMessage.created_at as string);

      return parsedMessage as TMessage;
    } catch (error) {
      throw Errors.validation("Unable to parse JSON message body.", {
        cause: error,
        context: {
          operation: "parseJsonMessage",
          service: "common",
        },
      });
    }
  }

  private getRejectedAttemptCount(
    msg: ConsumeMessage,
    queueName: string,
  ): number {
    const xDeath = msg.properties.headers?.["x-death"];
    if (!Array.isArray(xDeath)) {
      return 0;
    }

    return xDeath.reduce<number>((maxCount, entry) => {
      if (typeof entry !== "object" || entry === null) {
        return maxCount;
      }

      const queue = (entry as { queue?: unknown }).queue;
      const reason = (entry as { reason?: unknown }).reason;
      if (queue !== queueName || reason !== "rejected") {
        return maxCount;
      }

      const rawCount = (entry as { count?: unknown }).count;
      const count = typeof rawCount === "number" ? rawCount : Number(rawCount);
      return Number.isFinite(count) ? Math.max(maxCount, count) : maxCount;
    }, 0);
  }

  private normalizeConsumerError(error: unknown, queueName: string): AppError {
    if (isAppError(error)) {
      return error;
    }

    return wrapError(error, "InternalServerError", {
      context: {
        operation: "consume",
        queueName,
        service: "common",
      },
    });
  }

  private isRetryableError(error: AppError): boolean {
    return ![
      "ConfigurationError",
      "ConflictError",
      "NotFoundError",
      "ValidationError",
    ].includes(error.name);
  }

  private async publishToDeadLetterQueue(
    queueName: string,
    exchangeName: string,
    msg: ConsumeMessage,
    error: AppError,
    deadLettering: ResolvedDeadLetterOptions,
    attempts: number,
  ): Promise<void> {
    const channel = await this.requireChannel("dead-letter publish");

    await this.ensureExchangeWithOptions(deadLettering.deadLetterExchangeName, {
      durable: true,
      type: "direct",
    });

    channel.publish(
      deadLettering.deadLetterExchangeName,
      deadLettering.deadLetterRoutingKey,
      msg.content,
      {
        contentType: msg.properties.contentType ?? "application/json",
        correlationId: msg.properties.correlationId,
        headers: {
          ...(msg.properties.headers ?? {}),
          "x-dead-lettered-at": new Date().toISOString(),
          "x-error-code": error.errorCode ?? "",
          "x-error-message": error.message,
          "x-error-name": error.name,
          "x-error-context": JSON.stringify(error.context ?? {}),
          "x-original-exchange": exchangeName,
          "x-original-queue": queueName,
          "x-original-routing-key": msg.fields.routingKey,
          "x-rejected-attempts": attempts,
        },
        messageId: msg.properties.messageId,
        persistent: true,
        timestamp: Date.now(),
        type: msg.properties.type,
      },
    );

    await channel.waitForConfirms();
  }

  private async handleConsumerFailure(
    queueName: string,
    exchangeName: string,
    msg: ConsumeMessage,
    error: unknown,
    deadLettering: ResolvedDeadLetterOptions,
  ): Promise<void> {
    const normalizedError = this.normalizeConsumerError(error, queueName);
    const rejectedAttempts = this.getRejectedAttemptCount(msg, queueName);
    const retryable = this.isRetryableError(normalizedError);
    const channel = await this.requireChannel("consumer failure handling");

    if (
      deadLettering.enabled &&
      retryable &&
      rejectedAttempts < deadLettering.maxRetries
    ) {
      console.warn(
        `[RabbitMQService] Retry ${rejectedAttempts + 1}/${deadLettering.maxRetries} scheduled for '${queueName}'.`,
        normalizedError,
      );
      channel.nack(msg, false, false);
      return;
    }

    if (!deadLettering.enabled) {
      console.error(
        `[RabbitMQService] Error in onMessageCallback for queue ${queueName}. Message rejected without dead-lettering.`,
        normalizedError,
      );
      channel.nack(msg, false, false);
      return;
    }

    try {
      await this.publishToDeadLetterQueue(
        queueName,
        exchangeName,
        msg,
        normalizedError,
        deadLettering,
        rejectedAttempts,
      );
      channel.ack(msg);
      console.error(
        `[RabbitMQService] Message moved to DLQ '${deadLettering.deadLetterQueueName}' for queue '${queueName}'.`,
        normalizedError,
      );
    } catch (deadLetterError) {
      console.error(
        `[RabbitMQService] Failed to publish message to DLQ for queue '${queueName}'. Returning it to retry flow.`,
        deadLetterError,
      );
      channel.nack(msg, false, false);
    }
  }

  private getMessageIdentifier(msg: SupportedMessage): string {
    if ((msg as MarketDataPoint).asset_symbol) {
      const m = msg as MarketDataPoint;
      return `${m.asset_symbol} ${m.type}`;
    }
    if ((msg as any).title && (msg as any).url) {
      const n = msg as any;
      return `${n.source}: ${n.title}`;
    }
    if ((msg as any).event_type && (msg as any).canonical_text) {
      const e = msg as any;
      return `Event: ${e.event_type} (${e.id})`;
    }
    if ((msg as any).report_text) {
      const r = msg as any;
      return `Scenario Report for event: ${r.event_id}`;
    }
    if ((msg as any).methodology && (msg as any).result_json) {
      const a = msg as any;
      return `Analysis Run: ${a.methodology} (${a.id})`;
    }
    const i = msg as IndicatorDataPoint;
    return i.name || "Unknown Message";
  }

  public async publish(
    exchangeName: string,
    routingKey: string,
    message: SupportedMessage,
    options?: BrokerPublishOptions,
  ): Promise<void> {
    const channel = await this.requireChannel("publish");

    try {
      await this.ensureExchangeWithOptions(exchangeName, options?.exchange);
      const payload = Buffer.from(JSON.stringify(message));
      channel.publish(
        exchangeName,
        routingKey,
        payload,
        this.buildPublishOptions(options),
      );
      await channel.waitForConfirms();
      console.log(
        `[RabbitMQService] Published to ${exchangeName} with routing key '${routingKey}':`,
        this.getMessageIdentifier(message),
      );
    } catch (error) {
      console.error(
        `[RabbitMQService] Failed to publish message to ${exchangeName}:`,
        error,
      );
      throw error;
    }
  }

  public async consume<TMessage = SupportedMessage>(
    queueName: string,
    exchangeName: string,
    onMessageCallback: (msg: TMessage) => Promise<void>,
    options?: BrokerConsumeOptions,
  ): Promise<string | null> {
    const runtimeConsumeOptions = options as Options.Consume | undefined;

    if (runtimeConsumeOptions?.noAck) {
      throw Errors.configuration(
        `Queue '${queueName}' cannot enable noAck because acknowledgements are required for retry and DLQ handling.`,
        {
          context: {
            exchangeName,
            operation: "consume",
            queueName,
            service: "common",
          },
        },
      );
    }

    const channel = await this.requireChannel("consume");
    const exchangeOptions = this.normalizeExchangeOptions(options?.exchange);
    const bindingKeys = this.resolveBindingKeys(
      exchangeOptions.type,
      options?.bindingKeys,
      queueName,
    );
    const deadLettering = this.resolveDeadLetterOptions(
      queueName,
      options?.deadLettering,
    );

    try {
      await this.ensureExchangeWithOptions(exchangeName, exchangeOptions);
      if (deadLettering.enabled) {
        this.validateQueueOptionsForDeadLettering(
          queueName,
          options?.queueOptions,
        );
        await this.ensureDeadLetterTopology(
          exchangeName,
          bindingKeys,
          deadLettering,
        );
      }

      const q = await channel.assertQueue(
        queueName,
        this.buildQueueOptions(options?.queueOptions, deadLettering),
      );
      for (const bindingKey of bindingKeys) {
        await channel.bindQueue(q.queue, exchangeName, bindingKey);
      }
      channel.prefetch(options?.prefetch ?? 1);

      const { consumerTag } = await channel.consume(
        q.queue,
        async (msg: ConsumeMessage | null) => {
          if (msg) {
            try {
              const parsedMessage = this.parseJsonMessage<TMessage>(msg);
              await onMessageCallback(parsedMessage);
              channel.ack(msg);
            } catch (error) {
              await this.handleConsumerFailure(
                queueName,
                exchangeName,
                msg,
                error,
                deadLettering,
              );
            }
          }
        },
        this.buildConsumeOptions(options),
      );

      console.log(
        `[RabbitMQService] Consuming from '${queueName}' with tag '${consumerTag}'.`,
      );
      return consumerTag;
    } catch (error) {
      console.error(
        `[RabbitMQService] Failed to setup consumer for '${queueName}':`,
        error,
      );
      throw error;
    }
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
    return !!(
      this.connection &&
      this.channel &&
      !this.connection.expectSocketClose &&
      !this.isConnecting
    );
  }
}
