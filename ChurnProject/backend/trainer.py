"""
backend/trainer.py

Tier 2: Dynamic pipeline builder and trainer.
Takes any dataframe + inferred schema, builds a sklearn pipeline,
trains XGBoost, computes SHAP, and saves all artifacts.
Works identically to the original notebook but fully automated.
"""

import json
import time
import warnings
import numpy as np
import pandas as pd
import joblib
import shap

from pathlib import Path
from typing import Optional

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import roc_auc_score

from xgboost import XGBClassifier

warnings.filterwarnings("ignore")


# ─── Main Training Function ────────────────────────────────────────────────────

def train_model(
    df: pd.DataFrame,
    schema: dict,
    artifacts_dir: Path,
    progress_callback=None
) -> dict:
    """
    Full training pipeline for any dataset.

    Args:
        df:                Raw uploaded dataframe
        schema:            Inferred schema from schema_inferrer.infer_schema()
        artifacts_dir:     Where to save all artifacts (e.g. artifacts/b139e4227328/)
        progress_callback: Optional callable(step: str, pct: int) for progress updates

    Returns:
        result dict with keys: auc_cv, auc_test, feature_importance, warnings, duration_seconds
    """

    def _progress(step: str, pct: int):
        if progress_callback:
            progress_callback(step, pct)

    start_time = time.time()
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    result = {
        "auc_cv":             None,
        "auc_test":           None,
        "feature_importance": {},
        "feature_order":      [],
        "warnings":           schema.get("warnings", []),
        "duration_seconds":   None,
        "n_features":         0,
        "dataset_hash":       schema.get("dataset_hash", "unknown"),
        "dataset_name":       schema.get("dataset_name", "unknown"),
        "n_rows":             schema.get("n_rows", 0),
        "churn_rate":         schema.get("churn_rate", None),
    }

    # ── Step 1: Prepare data ──────────────────────────────────────────────────
    _progress("Preparing data", 5)

    target_col    = schema["target_col"]
    numeric_cols  = schema["numeric_cols"]
    cat_cols      = schema["categorical_cols"]
    drop_cols     = schema["drop_cols"]

    # Drop ID/datetime/text columns
    cols_to_drop = [c for c in drop_cols if c in df.columns]
    df = df.drop(columns=cols_to_drop)

    # Separate features and target
    from utils.schema_inferrer import normalise_target
    y_raw = df[target_col]
    y = normalise_target(y_raw)

    if y is None:
        raise ValueError(
            f"Could not convert target column '{target_col}' to binary 0/1. "
            f"Unique values: {y_raw.unique().tolist()}"
        )

    # Keep only feature columns that exist in the dataframe
    numeric_cols = [c for c in numeric_cols if c in df.columns]
    cat_cols     = [c for c in cat_cols     if c in df.columns]

    X = df[numeric_cols + cat_cols].copy()

    result["n_features"] = len(numeric_cols) + len(cat_cols)

    # ── Step 2: Build preprocessing pipeline ─────────────────────────────────
    _progress("Building pipeline", 15)

    numeric_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler())
    ])

    categorical_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("ohe",     OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_cols),
            ("cat", categorical_transformer, cat_cols),
        ],
        remainder="drop"
    )

    # ── Step 3: Determine class weight ────────────────────────────────────────
    _progress("Analysing class balance", 20)

    churn_rate   = y.mean()
    class_weight = _get_scale_pos_weight(churn_rate)

    # ── Step 4: Build full pipeline ───────────────────────────────────────────
    _progress("Configuring XGBoost", 25)

    xgb_params = {
        "n_estimators":     300,
        "max_depth":        6,
        "learning_rate":    0.05,
        "subsample":        0.8,
        "colsample_bytree": 0.8,
        "scale_pos_weight": class_weight,
        "use_label_encoder": False,
        "eval_metric":      "logloss",
        "random_state":     42,
        "n_jobs":           -1,
    }

    full_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("model",        XGBClassifier(**xgb_params))
    ])

    # ── Step 5: Cross-validation ──────────────────────────────────────────────
    _progress("Running cross-validation (this takes ~1 min)", 30)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(
        full_pipeline, X, y,
        cv=cv,
        scoring="roc_auc",
        n_jobs=-1
    )

    result["auc_cv"]    = round(float(cv_scores.mean()), 4)
    result["auc_cv_std"] = round(float(cv_scores.std()), 4)

    # ── Step 6: Train on full dataset ─────────────────────────────────────────
    _progress("Training final model on full dataset", 65)

    full_pipeline.fit(X, y)

    # Quick in-sample AUC as a sanity check
    y_pred_proba      = full_pipeline.predict_proba(X)[:, 1]
    result["auc_test"] = round(float(roc_auc_score(y, y_pred_proba)), 4)

    # ── Step 7: Extract post-OHE feature names ────────────────────────────────
    _progress("Extracting feature names", 72)

    feature_order = _get_feature_names(full_pipeline, numeric_cols, cat_cols)
    result["feature_order"] = feature_order

    # ── Step 8: Compute SHAP ──────────────────────────────────────────────────
    _progress("Computing SHAP values", 78)

    X_transformed = full_pipeline.named_steps["preprocessor"].transform(X)
    xgb_model     = full_pipeline.named_steps["model"]

    explainer = shap.TreeExplainer(xgb_model)

    # For large datasets, sample for SHAP computation
    if len(X_transformed) > 2000:
        idx_sample   = np.random.choice(len(X_transformed), 2000, replace=False)
        shap_values  = explainer.shap_values(X_transformed[idx_sample])
    else:
        shap_values = explainer.shap_values(X_transformed)

    # Global feature importance: mean absolute SHAP
    mean_shap = np.abs(shap_values).mean(axis=0)

    feature_importance = {
        feature_order[i]: round(float(mean_shap[i]), 6)
        for i in range(len(feature_order))
    }
    # Sort descending
    feature_importance = dict(
        sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    )
    result["feature_importance"] = feature_importance

    # ── Step 9: Save all artifacts ────────────────────────────────────────────
    _progress("Saving artifacts", 90)

    _save_artifacts(
        artifacts_dir  = artifacts_dir,
        pipeline       = full_pipeline,
        explainer      = explainer,
        feature_order  = feature_order,
        feature_importance = feature_importance,
        schema         = schema,
        result         = result,
        xgb_params     = xgb_params,
    )

    # ── Step 10: Done ─────────────────────────────────────────────────────────
    result["duration_seconds"] = round(time.time() - start_time, 1)
    _progress("Training complete", 100)

    return result


