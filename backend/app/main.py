"""FastAPI application serving the thyroid screening API and the built frontend.

One process serves both, so the whole system deploys as a single container.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.model_service import ModelNotLoadedError, model_service
from backend.app.schemas import (
    HealthResponse,
    ModelInfoResponse,
    PatientInput,
    PredictionResponse,
)
from ml.config import BINARY_LABELS, FEATURE_META

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s")
logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).resolve().parent / "static"

# The dev server runs the frontend on its own port, so it needs CORS. In
# production the frontend is served from this same origin and none is needed.
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the model once at start-up rather than on the first request."""
    model_service.load()
    yield


app = FastAPI(
    title="Thyroid Screening API",
    description=(
        "Machine-learning screening support for thyroid disorders. "
        "Educational use only - this is not a medical device."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    """Liveness probe that also reports whether the model actually loaded."""
    if not model_service.is_loaded:
        return HealthResponse(status="degraded", model_loaded=False)
    return HealthResponse(
        status="ok",
        model_loaded=True,
        model_name=model_service.metadata.get("model_name"),
    )


@app.get("/api/reference-data", tags=["metadata"])
def reference_data() -> dict:
    """Units, valid ranges and labels, so the UI never hard-codes clinical values."""
    return {
        "features": {
            name: {
                "label": meta["label"],
                "unit": meta["unit"],
                "min": meta["bounds"][0],
                "max": meta["bounds"][1],
                "reference": meta["reference"],
                "description": meta["description"],
            }
            for name, meta in FEATURE_META.items()
        },
        "history": [
            {"feature": name, "label": label}
            for name, label in BINARY_LABELS.items()
            if name != "sex_is_male"
        ],
    }


@app.get("/api/model", response_model=ModelInfoResponse, tags=["metadata"])
def model_info() -> ModelInfoResponse:
    """Metrics and provenance for the transparency page."""
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="No trained model is loaded.")
    metadata = model_service.metadata
    return ModelInfoResponse(
        model_name=metadata["model_name"],
        trained_at=metadata["trained_at"],
        sklearn_version=metadata["sklearn_version"],
        selection_metric=metadata["selection_metric"],
        class_names=metadata["class_names"],
        training_rows=metadata["training_rows"],
        test_rows=metadata["test_rows"],
        class_counts=metadata["class_counts"],
        metrics=metadata["metrics"],
        all_model_metrics=metadata["all_model_metrics"],
        dropped_columns=metadata["dropped_columns"],
    )


@app.post("/api/predict", response_model=PredictionResponse, tags=["screening"])
def predict(patient: PatientInput) -> PredictionResponse:
    """Screen one patient and explain the result."""
    try:
        result = model_service.predict(patient.model_dump())
    except ModelNotLoadedError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return PredictionResponse(**result)


# --- static frontend --------------------------------------------------------
# Registered last, but that alone does not protect the API: Starlette prefers a
# full path match over a partial one, so this catch-all would answer
# GET /api/predict (a method mismatch) and /api/anything-misspelled with the
# SPA's HTML and a 200. A client would then try to parse HTML as JSON and show
# the patient a syntax error instead of a real status, so /api is excluded here
# explicitly.
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str) -> FileResponse:
        """Return the requested file, falling back to the SPA entry point."""
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail=f"No API route at /{full_path}.")
        candidate = (STATIC_DIR / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(STATIC_DIR.resolve()):
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")

else:  # pragma: no cover - developer convenience only
    @app.get("/", include_in_schema=False)
    def frontend_missing() -> dict:
        return {
            "message": (
                "API is running. The frontend has not been built - run "
                "'npm run build' in frontend/ or use the Vite dev server."
            ),
            "docs": "/docs",
        }
