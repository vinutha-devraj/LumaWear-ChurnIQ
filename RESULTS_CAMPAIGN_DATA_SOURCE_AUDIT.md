# Forensic Data-Source & UI Consistency Audit: Churn Results & Campaign History

**Audit Date:** August 27, 2026  
**Target Environment:** LumaWear-Ecommerce Admin Dashboard + ChurnProject Pipeline  
**Database Host:** `127.0.0.1:27017`  
**Database Name:** `lumawear`  
**Audit Type:** **100% READ-ONLY FORENSIC INVESTIGATION**

---

## 1. Executive Summary & Root Cause Findings

```
========================================================================================
 ROOT CAUSE CONFIRMED:
 1. WHY RESULTS SHOWS 52/54 CUSTOMERS:
    - The "Total Customers Targeted" KPI on the Results page does NOT count users in 
      the `users` collection.
    - Instead, it aggregates historical `targetCustomerIds` embedded within all documents 
      in the `campaigns` collection (`server.js` line 1694: `allTargetUserIds.add(cid)`).
    - The `campaigns` collection contains 69 leftover test fixture campaigns from historical
      test suite executions that embedded the IDs of the 50 deleted test users.
    - 50 historical test customer IDs + 2 real customer IDs = 52 unique target customer IDs.

 2. WHY CAMPAIGN HISTORY SHOWS 71 CAMPAIGNS:
    - The `campaigns` collection in MongoDB contains 71 total documents:
      * 2 Legitimate Production Campaigns (Created by store admins)
      * 50 Historical Test Campaigns (Created by past runs of `retention.test.js`)
      * 18 Historical Test Campaigns (Created by past runs of `retentionEffectiveness.test.js`)
      * 1 Historical Test Campaign (Created by an earlier run of `results.test.js`)
    - The endpoint `GET /api/churn/campaigns` performs `Campaign.find({})` and returns all 71 documents.

 3. ZERO DATABASE MISMATCH & ZERO FRONTEND CACHE CORRUPTION:
    - The frontend is NOT using hardcoded mock data, CSV files, or stale `localStorage`.
    - Both frontend, backend, and CLI tools connect to the EXACT SAME MongoDB database (`lumawear`).
    - The count differences are 100% explained by the 69 test campaign documents in MongoDB.
========================================================================================
```

---

## 2. Authoritative Database Counts & Legitimate Customer Accounts

### MongoDB Collections State:
- **Total Users (`users`):** **4**
- **Admin Users:** **2** (`admin@lumawear.local`, `shivin412@gmail.com`)
- **Legitimate Customer Accounts:** **2**
  1. `shivu shivu` — `ID: 6a8704de95bfe658bec9dc05` (Created: `2026-08-20T13:45:02.160Z`)
  2. `shashi dj` — `ID: 6a8e91d0757ba1c728e8caaf` (Created: `2026-08-26T07:12:16.286Z`)
- **Retention Test Fixture Users in DB:** **0** (All purged during previous remediation)
- **Orders (`orders`):** **2**
- **Snapshots (`churn_prediction_snapshots`):** **0**
- **Campaigns (`campaigns`):** **71**

---

## 3. Results Endpoint Tracing & Customer Count Semantics

### Data Flow for Results:
```
MongoDB `campaigns` collection (71 documents)
        ↓
Express Endpoint: `GET /api/churn/results` (`server.js` lines 1671–2045)
        ↓
Function: `calculateCampaignResultsPayload()`
        - Reads all 71 campaign documents
        - Aggregates `c.targetCustomerIds` into `allTargetUserIds` Set (Size = 52)
        - Computes `summary.totalCustomersTargeted: 52`
        ↓
React Component: `ResultsDashboard.jsx` (lines 46–54, rendered in KPI card)
        ↓
UI Displays: "Total Customers Targeted: 52" & 71 Campaign Result Cards
```

### Why does the UI show 52/54 instead of 2?
The UI label **"Total Customers Targeted"** on the Results page represents the **cumulative total of distinct customers ever targeted across all historical campaigns**, not the current active user population.

Because 69 test campaigns in MongoDB still contain historical references to the 50 test users generated in previous test runs, `allTargetUserIds.size` evaluates to **52** ($50 \text{ test target IDs} + 2 \text{ real customer IDs}$).

In contrast:
- The **"Churn Risk Analytics"** tab calls `GET /api/churn/portfolio-summary` and displays **Total Customers: 2** (queried from `users`).
- The **"Customer Accounts & Activity"** tab calls `GET /api/admin/users` and displays **Total Users: 4** (queried from `users`).

---

## 4. Campaign History Tracing & Breakdown

### Data Flow for Campaign History:
```
MongoDB `campaigns` collection (71 documents)
        ↓
Express Endpoint: `GET /api/churn/campaigns` (`server.js` line 1630)
        - Executes `Campaign.find({}).sort({ createdAt: -1 })`
        ↓
React Component: `RetentionAndCampaignsView.jsx` (lines 71–88)
        - Receives `res.campaigns` (71 items)
        ↓
UI Displays: 71 campaign rows in the Campaign History table
```

