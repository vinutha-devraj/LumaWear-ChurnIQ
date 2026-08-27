# LumaWear ChurnIQ — API Reference & Integration Guide

## 1. Express Storefront & Churn Proxy Endpoints (:4000)

### `GET /api/churn/predict/:userId`
**Description**: Authenticated admin proxy endpoint that triggers live feature extraction, model scoring, SHAP explainability, and retention recommendation generation.
- **Authorization**: Required (`Bearer <JWT>` with role `admin`)
- **Parameters**: `userId` (MongoDB ObjectId or custom user identifier)
- **Response (200 OK)**:
```json
{
  "success": true,
  "prediction": {
    "customer_id": "6a8704de95bfe658bec9dc05",
    "customer_input": { ... },
    "churn_prediction": 0,
    "churn_label": "Will Not Churn",
    "churn_probability": 0.0537,
    "churn_percentage": 5.37,
    "risk_level": "Low",
    "churn_timeline": "Low near-term churn risk",
    "top_shap_features": [
      {
        "feature": "activity_event_count_30d",
        "shap_value": -0.7671,
        "direction": "reduces_churn"
      }
    ],
    "recommendations": [
      {
        "priority": "High",
        "recommendation": "Cart abandonment detected...",
        "driven_by": "cart_actions_30d"
      }
    ]
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Empty or invalid user ID.
  - `401 Unauthorized`: Missing or invalid JWT token.
  - `403 Forbidden`: Authenticated user does not possess `admin` role.
  - `404 Not Found`: Customer does not exist in MongoDB.
  - `503 Service Unavailable`: Python FastAPI inference engine is offline.
  - `504 Gateway Timeout`: Python inference engine exceeded 5s response deadline.

---

### `GET /api/churn/customer-features/:userId`
**Description**: Computes and returns the point-in-time 21 raw LumaWear behavioral features for a customer.
- **Authorization**: Internal / Service endpoint
- **Parameters**: `userId`
- **Response (200 OK)**:
```json
{
  "success": true,
  "user_id": "6a8704de95bfe658bec9dc05",
  "features": {
    "user_id": "6a8704de95bfe658bec9dc05",
    "tenure_days": 5,
    "days_since_last_login": 5,
    "days_since_last_activity": 0,
    "login_count_30d": 1,
    "active_days_30d": 2,
    "page_views_30d": 18,
    "product_views_30d": 0,
    "cart_actions_30d": 4,
    "wishlist_actions_30d": 3,
    "order_count": 0,
    "orders_30d": 0,
    "days_since_last_order": null,
    "total_spend": 0,
    "spend_30d": 0,
    "average_order_value": null,
    "preferred_order_category": null,
    "order_frequency": 0,
    "distinct_products_viewed_30d": 0,
    "distinct_categories_ordered": 0,
    "items_per_order": null,
    "activity_event_count_30d": 27
  }
}
```

---

## 2. Python FastAPI Inference Engine Endpoints (:8000)

### `POST /predict/live-customer`
**Description**: Accepts a customer ID, invokes the feature service to pull live MongoDB point-in-time features, and runs model scoring.
- **Request Body**:
```json
{
  "user_id": "6a8704de95bfe658bec9dc05"
}
```
- **Response (200 OK)**: Returns full `PredictionResponse` schema.

---

### `POST /predict`
**Description**: Scores an explicit customer feature payload (for simulation, what-if analysis, or batch evaluation).
- **Request Body**: `LumaWearCustomerInput` (21 features) or `BenchmarkCustomerInput`.
- **Response (200 OK)**: Returns full `PredictionResponse` schema.

---

### `GET /health`
**Description**: Health status check and active model verification.
- **Response (200 OK)**:
```json
{
  "status": "ok",
  "active_model": "2b2147fd4057",
  "auc_cv": 0.837
}
```
