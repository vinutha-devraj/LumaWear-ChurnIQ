"""
train_lumawear.py

Train and serialize the LumaWear-native XGBoost churn model.
Uses schema_inferrer to auto-detect the 21 LumaWear features,
trains with 5-fold StratifiedKFold cross-validation, computes SHAP values,
serializes all artifacts into artifacts/{dataset_hash}/, and updates active_model.txt.
"""

import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

from utils.schema_inferrer import infer_schema
from backend.trainer import train_model, load_artifacts
from utils.config import set_active_model, get_active_model_dir

EXPECTED_21_FEATURES = [
    "tenure_days",
    "days_since_last_login",
    "days_since_last_activity",
    "login_count_30d",
    "active_days_30d",
    "page_views_30d",
    "product_views_30d",
    "cart_actions_30d",
    "wishlist_actions_30d",
    "order_count",
    "orders_30d",
    "days_since_last_order",
    "total_spend",
    "spend_30d",
    "average_order_value",
    "preferred_order_category",
    "order_frequency",
    "distinct_products_viewed_30d",
    "distinct_categories_ordered",
    "items_per_order",
    "activity_event_count_30d",
]


def progress_logger(step: str, pct: int):
    bar = "=" * (pct // 5) + "-" * (20 - pct // 5)
    print(f"  [{bar}] {pct:3d}%  {step}")


def main():
    print("=" * 65)
    print(" LUMAWEAR CHURN MODEL TRAINING — PHASE 3")
    print("=" * 65)

    csv_path = Path("data/lumawear_churn_dataset.csv")
    if not csv_path.exists():
        csv_path = Path("../LumaWear-Ecommerce/backend/data/lumawear_churn_dataset.csv")

    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    print(f"\n1. Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"   Rows: {len(df):,}, Columns: {len(df.columns)}")

    # ── Schema Inference ──────────────────────────────────────────────────────
    print("\n2. Inferring schema with dynamic inferrer...")
    schema = infer_schema(df, dataset_name="LumaWear E-Commerce")

    print(f"   Dataset hash:         {schema['dataset_hash']}")
    print(f"   Target column:        {schema['target_col']}")
    print(f"   ID columns:           {schema['id_cols']}")
    print(f"   Datetime columns:     {schema['datetime_cols']}")
    print(f"   Drop columns:         {schema['drop_cols']}")
    print(f"   Numeric features:     {len(schema['numeric_cols'])}")
    print(f"   Categorical features: {len(schema['categorical_cols'])}")
    print(f"   Total model features: {len(schema['feature_cols'])}")
    print(f"   Churn rate:           {schema['churn_rate']}%")
    print(f"   Class balance:        {schema['class_balance']}")

    # Validation of inferred schema against strict LumaWear specifications
    assert schema["target_col"] == "churn", f"Target must be 'churn', got {schema['target_col']}"
    assert "user_id" in schema["drop_cols"], "user_id must be excluded in drop_cols"
    assert "as_of_date" in schema["drop_cols"], "as_of_date must be excluded in drop_cols"
    assert set(schema["feature_cols"]) == set(EXPECTED_21_FEATURES), (
        f"Feature columns mismatch!\nExpected: {set(EXPECTED_21_FEATURES)}\nGot: {set(schema['feature_cols'])}"
    )
    assert schema["categorical_cols"] == ["preferred_order_category"], (
        f"Expected ['preferred_order_category'], got {schema['categorical_cols']}"
    )
    print("   [OK] Schema matches all 21 LumaWear-native specifications exactly.")

    # ── Model Training ────────────────────────────────────────────────────────
    artifacts_dir = Path("artifacts") / schema["dataset_hash"]
    print(f"\n3. Training XGBoost model with 5-fold CV into {artifacts_dir}...")

    result = train_model(
        df=df,
        schema=schema,
        artifacts_dir=artifacts_dir,
        progress_callback=progress_logger,
    )

    # ── Validation & Evaluation ───────────────────────────────────────────────
    print("\n4. Evaluating model performance & confusion matrix...")
    artifacts = load_artifacts(artifacts_dir)
    pipeline = artifacts["pipeline"]

    X = df[schema["numeric_cols"] + schema["categorical_cols"]]
    y = df[schema["target_col"]].astype(int)

    y_pred_proba = pipeline.predict_proba(X)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)

    cm = confusion_matrix(y, y_pred)
    tn, fp, fn, tp = cm.ravel()

    print("\n" + "=" * 65)
    print(" TRAINING & EVALUATION REPORT")
    print("=" * 65)
    print(f"- Dataset Identifier (Hash): {result['dataset_hash']}")
    print(f"- Training Row Count:        {result['n_rows']:,}")
    print(f"- Raw Feature Count:         {result['n_features']} (20 numeric, 1 categorical)")
    print(f"- Post-OHE Feature Count:    {len(result['feature_order'])}")
    print(f"- Churn Class Distribution:  churn=0: {(y == 0).sum():,} ({(y == 0).mean()*100:.2f}%), churn=1: {(y == 1).sum():,} ({(y == 1).mean()*100:.2f}%)")
    print(f"- 5-Fold CV ROC-AUC:         {result['auc_cv']:.4f} +- {result.get('auc_cv_std', 0.0):.4f}")
    print(f"- Training ROC-AUC:          {result['auc_test']:.4f}")
    print(f"- Training Duration:         {result['duration_seconds']}s")
    print(f"- Artifact Directory:        {artifacts_dir.resolve()}")
    print("\nConfusion Matrix (threshold = 0.50):")
    print(f"  TN (Retained predicted Retained): {tn:,}")
    print(f"  FP (Retained predicted Churned):  {fp:,}")
    print(f"  FN (Churned predicted Retained):  {fn:,}")
    print(f"  TP (Churned predicted Churned):   {tp:,}")
    print("\nClassification Report:")
    print(classification_report(y, y_pred, target_names=["Retained (0)", "Churned (1)"]))

    print("\nTop 10 Features by Global SHAP Importance:")
    for feat, score in list(result["feature_importance"].items())[:10]:
        bar = "#" * int(score * 300)
        print(f"  {feat:<35} {score:.4f}  {bar}")

    # ── Artifact Validation ───────────────────────────────────────────────────
    print("\n5. Validating serialized artifacts integrity...")
    assert (artifacts_dir / "churn_pipeline.joblib").exists(), "churn_pipeline.joblib missing"
    assert (artifacts_dir / "shap_explainer.joblib").exists(), "shap_explainer.joblib missing"
    assert (artifacts_dir / "feature_order.json").exists(), "feature_order.json missing"
    assert (artifacts_dir / "feature_importance.json").exists(), "feature_importance.json missing"
    assert (artifacts_dir / "schema.json").exists(), "schema.json missing"
    assert (artifacts_dir / "model_metadata.json").exists(), "model_metadata.json missing"

    # Test single-row inference
    sample_row = X.iloc[[0]]
    sample_proba = pipeline.predict_proba(sample_row)[0, 1]
    print(f"   [OK] Sample prediction test passed: P(churn) = {sample_proba:.4f}")

    # ── Set Active Model ──────────────────────────────────────────────────────
    print(f"\n6. Updating active_model.txt to '{schema['dataset_hash']}'...")
    set_active_model(schema["dataset_hash"])
    active_dir = get_active_model_dir()
    print(f"   [OK] Active model is now: {active_dir.name}")

    print("\n" + "=" * 65)
    print(" PHASE 3 COMPLETE: LUMAWEAR MODEL SUCCESSFULLY TRAINED & ACTIVE")
    print("=" * 65)


if __name__ == "__main__":
    main()
