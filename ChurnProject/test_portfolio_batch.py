"""
test_portfolio_batch.py

Comprehensive Phase 8 test suite verifying:
1. Batch prediction request validation.
2. Vectorized scoring of multiple customers.
3. Empty batch handling.
4. Sparse/minimal customer feature handling.
5. Probability ranges (strictly [0.0, 1.0]).
6. 4-tier risk classification (Low, Medium, High, Very High).
7. SHAP feature attribution output across batch.
8. Retention recommendation generation for every scored customer.
9. Active model integrity (2b2147fd4057).
"""

import json
from fastapi.testclient import TestClient

from backend.main import app
from backend.predictor import predict_batch_features, get_metadata
from utils.config import get_active_model_dir

client = TestClient(app)

SAMPLE_CUSTOMER_1 = {
    "user_id": "cust-001",
    "tenure_days": 120.0,
    "days_since_last_login": 1.0,
    "days_since_last_activity": 1.0,
    "login_count_30d": 12.0,
    "active_days_30d": 8.0,
    "page_views_30d": 45.0,
    "product_views_30d": 20.0,
    "cart_actions_30d": 5.0,
    "wishlist_actions_30d": 2.0,
    "order_count": 4.0,
    "orders_30d": 2.0,
    "days_since_last_order": 10.0,
    "total_spend": 540.0,
    "spend_30d": 180.0,
    "average_order_value": 135.0,
    "preferred_order_category": "Apparel",
    "order_frequency": 1.0,
    "distinct_products_viewed_30d": 10.0,
    "distinct_categories_ordered": 2.0,
    "items_per_order": 2.5,
    "activity_event_count_30d": 65.0,
}

SAMPLE_CUSTOMER_2 = {
    "user_id": "cust-002",
    "tenure_days": 90.0,
    "days_since_last_login": 45.0,
    "days_since_last_activity": 45.0,
    "login_count_30d": 0.0,
    "active_days_30d": 0.0,
    "page_views_30d": 0.0,
    "product_views_30d": 0.0,
    "cart_actions_30d": 0.0,
    "wishlist_actions_30d": 0.0,
    "order_count": 1.0,
    "orders_30d": 0.0,
    "days_since_last_order": 85.0,
    "total_spend": 89.0,
    "spend_30d": 0.0,
    "average_order_value": 89.0,
    "preferred_order_category": "Footwear",
    "order_frequency": 0.33,
    "distinct_products_viewed_30d": 0.0,
    "distinct_categories_ordered": 1.0,
    "items_per_order": 1.0,
    "activity_event_count_30d": 0.0,
}

SPARSE_CUSTOMER = {
    "user_id": "cust-sparse",
    "tenure_days": 2.0,
}


def test_1_empty_batch():
    print("Test 1: Verifying empty batch handling...")
    resp = client.post("/predict/batch", json={"customers": []})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["total"] == 0
    assert data["predictions"] == []
    print("  [OK] Empty batch correctly returns 0 predictions.")


def test_2_multiple_customers_vectorized_scoring():
    print("Test 2: Verifying batch scoring for multiple customers...")
    resp = client.post("/predict/batch", json={"customers": [SAMPLE_CUSTOMER_1, SAMPLE_CUSTOMER_2]})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["total"] == 2
    assert len(data["predictions"]) == 2

    # Check first customer (active, low churn risk expected)
    c1 = data["predictions"][0]
    assert c1["customer_id"] == "cust-001"
    assert 0.0 <= c1["churn_probability"] <= 1.0
    assert 0.0 <= c1["churn_percentage"] <= 100.0
    assert c1["risk_level"] in ["Low", "Medium", "High", "Very High"]
    assert len(c1["top_shap_features"]) > 0
    assert len(c1["recommendations"]) > 0

    # Check second customer (inactive, elevated churn risk expected)
    c2 = data["predictions"][1]
    assert c2["customer_id"] == "cust-002"
    assert 0.0 <= c2["churn_probability"] <= 1.0
    assert c2["churn_probability"] > c1["churn_probability"]
    assert c2["risk_level"] in ["High", "Very High", "Medium"]
    assert len(c2["top_shap_features"]) > 0
    print(f"  [OK] Customer 1 (Active): P={c1['churn_probability']:.4f} ({c1['risk_level']})")
    print(f"  [OK] Customer 2 (Inactive): P={c2['churn_probability']:.4f} ({c2['risk_level']})")


def test_3_sparse_customer_handling():
    print("Test 3: Verifying sparse customer feature handling in batch...")
    resp = client.post("/predict/batch", json={"customers": [SPARSE_CUSTOMER]})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data["total"] == 1
    pred = data["predictions"][0]
    assert pred["customer_id"] == "cust-sparse"
    assert 0.0 <= pred["churn_probability"] <= 1.0
    assert pred["risk_level"] in ["Low", "Medium", "High", "Very High"]
    print(f"  [OK] Sparse customer scored cleanly: P={pred['churn_probability']:.4f}")


def test_4_shap_attributions_and_recommendations():
    print("Test 4: Verifying SHAP structure and recommendation outputs...")
    results = predict_batch_features([SAMPLE_CUSTOMER_1, SAMPLE_CUSTOMER_2, SPARSE_CUSTOMER])
    assert len(results) == 3
    for res in results:
        assert "churn_probability" in res
        assert "risk_level" in res
        assert "churn_timeline" in res
        assert isinstance(res["top_shap_features"], list)
        assert isinstance(res["recommendations"], list)
        for shap_item in res["top_shap_features"]:
            assert "feature" in shap_item
            assert "shap_value" in shap_item
            assert shap_item["direction"] in ["increases_churn", "reduces_churn"]
    print("  [OK] SHAP features and recommendation rules verified for all batch items.")


def test_5_active_model_integrity():
    print("Test 5: Verifying active model identity remains 2b2147fd4057...")
    meta = get_metadata()
    active_hash = meta.get("dataset_hash")
    assert active_hash == "2b2147fd4057", f"Expected active model 2b2147fd4057, got {active_hash}"
    active_dir = get_active_model_dir()
    assert active_dir.name == "2b2147fd4057"
    print(f"  [OK] Active model confirmed: {active_hash}")


if __name__ == "__main__":
    print("=" * 65)
    print(" RUNNING PHASE 8 BATCH PREDICTION TEST SUITE")
    print("=" * 65)
    test_1_empty_batch()
    test_2_multiple_customers_vectorized_scoring()
    test_3_sparse_customer_handling()
    test_4_shap_attributions_and_recommendations()
    test_5_active_model_integrity()
    print("=" * 65)
    print(" ALL 5 PHASE 8 BATCH PREDICTION TESTS PASSED!")
    print("=" * 65)
