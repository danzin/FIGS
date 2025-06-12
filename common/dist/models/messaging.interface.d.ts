import { Options } from "amqplib";
export interface MessageBroker {
    connect(): Promise<void>;
    publish(exchangeName: string, routingKey: string, message: any): Promise<void>;
    consume(queueName: string, exchangeName: string, onMessage: (message: any) => Promise<void>, options?: Options.Consume): Promise<string | null>;
    close(): Promise<void>;
}
//# sourceMappingURL=messaging.interface.d.ts.map