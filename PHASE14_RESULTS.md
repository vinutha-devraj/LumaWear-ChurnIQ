# Phase 14 Results: Before vs. After Campaign Measurement & Methodology

This document details the exact methodology, formulas, data pipelines, and integrity constraints powering the Phase 14 **Results** page.

---

## 1. Methodology & Data Sources

### The Dual-Snapshot Architecture

```
                                 TIME
  Campaign Creation (T0) ─────────────────────────► Results Analysis (T_now)
  ┌───────────────────────────┐                     ┌───────────────────────────┐
  │      BEFORE STATE         │                     │       LATEST STATE        │
  ├───────────────────────────┤                     ├───────────────────────────┤
  │ Baseline Snapshot (DB)    │                     │ Live MongoDB Data         │
  │ • Churn Probability       │                     │ • Current user/orders/act │
  │ • Baseline Risk Tier      │                     │ • 21-Feature Extraction   │
  │ • Historical Spend/Orders │                     │ • FastAPI XGBoost Scoring │
  │   (asOfDate = T0)         │                     │ • Current Spend/Orders    │
  └───────────────────────────┘                     └───────────────────────────┘
                │                                                 │
                └───────────────────────┬─────────────────────────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │       OBSERVED CHANGE       │
                         ├─────────────────────────────┤
                         │ • Probability Delta (pp)    │
                         │ • Risk Tier Transition      │
                         │ • Behavioral Metric Deltas  │
                         └─────────────────────────────┘
```

### A. BEFORE State (Baseline Snapshot)
1. When a campaign is staged in MongoDB, the system captures a **baseline snapshot** (`ChurnPredictionSnapshot` / `campaign.targetCustomers`).
2. The snapshot contains:
   - `campaignId`, `userId`, `churnProbability`, `riskLevel`, `topDriver`, `capturedAt`.
3. Historical behavioral metrics are calculated deterministically using the pure `extractCustomerFeatures` function with `asOfDate: campaign.createdAt`.
4. **Immutability Guarantee**: Once captured, this baseline is never modified or overwritten.

### B. AFTER State (Current Live State)
1. When the Results page is loaded or refreshed:
   - Latest records for target users, orders, and activities are retrieved from MongoDB.
   - Point-in-time features are computed via `extractCustomerFeatures` with `asOfDate: new Date()`.
   - The 21 features are sent via HTTP POST to FastAPI's batch prediction endpoint (`/predict/batch`).
   - The active XGBoost model (`2b2147fd4057`) outputs current continuous churn probability and risk tier.
   - Current spend, order count, and recency are extracted from the latest feature representation.

---

## 2. Mathematical Formulations & Classification Rules

### A. Risk Change (Percentage Points)
$$\Delta P = P_{\text{before}} - P_{\text{latest}}$$
$$\text{Percentage Points} = (P_{\text{before}} - P_{\text{latest}}) \times 100$$

> [!NOTE]
> Positive $\Delta P$ signifies an **observed risk decrease** (improvement), while negative $\Delta P$ indicates an **observed risk increase**.
> We explicitly communicate changes in **percentage points** (e.g. *34.0 percentage points*) rather than relative percentages to avoid ambiguity.

### B. Classification Thresholds
$$\text{Status} = \begin{cases} \text{Reduced}, & \text{if } \Delta P > 0.01 \text{ (+1.0 pp)} \\ \text{Increased}, & \text{if } \Delta P < -0.01 \text{ (-1.0 pp)} \\ \text{Unchanged}, & \text{otherwise (within } \pm 1.0 \text{ pp)} \end{cases}$$

### C. Risk Tier Transitions
Standard 4-tier risk classification boundaries (unchanged):
- **Low Risk**: $P < 0.25$
- **Medium Risk**: $0.25 \le P < 0.50$
- **High Risk**: $0.50 \le P < 0.75$
- **Very High Risk**: $P \ge 0.75$

Example: A customer moving from $P = 0.78$ to $P = 0.42$ displays transition:
$$\text{Very High} \longrightarrow \text{Medium}$$

### D. Behavioral Metric Deltas
- **Order Delta**: $\text{Orders}_{\text{latest}} - \text{Orders}_{\text{before}}$
- **Spend Delta**: $\text{Spend}_{\text{latest}} - \text{Spend}_{\text{before}}$
- **Last Order Recency Delta**: $\text{DaysSinceLastOrder}_{\text{latest}} - \text{DaysSinceLastOrder}_{\text{before}}$
- **Last Activity Recency Delta**: $\text{DaysSinceLastActivity}_{\text{latest}} - \text{DaysSinceLastActivity}_{\text{before}}$

---

## 3. Observational Integrity & Non-Causal Framing

The system strictly avoids misleading causal claims:
- ❌ **Forbidden Claims**: "Campaign caused customer retention", "Guaranteed ROI recovery", "100% prevented churn".
- ✅ **Valid Framing**: "Observed risk reduction", "Observed behavioral change", "Observed transition from Very High to Medium risk".
- **Mandatory Disclaimer**:
  *"Results show observed changes in customer behavior and predicted churn risk between the campaign baseline and the latest available customer state. A reduction in predicted churn risk does not by itself prove that the campaign caused the improvement."*
