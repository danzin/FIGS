# Financial Insights Gathering System (FIGS)

## 📌 Project Vision
 FIGS is a modular system for aggregating, persisting, and querying financial data — primarily focused on the crypto market. It aims to surface actionable insights by combining structured data (e.g., price feeds) with unstructured signals (e.g., app store rankings, AI sentiment analysis etc.)

## 🧠 Tech Stack
- ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
- ![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
- ![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
- ![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
- ![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white) 
- ![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB) ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)   **for the frontend**
- ![RabbitMQ](https://img.shields.io/badge/Rabbitmq-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)   **for event-based communication**
- ![TimeScaleDB](https://img.shields.io/badge/TimescaleDB-003B77?style=for-the-badge&logo=timescale&logoColor=white) **for time-series data**
- ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white) **for container orchestration**
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
- **seeder**: Seeds TimeScaleDB with fresh data and manually triggers all continousous aggregates in order to provide OHLC for the frontend chart.
  
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

<img width="1883" height="880" alt="image" src="https://github.com/user-attachments/assets/7b3be4e5-7cf4-42a8-b03a-853f2563a180" />
<img width="424" height="945" alt="image" src="https://github.com/user-attachments/assets/cda194dd-79f9-4ad1-969d-466f099c9958" />


The full docker build:


<img width="1585" height="396" alt="image" src="https://github.com/user-attachments/assets/12f453f9-728d-4afd-bc57-e69c463d85ea" />

<img width="1395" height="892" alt="image" src="https://github.com/user-attachments/assets/aeff5b25-048e-4999-a251-d96365a0a58e" />


