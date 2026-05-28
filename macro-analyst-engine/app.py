import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import pika

from src.analysis import (
    build_policy_context,
    build_analogue_metrics,
    build_analysis_payload,
    compute_confidence_score,
    compute_indicator_btc_lag_stats,
    compute_oil_btc_lag_stats,
)
from src.db import DatabaseClient
from src.publisher import RabbitPublisher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [MacroAnalystEngine] - %(message)s",
)

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://user:pass@rabbitmq:5672")
DB_HOST = os.getenv("DB_HOST", "timescaledb")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "market_signals")

ANALYST_ANALOGUE_LIMIT = int(os.getenv("ANALYST_ANALOGUE_LIMIT", "8"))
ANALYST_LOOKBACK_DAYS = int(os.getenv("ANALYST_LOOKBACK_DAYS", "180"))
ANALYST_POLICY_LOOKBACK_DAYS = int(os.getenv("ANALYST_POLICY_LOOKBACK_DAYS", "3650"))

ANALYSIS_RUN_VERSION = "v0.1"
ANALYSIS_METHODOLOGY = "analogue-event-window-v1"
RECENT_EVENT_BUFFER_SIZE = int(os.getenv("ANALYST_RECENT_EVENT_BUFFER_SIZE", "10000"))
ANALYSIS_QUEUE_MAX_RETRIES = int(
    os.getenv("ANALYST_QUEUE_MAX_RETRIES", "3")
)
ANALYSIS_QUEUE_RETRY_DELAY_MS = int(
    os.getenv("ANALYST_QUEUE_RETRY_DELAY_MS", "30000")
)

MACRO_EVENT_EXCHANGE = "macro.event"
MACRO_EVENT_ROUTING_KEY = "macro.event.structured"
MACRO_ANALYSIS_REQUEST_QUEUE = "macro_analysis_request_queue"
MACRO_ANALYSIS_RETRY_EXCHANGE = f"{MACRO_ANALYSIS_REQUEST_QUEUE}.retry"
MACRO_ANALYSIS_RETRY_QUEUE = f"{MACRO_ANALYSIS_REQUEST_QUEUE}.retry"
MACRO_ANALYSIS_RETRY_ROUTING_KEY = f"{MACRO_ANALYSIS_REQUEST_QUEUE}.retry"
MACRO_ANALYSIS_DLX = f"{MACRO_ANALYSIS_REQUEST_QUEUE}.dlx"
MACRO_ANALYSIS_DLQ = f"{MACRO_ANALYSIS_REQUEST_QUEUE}.dlq"
MACRO_ANALYSIS_DLQ_ROUTING_KEY = f"{MACRO_ANALYSIS_REQUEST_QUEUE}.dead-letter"

db = DatabaseClient(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD,
    database=DB_NAME,
)
publisher: RabbitPublisher | None = None
recent_event_ids: set[str] = set()
recent_event_order: list[str] = []


def remember_event(event_id: str) -> None:
    recent_event_ids.add(event_id)
    recent_event_order.append(event_id)
    while len(recent_event_order) > RECENT_EVENT_BUFFER_SIZE:
        oldest = recent_event_order.pop(0)
        if oldest in recent_event_ids:
            recent_event_ids.remove(oldest)


def parse_event(message: dict[str, Any]) -> dict[str, Any]:
    event = dict(message)
    if "id" not in event or "event_time" not in event:
        raise ValueError("Incoming message is missing required event fields.")

    if isinstance(event["event_time"], str):
        event["event_time"] = datetime.fromisoformat(
            event["event_time"].replace("Z", "+00:00")
        )
    if isinstance(event["event_time"], datetime) and event["event_time"].tzinfo is None:
        event["event_time"] = event["event_time"].replace(tzinfo=timezone.utc)

    event["severity"] = float(event.get("severity", 0.0))
    return event


def get_rejected_attempt_count(properties: Any, queue_name: str) -> int:
    headers = getattr(properties, "headers", None) or {}
    x_death = headers.get("x-death")
    if not isinstance(x_death, list):
        return 0

    max_count = 0
    for entry in x_death:
        if not isinstance(entry, dict):
            continue
        if entry.get("queue") != queue_name or entry.get("reason") != "rejected":
            continue

        raw_count = entry.get("count", 0)
        try:
            max_count = max(max_count, int(raw_count))
        except (TypeError, ValueError):
            continue

    return max_count


