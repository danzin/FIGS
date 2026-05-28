import json
import logging
import os
import socketserver
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from queue import Empty, Full, Queue
from typing import Any, Literal

import pika
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'user')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'pass')
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

RAW_NEWS_EXCHANGE = 'raw_news'
SENTIMENT_RESULTS_EXCHANGE = 'sentiment_results'
SENTIMENT_ANALYSIS_QUEUE = 'sentiment_analysis_queue'
SENTIMENT_ANALYSIS_RETRY_EXCHANGE = f'{SENTIMENT_ANALYSIS_QUEUE}.retry'
SENTIMENT_ANALYSIS_RETRY_QUEUE = f'{SENTIMENT_ANALYSIS_QUEUE}.retry'
SENTIMENT_ANALYSIS_RETRY_ROUTING_KEY = f'{SENTIMENT_ANALYSIS_QUEUE}.retry'
SENTIMENT_ANALYSIS_DLX = f'{SENTIMENT_ANALYSIS_QUEUE}.dlx'
SENTIMENT_ANALYSIS_DLQ = f'{SENTIMENT_ANALYSIS_QUEUE}.dlq'
SENTIMENT_ANALYSIS_DLQ_ROUTING_KEY = f'{SENTIMENT_ANALYSIS_QUEUE}.dead-letter'

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [SentimentService] - %(message)s')

service_ready = False


class SentimentResponse(BaseModel):
    sentiment: Literal['bullish', 'bearish', 'neutral'] = Field(
        ...,
        description='The market sentiment of the headline.',
    )
    score: float = Field(
        ...,
        description='A score between -1.0 (bearish) and 1.0 (bullish).',
        ge=-1.0,
        le=1.0,
    )


MODEL_NAME = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
MAX_ITEMS_PER_BATCH = int(os.getenv('SENTIMENT_BATCH_LIMIT', '50'))
BATCH_INTERVAL = int(os.getenv('SENTIMENT_BATCH_INTERVAL_SECONDS', '60'))
RATE_LIMIT_CHUNK = int(os.getenv('SENTIMENT_RATE_LIMIT_CHUNK', '3'))
RATE_LIMIT_SLEEP = int(os.getenv('SENTIMENT_RATE_LIMIT_SLEEP', '30'))
MAX_ANALYSIS_RETRIES = int(os.getenv('SENTIMENT_ANALYSIS_RETRIES', '2'))
QUEUE_MAX_RETRIES = int(
    os.getenv('SENTIMENT_QUEUE_MAX_RETRIES', os.getenv('SENTIMENT_ARTICLE_RETRIES', '3'))
)
QUEUE_RETRY_DELAY_MS = int(os.getenv('SENTIMENT_QUEUE_RETRY_DELAY_MS', '30000'))

llm = ChatGroq(
    temperature=0,
    model_name=MODEL_NAME,
    api_key=GROQ_API_KEY,
    max_retries=2,
)

structured_llm = llm.with_structured_output(SentimentResponse)

prompt_template = ChatPromptTemplate.from_messages(
    [
        (
            'system',
            'You are a crypto market sentiment analyzer. Analyze the following headline and extract the sentiment score and label.',
        ),
        ('human', '{headline}'),
    ]
)

chain = prompt_template | structured_llm


@dataclass(slots=True)
class BufferedDelivery:
    body: bytes
    delivery_tag: int
    properties: Any


DELIVERY_BUFFER = Queue(maxsize=max(MAX_ITEMS_PER_BATCH * 4, 1))
CONSUMER_CONNECTION: pika.BlockingConnection | None = None
CONSUMER_CHANNEL: Any = None


def build_rabbitmq_parameters() -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    return pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=credentials)


def connect_to_rabbitmq() -> pika.BlockingConnection:
    while True:
        try:
            return pika.BlockingConnection(build_rabbitmq_parameters())
        except Exception as exc:
            logging.warning(f'RabbitMQ connection failed, retrying in 5s: {exc}')
            time.sleep(5)


