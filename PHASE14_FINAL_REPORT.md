# Phase 14 Final Engineering Report: Admin Dashboard Reorganization & Real Before vs. After Results

**Document Version:** 1.0.0  
**Phase:** Phase 14 – Dashboard Simplification, Retention/Campaign Merger & Real Observational Results  
**Active ML Model ID:** `2b2147fd4057` (XGBoost Classifier with ROC-AUC 0.837)  
**Feature Contract:** 21 Native LumaWear E-Commerce Features (Unchanged)  
**Database Isolation:** Strictly Enforced (`users`, `orders`, `activities` Read-Only for Analytics)

---

## 1. Executive Summary

Phase 14 reorganizes and simplifies the Admin Dashboard into **exactly 5 top-level pages**, merges the Retention Action Center and Campaign History into a unified operational hub, removes redundant roster tables from Churn Risk Analytics, and converts the Results view into an evidence-based, longitudinal **Before vs. After Analysis Engine** powered by live MongoDB customer data and active XGBoost scoring via FastAPI.

### Key Architectural Transformations
1. **Simplified 5-Tab Navigation**:
   - `📊 Churn Risk Analytics` (`analytics`)
   - `🎯 Retention & Campaign History` (`retention_campaigns`)
   - `👥 Customer Accounts & Activity` (`store_data`)
   - `🩺 Model Health` (`model_health`)
   - `📈 Results` (`results`)
2. **Removed Navigation Items**:
   - `💰 Business Impact` removed from primary navigation (backend APIs preserved for system dependencies).
   - Separate `Retention Action Center` and `Campaign History` merged into one unified component (`RetentionAndCampaignsView.jsx`).
   - `Retention Effectiveness` replaced by `Results` (`ResultsDashboard.jsx`).
3. **Cleaned Up Churn Risk Analytics**:
   - Removed *Recommended Retention Priorities* and *Customer Risk Roster* completely from UI.
   - Preserved portfolio-level KPIs, 4-tier risk distributions, Fast Customer Lookup, Demo Mode toggle, and Top SHAP churn drivers.
   - Cleaned up obsolete sorting/filtering/pagination states and calculations without leaving empty containers.
4. **Real Before vs. After Results Engine**:
   - **BEFORE**: Uses historical baseline prediction snapshots (`ChurnPredictionSnapshot` / `campaign.targetCustomers`) captured at campaign creation time (strictly immutable, never overwritten). Reconstructs historical customer behavior as of `campaign.createdAt`.
   - **AFTER**: Reads latest user, order, and activity records from MongoDB, extracts the exact 21 features at `asOfDate = new Date()`, scores them through the active FastAPI XGBoost service (`2b2147fd4057`), and computes latest behavioral metrics.
   - **OBSERVED CHANGE**: Evaluates risk change in **percentage points** (`riskChange = before - after`), tracks risk tier transitions (`Very High → Medium`), and computes behavioral deltas (Spend, Orders, Recency).
   - **MANDATORY DISCLAIMER**: Displays prominent non-causal disclaimer on the Results page.

---

## 2. API Design & Data Pipeline Architecture

### End-to-End Results Flow
```
React Results Dashboard (GET /api/churn/results)
             │
             ▼
Node.js / Express Backend
             │
             ├─ 1. Query real campaigns & baseline snapshots from MongoDB (Campaign & ChurnPredictionSnapshot)
             ├─ 2. Query latest User, Order, Activity records from MongoDB
             ├─ 3. Reconstruct BEFORE behavior at asOfDate: campaign.createdAt
             ├─ 4. Compute LATEST 21 features at asOfDate: new Date() via extractCustomerFeatures()
             │
             ▼
HTTP POST /predict/batch (FastAPI REST Service)
             │
             ├─ 5. Active XGBoost Pipeline (2b2147fd4057)
             ├─ 6. Returns latest churn_probability, risk_level, and SHAP top drivers
             │
             ▼
Node.js Result Aggregation
             │
             ├─ 7. Compute riskChange = (beforeProbability - afterProbability)
             ├─ 8. Compute percentagePoints = (beforeProbability - afterProbability) * 100
             ├─ 9. Compute riskTransition (e.g., "Very High → Medium")
             ├─ 10. Classify status: "Reduced" (delta > +0.01), "Increased" (delta < -0.01), "Unchanged"
             ├─ 11. Compute behavioral metrics: orderDelta, spendDelta, recency deltas
             ├─ 12. Aggregate executive KPI summaries and attach mandatory disclaimer
             │
             ▼
React Results Dashboard (Render summary cards, campaign comparison table, and customer before-vs-after cards)
```

