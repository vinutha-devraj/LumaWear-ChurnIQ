"""
utils/schema_inferrer.py

Tier 1: Automatic schema inference for any uploaded dataset.
Detects column types, target column, ID columns, and builds
a schema registry JSON — without any hardcoding.
"""

import json
import hashlib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional


# ─── Constants ────────────────────────────────────────────────────────────────

CHURN_KEYWORDS = [
    'churn', 'churned', 'attrition', 'attrit', 'left', 'cancelled',
    'canceled', 'exited', 'exit', 'inactive', 'lapsed', 'dropout'
]

ID_KEYWORDS = [
    'id', 'uuid', 'guid', 'key', 'code', 'number', 'num', 'no',
    'identifier', 'ref', 'reference', 'index'
]

# A numeric column is categorical only if BOTH conditions are true:
#   - unique count <= this value
#   - value range <= this value
# Anything beyond these → always numeric
MAX_CATEGORICAL_UNIQUE = 5
MAX_CATEGORICAL_RANGE  = 4


# ─── Main Inference Function ───────────────────────────────────────────────────

def infer_schema(df: pd.DataFrame, dataset_name: str = "unknown") -> dict:
    schema = {
        "dataset_name": dataset_name,
        "dataset_hash": _hash_columns(df.columns.tolist()),
        "n_rows": len(df),
        "n_cols": len(df.columns),
        "target_col": None,
        "id_cols": [],
        "numeric_cols": [],
        "categorical_cols": [],
        "datetime_cols": [],
        "text_cols": [],
        "drop_cols": [],
        "feature_cols": [],
        "churn_rate": None,
        "class_balance": "unknown",
        "warnings": []
    }

    for col in df.columns:
        role = _detect_column_role(df, col)
        if role == "target":
            schema["target_col"] = col
        elif role == "id":
            schema["id_cols"].append(col)
        elif role == "numeric":
            schema["numeric_cols"].append(col)
        elif role == "categorical":
            schema["categorical_cols"].append(col)
        elif role == "datetime":
            schema["datetime_cols"].append(col)
        elif role == "text":
            schema["text_cols"].append(col)

    # Fallback target detection by value pattern
    if schema["target_col"] is None:
        schema["target_col"] = _detect_target_by_values(df, schema)
        if schema["target_col"]:
            for lst in ["numeric_cols", "categorical_cols"]:
                if schema["target_col"] in schema[lst]:
                    schema[lst].remove(schema["target_col"])

    # Churn rate and class balance
    if schema["target_col"]:
        target_series = _normalise_target(df[schema["target_col"]])
        if target_series is not None:
            schema["churn_rate"] = round(float(target_series.mean()) * 100, 2)
            schema["class_balance"] = _classify_balance(target_series.mean())

    schema["drop_cols"] = list(set(
        schema["id_cols"] +
        schema["datetime_cols"] +
        schema["text_cols"]
    ))

    schema["feature_cols"] = schema["numeric_cols"] + schema["categorical_cols"]
    schema["warnings"] = _generate_warnings(df, schema)

    return schema


# ─── Column Role Detection ─────────────────────────────────────────────────────

def _detect_column_role(df: pd.DataFrame, col: str) -> str:
    col_lower = col.lower().replace(" ", "_").replace("-", "_")
    series    = df[col]
    n_rows    = len(df)
    n_unique  = int(series.nunique())
    dtype     = series.dtype

    # ── 1. Target column by name ──────────────────────────────────────────────
    if any(kw in col_lower for kw in CHURN_KEYWORDS) and n_unique <= 5:
        return "target"

    # ── 2. ID column ──────────────────────────────────────────────────────────
    is_name_id = any(
        col_lower == kw or
        col_lower.endswith(f"_{kw}") or
        col_lower.startswith(f"{kw}_")
        for kw in ID_KEYWORDS
    )
    if series.nunique() == n_rows and not any(kw in col_lower for kw in CHURN_KEYWORDS):
        return "id"
    if is_name_id:
        if col_lower in ["user_id", "customer_id", "userid", "customerid", "client_id", "account_id"]:
            return "id"
        if pd.api.types.is_integer_dtype(dtype) and n_unique / max(n_rows, 1) > 0.5:
            return "id"
        if dtype == object and n_unique > 20:
            return "id"

    # ── 3. Datetime ───────────────────────────────────────────────────────────
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"
    if dtype == object:
        sample = series.dropna().head(20)
        try:
            parsed = pd.to_datetime(sample, format='mixed', errors='coerce')
            if parsed.notna().mean() > 0.8:
                return "datetime"
        except Exception:
            pass

    # ── 4. Free text ──────────────────────────────────────────────────────────
    if dtype == object:
        avg_len = series.dropna().astype(str).str.len().mean()
        if avg_len > 50 or n_unique / max(n_rows, 1) > 0.5:
            return "text"

    # ── 5. Numeric vs categorical ─────────────────────────────────────────────
    if pd.api.types.is_numeric_dtype(dtype):
        clean = series.dropna()

        # 5a. Strict binary flag {0,1} → categorical
        unique_vals = set(clean.unique())
        if unique_vals <= {0, 1, 0.0, 1.0}:
            return "categorical"

        # 5b. Continuous / discrete metric keywords → numeric
        NUMERIC_METRIC_KEYWORDS = [
            'count', 'days', 'spend', 'amount', 'views', 'actions', 'items', 'orders',
            'tenure', 'frequency', 'total', 'price', 'value', 'avg', 'average', 'hike'
        ]
        if any(kw in col_lower for kw in NUMERIC_METRIC_KEYWORDS):
            return "numeric"

        # 5c. Compute range
        val_range = float(clean.max()) - float(clean.min())

        # 5d. Low unique count AND small range → categorical
        #     Examples that pass: CityTier (3 unique, range 2)
        #     Examples that fail: SatisfactionScore (5 unique, range 4 → range > MAX)
        #                         HourSpendOnApp (6 unique, range 5 → unique > MAX)
        #                         NumberOfDeviceRegistered (6 unique → unique > MAX)
        if n_unique <= MAX_CATEGORICAL_UNIQUE and val_range <= MAX_CATEGORICAL_RANGE:
            return "categorical"

        # 5e. Everything else → numeric
        return "numeric"

    # ── 6. Object → categorical ───────────────────────────────────────────────
    if dtype == object:
        return "categorical"

    return "numeric"


