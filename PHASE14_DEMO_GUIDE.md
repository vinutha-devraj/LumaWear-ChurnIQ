# Phase 14 Live Demonstration Guide: Simplified Admin Dashboard & Real Before vs. After Results

This step-by-step guide explains how to demonstrate the newly reorganized 5-tab Admin Dashboard and the real longitudinal Before vs. After Results engine.

---

## 1. Starting the Stack

Ensure both backend services and the frontend dev server are active:

```bash
# Terminal 1: FastAPI ChurnIQ Engine (Active model: 2b2147fd4057)
cd ChurnProject
uvicorn backend.main:app --host 127.0.0.1 --port 8000

# Terminal 2: Node.js Express Backend
cd LumaWear-Ecommerce/backend
npm run dev

# Terminal 3: Vite React Frontend
cd LumaWear-Ecommerce/frontend
npm run dev
```

---

## 2. Navigating the 5-Tab Admin Dashboard

Navigate to `http://localhost:5173/admin` and sign in with admin credentials (`admin@lumawear.com` / `Admin@123`).

Observe the **exact 5 tabs** in the top navigation bar:
1. 📊 **Churn Risk Analytics**
2. 🎯 **Retention & Campaign History**
3. 👥 **Customer Accounts & Activity**
4. 🩺 **Model Health**
5. 📈 **Results**

---

## 3. Step-by-Step Feature Walkthrough

### Step A: Churn Risk Analytics
- Note that the UI is clean and uncluttered.
- *Recommended Retention Priorities* and *Customer Risk Roster* have been removed, eliminating redundant tables.
- Observe the **Portfolio Churn Risk Overview**, the 4 KPI summary cards, the **4-Tier Risk Distribution** bar with tier tiles, and the **Top Churn Drivers Across Customers** (SHAP explainability).
- Use the **Fast Customer Lookup** in the top header (`🔍 Inspect`) to search for any customer ID/email and inspect their SHAP waterfall.
- Toggle **🧪 Demo Mode** to review synthetic cohorts across all 4 risk tiers.

### Step B: Retention & Campaign History
- Click on `🎯 Retention & Campaign History`.
- **Section A — Retention Actions**:
  - Browse through the 5 retention action clusters (Cart Abandonment, Inactivity Re-engagement, Wishlist Follow-up, Product Recommendation, VIP Retention).
  - Select one or more target customers using the checkboxes.
  - Click `🚀 Stage Campaign (X Selected)` to open the `CampaignPreviewModal`.
  - Customize the campaign name and message, then click **Create & Stage Campaign**.
  - Notice the success banner confirming campaign creation and isolated snapshot storage.
- **Section C — Campaign History**:
  - Click on the `📜 Campaign History` sub-tab.
  - Review staged campaigns with their priority, status, customer count, and creation date.
  - Transition a campaign from `PLANNED` → `SENT` → `COMPLETED` (or `CANCELLED`).
  - Demonstrate Demo Mode safety: attempting to stage campaigns for `DEMO-*` synthetic accounts is cleanly blocked.

### Step C: Customer Accounts & Activity
- Click on `👥 Customer Accounts & Activity`.
- Verify the registered customer roster and live behavioral activity stream remain fully operational with 360° and instant scoring triggers.

### Step D: Model Health
- Click on `🩺 Model Health`.
- Review the active model (`2b2147fd4057`), 21-feature contract completeness, data quality metrics, PSI data drift monitoring, and live service latencies.

### Step E: Results (Real Before vs. After Intelligence)
- Click on `📈 Results`.
- Observe the **Observational Framework Disclaimer** at the top:
  > *"Results show observed changes in customer behavior and predicted churn risk between the campaign baseline and the latest available customer state. A reduction in predicted churn risk does not by itself prove that the campaign caused the improvement."*
- Review the **6 Summary KPI Cards**:
  - Campaigns Analyzed
  - Customers Analyzed
  - Reduced Risk count & percentage
  - Increased Risk count & percentage
  - Unchanged Risk count & percentage
  - Average Risk Change (in percentage points)
- Review the **Campaign Performance Table**:
  - Compare *Before Avg Risk* against *Latest Avg Risk* and observe the exact percentage point delta (e.g. `-34.0 pp`).
  - Click `View Targets ▼` to expand individual customer drill-downs.
- Inspect the **Individual Customer Comparison**:
  - **BEFORE CAMPAIGN**: Historical Churn Probability, Risk Tier, Spend, Orders, Last Order/Activity recency.
  - **LATEST STATE**: Current live Churn Probability, Risk Tier, Spend, Orders, Last Order/Activity recency.
  - **OBSERVED CHANGE**: Percentage point change (e.g. *"Risk decreased by 34.0 percentage points"*), Risk Tier Transition (`Very High → Medium`), and behavioral deltas.
  - Click `📈 Risk Movement` to open the longitudinal timeline and SHAP explanation modal.
