"""
backend/predictor.py

Loads artifacts from the active model directory and runs predictions.
Works with any model trained by backend/trainer.py — adaptive to both
LumaWear and benchmark e-commerce datasets.
"""

import json
import numpy as np
import pandas as pd
import shap

from pathlib import Path
from typing import Optional, Dict, Any, List

from utils.config import get_active_model_dir
from backend.trainer import load_artifacts
from backend.recommender import generate_recommendations


# ─── Global artifact cache ─────────────────────────────────────────────────────
_cache: dict = {}
_cache_model_dir: Optional[Path] = None


def _load_if_needed():
    """Load artifacts from the active model dir, only if not already cached."""
    global _cache, _cache_model_dir

    active_dir = get_active_model_dir()
    if _cache_model_dir == active_dir and _cache:
        return  # already loaded and up to date

    _cache = load_artifacts(active_dir)
    _cache_model_dir = active_dir


def reload_artifacts():
    """Force reload artifacts — called after training or switching models."""
    global _cache, _cache_model_dir
    _cache = {}
    _cache_model_dir = None
    _load_if_needed()


def get_schema() -> dict:
    _load_if_needed()
    return _cache.get("schema", {})


def get_feature_importance() -> dict:
    _load_if_needed()
    return _cache.get("feature_importance", {})


def get_metadata() -> dict:
    _load_if_needed()
    return _cache.get("metadata", {})


# ─── Risk & Timeline Helpers ───────────────────────────────────────────────────

def _risk_level(prob: float) -> str:
    """
    Map continuous churn probability to 4-tier risk categories:
    - 0.00–0.2499 → Low
    - 0.25–0.4999 → Medium
    - 0.50–0.7499 → High
    - 0.75–1.0000 → Very High
    """
    if prob >= 0.75:
        return "Very High"
    elif prob >= 0.50:
        return "High"
    elif prob >= 0.25:
        return "Medium"
    else:
        return "Low"


def _churn_timeline(prob: float) -> str:
    """
    Return risk-oriented 90-day churn timeline phrasing without implying
    an unrealistic exact future date.
    """
    if prob >= 0.75:
        return "Critical churn risk within the next 90 days"
    elif prob >= 0.50:
        return "High churn risk within the next 90 days"
    elif prob >= 0.25:
        return "Potential churn risk within the next 90 days"
    else:
        return "Low near-term churn risk"


# ─── Single prediction ─────────────────────────────────────────────────────────

def predict_single(customer_data: dict) -> dict:
    """
    Predict churn probability, risk level, timeline, SHAP features, and recommendations
    for a single customer.

    Args:
        customer_data: dict of {column_name: value} matching the trained schema

    Returns:
        dict with complete PredictionResponse payload
    """
    _load_if_needed()

    schema = _cache["schema"]
    pipeline = _cache["pipeline"]
    explainer = _cache["explainer"]
    feature_order = _cache["feature_order"]

    feature_cols = schema["numeric_cols"] + schema["categorical_cols"]

    # Build a single-row dataframe with only feature columns
    row = {col: customer_data.get(col, np.nan) for col in feature_cols}
    df_input = pd.DataFrame([row])

    # Predict continuous probability
    prob = float(pipeline.predict_proba(df_input)[0, 1])
    prob_rounded = round(prob, 4)
    pct_rounded = round(prob * 100, 2)
    risk = _risk_level(prob)
    timeline = _churn_timeline(prob)

    # SHAP explanation for this customer
    shap_features: List[Dict[str, Any]] = []
    if explainer is not None:
        try:
            X_transformed = pipeline.named_steps["preprocessor"].transform(df_input)
            shap_vals = explainer.shap_values(X_transformed)[0]

            # Top contributing features by absolute SHAP value
            top_idx = np.argsort(np.abs(shap_vals))[::-1][:5]
            for idx in top_idx:
                fname = feature_order[idx] if idx < len(feature_order) else f"feature_{idx}"
                sval = float(shap_vals[idx])
                shap_features.append({
                    "feature": fname,
                    "shap_value": round(sval, 4),
                    "direction": "increases_churn" if sval > 0 else "reduces_churn",
                })
        except Exception:
            pass

    # Generate personalized recommendations based on actual feature values & SHAP
    recs = generate_recommendations(
        top_shap_features=shap_features,
        customer_data=customer_data,
        churn_probability=prob,
        n=3,
    )

    return {
        "customer_input": customer_data,
        "churn_prediction": 1 if prob >= 0.5 else 0,
        "churn_label": "Will Churn" if prob >= 0.5 else "Will Not Churn",
        "churn_probability": prob_rounded,
        "churn_percentage": pct_rounded,
        "risk_level": risk,
        "churn_timeline": timeline,
        "top_shap_features": shap_features,
        "recommendations": recs,
    }


