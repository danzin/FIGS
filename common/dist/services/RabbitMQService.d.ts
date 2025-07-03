import { Options } from "amqplib";
import { MessageBroker } from "../models/messaging.interface";
import { Signal } from "../models/signal.interface";
/** Apparently in v0.10.7 of amqplib types,
 * amqp.connect() now resolves to a ChannelModel, not a Connection.
 * A ChannelModel is essentially a lightweight connection + channel factory */
export declare class RabbitMQService implements MessageBroker {
    private channelModel;
    private channel;
    private connection;
    private readonly url;
    private isConnecting;
    private reconnectTimeout;
    constructor(url: string);
    connect(): Promise<void>;
    private handleConnectionLoss;
    private scheduleReconnect;
    publish(exchangeName: string, routingKey: string, message: Signal, options?: Options.Publish): Promise<void>;
    consume(queueName: string, exchangeName: string, onMessageCallback: (signal: Signal) => Promise<void>, // Callback now directly takes Signal.
    options?: Options.Consume): Promise<string | null>;
    close(): Promise<void>;
    isConnected(): boolean;
}
//# sourceMappingURL=RabbitMQService.d.ts.map