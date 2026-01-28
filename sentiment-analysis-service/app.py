import os
import json
import pika
import logging
import time
import threading
import socketserver
from http.server import BaseHTTPRequestHandler

from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'user')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'pass')
GROQ_API_KEY = os.getenv('GROQ_API_KEY') 

RAW_NEWS_EXCHANGE = 'raw_news'
SENTIMENT_RESULTS_EXCHANGE = 'sentiment_results'
SENTIMENT_ANALYSIS_QUEUE = 'sentiment_analysis_queue'

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [SentimentService] - %(message)s')

service_ready = False

class SentimentResponse(BaseModel):
    sentiment: Literal["bullish", "bearish", "neutral"] = Field(
        ..., 
        description="The market sentiment of the headline."
    )
    score: float = Field(
        ..., 
        description="A score between -1.0 (bearish) and 1.0 (bullish).",
        ge=-1.0,
        le=1.0
    )

llm = ChatGroq(
    temperature=0, 
    model_name="gpt-oss-120b",
    api_key=GROQ_API_KEY,
    max_retries=2
)

structured_llm = llm.with_structured_output(SentimentResponse)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a crypto market sentiment analyzer. Analyze the following headline and extract the sentiment score and label."),
    ("human", "{headline}"),
])

chain = prompt_template | structured_llm

NEWS_BUFFER = []
BUFFER_LOCK = threading.Lock()
BATCH_INTERVAL = 4 * 60 * 60 # 4 hours
RATE_LIMIT_CHUNK = 5
RATE_LIMIT_SLEEP = 60

def analyze_sentiment(title: str) -> dict:
    try:
        result: SentimentResponse = chain.invoke({"headline": title})
        
        return {
            "score": result.score,
            "label": result.sentiment
        }
    except Exception as e:
        logging.error(f"Groq Analysis Failed: {e}")
        # Graceful fallback
        return {"score": 0.0, "label": "neutral"}
    
def process_buffered_news():
    """Background thread to process accumulated news every 4 hours."""
    logging.info(f"Batch processor started. Will run every {BATCH_INTERVAL} seconds.")
    while True:
        time.sleep(BATCH_INTERVAL)
        
        with BUFFER_LOCK:
            if not NEWS_BUFFER:
                logging.info("No news to process in this batch.")
                continue
            processing_queue = NEWS_BUFFER[:]
            NEWS_BUFFER.clear()
            
        logging.info(f"Starting batch processing of {len(processing_queue)} articles.")
        
        try:
            # Create a dedicated connection for the publisher thread
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
            connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=credentials))
            channel = connection.channel()
            # Ensure exchanges exist
            channel.exchange_declare(exchange=SENTIMENT_RESULTS_EXCHANGE, exchange_type='fanout', durable=True)
            
            total = len(processing_queue)
            for i in range(0, total, RATE_LIMIT_CHUNK):
                chunk = processing_queue[i : i + RATE_LIMIT_CHUNK]
                
                for article in chunk:
                    title = article.get('title')
                    if not title: 
                        continue
                        
                    sentiment = analyze_sentiment(title)
                    logging.info(f"Analyzed ({i}/{total}): {title[:30]}... -> {sentiment['label']}")
                    
                    result_msg = {
                        "external_id": article.get('id'),
                        "title": title,
                        "sentiment_score": sentiment['score'],
                        "sentiment_label": sentiment['label'],
                        "analyzed_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    channel.basic_publish(
                        exchange=SENTIMENT_RESULTS_EXCHANGE,
                        routing_key='',
                        body=json.dumps(result_msg),
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                
                # Rate limit sleep if there are more items
                if i + RATE_LIMIT_CHUNK < total:
                    time.sleep(RATE_LIMIT_SLEEP)
            
            connection.close()
            logging.info("Batch processing complete.")
            
        except Exception as e:
            logging.error(f"Error during batch processing: {e}")

class HealthHandler(BaseHTTPRequestHandler):
  def do_GET(self):
    if self.path == '/health':
      if service_ready:
        self.send_response(200) 
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        health_status = {
            "status": "healthy",
            "service": "sentiment-analysis",
            "ready": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "buffered_items": len(NEWS_BUFFER)
        }
        self.wfile.write(json.dumps(health_status).encode())
      else:
        self.send_response(503) 
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        health_status = {
          "status": "initializing",
          "service": "sentiment-analysis", 
          "ready": False,
          "timestamp": datetime.now(timezone.utc).isoformat()
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
  
  def log_message(self, format, *args):
      pass

def start_health_server():
  try:
    with socketserver.TCPServer(("", 6220), HealthHandler) as httpd:
      logging.info("Health check server started on port 6220")
      httpd.serve_forever()
  except Exception as e:
    logging.error(f"Failed to start health server: {e}")

def on_message(ch, method, properties, body):
    try:
        article = json.loads(body)
        
        with BUFFER_LOCK:
            NEWS_BUFFER.append(article)
            
        # Ack immediately to prevent queue buildup on RMQ side, 
        # moving responsibility to local memory buffer.
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        logging.error(f"Error buffering message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        
def main():
  global service_ready
  
  health_thread = threading.Thread(target=start_health_server, daemon=True)
  health_thread.start()
  
  batch_thread = threading.Thread(target=process_buffered_news, daemon=True)
  batch_thread.start()
  
  connection = None
  while connection is None:
    try:
      credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
      connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=credentials))
      logging.info("Connected to RabbitMQ.")
    except Exception:
      time.sleep(5)

  channel = connection.channel()
  channel.exchange_declare(exchange=RAW_NEWS_EXCHANGE, exchange_type='fanout', durable=True)
  channel.exchange_declare(exchange=SENTIMENT_RESULTS_EXCHANGE, exchange_type='fanout', durable=True)
  channel.queue_declare(queue=SENTIMENT_ANALYSIS_QUEUE, durable=True)
  channel.queue_bind(exchange=RAW_NEWS_EXCHANGE, queue=SENTIMENT_ANALYSIS_QUEUE)

  channel.basic_qos(prefetch_count=1)
  channel.basic_consume(queue=SENTIMENT_ANALYSIS_QUEUE, on_message_callback=on_message)

  service_ready = True
  try:
    channel.start_consuming()
  except KeyboardInterrupt:
    connection.close()

if __name__ == '__main__':
    main()