# ─── Target Detection Fallback ─────────────────────────────────────────────────

def _detect_target_by_values(df: pd.DataFrame, schema: dict) -> Optional[str]:
    BINARY_VALUE_SETS = [
        {0, 1}, {0.0, 1.0},
        {'True', 'False'}, {'true', 'false'},
        {'Yes', 'No'}, {'yes', 'no'},
        {'Y', 'N'}, {'1', '0'}
    ]
    candidates = []
    for col in df.columns:
        if col in schema.get("id_cols", []):
            continue
        unique_vals = set(df[col].dropna().unique())
        if unique_vals in BINARY_VALUE_SETS or len(unique_vals) == 2:
            candidates.append(col)

    if not candidates:
        return None

    for col in candidates:
        if any(kw in col.lower() for kw in CHURN_KEYWORDS):
            return col

    return candidates[-1]


# ─── Target Normalisation ──────────────────────────────────────────────────────

def normalise_target(series: pd.Series) -> Optional[pd.Series]:
    return _normalise_target(series)


def _normalise_target(series: pd.Series) -> Optional[pd.Series]:
    s = series.dropna()
    if s.empty:
        return None

    if pd.api.types.is_numeric_dtype(s):
        unique = set(s.unique())
        if unique <= {0, 1, 0.0, 1.0}:
            return series.fillna(0).astype(int)

    if s.dtype == bool:
        return series.astype(int)

    s_str = s.astype(str).str.strip().str.lower()
    unique_lower = set(s_str.unique())
    mapping = None

    if unique_lower <= {'true', 'false'}:
        mapping = {'true': 1, 'false': 0}
    elif unique_lower <= {'yes', 'no'}:
        mapping = {'yes': 1, 'no': 0}
    elif unique_lower <= {'y', 'n'}:
        mapping = {'y': 1, 'n': 0}
    elif unique_lower <= {'1', '0'}:
        mapping = {'1': 1, '0': 0}
    elif len(unique_lower) == 2:
        counts   = s_str.value_counts()
        minority = counts.idxmin()
        majority = counts.idxmax()
        mapping  = {minority: 1, majority: 0}

    if mapping:
        return series.astype(str).str.strip().str.lower().map(mapping).fillna(0).astype(int)

    return None


# ─── Class Balance ─────────────────────────────────────────────────────────────

def _classify_balance(churn_rate: float) -> str:
    if 0.30 <= churn_rate <= 0.70:
        return "balanced"
    elif 0.10 <= churn_rate < 0.30 or 0.70 < churn_rate <= 0.90:
        return "imbalanced"
    else:
        return "severe"


# ─── Warnings ─────────────────────────────────────────────────────────────────

def _generate_warnings(df: pd.DataFrame, schema: dict) -> list:
    warnings = []

    if schema["target_col"] is None:
        warnings.append(
            "No churn target column detected. "
            "Ensure your dataset has a binary churn column."
        )

    if schema["n_rows"] < 500:
        warnings.append(
            f"Only {schema['n_rows']} rows detected. "
            f"Model accuracy may be low — recommend at least 1,000 rows."
        )

    if len(schema["feature_cols"]) < 3:
        warnings.append(
            "Fewer than 3 feature columns detected. "
            "Schema inference may have been too aggressive."
        )

    if schema["class_balance"] == "severe":
        rate = schema.get("churn_rate", 0)
        warnings.append(
            f"Severe class imbalance ({rate}% churn). "
            f"Model will apply class weights automatically."
        )

    for col in schema["feature_cols"]:
        null_pct = df[col].isna().mean() * 100
        if null_pct > 40:
            warnings.append(
                f"'{col}' has {null_pct:.0f}% missing values — "
                f"consider dropping it manually."
            )

    return warnings


# ─── Schema Match Check ────────────────────────────────────────────────────────

def schema_matches_existing(df: pd.DataFrame, existing_schema_path: Path) -> bool:
    if not existing_schema_path.exists():
        return False

    with open(existing_schema_path, "r") as f:
        saved = json.load(f)

    saved_cols = set(
        saved.get("feature_cols", []) +
        [saved.get("target_col", "")] +
        saved.get("id_cols", [])
    )
    saved_cols.discard("")

    return set(df.columns.tolist()) == saved_cols


# ─── Utilities ─────────────────────────────────────────────────────────────────

def _hash_columns(columns: list) -> str:
    col_string = ",".join(sorted(columns))
    return hashlib.md5(col_string.encode()).hexdigest()[:12]


def save_schema(schema: dict, artifacts_dir: Path) -> Path:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    schema_path = artifacts_dir / "schema.json"
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    return schema_path


def load_schema(artifacts_dir: Path) -> Optional[dict]:
    schema_path = artifacts_dir / "schema.json"
    if not schema_path.exists():
        return None
    with open(schema_path, "r") as f:
        return json.load(f)