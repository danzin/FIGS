# Financial Insights Gathering System (FIGS)

## 📌 Project Vision
 FIGS is a modular system for aggregating, persisting, and querying financial signals — primarily focused on the crypto market. It aims to surface actionable insights by combining structured data (e.g., price feeds) with unstructured signals (e.g., app store rankings, social sentiment, and search trends etc).

## 🧠 Tech Stack
- **TypeScript**
- **Express**
- **NodeJS**
- **NestJS**
- **React, Vite, TailwindCSS** for the frontend. 
- **RabbitMQ** for event-based communication
- **TimescaleDB (PostgreSQL)** for time-series data
- **Docker** for container orchestration
- **Monorepo**
- Planned:
  - Additional microservice for scraping data unreachable through an API
  - Possibly adding another DB(PostgreSQL or MongoDB) for handling non-timeseries data
  - **Redis** for caching
  - **AWS ECS** deployment, 
  
## 📦 Microservices

- **data-collector**: Consumes and publishes signals to RabbitMQ
- **signal-persister**: Consumes and writes signals to TimescaleDB
- **signal-query-api**: Serves raw + aggregated signal queries from TimescaleDB
- **micro-frontend**: Displays data from signal-query-api

## 📊 Features

- Raw + bucketed query support
- Continuous aggregates for fast timescale lookups
- Extensible DTOs and modular repository layer

## 🚀 Running Locally

```bash
npm install
docker compose up --build
```

The frontend is currently minimalistic, only displaying a few signals with a price chart. 
As I add more data to work with, more data will be displayed.

![image](https://github.com/user-attachments/assets/54b48019-b414-4111-a57f-b07c99bcf3e3)

The full docker build:

![image](https://github.com/user-attachments/assets/fc3f486f-3c77-47b0-8b0e-1c795f48034a)

![image](https://github.com/user-attachments/assets/5f744c97-ee1f-40d3-8e35-736cff4f061e)


