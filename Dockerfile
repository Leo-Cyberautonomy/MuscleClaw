# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend + serve frontend
FROM python:3.12-slim
WORKDIR /app

# Install uv for fast pip
RUN pip install uv

# Install backend deps
COPY backend/requirements.txt ./backend/
RUN uv pip install --system -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Environment
ENV PORT=8080
ENV GOOGLE_GENAI_USE_VERTEXAI=FALSE

EXPOSE 8080

# Run from backend directory so imports work correctly
WORKDIR /app/backend
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
