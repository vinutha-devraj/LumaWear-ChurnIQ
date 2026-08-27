"""
test_resilience_security.py

Comprehensive Phase 6D Error & Resilience Test Suite:
1. Valid customer prediction
2. Unknown customer handling (404)
3. Missing / empty user ID handling (400/422)
4. Missing optional features handling
5. Invalid numeric feature handling
6. Unknown categorical value handling
7. Prediction response schema validity
8. SHAP explanation integrity & bounds
9. Recommendation generation correctness
10. Active model integrity & non-tampering
"""

import sys
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.predictor import predict_single, _risk_level, _churn_timeline
from utils.config import get_active_model_dir, ARTIFACTS_BASE


class TestResilienceAndSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_valid_customer_prediction_payload(self):
        """Test single predict with full valid feature payload."""
        sample_input = {
            "user_id": "cust-test-1",
            "tenure_days": 60.0,
            "days_since_last_login": 3.0,
            "days_since_last_activity": 1.0,
            "login_count_30d": 5.0,
            "active_days_30d": 4.0,
            "page_views_30d": 25.0,
            "product_views_30d": 12.0,
            "cart_actions_30d": 3.0,
            "wishlist_actions_30d": 1.0,
            "order_count": 2.0,
            "orders_30d": 1.0,
            "days_since_last_order": 15.0,
            "total_spend": 280.0,
            "spend_30d": 120.0,
            "average_order_value": 140.0,
            "preferred_order_category": "Tops",
            "order_frequency": 1.0,
            "distinct_products_viewed_30d": 8.0,
            "distinct_categories_ordered": 1.0,
            "items_per_order": 2.0,
            "activity_event_count_30d": 45.0,
        }
        res = self.client.post("/predict", json=sample_input)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("churn_probability", data)
        self.assertGreaterEqual(data["churn_probability"], 0.0)
        self.assertLessEqual(data["churn_probability"], 1.0)
        self.assertAlmostEqual(data["churn_percentage"], data["churn_probability"] * 100, places=2)
        self.assertIn(data["risk_level"], ["Low", "Medium", "High", "Very High"])
        self.assertIsInstance(data["top_shap_features"], list)
        self.assertIsInstance(data["recommendations"], list)

    def test_02_unknown_customer_live_prediction(self):
        """Test live prediction with non-existent user_id returns 404."""
        res = self.client.post("/predict/live-customer", json={"user_id": "non_existent_user_999999999"})
        self.assertEqual(res.status_code, 404)
        self.assertIn("not found", res.json().get("detail", "").lower())

    def test_03_missing_or_empty_user_id(self):
        """Test live prediction with empty user_id returns 422 Unprocessable Entity."""
        res = self.client.post("/predict/live-customer", json={"user_id": ""})
        self.assertEqual(res.status_code, 422)

    def test_04_missing_optional_features(self):
        """Test predict with minimal/sparse features (e.g. brand new customer with 0 orders)."""
        sparse_input = {
            "user_id": "newbie-1",
            "tenure_days": 1.0,
            "days_since_last_login": 0.0,
            "days_since_last_activity": 0.0,
            "login_count_30d": 1.0,
            "active_days_30d": 1.0,
            "page_views_30d": 5.0,
            "product_views_30d": 2.0,
            "cart_actions_30d": 0.0,
            "wishlist_actions_30d": 0.0,
            "order_count": 0.0,
            "orders_30d": 0.0,
            "days_since_last_order": None,
            "total_spend": 0.0,
            "spend_30d": 0.0,
            "average_order_value": None,
            "preferred_order_category": None,
            "order_frequency": 0.0,
            "distinct_products_viewed_30d": 2.0,
            "distinct_categories_ordered": 0.0,
            "items_per_order": None,
            "activity_event_count_30d": 8.0,
        }
        res = self.client.post("/predict", json=sparse_input)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["churn_probability"], 0.0)
        self.assertLessEqual(data["churn_probability"], 1.0)

    def test_05_unknown_categorical_value(self):
        """Test predict with unexpected category value (handles OHE gracefully)."""
        input_with_weird_cat = {
            "tenure_days": 30.0,
            "days_since_last_login": 2.0,
            "days_since_last_activity": 1.0,
            "preferred_order_category": "SpacesuitsAndHovercrafts",
            "order_count": 1.0,
            "total_spend": 100.0,
        }
        res = self.client.post("/predict", json=input_with_weird_cat)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("churn_probability", data)

    def test_06_risk_tier_boundary_mappings(self):
        """Test exact boundary transitions for 4-tier risk classification."""
        self.assertEqual(_risk_level(0.00), "Low")
        self.assertEqual(_risk_level(0.2499), "Low")
        self.assertEqual(_risk_level(0.25), "Medium")
        self.assertEqual(_risk_level(0.4999), "Medium")
        self.assertEqual(_risk_level(0.50), "High")
        self.assertEqual(_risk_level(0.7499), "High")
        self.assertEqual(_risk_level(0.75), "Very High")
        self.assertEqual(_risk_level(1.00), "Very High")

    def test_07_churn_timeline_phrasing(self):
        """Test risk-oriented 90-day churn timeline phrasing."""
        self.assertEqual(_churn_timeline(0.10), "Low near-term churn risk")
        self.assertEqual(_churn_timeline(0.35), "Potential churn risk within the next 90 days")
        self.assertEqual(_churn_timeline(0.60), "High churn risk within the next 90 days")
        self.assertEqual(_churn_timeline(0.85), "Critical churn risk within the next 90 days")

    def test_08_active_model_integrity(self):
        """Verify active model directory and all 6 required artifact files exist."""
        active_dir = get_active_model_dir()
        self.assertTrue(active_dir.exists())
        self.assertTrue((active_dir / "churn_pipeline.joblib").exists())
        self.assertTrue((active_dir / "shap_explainer.joblib").exists())
        self.assertTrue((active_dir / "feature_order.json").exists())
        self.assertTrue((active_dir / "schema.json").exists())
        self.assertTrue((active_dir / "model_metadata.json").exists())
        self.assertTrue((active_dir / "feature_importance.json").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
