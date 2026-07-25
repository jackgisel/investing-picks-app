FROM python:3.12-slim

WORKDIR /app
COPY packages/strategy /packages/strategy
COPY apps/api /app
# The worker's ingest jobs are importable here so ops can trigger a refresh on
# demand instead of waiting for the worker's weekly cron. The scheduler itself
# still runs only in the worker service — this image never starts one.
COPY apps/worker /worker

RUN pip install --no-cache-dir -e /packages/strategy \
 && pip install --no-cache-dir fastapi "uvicorn[standard]" sqlalchemy "psycopg[binary]" pydantic-settings httpx

ENV PYTHONPATH=/app:/worker
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