class BrokerPublisherClient:
    def __init__(self) -> None:
        self.connection: pika.BlockingConnection | None = None
        self.channel: Any = None

    def _ensure_channel(self) -> Any:
        if (
            self.connection is not None
            and self.connection.is_open
            and self.channel is not None
            and self.channel.is_open
        ):
            return self.channel

        self.connection = connect_to_rabbitmq()
        self.channel = self.connection.channel()
        self.channel.confirm_delivery()
        self.channel.exchange_declare(
            exchange=SENTIMENT_RESULTS_EXCHANGE,
            exchange_type='fanout',
            durable=True,
        )
        self.channel.exchange_declare(
            exchange=SENTIMENT_ANALYSIS_DLX,
            exchange_type='direct',
            durable=True,
        )
        return self.channel

    def publish_result(self, result_msg: dict[str, Any]) -> None:
        channel = self._ensure_channel()
        channel.basic_publish(
            exchange=SENTIMENT_RESULTS_EXCHANGE,
            routing_key='',
            body=json.dumps(result_msg),
            properties=pika.BasicProperties(
                content_type='application/json',
                delivery_mode=2,
                timestamp=int(datetime.now(timezone.utc).timestamp()),
            ),
        )

    def publish_dead_letter(
        self,
        delivery: BufferedDelivery,
        error: Exception,
        attempts: int,
    ) -> None:
        channel = self._ensure_channel()
        headers = dict(getattr(delivery.properties, 'headers', None) or {})
        headers.update(
            {
                'x-dead-lettered-at': datetime.now(timezone.utc).isoformat(),
                'x-error-message': str(error),
                'x-error-name': type(error).__name__,
                'x-original-exchange': RAW_NEWS_EXCHANGE,
                'x-original-queue': SENTIMENT_ANALYSIS_QUEUE,
                'x-original-routing-key': '',
                'x-rejected-attempts': attempts,
            }
        )

        channel.basic_publish(
            exchange=SENTIMENT_ANALYSIS_DLX,
            routing_key=SENTIMENT_ANALYSIS_DLQ_ROUTING_KEY,
            body=delivery.body,
            properties=pika.BasicProperties(
                content_type=getattr(delivery.properties, 'content_type', None) or 'application/json',
                correlation_id=getattr(delivery.properties, 'correlation_id', None),
                delivery_mode=2,
                headers=headers,
                message_id=getattr(delivery.properties, 'message_id', None),
                timestamp=int(datetime.now(timezone.utc).timestamp()),
                type=getattr(delivery.properties, 'type', None),
            ),
        )

    def close(self) -> None:
        if self.channel is not None and self.channel.is_open:
            self.channel.close()
        if self.connection is not None and self.connection.is_open:
            self.connection.close()


def analyze_sentiment(title: str) -> dict[str, Any] | None:
    for attempt in range(1, MAX_ANALYSIS_RETRIES + 1):
        try:
            result: SentimentResponse = chain.invoke({'headline': title})
            return {
                'score': result.score,
                'label': result.sentiment,
            }
        except Exception as exc:
            logging.warning(
                f'Groq analysis failed (attempt {attempt}/{MAX_ANALYSIS_RETRIES}): {exc}'
            )
            if attempt < MAX_ANALYSIS_RETRIES:
                time.sleep(2**attempt)

    return None


def declare_consumer_topology(channel: Any) -> None:
    channel.exchange_declare(exchange=RAW_NEWS_EXCHANGE, exchange_type='fanout', durable=True)
    channel.exchange_declare(
        exchange=SENTIMENT_RESULTS_EXCHANGE,
        exchange_type='fanout',
        durable=True,
    )
    channel.exchange_declare(
        exchange=SENTIMENT_ANALYSIS_DLX,
        exchange_type='direct',
        durable=True,
    )
    channel.queue_declare(queue=SENTIMENT_ANALYSIS_DLQ, durable=True)
    channel.queue_bind(
        exchange=SENTIMENT_ANALYSIS_DLX,
        queue=SENTIMENT_ANALYSIS_DLQ,
        routing_key=SENTIMENT_ANALYSIS_DLQ_ROUTING_KEY,
    )

    channel.exchange_declare(
        exchange=SENTIMENT_ANALYSIS_RETRY_EXCHANGE,
        exchange_type='direct',
        durable=True,
    )
    channel.queue_declare(
        queue=SENTIMENT_ANALYSIS_RETRY_QUEUE,
        durable=True,
        arguments={
            'x-dead-letter-exchange': RAW_NEWS_EXCHANGE,
            'x-dead-letter-routing-key': '',
            'x-message-ttl': QUEUE_RETRY_DELAY_MS,
        },
    )
    channel.queue_bind(
        exchange=SENTIMENT_ANALYSIS_RETRY_EXCHANGE,
        queue=SENTIMENT_ANALYSIS_RETRY_QUEUE,
        routing_key=SENTIMENT_ANALYSIS_RETRY_ROUTING_KEY,
    )

    channel.queue_declare(
        queue=SENTIMENT_ANALYSIS_QUEUE,
        durable=True,
        arguments={
            'x-dead-letter-exchange': SENTIMENT_ANALYSIS_RETRY_EXCHANGE,
            'x-dead-letter-routing-key': SENTIMENT_ANALYSIS_RETRY_ROUTING_KEY,
        },
    )
    channel.queue_bind(exchange=RAW_NEWS_EXCHANGE, queue=SENTIMENT_ANALYSIS_QUEUE)