### Complete Breakdown of the 71 Campaigns in MongoDB:

| Category | Campaign Name | Count | Origin / Source | Target Customers | Status in DB |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Legitimate** | `Cart Abandonment Recovery Campaign` | **1** | Admin manual creation | `shashi dj` | `CANCELLED` |
| **Legitimate** | `Wishlist Follow-up Campaign` | **1** | Admin manual creation | `shashi dj`, `shivu shivu` | `SENT` |
| **Test Artifact** | `Q3 Abandoned Cart Win-Back` | **25** | `retention.test.js` (past runs) | `Retention Customer One`, `Two` | `COMPLETED` |
| **Test Artifact** | `Cancelled Campaign Test` | **25** | `retention.test.js` (past runs) | `Retention Customer One` | `CANCELLED` |
| **Test Artifact** | `Effectiveness Test Campaign` | **18** | `retentionEffectiveness.test.js` | `testCustomerUser` | `PLANNED` / `SENT` |
| **Test Artifact** | `Results Test Campaign 1787808970045` | **1** | `results.test.js` (earlier run) | `testCustomerUser` | `PLANNED` |
| **TOTAL** | | **71** | | | |

---

## 5. Cache, Static Data, and Database Identity Audit

1. **Database Identity Match:**
   - Express backend (`server.js`): Connected to `mongodb://127.0.0.1:27017/lumawear`.
   - Python FastAPI engine (`main.py`): Connected to `mongodb://127.0.0.1:27017/lumawear`.
   - CLI verification scripts: Connected to `mongodb://127.0.0.1:27017/lumawear`.
   - **Verdict:** ZERO database fragmentation or port mismatch.

2. **Frontend State & Caching:**
   - Grep search for `localStorage`, `sessionStorage`, and static mock data confirmed that `ResultsDashboard.jsx` and `RetentionAndCampaignsView.jsx` do NOT cache or render static mock datasets.
   - All displayed counts are live responses from Express backend routes `/api/churn/results` and `/api/churn/campaigns`.

3. **React Render Duplication:**
   - Inspected `useEffect` and state setting patterns in `ResultsDashboard.jsx` and `RetentionAndCampaignsView.jsx`.
   - State updates use direct replacement (`setData(res)` and `setCampaigns(res.campaigns)`), ruling out array duplication (`[...prev, ...newData]`).

---

## 6. Comprehensive Summary Table

| Dashboard Section / Metric | API Endpoint Queried | Source Collection in MongoDB | Count Returned by API | Count Displayed on UI | Root Cause of Count |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Portfolio Churn Risk** | `GET /api/churn/portfolio-summary` | `users` (`role: 'customer'`) | **2** | **2 Customers** | Matches 2 real customers in MongoDB |
| **Customer Accounts** | `GET /api/admin/users` | `users` (all roles) | **4** | **4 Accounts** | Matches 2 admins + 2 customers |
| **Churn Results (Targets)** | `GET /api/churn/results` | `campaigns.targetCustomerIds` | **52** | **52 Targets** | Distinct target IDs across all 71 campaigns (50 test targets + 2 real) |
| **Churn Results (Campaigns)**| `GET /api/churn/results` | `campaigns` | **71** | **71 Campaigns** | Total campaign documents in MongoDB (69 test + 2 real) |
| **Campaign History** | `GET /api/churn/campaigns` | `campaigns` | **71** | **71 Campaigns** | Total campaign documents in MongoDB (69 test + 2 real) |

---

## 7. Recommended Remediation Strategy (For Future Action)

When authorized to clean up test campaign artifacts and reinforce test hygiene:

### 1. Test Suite Cleanup Hygiene:
- In [`retentionEffectiveness.test.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/retentionEffectiveness.test.js):
  - Add `createdCampaignIds = []` tracking.
  - Delete created campaigns in `test.after()`: `await Campaign.deleteMany({ campaignId: { $in: createdCampaignIds } })`.

### 2. Campaign Collection Fixture Cleanup:
- Execute a targeted deletion of the 69 identified test fixture campaigns matching:
  - `name: { $in: ["Q3 Abandoned Cart Win-Back", "Cancelled Campaign Test", "Effectiveness Test Campaign"] }`
  - `name: /^Results Test Campaign/`
- This will leave exactly the **2 legitimate production campaigns** in MongoDB.
- Once completed:
  - `GET /api/churn/campaigns` will return **2 campaigns**.
  - `GET /api/churn/results` will return **2 campaigns** and **2 total customers targeted**.

---

## 8. Absolute Safety Confirmation

- **No documents were deleted from MongoDB during this audit.**
- **No documents were modified or inserted.**
- **Database counts remain 100% verified and untouched.**
