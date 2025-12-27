import os
import json
import pika
import logging
import sys
import time
import threading
from datetime import datetime, timezone
from google import genai
from google.genai import types
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

# Global variable to track service readiness
service_ready = False

# Initialize Gemini client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'user')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'pass')

RAW_NEWS_EXCHANGE = 'raw_news'
SENTIMENT_RESULTS_EXCHANGE = 'sentiment_results'
SENTIMENT_ANALYSIS_QUEUE = 'sentiment_analysis_queue'

# MODEL CHOICE: Use 1.5-flash for the high free-tier quota. 
# 2.0-flash experimental is currently too restricted for high-volume news.
MODEL_NAME = 'gemini-1.5-flash-8b' 

logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - [SentimentService] - %(message)s',
  stream=sys.stdout
)

# Health check handler
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

def analyze_title_sentiment(title: str) -> dict:
  if not isinstance(title, str) or not title.strip():
    return {"score": 0.0, "label": "neutral"}

  prompt = f"""
Analyze this crypto/financial news headline for market sentiment: "{title}"
Return ONLY valid JSON: {{"sentiment": "bullish" | "bearish" | "neutral", "score": -1.0 to 1.0}}
"""

  # Force a 5-second gap to stay under 15 RPM (1 request every 4s is the limit)
  time.sleep(5)

  try:
    response = client.models.generate_content(
      model=MODEL_NAME, # UPDATED: Using 1.5-flash
      contents=prompt,
      config=types.GenerateContentConfig(
        response_mime_type='application/json',
        temperature=0.0
      )
    )
    
    result = json.loads(response.text)
    score = float(result.get('score', 0.0))
    score = max(-1.0, min(1.0, score))
    
    label = result.get('sentiment', 'neutral').lower()
    if label not in ['bullish', 'bearish', 'neutral']:
      label = 'neutral'
    
    return {"score": round(score, 3), "label": label}
      
  except Exception as e:
    # Handle Quota Exhaustion with a longer backoff
    if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
        logging.warning("Quota hit. Backing off for 30 seconds...")
        time.sleep(30)
    
    logging.error(f"Gemini analysis failed: {e}")
    return {"score": 0.0, "label": "neutral"}

def on_message_callback(ch, method, properties, body):
  try:
    article = json.loads(body.decode('utf-8'))
    title = article.get('title')
    
    if not title:
      ch.basic_ack(delivery_tag=method.delivery_tag)
      return

    sentiment_data = analyze_title_sentiment(title)

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

    ch.basic_publish(
      exchange=SENTIMENT_RESULTS_EXCHANGE,
      routing_key='',
      body=json.dumps(sentiment_result),
      properties=pika.BasicProperties(
        content_type='application/json',
        delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
      )
    )
    logging.info(f"Analyzed: {title[:50]}... [{sentiment_data['label']}]")
    ch.basic_ack(delivery_tag=method.delivery_tag)

  except Exception as e:
    logging.error(f"Callback error: {e}")
    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

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

  # Process ONE message at a time to respect Gemini rate limits
  channel.basic_qos(prefetch_count=1)
  channel.basic_consume(queue=SENTIMENT_ANALYSIS_QUEUE, on_message_callback=on_message_callback)

  service_ready = True
  try:
    channel.start_consuming()
  except KeyboardInterrupt:
    connection.close()

if __name__ == '__main__':
    main()