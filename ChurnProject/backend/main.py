"""
backend/main.py

FastAPI application for ChurnIQ — e-commerce customer churn prediction.

Endpoints:
  GET  /health
  GET  /model/info
  GET  /model/list
  POST /model/switch/{model_id}
  GET  /features/importance
  POST /predict
  POST /predict/live-customer
  POST /predict/batch-analyze
  GET  /train/status/{job_id}
  GET  /train/result/{job_id}
"""

import io
import re
import uuid
import threading
import pandas as pd
from typing import Dict, Any, Union

from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path

from utils.config import (
    get_active_model_dir, set_active_model,
    list_available_models, ARTIFACTS_BASE
)
from utils.schema_inferrer import infer_schema, schema_matches_existing
from backend.predictor import (
    predict_single, predict_batch, predict_batch_features, reload_artifacts,
    get_metadata, get_feature_importance
)
from backend.trainer import train_model
from backend.schemas import (
    LumaWearCustomerInput, CustomerInput, LiveCustomerRequest,
    PredictionResponse, BatchPredictionRequest, BatchPredictionResponse
)
from backend.feature_service import extract_live_customer_features


# ─── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "ChurnIQ API",
    description = "E-commerce customer churn prediction & retention recommendation engine",
    version     = "4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ─── Job store ─────────────────────────────────────────────────────────────────
_jobs: dict = {}
_jobs_lock = threading.Lock()


def _make_job_id(filename: str) -> str:
    """Create a readable job_id like 'e_commerce_dataset_a3f9c2'."""
    base = re.sub(r'[^a-z0-9]+', '_', (filename or "dataset").lower().rsplit('.', 1)[0])
    base = base.strip('_')[:30] or "dataset"
    short_random = uuid.uuid4().hex[:6]
    return f"{base}_{short_random}"


def _update_job(job_id: str, **kwargs):
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(kwargs)


def _run_training_job(job_id: str, df: pd.DataFrame, schema: dict, hash_dir: Path):
    """
    Runs in a background thread. Trains the model, updates _jobs progress,
    then scores the dataframe and stores the final dashboard payload.
    """
    try:
        def progress_callback(step: str, pct: int):
            _update_job(job_id, step=step, pct=pct, status="training")

        result = train_model(
            df            = df,
            schema        = schema,
            artifacts_dir = hash_dir,
            progress_callback = progress_callback,
        )

        # Switch active model and reload artifacts for scoring
        set_active_model(schema["dataset_hash"])
        reload_artifacts()

        _update_job(job_id, step="Scoring customers", pct=98, status="training")

        payload = predict_batch(df)
        payload["trained_on_upload"] = True
        payload["training_result"]   = {
            "auc_cv":           result["auc_cv"],
            "duration_seconds": result["duration_seconds"],
            "n_features":       result["n_features"],
            "dataset_hash":     result["dataset_hash"],
        }

        _update_job(job_id, status="complete", step="Done", pct=100, result=payload, error=None)

    except Exception as e:
        _update_job(job_id, status="error", step="Failed", pct=0, error=str(e))


# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    try:
        meta = get_metadata()
        return {
            "status":       "ok",
            "active_model": meta.get("dataset_name", "unknown"),
            "dataset_hash": meta.get("dataset_hash", ""),
            "auc_cv":       meta.get("auc_cv"),
        }
    except Exception as e:
        return {"status": "ok", "active_model": "none", "note": str(e)}


# ─── Model info ────────────────────────────────────────────────────────────────

@app.get("/model/info")
def model_info():
    return get_metadata()


@app.get("/model/list")
def model_list():
    return {"models": list_available_models()}


@app.post("/model/switch/{model_id}")
def model_switch(model_id: str):
    model_dir = ARTIFACTS_BASE / model_id
    if not model_dir.exists():
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")
    set_active_model(model_id)
    reload_artifacts()
    return {"status": "switched", "active_model": model_id}


# ─── Feature importance ────────────────────────────────────────────────────────

@app.get("/features/importance")
def features_importance():
    return {"feature_importance": get_feature_importance()}


# ─── Single predict ────────────────────────────────────────────────────────────

