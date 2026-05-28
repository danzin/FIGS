import {
  MACRO_EXCHANGES,
  MACRO_ROUTING_KEYS,
  MacroEvent,
  MessageBroker,
} from "@financialsignalsgatheringsystem/common";

export class Publisher {
  constructor(private readonly broker: MessageBroker) {}

  public async publishStructuredEvent(event: MacroEvent): Promise<void> {
    await this.broker.publish(
      MACRO_EXCHANGES.EVENT,
      MACRO_ROUTING_KEYS.STRUCTURED_EVENT,
      event,
      {
        exchange: {
          type: "topic",
        },
      },
    );
  }

  public async publishEmbeddingReady(event: MacroEvent): Promise<void> {
    await this.broker.publish(
      MACRO_EXCHANGES.EVENT,
      MACRO_ROUTING_KEYS.EMBEDDING_READY,
      event,
      {
        exchange: {
          type: "topic",
        },
      },
    );
  }
}