### API Endpoint Specification
- **`GET /api/churn/results`**:
  - **Auth**: Bearer JWT (Admin role required).
  - **Response Payload**:
    ```json
    {
      "success": true,
      "disclaimer": "Results show observed changes in customer behavior and predicted churn risk between the campaign baseline and the latest available customer state. A reduction in predicted churn risk does not by itself prove that the campaign caused the improvement.",
      "summary": {
        "totalCampaigns": 4,
        "totalCustomersTargeted": 12,
        "customersWithReducedRisk": 8,
        "customersWithIncreasedRisk": 2,
        "customersWithUnchangedRisk": 2,
        "averageRiskChange": 0.145,
        "bestPerformingCampaign": { ... }
      },
      "campaigns": [
        {
          "campaignId": "CAMP-1724738491-A1B2C3",
          "name": "Cart Abandonment Recovery",
          "campaignType": "cart_abandonment",
          "priority": "High",
          "status": "SENT",
          "createdAt": "2026-08-20T10:00:00.000Z",
          "targetCustomerCount": 3,
          "averageBaselineChurnProbability": 0.76,
          "averageLatestChurnProbability": 0.42,
          "averageRiskChange": 0.34,
          "customersWithReducedRisk": 2,
          "customersWithIncreasedRisk": 0,
          "customersWithUnchangedRisk": 1,
          "effectiveReductionPercentage": 66.7,
          "customers": [
            {
              "userId": "64f1b2c3d4e5f6a7b8c9d0e1",
              "name": "Rahul Sharma",
              "email": "rahul@example.com",
              "before": {
                "churnProbability": 0.76,
                "riskLevel": "Very High",
                "topDriver": "30-Day Activity Events",
                "orderCount": 2,
                "totalSpend": 5000,
                "daysSinceLastOrder": 60,
                "daysSinceLastActivity": 40
              },
              "after": {
                "churnProbability": 0.42,
                "riskLevel": "Medium",
                "topDriver": "30-Day Activity Events",
                "orderCount": 3,
                "totalSpend": 7500,
                "daysSinceLastOrder": 5,
                "daysSinceLastActivity": 1
              },
              "change": {
                "probabilityChange": 0.34,
                "percentagePoints": 34.0,
                "riskTierTransition": "Very High → Medium",
                "status": "Reduced",
                "orderDelta": 1,
                "spendDelta": 2500,
                "daysSinceOrderDelta": -55,
                "daysSinceActivityDelta": -39
              }
            }
          ]
        }
      ]
    }
    ```

---

## 3. Verification & Test Execution Results

| Test Suite | Scope / Components Tested | Status | Result |
| :--- | :--- | :--- | :--- |
| **Node Backend Tests** | 90 test cases (`results.test.js`, `retentionEffectiveness.test.js`, `modelHealth.test.js`, `portfolio.test.js`, `customer360.test.js`, `businessImpact.test.js`, `demoMode.test.js`, `features.test.js`, etc.) | ✅ PASS | 90 / 90 passed (0 failed) |
| **Vite Frontend Build** | Production bundling, tree-shaking, JSX validation, CSS asset generation | ✅ PASS | Built in 1.49s (0 errors) |
| **Python Batch Suite** | Vectorized scoring across customer batches, active model integrity | ✅ PASS | 5 / 5 passed |
| **Python Inference Suite** | 21-feature contract, 4-tier risk classification, SHAP explanations | ✅ PASS | 9 / 9 passed |
| **Python Security Suite** | Schema validation, sparse features, OHE handling, model directory integrity | ✅ PASS | 8 / 8 passed |

---

## 4. Integrity Confirmations

1. **ML Model Integrity**:
   - Model artifact `2b2147fd4057` was not retrained, modified, or altered in weights.
   - FastAPI model loading and SHAP TreeExplainer remain intact.
2. **21-Feature Contract**:
   - Native 21 features and extraction logic in `extractCustomerFeatures` remain strictly preserved.
3. **Database Read-Only Safety**:
   - `users`, `orders`, and `activities` collections are strictly read-only during analytics.
   - Historical baseline snapshots are preserved upon campaign creation and never overwritten.
4. **Demo Mode Isolation**:
   - Synthetic `DEMO-*` customer profiles are strictly blocked from creating real database campaigns.
