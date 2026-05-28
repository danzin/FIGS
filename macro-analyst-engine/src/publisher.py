import json
from datetime import datetime
from typing import Any

import pika

MACRO_ANALYSIS_EXCHANGE = "macro.analysis"
MACRO_SCENARIO_EXCHANGE = "macro.scenario"


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


class RabbitPublisher:
    def __init__(self, rabbitmq_url: str):
        self.rabbitmq_url = rabbitmq_url
        self.connection: pika.BlockingConnection | None = None
        self.channel: pika.adapters.blocking_connection.BlockingChannel | None = None

    def _ensure_channel(self) -> pika.adapters.blocking_connection.BlockingChannel:
        if (
            self.connection is not None
            and self.connection.is_open
            and self.channel is not None
            and self.channel.is_open
        ):
            return self.channel

        self.connection = pika.BlockingConnection(pika.URLParameters(self.rabbitmq_url))
        self.channel = self.connection.channel()
        self.channel.confirm_delivery()
        self.channel.exchange_declare(
            exchange=MACRO_ANALYSIS_EXCHANGE,
            exchange_type="topic",
            durable=True,
        )
        self.channel.exchange_declare(
            exchange=MACRO_SCENARIO_EXCHANGE,
            exchange_type="topic",
            durable=True,
        )
        return self.channel

    def _publish(self, exchange: str, routing_key: str, payload: dict[str, Any]) -> None:
        channel = self._ensure_channel()
        body = json.dumps(payload, default=_json_default)
        channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=body,
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
                timestamp=int(datetime.utcnow().timestamp()),
            ),
        )

    def publish_analysis_result(self, payload: dict[str, Any]) -> None:
        self._publish(MACRO_ANALYSIS_EXCHANGE, "macro.analysis.result", payload)

    def publish_scenario_request(self, payload: dict[str, Any]) -> None:
        self._publish(MACRO_SCENARIO_EXCHANGE, "macro.scenario.request", payload)

    def close(self) -> None:
        if self.channel is not None and self.channel.is_open:
            self.channel.close()
        if self.connection is not None and self.connection.is_open:
            self.connection.close()