def get_rejected_attempt_count(properties: Any, queue_name: str) -> int:
    headers = getattr(properties, 'headers', None) or {}
    x_death = headers.get('x-death')
    if not isinstance(x_death, list):
        return 0

    max_count = 0
    for entry in x_death:
        if not isinstance(entry, dict):
            continue
        if entry.get('queue') != queue_name or entry.get('reason') != 'rejected':
            continue

        raw_count = entry.get('count', 0)
        try:
            max_count = max(max_count, int(raw_count))
        except (TypeError, ValueError):
            continue

    return max_count


def schedule_delivery_ack(delivery_tag: int) -> None:
    if (
        CONSUMER_CONNECTION is None
        or CONSUMER_CHANNEL is None
        or CONSUMER_CONNECTION.is_closed
        or CONSUMER_CHANNEL.is_closed
    ):
        raise RuntimeError('Consumer channel is not available for acknowledgements.')

    CONSUMER_CONNECTION.add_callback_threadsafe(
        lambda delivery_tag=delivery_tag: CONSUMER_CHANNEL.basic_ack(
            delivery_tag=delivery_tag,
        )
    )


def schedule_delivery_nack(delivery_tag: int, requeue: bool) -> None:
    if (
        CONSUMER_CONNECTION is None
        or CONSUMER_CHANNEL is None
        or CONSUMER_CONNECTION.is_closed
        or CONSUMER_CHANNEL.is_closed
    ):
        raise RuntimeError('Consumer channel is not available for negative acknowledgements.')

    CONSUMER_CONNECTION.add_callback_threadsafe(
        lambda delivery_tag=delivery_tag, requeue=requeue: CONSUMER_CHANNEL.basic_nack(
            delivery_tag=delivery_tag,
            requeue=requeue,
        )
    )


def parse_article(body: bytes) -> dict[str, Any]:
    payload = json.loads(body.decode('utf-8'))
    if not isinstance(payload, dict):
        raise ValueError('Incoming sentiment payload must be a JSON object.')

    title = payload.get('title')
    source = payload.get('source')
    url = payload.get('url')
    external_id = payload.get('id')

    if not isinstance(title, str) or not title.strip():
        raise ValueError('Incoming sentiment payload is missing a valid title.')
    if not isinstance(source, str) or not source.strip():
        raise ValueError('Incoming sentiment payload is missing a valid source.')
    if not isinstance(url, str) or not url.strip():
        raise ValueError('Incoming sentiment payload is missing a valid url.')
    if not isinstance(external_id, str) or not external_id.strip():
        raise ValueError('Incoming sentiment payload is missing a valid id.')

    published_at = payload.get('publishedAt')
    if not isinstance(published_at, str) or not published_at.strip():
        logging.warning(f'Article {external_id} missing publishedAt, using current time')
        payload['publishedAt'] = datetime.now(timezone.utc).isoformat()

    return payload


def build_result_message(
    article: dict[str, Any],
    sentiment: dict[str, Any],
) -> dict[str, Any]:
    return {
        'external_id': article['id'],
        'source': article['source'],
        'title': article['title'],
        'url': article['url'],
        'published_at': article['publishedAt'],
        'summary': article.get('summary'),
        'image_url': article.get('imageUrl'),
        'sentiment_score': sentiment['score'],
        'sentiment_label': sentiment['label'],
        'analyzed_at': datetime.now(timezone.utc).isoformat(),
    }


def should_retry_processing(error: Exception) -> bool:
    return not isinstance(error, ValueError)


def handle_delivery_failure(
    delivery: BufferedDelivery,
    publisher: BrokerPublisherClient,
    error: Exception,
) -> None:
    attempts = get_rejected_attempt_count(delivery.properties, SENTIMENT_ANALYSIS_QUEUE)
    if should_retry_processing(error) and attempts < QUEUE_MAX_RETRIES:
        logging.warning(
            f'Sentiment processing failed, routing to retry queue (attempt {attempts + 1}/{QUEUE_MAX_RETRIES}): {error}'
        )
        schedule_delivery_nack(delivery.delivery_tag, requeue=False)
        return

    try:
        publisher.publish_dead_letter(delivery, error, attempts)
        schedule_delivery_ack(delivery.delivery_tag)
        logging.error(
            f'Sentiment processing failed permanently; moved message to DLQ after {attempts} rejected attempts.'
        )
    except Exception as dead_letter_error:
        logging.error(f'Failed to publish sentiment message to DLQ: {dead_letter_error}')
        schedule_delivery_nack(delivery.delivery_tag, requeue=False)