def should_retry_processing(error: Exception) -> bool:
    return not isinstance(error, ValueError)


def publish_to_dead_letter(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    properties: Any,
    body: bytes,
    error: Exception,
    attempts: int,
) -> None:
    headers = dict(getattr(properties, "headers", None) or {})
    headers.update(
        {
            "x-dead-lettered-at": datetime.now(timezone.utc).isoformat(),
            "x-error-message": str(error),
            "x-error-name": type(error).__name__,
            "x-original-exchange": MACRO_EVENT_EXCHANGE,
            "x-original-queue": MACRO_ANALYSIS_REQUEST_QUEUE,
            "x-original-routing-key": MACRO_EVENT_ROUTING_KEY,
            "x-rejected-attempts": attempts,
        }
    )

    channel.basic_publish(
        exchange=MACRO_ANALYSIS_DLX,
        routing_key=MACRO_ANALYSIS_DLQ_ROUTING_KEY,
        body=body,
        properties=pika.BasicProperties(
            content_type=getattr(properties, "content_type", None)
            or "application/json",
            correlation_id=getattr(properties, "correlation_id", None),
            delivery_mode=2,
            headers=headers,
            message_id=getattr(properties, "message_id", None),
            timestamp=int(datetime.now(timezone.utc).timestamp()),
            type=getattr(properties, "type", None),
        ),
    )


def handle_processing_failure(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    method: Any,
    properties: Any,
    body: bytes,
    error: Exception,
) -> None:
    attempts = get_rejected_attempt_count(properties, MACRO_ANALYSIS_REQUEST_QUEUE)
    if should_retry_processing(error) and attempts < ANALYSIS_QUEUE_MAX_RETRIES:
        logging.warning(
            "Analysis failed, routing to retry queue (attempt %s/%s): %s",
            attempts + 1,
            ANALYSIS_QUEUE_MAX_RETRIES,
            error,
        )
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        return

    try:
        publish_to_dead_letter(channel, properties, body, error, attempts)
        channel.basic_ack(delivery_tag=method.delivery_tag)
        logging.error(
            "Analysis failed permanently; moved message to DLQ after %s rejected attempts.",
            attempts,
        )
    except Exception as dead_letter_error:
        logging.exception(
            "Failed to publish analysis message to DLQ: %s",
            dead_letter_error,
        )
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def connect_to_rabbitmq() -> pika.BlockingConnection:
    while True:
        try:
            return pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        except Exception as exc:
            logging.warning("RabbitMQ connection failed, retrying in 5s: %s", exc)
            time.sleep(5)


def declare_consumer_topology(
    channel: pika.adapters.blocking_connection.BlockingChannel,
) -> None:
    channel.exchange_declare(
        exchange=MACRO_EVENT_EXCHANGE,
        exchange_type="topic",
        durable=True,
    )
    channel.exchange_declare(exchange=MACRO_ANALYSIS_DLX, exchange_type="direct", durable=True)
    channel.queue_declare(queue=MACRO_ANALYSIS_DLQ, durable=True)
    channel.queue_bind(
        queue=MACRO_ANALYSIS_DLQ,
        exchange=MACRO_ANALYSIS_DLX,
        routing_key=MACRO_ANALYSIS_DLQ_ROUTING_KEY,
    )

    channel.exchange_declare(
        exchange=MACRO_ANALYSIS_RETRY_EXCHANGE,
        exchange_type="direct",
        durable=True,
    )
    channel.queue_declare(
        queue=MACRO_ANALYSIS_RETRY_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": MACRO_EVENT_EXCHANGE,
            "x-dead-letter-routing-key": MACRO_EVENT_ROUTING_KEY,
            "x-message-ttl": ANALYSIS_QUEUE_RETRY_DELAY_MS,
        },
    )
    channel.queue_bind(
        queue=MACRO_ANALYSIS_RETRY_QUEUE,
        exchange=MACRO_ANALYSIS_RETRY_EXCHANGE,
        routing_key=MACRO_ANALYSIS_RETRY_ROUTING_KEY,
    )

    channel.queue_declare(
        queue=MACRO_ANALYSIS_REQUEST_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": MACRO_ANALYSIS_RETRY_EXCHANGE,
            "x-dead-letter-routing-key": MACRO_ANALYSIS_RETRY_ROUTING_KEY,
        },
    )
    channel.queue_bind(
        queue=MACRO_ANALYSIS_REQUEST_QUEUE,
        exchange=MACRO_EVENT_EXCHANGE,
        routing_key=MACRO_EVENT_ROUTING_KEY,
    )


