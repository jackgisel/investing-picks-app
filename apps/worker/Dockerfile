FROM python:3.12-slim

WORKDIR /app
COPY packages/strategy /packages/strategy
COPY apps/api /api
COPY apps/worker /worker

RUN pip install --no-cache-dir -e /packages/strategy \
 && pip install --no-cache-dir sqlalchemy "psycopg[binary]" pydantic-settings apscheduler httpx

ENV PYTHONPATH=/api:/worker
WORKDIR /worker
CMD ["python", "-m", "worker.main"]