def collect_batch() -> list[BufferedDelivery]:
    try:
        first = DELIVERY_BUFFER.get(timeout=BATCH_INTERVAL)
    except Empty:
        logging.info('No news to process in this batch.')
        return []

    batch = [first]
    deadline = time.monotonic() + BATCH_INTERVAL
    while len(batch) < MAX_ITEMS_PER_BATCH:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break

        try:
            batch.append(DELIVERY_BUFFER.get(timeout=remaining))
        except Empty:
            break

    return batch


def process_buffered_news() -> None:
    logging.info(
        f'Batch processor started. Will process up to {MAX_ITEMS_PER_BATCH} items every {BATCH_INTERVAL} seconds.'
    )
    publisher = BrokerPublisherClient()

    while True:
        deliveries = collect_batch()
        if not deliveries:
            continue

        logging.info(f'Starting batch processing of {len(deliveries)} articles.')
        for index, delivery in enumerate(deliveries, start=1):
            try:
                article = parse_article(delivery.body)
                sentiment = analyze_sentiment(article['title'])
                if sentiment is None:
                    raise RuntimeError('Sentiment analysis failed after retry budget.')

                publisher.publish_result(build_result_message(article, sentiment))
                schedule_delivery_ack(delivery.delivery_tag)
                logging.info(
                    f"Analyzed ({index}/{len(deliveries)}): {article['title'][:30]}... -> {sentiment['label']}"
                )
            except Exception as error:
                logging.exception(f'Failed to process buffered news delivery: {error}')
                handle_delivery_failure(delivery, publisher, error)
            finally:
                DELIVERY_BUFFER.task_done()

            if index % RATE_LIMIT_CHUNK == 0 and index < len(deliveries):
                time.sleep(RATE_LIMIT_SLEEP)


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == '/health':
            if service_ready:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                health_status = {
                    'status': 'healthy',
                    'service': 'sentiment-analysis',
                    'ready': True,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'buffered_items': DELIVERY_BUFFER.qsize(),
                }
                self.wfile.write(json.dumps(health_status).encode())
            else:
                self.send_response(503)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                health_status = {
                    'status': 'initializing',
                    'service': 'sentiment-analysis',
                    'ready': False,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                }
                self.wfile.write(json.dumps(health_status).encode())
        elif self.path == '/ready':
            if service_ready:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'ready')
            else:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b'not ready')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        pass


def start_health_server() -> None:
    try:
        with socketserver.TCPServer(('', 6220), HealthHandler) as httpd:
            logging.info('Health check server started on port 6220')
            httpd.serve_forever()
    except Exception as exc:
        logging.error(f'Failed to start health server: {exc}')


def on_message(ch: Any, method: Any, properties: Any, body: bytes) -> None:
    try:
        DELIVERY_BUFFER.put_nowait(
            BufferedDelivery(
                body=body,
                delivery_tag=method.delivery_tag,
                properties=properties,
            )
        )
    except Full:
        logging.warning('Sentiment delivery buffer is full; routing message to retry queue.')
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as exc:
        logging.error(f'Error buffering message: {exc}')
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def main() -> None:
    global CONSUMER_CHANNEL, CONSUMER_CONNECTION, service_ready

    health_thread = threading.Thread(target=start_health_server, daemon=True)
    health_thread.start()

    batch_thread = threading.Thread(target=process_buffered_news, daemon=True)
    batch_thread.start()

    CONSUMER_CONNECTION = connect_to_rabbitmq()
    logging.info('Connected to RabbitMQ.')

    CONSUMER_CHANNEL = CONSUMER_CONNECTION.channel()
    declare_consumer_topology(CONSUMER_CHANNEL)
    CONSUMER_CHANNEL.basic_qos(prefetch_count=max(MAX_ITEMS_PER_BATCH, 1))
    CONSUMER_CHANNEL.basic_consume(
        queue=SENTIMENT_ANALYSIS_QUEUE,
        on_message_callback=on_message,
    )

    service_ready = True
    try:
        CONSUMER_CHANNEL.start_consuming()
    except KeyboardInterrupt:
        logging.info('Shutdown requested, stopping sentiment consumer.')
    finally:
        service_ready = False
        try:
            if CONSUMER_CHANNEL is not None and CONSUMER_CHANNEL.is_open:
                CONSUMER_CHANNEL.stop_consuming()
        except Exception:
            pass

        if CONSUMER_CONNECTION is not None and CONSUMER_CONNECTION.is_open:
            CONSUMER_CONNECTION.close()


if __name__ == '__main__':
    main()
