#!/usr/bin/env bash
set -euo pipefail

# Automated Cloud Run deployment for MuscleClaw.
# Run from the repository root:
#   PROJECT_ID=your-gcp-project GOOGLE_API_KEY=your-key ./deploy/deploy-cloud-run.sh

PROJECT_ID="${PROJECT_ID:-}"
GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"
SERVICE_NAME="${SERVICE_NAME:-muscleclaw}"
REGION="${REGION:-us-central1}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required."
  exit 1
fi

if [[ -z "${GOOGLE_API_KEY}" ]]; then
  echo "GOOGLE_API_KEY is required."
  exit 1
fi

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --region "${REGION}" \
  --allow-unauthenticated \
  --memory 1Gi \
  --port 8080 \
  --set-env-vars "GOOGLE_API_KEY=${GOOGLE_API_KEY},GCP_PROJECT=${PROJECT_ID},GOOGLE_GENAI_USE_VERTEXAI=FALSE"
