"""
test_lumawear_model.py

Comprehensive test suite verifying:
1. Schema inference on LumaWear dataset.
2. Loading of serialized LumaWear artifacts from artifacts/2b2147fd4057.
3. Inference and SHAP calculations for LumaWear dataset.
4. Active model tracking via get_active_model_dir().
5. Single-customer prediction with continuous probability, 4-tier risk mapping, and recommendations.
6. Backward compatibility with the benchmark E-Commerce model (b139e4227328).
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

from utils.schema_inferrer import infer_schema
from backend.trainer import load_artifacts
from backend.predictor import predict_single, _risk_level, _churn_timeline, reload_artifacts
from utils.config import get_active_model_dir, set_active_model, DEFAULT_MODEL_DIR

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


def test_lumawear_schema():
    print("Testing LumaWear schema inference...")
    csv_path = Path("data/lumawear_churn_dataset.csv")
    df = pd.read_csv(csv_path)
    schema = infer_schema(df, dataset_name="LumaWear E-Commerce")

    assert schema["dataset_hash"] == "2b2147fd4057"
    assert schema["target_col"] == "churn"
    assert schema["id_cols"] == ["user_id"]
    assert schema["datetime_cols"] == ["as_of_date"]
    assert set(schema["feature_cols"]) == set(EXPECTED_21_FEATURES)
    assert len(schema["numeric_cols"]) == 20
    assert schema["categorical_cols"] == ["preferred_order_category"]
    print("  [OK] LumaWear schema inference passed.")


def test_lumawear_artifacts():
    print("Testing LumaWear artifact loading and prediction...")
    set_active_model("2b2147fd4057")
    reload_artifacts()
    active_dir = get_active_model_dir()
    assert active_dir.name == "2b2147fd4057", f"Expected active model 2b2147fd4057, got {active_dir.name}"

    artifacts = load_artifacts(active_dir)
    pipeline = artifacts["pipeline"]
    explainer = artifacts["explainer"]
    feature_order = artifacts["feature_order"]
    schema = artifacts["schema"]
    metadata = artifacts["metadata"]

    assert pipeline is not None
    assert explainer is not None
    assert len(feature_order) == 29
    assert metadata["n_features_raw"] == 21
    assert metadata["auc_cv"] >= 0.80

    # Test single-row inference via pipeline
    df = pd.read_csv("data/lumawear_churn_dataset.csv")
    X = df[schema["numeric_cols"] + schema["categorical_cols"]]
    sample = X.iloc[[0]]
    proba = pipeline.predict_proba(sample)[0, 1]
    assert 0.0 <= proba <= 1.0

    # Test SHAP explanation
    X_trans = pipeline.named_steps["preprocessor"].transform(sample)
    shap_vals = explainer.shap_values(X_trans)
    assert shap_vals.shape[1] == len(feature_order)
    print(f"  [OK] Artifact loading, inference (P={proba:.4f}), and SHAP calculation passed.")


def test_single_customer_prediction():
    print("Testing predictor.predict_single with full response schema...")
    customer = {
        "tenure_days": 49.0,
        "days_since_last_login": 2.0,
        "days_since_last_activity": 2.0,
        "login_count_30d": 3.0,
        "active_days_30d": 3.0,
        "page_views_30d": 11.0,
        "product_views_30d": 11.0,
        "cart_actions_30d": 2.0,
        "wishlist_actions_30d": 0.0,
        "order_count": 1.0,
        "orders_30d": 0.0,
        "days_since_last_order": 40.0,
        "total_spend": 340.40,
        "spend_30d": 0.0,
        "average_order_value": 340.40,
        "preferred_order_category": "Outerwear",
        "order_frequency": 0.61,
        "distinct_products_viewed_30d": 8.0,
        "distinct_categories_ordered": 1.0,
        "items_per_order": 2.0,
        "activity_event_count_30d": 27.0,
    }

    result = predict_single(customer)
    assert 0.0 <= result["churn_probability"] <= 1.0
    assert 0.0 <= result["churn_percentage"] <= 100.0
    assert result["risk_level"] in ["Low", "Medium", "High", "Very High"]
    assert "90 days" in result["churn_timeline"] or "near-term" in result["churn_timeline"]
    assert isinstance(result["top_shap_features"], list)
    assert isinstance(result["recommendations"], list)
    print(f"  [OK] predict_single returned: Prob={result['churn_probability']}, Tier={result['risk_level']}, Recs={len(result['recommendations'])}")


def test_benchmark_backward_compatibility():
    print("Testing benchmark model backward compatibility...")
    benchmark_dir = Path("artifacts/b139e4227328")
    if benchmark_dir.exists():
        artifacts = load_artifacts(benchmark_dir)
        assert artifacts["pipeline"] is not None
        assert artifacts["metadata"]["n_features_raw"] == 18

        set_active_model("b139e4227328")
        reload_artifacts()
        bench_cust = {
            "Tenure": 4.0,
            "WarehouseToHome": 6.0,
            "HourSpendOnApp": 3.0,
            "NumberOfDeviceRegistered": 3,
            "SatisfactionScore": 2,
            "NumberOfAddress": 9,
            "Complain": 1,
            "CashbackAmount": 159.93,
            "CityTier": 3,
            "PreferredLoginDevice": "Mobile Phone",
            "PreferredPaymentMode": "Debit Card",
            "Gender": "Female",
            "PreferedOrderCat": "Fashion",
            "MaritalStatus": "Single",
        }
        res = predict_single(bench_cust)
        assert 0.0 <= res["churn_probability"] <= 1.0
        assert len(res["recommendations"]) > 0

        # Switch back to active LumaWear model
        set_active_model("2b2147fd4057")
        reload_artifacts()
        print("  [OK] Benchmark model (b139e4227328) loaded and scored successfully.")


if __name__ == "__main__":
    print("=" * 60)
    print(" RUNNING LUMAWEAR MODEL TESTS")
    print("=" * 60)
    test_lumawear_schema()
    test_lumawear_artifacts()
    test_single_customer_prediction()
    test_benchmark_backward_compatibility()
    print("=" * 60)
    print(" ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)