@app.post("/predict", response_model=PredictionResponse)
def predict(customer_data: dict = Body(...)):
    """
    Predict churn probability, 4-tier risk level, 90-day timeline, SHAP drivers,
    and personalized recommendations for a single customer.
    """
    try:
        return predict_single(customer_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Live Customer Prediction ──────────────────────────────────────────────────

@app.post("/predict/live-customer", response_model=PredictionResponse)
def predict_live_customer(request: LiveCustomerRequest):
    """
    Accepts a LumaWear user_id, extracts their current 21 behavioral features
    from LumaWear, and returns the full churn prediction response.
    """
    try:
        features = extract_live_customer_features(request.user_id)
        prediction = predict_single(features)
        prediction["customer_id"] = request.user_id
        return prediction
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live customer scoring failed: {e}")


# ─── Batch Feature Prediction ──────────────────────────────────────────────────

@app.post("/predict/batch", response_model=BatchPredictionResponse)
def predict_batch_endpoint(request: BatchPredictionRequest):
    """
    Score a list of customer feature payloads in a single vectorized pass.
    Used by the authenticated admin proxy to generate portfolio-wide analytics.
    """
    try:
        predictions = predict_batch_features(request.customers)
        meta = get_metadata()
        active_model = meta.get("dataset_hash") or "2b2147fd4057"
        return {
            "predictions": predictions,
            "total": len(predictions),
            "active_model": active_model,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {e}")


# ─── Batch analyze ─────────────────────────────────────────────────────────────

@app.post("/predict/batch-analyze")
async def batch_analyze(file: UploadFile = File(...)):
    """
    Upload any CSV/XLSX of e-commerce customer data.

    - If columns match the active model's schema exactly → score instantly,
      return full payload directly (status 200, no job).
    - If columns match a previously trained model's schema → reuse that model,
      score instantly, return full payload directly.
    - Otherwise → start a background training job, return {job_id} immediately
      with status 202. Frontend polls /train/status/{job_id}.
    """
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        df = _read_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or unreadable.")

    # ── Check schema match against active model ───────────────────────────────
    active_dir    = get_active_model_dir()
    active_schema = active_dir / "schema.json"

    if active_schema.exists() and schema_matches_existing(df, active_schema):
        try:
            payload = predict_batch(df)
            payload["trained_on_upload"] = False
            return JSONResponse(content=payload)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── New dataset → infer schema ─────────────────────────────────────────────
    inferred = infer_schema(df, dataset_name=file.filename)

    if inferred["target_col"] is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not detect a churn target column. "
                "Ensure your dataset has a binary column named e.g. "
                "'Churn', 'Churned', 'Exited', 'Attrition'."
            )
        )

    if len(inferred["feature_cols"]) < 3:
        raise HTTPException(
            status_code=422,
            detail="Too few usable feature columns detected. Check your dataset."
        )

    # ── Reuse existing model if same schema hash ───────────────────────────────
    hash_dir = ARTIFACTS_BASE / inferred["dataset_hash"]
    if hash_dir.exists() and (hash_dir / "churn_pipeline.joblib").exists():
        set_active_model(inferred["dataset_hash"])
        reload_artifacts()
        payload = predict_batch(df)
        payload["trained_on_upload"] = False
        payload["reused_model"]      = True
        return JSONResponse(content=payload, status_code=200)

    # ── New dataset, no existing model → start background training job ────────
    job_id = _make_job_id(file.filename)

    with _jobs_lock:
        _jobs[job_id] = {
            "label":  file.filename,
            "status": "training",
            "step":   "Queued",
            "pct":    0,
            "result": None,
            "error":  None,
        }

    thread = threading.Thread(
        target=_run_training_job,
        args=(job_id, df.copy(), inferred, hash_dir),
        daemon=True,
    )
    thread.start()

    return JSONResponse(
        content={"job_id": job_id, "status": "training", "label": file.filename},
        status_code=202,
    )


# ─── Training status & result ──────────────────────────────────────────────────

@app.get("/train/status/{job_id}")
def train_status(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "job_id": job_id,
        "label":  job["label"],
        "status": job["status"],
        "step":   job["step"],
        "pct":    job["pct"],
        "error":  job.get("error"),
    }


@app.get("/train/result/{job_id}")
def train_result(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] == "error":
        raise HTTPException(status_code=500, detail=job.get("error", "Training failed."))

    if job["status"] != "complete":
        raise HTTPException(status_code=425, detail="Training not yet complete.")

    return JSONResponse(content=job["result"])


# ─── File reader ────────────────────────────────────────────────────────────────

def _read_file(content: bytes, filename: str) -> pd.DataFrame:
    """Read CSV or XLSX. For XLSX, always picks the sheet with the most rows."""
    fname = (filename or "").lower()

    if fname.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content))

    if fname.endswith(".xlsx") or fname.endswith(".xls"):
        xl = pd.ExcelFile(io.BytesIO(content))

        best_sheet = xl.sheet_names[0]
        best_rows  = 0
        for sheet in xl.sheet_names:
            try:
                df_try = pd.read_excel(io.BytesIO(content), sheet_name=sheet, nrows=10000)
                if len(df_try) > best_rows:
                    best_rows  = len(df_try)
                    best_sheet = sheet
            except Exception:
                continue

        return pd.read_excel(io.BytesIO(content), sheet_name=best_sheet)

    raise ValueError(f"Unsupported file type: {filename}. Upload CSV or XLSX.")