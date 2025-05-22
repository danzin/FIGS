export interface MessageBroker {
	connect(): Promise<void>;
	publish(exchangeName: string, routingKey: string, message: any): Promise<void>;
	consume(queueName: string, onMessage: (message: any) => Promise<void>): Promise<void>; // 'any' can be Signal later
	close(): Promise<void>;
}