# ─── Artifact Saving ───────────────────────────────────────────────────────────

def _save_artifacts(
    artifacts_dir: Path,
    pipeline,
    explainer,
    feature_order: list,
    feature_importance: dict,
    schema: dict,
    result: dict,
    xgb_params: dict,
):
    # 1. Full sklearn pipeline
    joblib.dump(pipeline, artifacts_dir / "churn_pipeline.joblib")

    # 2. SHAP explainer
    joblib.dump(explainer, artifacts_dir / "shap_explainer.joblib")

    # 3. Feature order (post-OHE)
    with open(artifacts_dir / "feature_order.json", "w") as f:
        json.dump(feature_order, f, indent=2)

    # 4. Feature importance
    with open(artifacts_dir / "feature_importance.json", "w") as f:
        json.dump(feature_importance, f, indent=2)

    # 5. Schema (already saved by schema_inferrer, but save again with full info)
    from utils.schema_inferrer import save_schema
    save_schema(schema, artifacts_dir)

    # 6. Model metadata
    metadata = {
        "dataset_name":       result["dataset_name"],
        "dataset_hash":       result["dataset_hash"],
        "n_rows":             result["n_rows"],
        "n_features_raw":     result["n_features"],
        "n_features_post_ohe": len(feature_order),
        "churn_rate":         result["churn_rate"],
        "best_model":         "XGBoost",
        "auc_cv":             result["auc_cv"],
        "auc_cv_std":         result.get("auc_cv_std"),
        "auc_train":          result["auc_test"],
        "xgb_params":         xgb_params,
        "class_balance":      schema.get("class_balance"),
        "warnings":           result["warnings"],
    }
    with open(artifacts_dir / "model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_scale_pos_weight(churn_rate: float) -> float:
    """
    XGBoost scale_pos_weight = n_negative / n_positive.
    For 16.84% churn: (1 - 0.1684) / 0.1684 ≈ 4.94
    """
    if churn_rate <= 0 or churn_rate >= 1:
        return 1.0
    return round((1 - churn_rate) / churn_rate, 4)


def _get_feature_names(pipeline: Pipeline, numeric_cols: list, cat_cols: list) -> list:
    """
    Extract post-OHE feature names from the fitted pipeline.
    Returns ordered list matching the transformed feature matrix columns.
    """
    preprocessor = pipeline.named_steps["preprocessor"]
    feature_names = list(numeric_cols)  # numeric cols keep their names

    if cat_cols:
        ohe = preprocessor.named_transformers_["cat"].named_steps["ohe"]
        ohe_names = ohe.get_feature_names_out(cat_cols).tolist()
        feature_names += ohe_names

    return feature_names


# ─── Artifact Loader ───────────────────────────────────────────────────────────

def load_artifacts(artifacts_dir: Path) -> dict:
    """
    Load all artifacts from a model directory.
    Returns dict with keys: pipeline, explainer, feature_order,
                            feature_importance, schema, metadata
    Raises FileNotFoundError if required artifacts are missing.
    """
    artifacts_dir = Path(artifacts_dir)
    required = ["churn_pipeline.joblib", "feature_order.json"]

    for f in required:
        if not (artifacts_dir / f).exists():
            raise FileNotFoundError(
                f"Required artifact '{f}' not found in {artifacts_dir}. "
                f"Please train the model first."
            )

    artifacts = {}

    artifacts["pipeline"] = joblib.load(artifacts_dir / "churn_pipeline.joblib")

    explainer_path = artifacts_dir / "shap_explainer.joblib"
    if explainer_path.exists():
        try:
            artifacts["explainer"] = joblib.load(explainer_path)
        except Exception:
            try:
                model = artifacts["pipeline"].named_steps.get("model")
                artifacts["explainer"] = shap.TreeExplainer(model) if model else None
            except Exception:
                artifacts["explainer"] = None
    else:
        artifacts["explainer"] = None

    with open(artifacts_dir / "feature_order.json") as f:
        artifacts["feature_order"] = json.load(f)

    fi_path = artifacts_dir / "feature_importance.json"
    artifacts["feature_importance"] = (
        json.load(open(fi_path)) if fi_path.exists() else {}
    )

    schema_path = artifacts_dir / "schema.json"
    artifacts["schema"] = (
        json.load(open(schema_path)) if schema_path.exists() else {}
    )

    meta_path = artifacts_dir / "model_metadata.json"
    artifacts["metadata"] = (
        json.load(open(meta_path)) if meta_path.exists() else {}
    )

    return artifacts