# ─── Feature-Dictionary Batch Prediction ───────────────────────────────────────

def predict_batch_features(customer_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Score a list of customer feature dictionaries in a single vectorized batch.

    Args:
        customer_records: list of dicts with customer features (and optional user_id/customer_id)

    Returns:
        List of prediction dicts conforming to PredictionResponse schema.
    """
    if not customer_records:
        return []

    _load_if_needed()

    schema = _cache["schema"]
    pipeline = _cache["pipeline"]
    explainer = _cache["explainer"]
    feature_order = _cache["feature_order"]

    feature_cols = schema["numeric_cols"] + schema["categorical_cols"]

    # Extract customer IDs and feature rows
    customer_ids = []
    rows = []
    for i, record in enumerate(customer_records):
        cid = record.get("user_id") or record.get("customer_id") or record.get("id") or str(i + 1)
        customer_ids.append(str(cid))
        row = {col: record.get(col, np.nan) for col in feature_cols}
        rows.append(row)

    df_input = pd.DataFrame(rows, columns=feature_cols)

    # Vectorized continuous probability prediction
    probs = pipeline.predict_proba(df_input)[:, 1]

    # Preprocess transformed input for SHAP
    shap_results = [[] for _ in range(len(customer_records))]
    if explainer is not None:
        try:
            X_transformed = pipeline.named_steps["preprocessor"].transform(df_input)
            shap_matrix = explainer.shap_values(X_transformed)
            for i in range(len(customer_records)):
                row_shap = shap_matrix[i]
                top_idx = np.argsort(np.abs(row_shap))[::-1][:5]
                shap_results[i] = [
                    {
                        "feature": feature_order[k] if k < len(feature_order) else f"feature_{k}",
                        "shap_value": round(float(row_shap[k]), 4),
                        "direction": "increases_churn" if row_shap[k] > 0 else "reduces_churn",
                    }
                    for k in top_idx
                ]
        except Exception:
            pass

    # Build individual prediction responses
    results = []
    for i, (cid, prob, shap_feats, raw_record) in enumerate(zip(customer_ids, probs, shap_results, customer_records)):
        prob_float = float(prob)
        prob_rounded = round(prob_float, 4)
        pct_rounded = round(prob_float * 100, 2)
        risk = _risk_level(prob_float)
        timeline = _churn_timeline(prob_float)

        recs = generate_recommendations(
            top_shap_features=shap_feats,
            customer_data=raw_record,
            churn_probability=prob_float,
            n=3,
        )

        results.append({
            "customer_id": cid,
            "customer_input": raw_record,
            "churn_prediction": 1 if prob_float >= 0.5 else 0,
            "churn_label": "Will Churn" if prob_float >= 0.5 else "Will Not Churn",
            "churn_probability": prob_rounded,
            "churn_percentage": pct_rounded,
            "risk_level": risk,
            "churn_timeline": timeline,
            "top_shap_features": shap_feats,
            "recommendations": recs,
        })

    return results



# ─── Batch prediction ──────────────────────────────────────────────────────────

def predict_batch(df: pd.DataFrame) -> dict:
    """
    Predict churn for all rows in a dataframe.
    Uses tiered SHAP: full SHAP for high-risk (prob >= 0.45),
    global importance approximation for stable customers.

    Returns the full analytics payload consumed by the frontend.
    """
    _load_if_needed()

    schema = _cache["schema"]
    pipeline = _cache["pipeline"]
    explainer = _cache["explainer"]
    feature_order = _cache["feature_order"]
    global_fi = _cache["feature_importance"]

    feature_cols = schema["numeric_cols"] + schema["categorical_cols"]
    target_col = schema.get("target_col", "Churn")
    id_col = _detect_id_col(df, schema)

    # Drop target if present in upload
    if target_col in df.columns:
        df = df.drop(columns=[target_col])

    # Assign customer IDs
    if id_col and id_col in df.columns:
        customer_ids = df[id_col].astype(str).tolist()
    else:
        customer_ids = [str(i + 1) for i in range(len(df))]

    # Build feature matrix — only known feature columns
    available_features = [c for c in feature_cols if c in df.columns]
    X = df[available_features].copy()

    # Add missing feature columns as NaN (pipeline imputer handles them)
    for col in feature_cols:
        if col not in X.columns:
            X[col] = np.nan
    X = X[feature_cols]  # enforce column order

    # Predict all at once
    probs = pipeline.predict_proba(X)[:, 1]
    risk_flags = [_risk_level(p) for p in probs]

    # Transform for SHAP
    X_transformed = pipeline.named_steps["preprocessor"].transform(X)

    # Tiered SHAP
    high_risk_mask = probs >= 0.45
    shap_results = _tiered_shap(
        X_transformed=X_transformed,
        probs=probs,
        high_risk_mask=high_risk_mask,
        explainer=explainer,
        feature_order=feature_order,
        global_fi=global_fi,
    )

    # Build customer records
    customers = []
    for i, (cid, prob, risk) in enumerate(zip(customer_ids, probs, risk_flags)):
        record = {
            "customer_id": cid,
            "churn_probability": round(float(prob), 4),
            "churn_percentage": round(float(prob) * 100, 2),
            "risk_level": risk,
            "churn_timeline": _churn_timeline(prob),
            "top_shap_features": shap_results[i],
        }
        # Attach raw feature values for the detail modal
        for col in feature_cols:
            record[col] = _safe_val(df, i, col)

        customers.append(record)

    # Build analytics payload
    payload = _build_analytics_payload(
        customers=customers,
        probs=probs,
        schema=schema,
        df=df,
        feature_cols=feature_cols,
        global_fi=global_fi,
    )

    return payload


# ─── Tiered SHAP ───────────────────────────────────────────────────────────────

def _tiered_shap(
    X_transformed, probs, high_risk_mask,
    explainer, feature_order, global_fi,
    max_exact=500
) -> list:
    """
    Compute SHAP values efficiently:
    - Exact SHAP for high-risk customers (prob >= 0.45), capped at max_exact rows
    - Global importance approximation for stable customers
    """
    n = len(probs)
    results = [[] for _ in range(n)]

    if explainer is not None:
        high_risk_idx = np.where(high_risk_mask)[0]

        # Cap at max_exact to keep batch time under 30s
        if len(high_risk_idx) > max_exact:
            high_risk_idx = high_risk_idx[:max_exact]

        if len(high_risk_idx) > 0:
            shap_vals = explainer.shap_values(X_transformed[high_risk_idx])
            for j, i in enumerate(high_risk_idx):
                row_shap = shap_vals[j]
                top_idx = np.argsort(np.abs(row_shap))[::-1][:3]
                results[i] = [
                    {
                        "feature": feature_order[k] if k < len(feature_order) else f"feature_{k}",
                        "shap_value": round(float(row_shap[k]), 4),
                        "direction": "increases_churn" if row_shap[k] > 0 else "reduces_churn",
                    }
                    for k in top_idx
                ]

    # Approximate SHAP for remaining rows using global importance
    top_global = sorted(global_fi.items(), key=lambda x: x[1], reverse=True)[:3]
    approx_shap = [
        {"feature": f, "shap_value": round(v, 4), "direction": "increases_churn"}
        for f, v in top_global
    ]
    for i in range(n):
        if not results[i]:
            results[i] = approx_shap

    return results


# ─── Analytics Payload ─────────────────────────────────────────────────────────

def _build_analytics_payload(
    customers, probs, schema, df, feature_cols, global_fi
) -> dict:
    total = len(customers)
    churn_count = sum(1 for c in customers if c["churn_probability"] >= 0.5)
    very_high_risk = sum(1 for c in customers if c["risk_level"] == "Very High")
    high_risk = sum(1 for c in customers if c["risk_level"] == "High")
    medium_risk = sum(1 for c in customers if c["risk_level"] == "Medium")
    low_risk = sum(1 for c in customers if c["risk_level"] == "Low")

    timeline_counts = {
        "critical_90d": very_high_risk,
        "high_90d": high_risk,
        "potential_90d": medium_risk,
        "low_risk": low_risk,
        # Backward-compatible keys for legacy dashboard tabs
        "1_month": very_high_risk,
        "3_months": high_risk,
        "6_months": medium_risk,
        "stable": low_risk,
    }

    # Segment distributions for categorical columns
    cat_cols = schema.get("categorical_cols", [])
    segments = _build_segments(customers, df, cat_cols, feature_cols)

    # Top churn drivers from global feature importance
    top_drivers = [
        {"feature": f, "importance": round(v, 4)}
        for f, v in sorted(global_fi.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # Probability histogram
    hist_counts, hist_edges = np.histogram(probs, bins=20, range=(0, 1))
    histogram = [
        {
            "bin_start": round(float(hist_edges[i]), 2),
            "bin_end": round(float(hist_edges[i + 1]), 2),
            "count": int(hist_counts[i]),
        }
        for i in range(len(hist_counts))
    ]

    return {
        "summary": {
            "total_customers": total,
            "predicted_churn": churn_count,
            "very_high_risk": very_high_risk,
            "high_risk": high_risk,
            "medium_risk": medium_risk,
            "low_risk": low_risk,
            "churn_rate_pct": round(churn_count / total * 100, 2) if total else 0,
        },
        "timeline": timeline_counts,
        "segments": segments,
        "top_drivers": top_drivers,
        "histogram": histogram,
        "customers": customers,
        "schema": {
            "dataset_name": schema.get("dataset_name", "Unknown"),
            "dataset_hash": schema.get("dataset_hash", ""),
            "numeric_cols": schema.get("numeric_cols", []),
            "categorical_cols": schema.get("categorical_cols", []),
            "feature_cols": feature_cols,
        },
    }


# ─── Segment Builder ───────────────────────────────────────────────────────────

def _build_segments(customers, df, cat_cols, feature_cols) -> dict:
    """Build churn rate by category for each categorical column."""
    segments = {}
    for col in cat_cols:
        if col not in df.columns:
            continue
        col_seg = {}
        for i, c in enumerate(customers):
            val = str(_safe_val(df, i, col))
            prob = c["churn_probability"]
            if val not in col_seg:
                col_seg[val] = {"churned": 0, "retained": 0, "total": 0}
            col_seg[val]["total"] += 1
            if prob >= 0.5:
                col_seg[val]["churned"] += 1
            else:
                col_seg[val]["retained"] += 1
        segments[col] = col_seg
    return segments


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _detect_id_col(df: pd.DataFrame, schema: dict) -> Optional[str]:
    """Find the customer ID column in the uploaded dataframe."""
    id_cols = schema.get("id_cols", [])
    for col in id_cols:
        if col in df.columns:
            return col
    # Fallback: look for common ID column names
    for col in df.columns:
        if col.lower() in ["customerid", "customer_id", "id", "userid", "user_id"]:
            return col
    return None


def _safe_val(df: pd.DataFrame, i: int, col: str):
    """Safely get value from dataframe row, return None if missing."""
    try:
        val = df.iloc[i][col]
        if pd.isna(val):
            return None
        if hasattr(val, "item"):
            return val.item()
        return val
    except Exception:
        return None