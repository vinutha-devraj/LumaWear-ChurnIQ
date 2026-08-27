# 🎬 Phase 13 Demo Guide — Demo / Simulation Mode for Complete Risk Coverage

This guide provides a structured 3–5 minute presentation script for demonstrating **Phase 13: Demo / Simulation Mode**.

---

## ⏱️ Live Presentation Script (Step-by-Step)

| Step | Action & UI View | Speaking Script |
| :--- | :--- | :--- |
| **1. Show Live Production Mode** | Navigate to `/admin` dashboard (`📊 Churn Risk Analytics` tab) | *"In our live store, our real customer telemetry is currently populated by active and moderate shoppers who naturally sit in Low and Medium risk tiers."* |
| **2. Explain Production Integrity** | Highlight live numbers (e.g. Low & Medium counts) | *"Rather than artificially distorting risk thresholds or hardcoding fake high probabilities in our database, we built an isolated **Demo / Simulation Mode**."* |
| **3. Toggle to Demo Mode** | Click the **'🧪 Demo Mode'** switch at top right | *"When we switch to Demo Mode, our system sends 12 realistic synthetic customer profiles through our exact same production 21-feature contract and active XGBoost model (`2b2147fd4057`)."* |
| **4. Highlight 4-Tier Coverage** | Point to **Risk Summary Cards & Distribution Meter** | *"Now we see complete coverage across all four risk tiers: Low, Medium, High, and Very High risk. The distribution meter displays the complete risk spectrum."* |
| **5. Drill Down on Demo Customer** | Click **'⚡ Analyze Risk'** on `DEMO-VHIGH-001` (Arthur Pendelton) | *"Clicking 'Analyze Risk' opens our live `ChurnPredictionModal`. Notice that Arthur scored an 88.09% churn probability directly from XGBoost due to 85 days of inactivity and 0 recent events, driving a critical churn timeline."* |
| **6. Show Customer 360 for Demo** | Click **'👤 360°'** on `DEMO-HIGH-003` (Nathan Drake) | *"We can also inspect his complete synthetic Customer 360 profile, viewing his simulated order history, 21-feature telemetry breakdown, and applicable retention clusters."* |
| **7. Demonstrate Safety Guardrails** | Switch to **'💰 Business Impact'** and toggle Demo | *"Our Business Impact view also models revenue-at-risk for the synthetic cohort with prominent disclaimers, while campaign creation is strictly prevented for synthetic accounts to protect production data."* |
| **8. Switch Back to Live Mode** | Click **'🟢 Live Data'** | *"Switching back to Live Data instantly restores our production MongoDB state, proving that live data and model weights were never mutated."* |

---

## 🏆 Key Interview Talking Points

1. **Why Demo Mode?**: Real production datasets naturally exhibit class and risk distributions. We never modify production model thresholds just for visual demonstrations.
2. **Same Production Pipeline**: Demo mode does not use hardcoded probabilities. It generates realistic feature vectors and scores them live through FastAPI `POST /predict/batch`.
3. **Strict Isolation**: Production MongoDB collections (`users`, `orders`, `activities`, `campaigns`) remain 100% untouched.
