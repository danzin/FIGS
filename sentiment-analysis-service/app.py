import os
import json
import pika
import logging
import sys
import time
import threading
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'user')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'pass')
GROQ_API_KEY = os.getenv('GROQ_API_KEY') # Make sure this is in your .env

# Queue Config
RAW_NEWS_EXCHANGE = 'raw_news'
SENTIMENT_RESULTS_EXCHANGE = 'sentiment_results'
SENTIMENT_ANALYSIS_QUEUE = 'sentiment_analysis_queue'

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [SentimentService] - %(message)s')

# --- DEFINING THE STRUCTURE ---
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

# --- INITIALIZE LANGCHAIN ---
# llama-3.1-8b-instant is the "Speed King" (Groq Free Tier: ~30 RPM)
llm = ChatGroq(
    temperature=0, 
    model_name="llama-3.1-8b-instant",
    api_key=GROQ_API_KEY,
    max_retries=2
)

# Create the Structured Output Chain
# This tells Groq: "Force your output to match the SentimentResponse class"
structured_llm = llm.with_structured_output(SentimentResponse)

# Define the Prompt
prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a crypto market sentiment analyzer. Analyze the following headline and extract the sentiment score and label."),
    ("human", "{headline}"),
])

# Create the Runnable Chain
chain = prompt_template | structured_llm

def analyze_sentiment(title: str) -> dict:
    try:
        # LangChain handles the retry, the JSON parsing, and the validation
        result: SentimentResponse = chain.invoke({"headline": title})
        
        return {
            "score": result.score,
            "label": result.sentiment
        }
    except Exception as e:
        logging.error(f"Groq Analysis Failed: {e}")
        # Graceful fallback
        return {"score": 0.0, "label": "neutral"}

# --- RABBITMQ CONSUMER (Standard Boilerplate) ---
def on_message(ch, method, properties, body):
    try:
        article = json.loads(body)
        title = article.get('title')
        
        if not title:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # CALL THE CHAIN
        sentiment = analyze_sentiment(title)
        
        logging.info(f"Analyzed: {title[:40]}... -> [{sentiment['label']} / {sentiment['score']}]")

        result_msg = {
            "external_id": article.get('id'),
            "title": title,
            "sentiment_score": sentiment['score'],
            "sentiment_label": sentiment['sentiment_label'], # Fixed typo mapping
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
    # (Connection logic same as before...)
    # Just ensure you load your GROQ_API_KEY
    if not GROQ_API_KEY:
        logging.error("CRITICAL: GROQ_API_KEY is missing!")
        sys.exit(1)
        
    logging.info("Starting LangChain + Groq Sentiment Service...")
    # ... (RabbitMQ connection code) ...

if __name__ == "__main__":
    main()