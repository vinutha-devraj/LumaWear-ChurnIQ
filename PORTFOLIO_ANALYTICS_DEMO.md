# Portfolio Churn Risk Analytics — Interview & Demo Playbook

This playbook provides an exact, step-by-step walkthrough script for demonstrating **Phase 8: Portfolio-Wide Churn Risk Analytics** in LumaWear + ChurnIQ to engineering leads, stakeholders, or technical interviewers.

---

## 1. 30-Second Elevator Pitch

> *"In Phases 1 through 7, we built an end-to-end Machine Learning intelligence engine that predicts 90-day churn risk, computes SHAP feature attributions, and generates personalized retention actions for individual customers.
>
> In Phase 8, we scaled this intelligence from customer-level inspection to **portfolio-wide risk governance**. Store administrators can now assess aggregate churn risk exposure across all active customers, analyze risk distribution across 4 tiers, discover systemic churn drivers via aggregated SHAP attributions, and drill down seamlessly from macro risk into individual customer telemetry—all powered strictly by live MongoDB data and our active XGBoost model (`2b2147fd4057`)."*

---

## 2. Step-by-Step Live Demo Flow

### Step 1: Navigating to the Admin Console
- **Action**: Sign in as `admin@lumawear.local` and navigate to `/admin`.
- **Talking Point**:
  > *"Notice the live status badge at the top: **'Live MongoDB + XGBoost (2b2147fd4057)'**. The admin interface never communicates directly with the Python ML port 8000. Instead, all requests route through our authenticated Node/Express proxy, enforcing strict role-based access control (RBAC)."*

### Step 2: Risk Summary Cards (Feature 1)
- **Visual**: Point out the 4 summary metrics:
  1. **Total Customers**: Scored vs. failed breakdown.
  2. **Average Churn Probability**: Continuous portfolio-wide mean risk.
  3. **High-Risk Customers**: Count of customers in High + Very High risk brackets.
  4. **High-Risk Share**: Percentage of the total customer base requiring immediate retention action.
- **Talking Point**:
  > *"These metrics are computed on the fly from live customer orders, sessions, and activity streams. We do not use hardcoded numbers or synthetic CSV caches for live intelligence."*

### Step 3: Interactive Risk Distribution (Feature 2)
- **Visual**: Show the proportional risk distribution bar (Emerald $\rightarrow$ Amber $\rightarrow$ Orange $\rightarrow$ Rose) and the 4 risk tier tiles.
- **Action**: Click the **'High Risk'** tile or **'Very High Risk'** tile.
- **Talking Point**:
  > *"The distribution cards are fully interactive. When I click 'High Risk', the customer roster below immediately filters to only show customers with churn probabilities between 50% and 75%. If I click 'Focus All High & Critical Customers', it highlights all customers at &ge; 50% risk."*

### Step 4: Top Aggregated Churn Drivers (Feature 4)
- **Visual**: Inspect the ranked list of top churn drivers.
- **Talking Point**:
  > *"Rather than guessing why customers leave, we aggregate the absolute SHAP attribution values across all scored customers. We see features like `activity_event_count_30d`, `days_since_last_activity`, and `days_since_last_login` ranking as top drivers.
  >
  > Crucially, we include a clear disclaimer: this represents model attribution across historical representations, not causal proof. We avoid making unsubstantiated causal claims in our ML interfaces."*

### Step 5: Recommended Retention Priorities (Feature 8)
- **Visual**: Highlight the Business Action Panel cards (High, Medium, Low priority retention action clusters).
- **Talking Point**:
  > *"We synthesize model outputs into actionable business playbooks—showing how many customers have abandoned carts, how many require win-back campaigns, and how many high-value VIP customers need retention perks."*

### Step 6: Portfolio $\rightarrow$ Individual Drill-Down (Feature 9)
- **Action**: In the filtered High-Risk customer table, search for a customer or pick a high-risk row. Click **'⚡ Analyze Risk'**.
- **Visual**: The existing `ChurnPredictionModal` pops up smoothly.
- **Talking Point**:
  > *"Here is the complete drill-down: from a macro portfolio overview, down to a filtered high-risk cohort, down to an individual customer modal showing their exact 21 point-in-time features, SHAP waterfall chart, 90-day risk horizon, and tailored retention actions."*

---

## 3. High-Frequency Interview Questions & Answers

### Q1: How did you solve the performance problem of scoring hundreds of customers?
> **Answer**:
> *"We avoided two major anti-patterns:
> 1. **No N+1 database queries**: We fetch all customer activities and orders using batched `$in: userIds` queries in MongoDB (2 queries total) and group them in memory.
> 2. **No N+1 HTTP roundtrips**: Rather than having Express make separate HTTP calls per customer to FastAPI, we added a vectorized `POST /predict/batch` endpoint. It converts all customer feature dicts into a single DataFrame and executes XGBoost matrix inference and SHAP attribution in a single vectorized pass (< 80ms for 100 customers)."*

### Q2: How does the system handle service outages (e.g. if FastAPI crashes)?
> **Answer**:
> *"The Express proxy uses an `AbortController` with a 10-second deadline. If FastAPI is offline or times out, Express returns a clean `503 Service Unavailable` with `service_status: 'offline'`. The frontend displays a friendly warning with a 'Retry Analysis' button, while the core admin functionalities (user accounts list, live site activity stream) remain completely operational without leaking stack traces or internal paths."*

### Q3: Did you retrain or modify the machine learning model for Phase 8?
> **Answer**:
> *"No. The active model artifact remains strictly `2b2147fd4057`. Model integrity is paramount: the 21-feature contract, preprocessing pipeline, and model weights are completely unchanged. Phase 8 solely extends the operational intelligence and aggregation layer."*
