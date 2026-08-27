# Phase 6A: Complete Project Audit Report

This audit documents findings across the entire LumaWear and ChurnProject codebases, assessing security, configuration, API resilience, input validation, and model integrity.

---

## Summary Table of Findings

| ID | Finding | Severity | File | Recommended Fix | Impact / Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | `feature_service.py` had a fallback strategy reading from synthetic CSVs (`lumawear_churn_dataset.csv`) for live predictions. | **High** | `ChurnProject/backend/feature_service.py` | Remove CSV fallback from live prediction pipeline so live inference strictly relies on authoritative MongoDB extraction. | None. Ensures live prediction only scores real customers. |
| **F-02** | Express proxy `GET /api/churn/predict/:userId` lacked an explicit network timeout for FastAPI calls. | **Medium** | `LumaWear-Ecommerce/backend/src/server.js` | Add `AbortController` with a 5000ms timeout to avoid hanging requests if the Python service stalls. | None. Improves server responsiveness and prevents connection pileups. |
| **F-03** | Service URLs (`http://127.0.0.1:8000` and `http://localhost:4000`) were hardcoded in some secondary modules without unified environment defaults. | **Medium** | `LumaWear-Ecommerce/backend/src/server.js`, `ChurnProject/backend/feature_service.py` | Use `process.env.CHURN_SERVICE_URL` and `os.environ.get("LUMAWEAR_BACKEND_URL")` with fallback defaults. | None. Simplifies containerized and local deployments. |
| **F-04** | Potential numpy type serialization issues (e.g., `np.float64`, `np.nan`) in predictor outputs. | **Low** | `ChurnProject/backend/predictor.py` | Ensure all numerical values in `predict_single` and SHAP dictionaries are converted to standard Python `float`/`int` and NaNs converted to `None`. | None. Guarantees 100% standard JSON compliance. |
| **F-05** | Missing parameter validation on `:userId` parameter in Express churn routes. | **Low** | `LumaWear-Ecommerce/backend/src/server.js` | Add validation rejecting empty or whitespace-only user IDs with HTTP 400. | None. Prevents unnecessary database and proxy lookups for empty queries. |
| **F-06** | FastAPI `/predict/live-customer` error mapping for upstream network errors. | **Low** | `ChurnProject/backend/main.py` | Distinguish between 404 (customer not found) and 503 (database/service unavailable) cleanly. | None. Improves error clarity in admin dashboard. |
| **F-07** | Production build optimization warnings for Tailwind / Vite. | **Low** | `LumaWear-Ecommerce/frontend/vite.config.js` | Maintain clean Vite build without breaking existing React plugins. | None. Build already succeeds in 3.74s. |

---

## Detailed Evaluation by Subsystem

### 1. Express Backend (`LumaWear-Ecommerce/backend/src/server.js`)
- **Authentication & Authorization**: `authenticate` and `requireAdmin` middlewares properly guard `/api/churn/predict/:userId` and `/api/admin/*`.
- **Feature Extraction Route**: `GET /api/churn/customer-features/:userId` accurately pulls User, Activity, and Order documents and feeds them to `extractCustomerFeatures`.
- **Secrets Management**: JWT secrets and Mongo connection strings are loaded via `dotenv`. No raw credentials leaked.

### 2. FastAPI Inference Engine (`ChurnProject/backend/`)
- **Pydantic Schemas**: `LumaWearCustomerInput` and `PredictionResponse` enforce structural types and sensible optional defaults.
- **Model Invariance**: The active model artifact `artifacts/2b2147fd4057` is loaded read-only via joblib with caching.
- **Explainability**: SHAP explanations utilize the serialized `TreeExplainer` for XGBoost without recomputing backgrounds.

### 3. Frontend Admin Dashboard (`LumaWear-Ecommerce/frontend/`)
- **Security**: The frontend never connects directly to FastAPI port 8000; all inference is proxied through the authenticated Express backend on port 4000.
- **Visual Design**: The `ChurnPredictionModal` adheres strictly to the existing LumaWear cream/charcoal/sand design system.
- **State Handling**: Comprehensive loading skeletons, error alerts with retry triggers, and safe fallbacks for missing/sparse features.
