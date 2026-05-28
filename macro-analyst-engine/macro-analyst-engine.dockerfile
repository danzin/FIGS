FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY ./macro-analyst-engine/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ./macro-analyst-engine ./macro-analyst-engine
WORKDIR /app/macro-analyst-engine

CMD ["python", "app.py"]
