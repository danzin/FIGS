import os
import json
import pika
import logging
import sys
import time
from datetime import datetime, timezone
from transformers import pipeline

sentiment_pipeline = pipeline(
    "sentiment-analysis", 
    model="ProsusAI/finbert",  # FinBERT model
    return_all_scores=False    # Simplify output
)

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'user')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'pass')

RAW_NEWS_EXCHANGE = 'raw_news'
SENTIMENT_RESULTS_EXCHANGE = 'sentiment_results'
SENTIMENT_ANALYSIS_QUEUE = 'sentiment_analysis_queue'

logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - [SentimentService] - %(message)s',
  stream=sys.stdout
)

def analyze_title_sentiment(title: str) -> dict:
  """
  Analyzes sentiment using FinBERT (financial BERT model).
  Returns normalized score and label.
  """
  if not isinstance(title, str) or not title.strip():
    return {"score": 0.0, "label": "neutral"}

  try:
    result = sentiment_pipeline(title)[0]
    
    label_map = {
      'positive': 'bullish',
      'negative': 'bearish',
      'neutral': 'neutral'
    }
    
    score = result['score'] * 2 - 1  # Scale from 0-1 to -1-1
    
    # Adjust score direction for negative labels
    if result['label'] == 'negative':
      score = -abs(score)
        
    return {
      "score": round(score, 3),  # 3 decimal places
      "label": label_map[result['label']]
    }
      
  except Exception as e:
    logging.error(f"FinBERT analysis failed: {e}")
    return {"score": 0.0, "label": "neutral"}

# ====================================================================
# RABBITMQ CALLBACK
# ====================================================================
def on_message_callback(ch, method, properties, body):
  """
  This function is called for every message received from the raw news queue.
  """
  try:
    # Decode the message body from bytes to a Python dictionary
    article = json.loads(body.decode('utf-8'))
    logging.info(f"Received article: {article.get('id')}")

    # Ensure the article has a title
    title = article.get('title')
    if not title:
      logging.warning(f"Article {article.get('id')} has no title. Discarding.")
      ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
      return

    # Perform the analysis
    sentiment_data = analyze_title_sentiment(title)

    # Construct the result message to be published
    sentiment_result = {
      "external_id": article.get('id'),
      "source": article.get('source'),
      "title": title,
      "url": article.get('url'),
      "published_at": article.get('publishedAt'),
      "sentiment_score": sentiment_data['score'],
      "sentiment_label": sentiment_data['label'],
      "analyzed_at": datetime.now(timezone.utc).isoformat()
    }

    # Publish the result to the next exchange in the pipeline
    ch.basic_publish(
      exchange=SENTIMENT_RESULTS_EXCHANGE,
      routing_key='',  # routing_key is ignored for fanout exchanges
      body=json.dumps(sentiment_result),
      properties=pika.BasicProperties(
        content_type='application/json',
        delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
      )
    )
    logging.info(f"Published sentiment for article: {article.get('id')}")

    # Acknowledge the original message, removing it from the queue
    ch.basic_ack(delivery_tag=method.delivery_tag)

  except json.JSONDecodeError as e:
    logging.error(f"Failed to decode JSON message body: {e}. Discarding message.")
    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
  except Exception as e:
    logging.error(f"An unexpected error occurred in callback: {e}. Discarding message.")
    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


# ====================================================================
# MAIN APPLICATION LOGIC
# ====================================================================
def main():
  """
  Main function to set up RabbitMQ connection, channels, queues,
  and start consuming messages.
  """
  logging.info("Sentiment Analysis Service is starting...")
  connection = None
  while connection is None:
    try:
      credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
      connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=credentials))
      logging.info("Successfully connected to RabbitMQ.")
    except pika.exceptions.AMQPConnectionError as e:
      logging.error(f"Failed to connect to RabbitMQ: {e}. Retrying in 5 seconds...")
      time.sleep(5)

  channel = connection.channel()

  # Declare the exchange to listen to (published by the scraper)
  channel.exchange_declare(exchange=RAW_NEWS_EXCHANGE, exchange_type='fanout', durable=True)
  
  # Declare the exchange to publish to (listened to by the persister)
  channel.exchange_declare(exchange=SENTIMENT_RESULTS_EXCHANGE, exchange_type='fanout', durable=True)

  # Declare a durable queue to consume messages from
  channel.queue_declare(queue=SENTIMENT_ANALYSIS_QUEUE, durable=True)

  # Bind the queue to the raw news exchange
  channel.queue_bind(exchange=RAW_NEWS_EXCHANGE, queue=SENTIMENT_ANALYSIS_QUEUE)

  logging.info(f"Queue '{SENTIMENT_ANALYSIS_QUEUE}' is bound to exchange '{RAW_NEWS_EXCHANGE}'.")

  # Set Quality of Service: process one message at a time
  channel.basic_qos(prefetch_count=1)

  # Register the callback function to handle messages
  channel.basic_consume(queue=SENTIMENT_ANALYSIS_QUEUE, on_message_callback=on_message_callback)

  logging.info("Waiting for messages. To exit press CTRL+C")
  try:
    channel.start_consuming()
  except KeyboardInterrupt:
    logging.info("Shutting down...")
    channel.stop_consuming()
  finally:
    connection.close()
    logging.info("RabbitMQ connection closed.")


if __name__ == '__main__':
    main()
