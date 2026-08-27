# 🎬 Phase 12 Demo Guide — Retention Effectiveness & Experiment Analytics

This guide provides a structured 3–5 minute presentation script for demonstrating **Phase 12: Retention Effectiveness & Experiment Analytics**.

---

## ⏱️ Live Presentation Script (Step-by-Step)

| Step | Action & UI View | Speaking Script |
| :--- | :--- | :--- |
| **1. Business Context** | Navigate to `/admin` dashboard | *"In predictive churn, predicting risk is only half the battle. Phase 12 answers the million-dollar business question: **'How can the store measure whether our retention interventions actually reduced customer churn and saved revenue?'**"* |
| **2. Navigate to Effectiveness Tab** | Click the **'📈 Retention Effectiveness'** navigation tab | *"Here in the Retention Effectiveness console, we provide an executive analytics overview across all staged, sent, and completed retention campaigns."* |
| **3. Highlight Executive Summary** | Point to **Executive KPI Cards** | *"We see our aggregate performance: total campaigns, total targeted accounts, customers with observed risk reduction, and our overall portfolio average risk reduction."* |
| **4. Campaign Comparison Table** | Scroll through the **Campaign Comparison Table** | *"Each campaign row tracks its target cohort, comparing baseline churn probability at campaign creation against current live churn probability, computing the exact longitudinal risk change."* |
| **5. Expand Campaign Targets** | Click **'View Targets ▼'** on a campaign row | *"When we expand a campaign, we see each individual customer in the cohort with their baseline probability, latest probability, and individual risk trajectory."* |
| **6. Before vs. After Customer Analysis** | Click **'📈 Risk Movement'** on a customer | *"Clicking 'Risk Movement' opens our **Risk Movement Modal**. Here we inspect a clean Before vs. After comparison showing their initial risk and SHAP driver alongside their latest risk score, probability delta, risk transition (e.g. High → Low), and chronological snapshot timeline."* |
| **7. A/B Experiment Simulator** | Click the **'🧪 A/B Experiment Simulator'** sub-tab | *"Because observational data alone cannot prove causality due to customer self-recovery, we built an **A/B Experiment Simulator**. Admins can configure treatment and control group sizes, baseline vs. treatment conversion rates, and campaign costs to project true causal incremental lift and experimental ROI."* |
| **8. Financial ROI Calculator** | Click the **'💰 ROI Scenario Calculator'** sub-tab | *"Finally, our **Financial ROI Scenario Planner** allows finance leaders to model budget requirements, expected customer recovery rates, and projected revenue return."* |

---

## 🏆 Key Interview Talking Points

1. **Observational vs. Causal Attribution**: We explicitly differentiate between observational model risk drops and causal incremental lift measured through randomized A/B holdouts.
2. **Prediction Snapshots**: The dedicated `churn_prediction_snapshots` collection provides immutable historical telemetry snapshots without polluting operational ecommerce collections.
3. **End-to-End Churn Intelligence Lifecycle**: The system connects the entire journey from **MongoDB Raw Data $\rightarrow$ Live XGBoost Scoring $\rightarrow$ SHAP Attribution $\rightarrow$ Portfolio Analytics $\rightarrow$ Retention Action Center $\rightarrow$ Business Impact $\rightarrow$ Customer 360 $\rightarrow$ MLOps Monitoring $\rightarrow$ Effectiveness Analytics**.
