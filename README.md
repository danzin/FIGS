# Financial Insights Gathering System (FIGS)

## 📌 Project Vision
 FIGS is a modular system for aggregating, persisting, and querying financial data — primarily focused on the crypto market. It aims to surface actionable insights by combining structured data (e.g., price feeds) with unstructured signals (e.g., app store rankings, AI sentiment analysis etc.)

## 🧠 Tech Stack
- **TypeScript**
- **Python**
- **Express**
- **NodeJS**
- **NestJS**
- **React, Vite, TailwindCSS** for the frontend. 
- **RabbitMQ** for event-based communication
- **TimescaleDB (PostgreSQL)** for time-series data
- **Docker** for container orchestration
- **Monorepo**
- **AI Sentiment Analysis**
  
- Planned:
  - Possibly adding another DB(PostgreSQL or MongoDB) for handling non-timeseries data
  - **Redis** for caching
  - **AWS ECS** deployment
  - Frontend redesign
  
## 📦 Microservices

- **data-collector**: Consumes and publishes data to RabbitMQ
- **signal-persister**: Consumes and writes data to TimescaleDB
- **signal-query-api**: Serves raw + aggregated data queries from TimescaleDB
- **micro-frontend**: Displays data from signal-query-api
- **scraper-service**: Spins up headless browsers and scrapes data unavaiable through APIs
- **sentiment-analysis-service**: Uses AI to perform sentiment analysis on recent news articles
  
## 📊 Features

- Raw + bucketed query support
- Continuous aggregates for fast timescale lookups
- Extensible DTOs and modular repository layer
- AI sentiment analysis of recent news


## 🚀 Running Locally

```bash
npm install
docker compose up --build
```

The frontend is currently minimalistic, only displaying a few signals with a price chart. 
As I add more data to work with, more data will be displayed.

![image](https://github.com/user-attachments/assets/1f422c79-09e6-4a27-9d10-79a584fb0e7e)

The full docker build:

![image](https://github.com/user-attachments/assets/fc3f486f-3c77-47b0-8b0e-1c795f48034a)

![image](https://github.com/user-attachments/assets/5f744c97-ee1f-40d3-8e35-736cff4f061e)