def on_message(channel: Any, method: Any, properties: Any, body: bytes) -> None:
    try:
        decoded = json.loads(body.decode("utf-8"))
        event = parse_event(decoded)
        event_id = event["id"]

        if event_id in recent_event_ids:
            channel.basic_ack(delivery_tag=method.delivery_tag)
            logging.info("Skipping duplicate event %s", event_id)
            return

        logging.info(
            "Received event for analysis: id=%s channel=%s type=%s",
            event_id,
            event.get("channel"),
            event.get("event_type"),
        )

        analogues = db.fetch_analogues(event, ANALYST_ANALOGUE_LIMIT)
        db.upsert_analogues(event["id"], analogues)

        metrics = build_analogue_metrics(db, analogues)
        lag_stats = compute_oil_btc_lag_stats(db, ANALYST_LOOKBACK_DAYS)
        policy_context = build_policy_context(db, event["event_time"])
        policy_lags = {
            "fed_funds_btc": compute_indicator_btc_lag_stats(
                db, "FRED_FEDFUNDS", ANALYST_POLICY_LOOKBACK_DAYS
            ),
            "us10y_btc": compute_indicator_btc_lag_stats(
                db, "FRED_DGS10", ANALYST_POLICY_LOOKBACK_DAYS
            ),
            "m2_btc": compute_indicator_btc_lag_stats(
                db, "FRED_M2SL", ANALYST_POLICY_LOOKBACK_DAYS
            ),
        }
        confidence_score = compute_confidence_score(len(analogues), lag_stats, metrics)

        analysis_payload = build_analysis_payload(
            event=event,
            analogues=analogues,
            metrics=metrics,
            lag_stats=lag_stats,
            confidence_score=confidence_score,
            policy_context=policy_context,
            policy_lags=policy_lags,
        )

        analysis_run_id = db.insert_analysis_run(
            event_id=event_id,
            run_version=ANALYSIS_RUN_VERSION,
            methodology=ANALYSIS_METHODOLOGY,
            result_json=analysis_payload,
            confidence_score=confidence_score,
        )

        result_message = {
            "analysis_run_id": analysis_run_id,
            "event_id": event_id,
            "methodology": ANALYSIS_METHODOLOGY,
            "run_version": ANALYSIS_RUN_VERSION,
            "confidence_score": confidence_score,
            "summary": {
                "analogue_count": analysis_payload["analogue_count"],
                "best_lag_days": lag_stats.get("best_lag_days"),
                "best_corr": lag_stats.get("best_corr"),
                "btc_return_7d_mean": analysis_payload["metrics"].get(
                    "btc_return_7d_mean"
                ),
                "policy_pressure_score": policy_context.get("policy_pressure_score"),
                "fed_funds_best_corr": policy_lags["fed_funds_btc"].get("best_corr"),
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        if publisher is None:
            raise RuntimeError("Rabbit publisher is not initialized.")

        publisher.publish_analysis_result(result_message)
        publisher.publish_scenario_request(
            {
                "event_id": event_id,
                "analysis_run_id": analysis_run_id,
                "confidence_score": confidence_score,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        remember_event(event_id)
        channel.basic_ack(delivery_tag=method.delivery_tag)
        logging.info("Analysis complete for event %s", event_id)
    except Exception as exc:
        logging.exception("Analysis failed: %s", exc)
        handle_processing_failure(channel, method, properties, body, exc)


def main() -> None:
    global publisher

    connection = connect_to_rabbitmq()
    channel = connection.channel()
    channel.confirm_delivery()
    declare_consumer_topology(channel)
    publisher = RabbitPublisher(RABBITMQ_URL)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue=MACRO_ANALYSIS_REQUEST_QUEUE,
        on_message_callback=on_message,
    )

    logging.info("Macro analyst engine started. Waiting for macro events...")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        logging.info("Shutdown requested, stopping consumer.")
    finally:
        try:
            channel.stop_consuming()
        except Exception:
            pass
        connection.close()
        if publisher is not None:
            publisher.close()
        db.close()


if __name__ == "__main__":
    main()

