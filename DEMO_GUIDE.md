# LumaWear ChurnIQ — Demonstration & Operations Guide

This guide details how to launch all services and demonstrate real-time AI customer churn prediction on the LumaWear e-commerce platform.

---

## 1. Startup Commands

Open 3 terminal windows to launch all subsystems:

### Terminal 1: LumaWear Express Backend (:4000)
```bash
cd LumaWear-Ecommerce/backend
node src/server.js
```
*(Ensure MongoDB is running locally on `mongodb://127.0.0.1:27017/lumawear`)*

### Terminal 2: ChurnIQ Python FastAPI Engine (:8000)
```bash
cd ChurnProject
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### Terminal 3: LumaWear React Storefront (:5173)
```bash
cd LumaWear-Ecommerce/frontend
npm run dev
```

---

## 2. Live Demonstration Flow

### Step 1: Sign in as Administrator
1. Open browser to `http://localhost:5173/sign-in`.
2. Enter admin credentials:
   - **Email**: `admin@lumawear.local` (or `shivin412@gmail.com`)
   - **Password**: `ChangeMe123!` (or `Shivin@123`)
3. Redirects to storefront; open `http://localhost:5173/admin`.

### Step 2: View Customer Accounts & Site Activity
1. The **Admin Dashboard** displays all registered customer accounts and real-time behavioral streams.
2. Locate customer `shivin1418@gmail.com`.

### Step 3: Analyze Customer Churn Risk
1. Click the **"⚡ Analyze Risk"** action button next to the customer.
2. The **Customer Churn Risk Analysis Modal** opens with live inference data:
   - **Churn Probability**: `5.37%` (Continuous probability: `0.0537`)
   - **Risk Classification**: `Low Risk` (Visual emerald badge)
   - **Retention Timeline**: `"Low near-term churn risk"` (90-day horizon)
   - **SHAP Key Drivers**:
     - `30-Day Activity Events` ($\downarrow$ Reduces Churn: `-0.7671`)
     - `Order Frequency` ($\downarrow$ Reduces Churn: `-0.4409`)
     - `Account Tenure` ($\downarrow$ Reduces Churn: `-0.3222`)
   - **Personalized Recommendations**:
     - `[High Priority]` Cart abandonment reminder (4 cart actions with 0 orders).
     - `[Medium Priority]` New customer onboarding journey (5-day tenure).
   - **Live MongoDB Signals**: Displays all 21 raw point-in-time features.

### Step 4: Demonstrate On-Demand Search
1. In the top-right search bar, type the MongoDB User ID or email of any customer and click **"🔍 Analyze Risk"**.
2. The modal instantly retrieves and scores the requested customer.
