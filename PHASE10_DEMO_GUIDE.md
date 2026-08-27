# 🎬 Phase 10 Demo Guide — Business Impact & Customer 360°

This guide provides a crisp, confident 3–5 minute live presentation script for demonstrating **Phase 10: Business Impact Analytics & Customer 360° Intelligence**.

---

## ⏱️ Live Demo Walkthrough (Step-by-Step)

| Step | Action & UI View | Speaking Script |
| :--- | :--- | :--- |
| **1. Introduction** | Navigate to `/admin` dashboard | *"Today I'm going to demonstrate how our ChurnIQ platform doesn't just stop at machine learning predictions—it directly translates churn probabilities into **quantified business exposure** and gives store operators a complete **Customer 360 intelligence view**."* |
| **2. Business Impact Tab** | Click on the **'💰 Business Impact'** navigation tab | *"Here in the Business Impact console, we answer the primary executive question: **'How much customer value is currently exposed to churn?'** Rather than making ungrounded future revenue claims, we compute an analytical exposure metric: historical spend multiplied by the continuous XGBoost churn probability."* |
| **3. Executive KPI Cards** | Point to the 5 top summary cards | *"Across our customer portfolio, we see our Total Customer Lifetime Value ($24.8k), the Estimated Revenue at Risk ($8.4k or 33.8% of portfolio spend), the count of High-Risk customers, and our Average Spend per at-risk customer ($889)."* |
| **4. Risk Tier Matrix** | Highlight the **Revenue Exposure by Risk Tier** bar and cards | *"Notice our visual revenue breakdown: while Low Risk customers account for only 7.6% of risk exposure, High and Very High risk customers represent over 80% of our exposed customer value. This immediately shows marketing where to focus their retention budget."* |
| **5. Top Value-at-Risk Table** | Scroll down to **Highest Value-at-Risk Customers** | *"Our table ranks individual customers by their exact revenue exposure. For each customer, we see their lifetime spend, predicted churn percentage, primary SHAP driver, and recommended action."* |
| **6. Open Customer 360** | Click **'👤 360°'** on the top at-risk customer | *"When I click '👤 360°', notice the responsive CRM modal that opens. In a single parallel query, Express pulls their profile, risk scorecard, business metrics, and complete history."* |
| **7. Customer Journey** | Click the **'🧭 Customer Journey'** tab | *"In the Customer Journey tab, our system reconstructs their chronological milestones directly from real MongoDB timestamps—from their initial registration to product browsing, cart additions, first and latest purchases, up to their current churn risk level."* |
| **8. 21-Feature Telemetry** | Click the **'🔬 21-Feature Telemetry'** tab | *"Here we display all 21 raw behavioral features passed to our XGBoost pipeline—grouped into Engagement, Purchasing, and Profile categories with human-readable labels."* |
| **9. Orders & Activity Tabs** | Switch between **'🛍️ Order History'** and **'⚡ Activity Log'** | *"Store operators can inspect their historical order ledger and live behavioral event stream—all completely read-only to preserve transactional database integrity."* |
| **10. Seamless Actions** | Click **'⚡ Analyze Risk'** or **'🎯 Stage Campaign'** | *"From within Customer 360, admins can launch our single-customer SHAP explainability waterfall (`ChurnPredictionModal`) or stage a simulated retention campaign (`CampaignPreviewModal`) with this customer preselected."* |

---

## 🏆 Key Interview Talking Points

1. **Why Revenue at Risk is an Estimate**: We explicitly state that historical spend $\times$ churn probability is an analytical exposure metric, not a guaranteed future revenue forecast.
2. **Performance Optimization**: `GET /api/churn/business-impact` uses a single bulk query and batch matrix inference (`POST /predict/batch`) to score the entire portfolio without N+1 queries.
3. **Immutability & Security**: All customer accounts (`users`), `orders`, and `activities` collections are strictly read-only; admin authorization is strictly enforced via JWT and role-based middleware.
