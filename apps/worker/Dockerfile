FROM python:3.12-slim

WORKDIR /app
COPY packages/strategy /packages/strategy
COPY apps/api /api
COPY apps/worker /worker
COPY apps/web/src/lib/income-visual/themes.json /x-themes.json

RUN pip install --no-cache-dir -e /packages/strategy \
 && pip install --no-cache-dir sqlalchemy "psycopg[binary]" pydantic-settings apscheduler httpx

ENV PYTHONPATH=/api:/worker
WORKDIR /worker
CMD ["python", "-m", "worker.main"]
