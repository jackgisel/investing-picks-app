FROM python:3.12-slim

WORKDIR /app
COPY packages/strategy /packages/strategy
COPY apps/api /app

RUN pip install --no-cache-dir -e /packages/strategy \
 && pip install --no-cache-dir fastapi "uvicorn[standard]" sqlalchemy "psycopg[binary]" pydantic-settings

ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
