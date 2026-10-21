# Build the frontend, then serve it from the Python image alongside the API.
# One image, one process, one port - which is what makes this deployable on a
# free container host.

FROM node:24-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM python:3.13-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY ml/ ./ml/
COPY backend/ ./backend/
COPY models/thyroid_model.joblib ./models/thyroid_model.joblib

# The compiled UI, which the API serves as static files. Without this the
# image would start and answer /api but hand every visitor a bare JSON notice.
# vite.config.ts writes the bundle to ../backend/app/static, which resolves to
# /backend/app/static in the build stage's filesystem.
COPY --from=frontend /backend/app/static/ ./backend/app/static/

# Accounts and saved screenings live in SQLite under /app/var. Mount a
# persistent volume there, or the database resets whenever the container does.
ENV THYROLENS_DB_PATH=/app/var/thyrolens.db
VOLUME ["/app/var"]

# Run as a non-root user; the only directory it writes to is /app/var.
RUN useradd --create-home --uid 1000 appuser && mkdir -p /app/var && chown -R appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import os, urllib.request; p=os.environ.get('PORT','8000'); urllib.request.urlopen(f'http://127.0.0.1:{p}/api/health')"

CMD ["python", "-m", "backend.app.start"]
