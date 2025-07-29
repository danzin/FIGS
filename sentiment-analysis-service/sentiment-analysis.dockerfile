FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app


RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      gcc \
      build-essential \
      curl \
 && rm -rf /var/lib/apt/lists/*

COPY ./sentiment-analysis-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "sentiment-analysis-service/app.py"]
