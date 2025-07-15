# Financial Insights Gathering System (FIGS)

A backend system designed for ingesting and querying financial signals using a microservice architecture.

## 🧠 Tech Stack

- **NestJS** + **TypeScript**
- **RabbitMQ** for event-based communication
- **TimescaleDB (PostgreSQL)** for time-series data
- **Docker** for container orchestration
- Planned: **Redis** for caching, **AWS ECS** deployment

## 📦 Microservices

- **data-collector**: Consumes and publishes signals
- **signal-persister**: Writes signals to TimescaleDB
- **signal-query-api**: Serves raw + aggregated signal queries

## 📊 Features

- Raw + bucketed query support
- Continuous aggregates for fast timescale lookups
- Extensible DTOs and modular repository layer

## 🚀 Running Locally

```bash
docker compose up --build

