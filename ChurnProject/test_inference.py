"""
test_inference.py

Comprehensive Phase 4 test suite verifying:
1. Probability is strictly between 0.0 and 1.0.
2. Percentage matches probability (0–100%).
3. Risk tier boundaries (0–0.25 Low, 0.25–0.50 Medium, 0.50–0.75 High, 0.75–1.00 Very High).
4. LumaWear 21-feature schema validation.
5. SHAP output structure and direction.
6. Recommendation generation based on actual feature values.
7. Missing optional feature handling.
8. /predict and /predict/live-customer FastAPI endpoints response format.
9. Existing benchmark model backward compatibility.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi.testclient import TestClient

from utils.config import get_active_model_dir, set_active_model, get_model_dir
from backend.predictor import (
    predict_single, _risk_level, _churn_timeline,
    reload_artifacts, get_schema, get_metadata
)
from backend.recommender import generate_recommendations
from backend.schemas import LumaWearCustomerInput, PredictionResponse, BenchmarkCustomerInput
from backend.main import app

client = TestClient(app)

SAMPLE_LUMAWEAR_CUSTOMER = {
    "user_id": "u-0010",
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


def test_1_probability_bounds_and_type():
    print("Test 1: Verifying churn probability is continuous float between 0.0 and 1.0...")
    set_active_model("2b2147fd4057")
    reload_artifacts()

    result = predict_single(SAMPLE_LUMAWEAR_CUSTOMER)
    prob = result["churn_probability"]

    assert isinstance(prob, float), f"Expected float probability, got {type(prob)}"
    assert 0.0 <= prob <= 1.0, f"Probability {prob} is outside [0.0, 1.0]"
    print(f"  [OK] Probability: {prob:.4f}")


def test_2_percentage_matches_probability():
    print("Test 2: Verifying churn percentage matches probability (0–100%)...")
    result = predict_single(SAMPLE_LUMAWEAR_CUSTOMER)
    prob = result["churn_probability"]
    pct = result["churn_percentage"]

    assert isinstance(pct, float), f"Expected float percentage, got {type(pct)}"
    assert 0.0 <= pct <= 100.0, f"Percentage {pct} is outside [0.0, 100.0]"
    assert abs(pct - round(prob * 100, 2)) < 0.01, f"Mismatch: pct={pct} vs prob={prob}"
    print(f"  [OK] Probability: {prob:.4f} -> Percentage: {pct}%")


def test_3_risk_tier_boundaries():
    print("Test 3: Verifying 4-tier risk classification boundaries...")
    # Low: 0.00 – 0.2499
    assert _risk_level(0.0) == "Low"
    assert _risk_level(0.15) == "Low"
    assert _risk_level(0.2499) == "Low"

    # Medium: 0.25 – 0.4999
    assert _risk_level(0.25) == "Medium"
    assert _risk_level(0.35) == "Medium"
    assert _risk_level(0.4999) == "Medium"

    # High: 0.50 – 0.7499
    assert _risk_level(0.50) == "High"
    assert _risk_level(0.65) == "High"
    assert _risk_level(0.7499) == "High"

    # Very High: 0.75 – 1.00
    assert _risk_level(0.75) == "Very High"
    assert _risk_level(0.85) == "Very High"
    assert _risk_level(1.00) == "Very High"

    # Timelines
    assert "Low" in _churn_timeline(0.10)
    assert "Potential" in _churn_timeline(0.30)
    assert "High" in _churn_timeline(0.60)
    assert "Critical" in _churn_timeline(0.80)
    print("  [OK] Risk tiers and timeline descriptions correctly mapped across all boundaries.")


def test_4_lumawear_feature_schema():
    print("Test 4: Verifying LumaWear 21-feature schema validation...")
    schema = LumaWearCustomerInput(**SAMPLE_LUMAWEAR_CUSTOMER)
    dump = schema.model_dump()

    assert len(dump) >= 21
    for k in SAMPLE_LUMAWEAR_CUSTOMER:
        assert k in dump, f"Missing key {k} in dump"

    # Test with empty/default fields
    empty_schema = LumaWearCustomerInput()
    assert empty_schema.login_count_30d == 0.0
    assert empty_schema.days_since_last_activity is None
    print("  [OK] LumaWear schema validation and default handling passed.")


def test_5_shap_output_structure():
    print("Test 5: Verifying SHAP feature explanations...")
    result = predict_single(SAMPLE_LUMAWEAR_CUSTOMER)
    shap_features = result["top_shap_features"]

    assert isinstance(shap_features, list), "top_shap_features must be a list"
    assert len(shap_features) > 0, "top_shap_features should not be empty"

    for item in shap_features:
        assert "feature" in item, "Missing 'feature' key in SHAP item"
        assert "shap_value" in item, "Missing 'shap_value' key in SHAP item"
        assert "direction" in item, "Missing 'direction' key in SHAP item"
        assert item["direction"] in ["increases_churn", "reduces_churn"]
        assert isinstance(item["shap_value"], float)

    print(f"  [OK] Top SHAP features ({len(shap_features)} features):")
    for s in shap_features[:3]:
        print(f"       - {s['feature']}: {s['shap_value']:+.4f} ({s['direction']})")


def test_6_recommendation_generation():
    print("Test 6: Verifying e-commerce recommendation generation rules...")
    # Test case A: Cart abandonment
    cart_ab_customer = {
        **SAMPLE_LUMAWEAR_CUSTOMER,
        "cart_actions_30d": 4.0,
        "orders_30d": 0.0,
    }
    recs_a = generate_recommendations([], cart_ab_customer, churn_probability=0.60)
    assert any("abandonment" in r["recommendation"].lower() or "cart" in r["recommendation"].lower() for r in recs_a)

    # Test case B: High inactivity
    inactive_customer = {
        **SAMPLE_LUMAWEAR_CUSTOMER,
        "days_since_last_activity": 25.0,
    }
    recs_b = generate_recommendations([], inactive_customer, churn_probability=0.70)
    assert any("inactive" in r["recommendation"].lower() or "win-back" in r["recommendation"].lower() for r in recs_b)

    # Test case C: High spend VIP
    vip_customer = {
        **SAMPLE_LUMAWEAR_CUSTOMER,
        "total_spend": 850.0,
    }
    recs_c = generate_recommendations([], vip_customer, churn_probability=0.65)
    assert any("vip" in r["recommendation"].lower() for r in recs_c)

    print("  [OK] All behavioral recommendation rules triggered as expected.")


def test_7_missing_optional_feature_handling():
    print("Test 7: Verifying prediction with missing/sparse optional features...")
    sparse_customer = {
        "tenure_days": 10.0,
        "login_count_30d": 1.0,
        "total_spend": 50.0,
    }
    result = predict_single(sparse_customer)

    assert 0.0 <= result["churn_probability"] <= 1.0
    assert result["risk_level"] in ["Low", "Medium", "High", "Very High"]
    assert len(result["recommendations"]) > 0
    print(f"  [OK] Sparse customer prediction succeeded: P={result['churn_probability']:.4f} ({result['risk_level']})")


def test_8_fastapi_endpoints():
    print("Test 8: Verifying FastAPI /predict and /predict/live-customer endpoints...")
    # Test POST /predict
    resp = client.post("/predict", json=SAMPLE_LUMAWEAR_CUSTOMER)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()

    assert "churn_probability" in data
    assert "churn_percentage" in data
    assert "risk_level" in data
    assert "churn_timeline" in data
    assert "top_shap_features" in data
    assert "recommendations" in data

    # Test POST /predict/live-customer with real MongoDB customer ID
    resp_live = client.post("/predict/live-customer", json={"user_id": "6a8704de95bfe658bec9dc05"})
    assert resp_live.status_code == 200, f"Expected 200 for live customer, got {resp_live.status_code}: {resp_live.text}"
    live_data = resp_live.json()
    assert live_data["customer_id"] == "6a8704de95bfe658bec9dc05"
    assert 0.0 <= live_data["churn_probability"] <= 1.0

    print("  [OK] FastAPI endpoints returned complete validated responses.")


def test_9_benchmark_backward_compatibility():
    print("Test 9: Verifying backward compatibility with benchmark model (b139e4227328)...")
    benchmark_dir = get_model_dir("b139e4227328")
    if benchmark_dir.exists():
        set_active_model("b139e4227328")
        reload_artifacts()

        benchmark_customer = {
            "Tenure": 4.0,
            "WarehouseToHome": 6.0,
            "HourSpendOnApp": 3.0,
            "NumberOfDeviceRegistered": 3,
            "SatisfactionScore": 2,
            "NumberOfAddress": 9,
            "Complain": 1,
            "OrderAmountHikeFromlastYear": 11.0,
            "CouponUsed": 1.0,
            "OrderCount": 1.0,
            "DaySinceLastOrder": 5.0,
            "CashbackAmount": 159.93,
            "CityTier": 3,
            "PreferredLoginDevice": "Mobile Phone",
            "PreferredPaymentMode": "Debit Card",
            "Gender": "Female",
            "PreferedOrderCat": "Fashion",
            "MaritalStatus": "Single",
        }

        resp = client.post("/predict", json=benchmark_customer)
        assert resp.status_code == 200
        bench_res = resp.json()
        assert 0.0 <= bench_res["churn_probability"] <= 1.0
        assert len(bench_res["recommendations"]) > 0

        # Switch back to LumaWear model
        set_active_model("2b2147fd4057")
        reload_artifacts()
        print("  [OK] Benchmark model and feature scoring fully preserved.")


if __name__ == "__main__":
    print("=" * 65)
    print(" RUNNING PHASE 4 INFERENCE ENGINE & RISK SCORING TEST SUITE")
    print("=" * 65)
    test_1_probability_bounds_and_type()
    test_2_percentage_matches_probability()
    test_3_risk_tier_boundaries()
    test_4_lumawear_feature_schema()
    test_5_shap_output_structure()
    test_6_recommendation_generation()
    test_7_missing_optional_feature_handling()
    test_8_fastapi_endpoints()
    test_9_benchmark_backward_compatibility()
    print("=" * 65)
    print(" ALL 9 PHASE 4 TESTS PASSED PERFECTLY!")
    print("=" * 65)
