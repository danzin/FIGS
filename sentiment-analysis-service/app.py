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
    model_name="llama-3.1-8b-instant",
    api_key=GROQ_API_KEY,
    max_retries=2
)

structured_llm = llm.with_structured_output(SentimentResponse)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a crypto market sentiment analyzer. Analyze the following headline and extract the sentiment score and label."),
    ("human", "{headline}"),
])

chain = prompt_template | structured_llm

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
            "timestamp": datetime.now(timezone.utc).isoformat()
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
        title = article.get('title')
        
        if not title:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        sentiment = analyze_sentiment(title)
        
        logging.info(f"Analyzed: {title[:40]}... -> [{sentiment['label']} / {sentiment['score']}]")

        result_msg = {
            "external_id": article.get('id'),
            "title": title,
            "sentiment_score": sentiment['score'],
            "sentiment_label": sentiment['label'],
            "analyzed_at": datetime.now(timezone.utc).isoformat()
        }

        ch.basic_publish(
            exchange=SENTIMENT_RESULTS_EXCHANGE,
            routing_key='',
            body=json.dumps(result_msg),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        logging.error(f"Error processing message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        
def main():
  global service_ready
  
  health_thread = threading.Thread(target=start_health_server, daemon=True)
  health_thread.start()
  
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