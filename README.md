# Financial Insights Gathering System (FIGS)

A system designed for ingesting and querying financial signals using a microservice architecture.

## 🧠 Tech Stack
- **TypeScript**
- **Express**
- **NodeJS**
- **NestJS** 
- **RabbitMQ** for event-based communication
- **TimescaleDB (PostgreSQL)** for time-series data
- **Docker** for container orchestration
- Planned: **Redis** for caching, **AWS ECS** deployment
- **Monorepo**
  
## 📦 Microservices

- **data-collector**: Consumes and publishes signals to RabbitMQ
- **signal-persister**: Consumes and writes signals to TimescaleDB
- **signal-query-api**: Serves raw + aggregated signal queries from TimsescaleDB
- **micro-frontend**: Displays data from signal-query-api

## 📊 Features

- Raw + bucketed query support
- Continuous aggregates for fast timescale lookups
- Extensible DTOs and modular repository layer

## 🚀 Running Locally

```bash
docker compose up --build

