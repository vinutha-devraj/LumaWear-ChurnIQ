# Forensic Investigation & Architectural Audit: Stage Campaign & Results Synchronization

**Audit Date:** August 27, 2026  
**System:** LumaWear-Ecommerce Admin Dashboard + ChurnProject Pipeline  
**Investigation Mode:** **100% READ-ONLY DIAGNOSTIC AUDIT**  
**Database Host:** `127.0.0.1:27017`  
**Database Name:** `lumawear`  
**Root Cause Status:** **DEFINITIVE ROOT CAUSE IDENTIFIED & PROVEN**

---

## 1. Executive Summary & Definitive Root Cause

```
========================================================================================
 ROOT CAUSE CLASSIFICATION: [A] FRONTEND BUG + [D] PROP CONTRACT MISMATCH
 
 1. WHY STAGE CAMPAIGN WAS NOT WORKING:
    In `RetentionAndCampaignsView.jsx` (lines 829–835) and `AdminDashboardPage.jsx` 
    (lines 800–817), `<CampaignPreviewModal />` was invoked with mismatched prop names:
      - `cluster={...}`         instead of `activeCluster={...}`
      - `customers={...}`       instead of `selectedCustomers={...}`
      - `onSuccess={...}`       instead of `onCampaignCreated={...}`
      - Missing `isOpen={true}`

    Inside `CampaignPreviewModal.jsx` (line 17):
      `if (!isOpen || !activeCluster) return null;`
    Because `isOpen` and `activeCluster` were `undefined`, the modal evaluated `!isOpen`
    as true and immediately returned `null`.
    
    Result: Clicking "Stage Campaign" NEVER rendered the modal to the DOM.
    Consequently, `handleSubmit` was never invoked, `POST /api/churn/campaigns` was
    never executed, and NO campaign document was ever inserted into MongoDB.

 2. WHY THE STAGED CAMPAIGN WAS NOT APPEARING ON THE RESULTS PAGE:
    Because the staging request was never sent to the backend due to the frontend prop 
    mismatch, MongoDB never received a new campaign record.
    When navigating to the Results tab, `GET /api/churn/results` queried MongoDB and 
    truthfully returned only the 2 existing legitimate production campaigns.
========================================================================================
```

---

## 2. End-to-End Data Flow & Lifecycle Tracing

### Complete Staging Flow (Frontend $\rightarrow$ Backend $\rightarrow$ MongoDB $\rightarrow$ Results API):
```
1. Admin clicks "Stage Campaign" in Retention Workspace (`RetentionAndCampaignsView.jsx`)
         ↓
2. `setIsPreviewOpen(true)` triggered
         ↓
3. `<CampaignPreviewModal />` renders (FAILED: Blocked by prop mismatch `!isOpen || !activeCluster`)
         ↓ [WHEN PROPS ALIGNED]
4. Admin reviews recommended copy & targeted customers, clicks "Confirm & Stage Campaign"
         ↓
5. `POST /api/churn/campaigns` sent with `{ name, campaignType, priority, targetCustomerIds, ... }`
         ↓
6. Express Backend (`server.js` lines 1462–1595):
         - Authenticates admin JWT
         - Validates campaignType, priority, and targetCustomerIds against MongoDB `users`
         - Generates unique ID: `CAMP-<timestamp>-<hex>`
         - Persists to MongoDB `campaigns` with `status: "PLANNED"`
         - Inserts baseline analytical snapshot into `churn_prediction_snapshots`
         - Responds with `201 Created` and `{ success: true, campaign }`
         ↓
7. Frontend closes modal, refreshes Campaign History (`GET /api/churn/campaigns`)
         ↓
8. Admin switches to "Results" tab (`ResultsDashboard.jsx`)
         ↓
9. `GET /api/churn/results` calls `calculateCampaignResultsPayload()`:
         - Reads all campaigns in MongoDB (including new `PLANNED` campaign)
         - Vectorized scoring via FastAPI XGBoost model `2b2147fd4057`
         - Calculates baseline vs live probability delta & risk transitions
         - Returns summary and evaluated campaigns to `ResultsDashboard`
```

---

## 3. Detailed Component & Prop Contract Comparison

### Calling Site in [`RetentionAndCampaignsView.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/components/RetentionAndCampaignsView.jsx) (Lines 828–835):
```jsx
{/* BROKEN: Prop names do not match CampaignPreviewModal declaration */}
{isPreviewOpen && activeCluster && (
  <CampaignPreviewModal
    cluster={activeCluster}
    customers={getSelectedCustomerObjects()}
    onClose={() => setIsPreviewOpen(false)}
    onSuccess={handleCampaignCreated}
  />
)}
```

### Calling Site in [`AdminDashboardPage.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/pages/AdminDashboardPage.jsx) (Lines 800–818):
```jsx
{/* BROKEN: Prop names do not match CampaignPreviewModal declaration */}
{stagedCampaignTarget && (
  <CampaignPreviewModal
    cluster={{ ... }}
    customers={[stagedCampaignTarget]}
    onClose={() => setStagedCampaignTarget(null)}
    onSuccess={() => { ... }}
  />
)}
```

### Component Definition in [`CampaignPreviewModal.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/components/CampaignPreviewModal.jsx) (Lines 4–17):
```javascript
export default function CampaignPreviewModal({
  isOpen,                     // EXPECTED: boolean
  onClose,                    // MATCHED
  activeCluster,              // EXPECTED: object (Caller passed 'cluster')
  selectedCustomers = [],     // EXPECTED: array  (Caller passed 'customers')
  onCampaignCreated,          // EXPECTED: func   (Caller passed 'onSuccess')
}) {
  ...
  if (!isOpen || !activeCluster) return null; // ❌ FAILS: isOpen is undefined, activeCluster is undefined
```

---

## 4. Campaign Status Transition Rules in Backend

In `server.js` (lines 1614–1660), the campaign lifecycle is strictly governed by `PATCH /api/churn/campaigns/:campaignId/status`:

```
                 ┌───────────────┐
                 │    PLANNED    │  (Initial status upon staging)
                 └───────┬───────┘
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      ┌─────────────┐         ┌─────────────┐
      │    SENT     │         │  CANCELLED  │ (Terminal)
      └──────┬──────┘         └─────────────┘
             │                       ▲
             ├───────────────────────┘
             ▼
      ┌─────────────┐
      │  COMPLETED  │ (Terminal)
      └─────────────┘
```

- **Initial Staged Status:** `"PLANNED"` (There is no status named `"STAGED"`; `"PLANNED"` is the authoritative initial state).
- **Allowed Transitions:**
  - `PLANNED` $\rightarrow$ `SENT` or `CANCELLED`
  - `SENT` $\rightarrow$ `COMPLETED` or `CANCELLED`
  - `COMPLETED` $\rightarrow$ Terminal
  - `CANCELLED` $\rightarrow$ Terminal

---

## 5. Current Read-Only MongoDB Campaigns State

Inspection of the `campaigns` collection in MongoDB (`mongodb://127.0.0.1:27017/lumawear`):

```
Total Campaigns in MongoDB: 2

Campaign #1:
  _id:                6a8f1b48e62d09dd89a44387
  campaignId:         CAMP-1787763528396-F326E3
  name:               Cart Abandonment Recovery Campaign
  campaignType:       cart_abandonment
  status:             CANCELLED
  priority:           High
  targetCustomerIds:  ["6a8e91d0757ba1c728e8caaf"] (shashi dj)
  createdAt:          2026-08-26T16:58:48.410Z
  updatedAt:          2026-08-27T04:25:16.737Z

Campaign #2:
  _id:                6a8fb80e168fbd0609c91369
  campaignId:         CAMP-1787803662812-31D734
  name:               Wishlist Follow-up Campaign
  campaignType:       wishlist_followup
  status:             SENT
  priority:           Medium
  targetCustomerIds:  ["6a8e91d0757ba1c728e8caaf", "6a8704de95bfe658bec9dc05"]
  createdAt:          2026-08-27T04:07:42.837Z
  updatedAt:          2026-08-27T04:19:05.309Z
```

---

## 6. Comparison: `GET /api/churn/campaigns` vs `GET /api/churn/results`

Both endpoints read from the same MongoDB `campaigns` collection, but serve distinct operational vs. analytical roles:

| Feature / Dimension | `GET /api/churn/campaigns` | `GET /api/churn/results` |
| :--- | :--- | :--- |
| **Primary Consumer** | "Campaign History" tab in `RetentionAndCampaignsView.jsx` | "Results" tab in `ResultsDashboard.jsx` |
| **Backend Function** | `app.get("/api/churn/campaigns")` | `calculateCampaignResultsPayload()` |
| **Data Returned** | Raw campaign metadata (status, targets, dates, priority) | Full before vs. after longitudinal evaluation & portfolio impact |
| **Live Inference** | None (pure MongoDB find) | Evaluates live 21-feature telemetry via FastAPI XGBoost model |
| **Output Shape** | `{ success: true, campaigns: [...] }` | `{ success: true, summary: {...}, campaigns: [...], disclaimer: "..." }` |
| **Evaluation of PLANNED** | Displays `status: "PLANNED"` with "Send" action button | Displays baseline vs current risk transition & status badge |

---

## 7. Minimal Proposed Code Fix Plan

To fix the staging flow without touching MongoDB data, model weights, or unrelated files:

### Step 1: Normalize Props in [`CampaignPreviewModal.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/components/CampaignPreviewModal.jsx)
Make `CampaignPreviewModal` resilient to both calling conventions:
```javascript
export default function CampaignPreviewModal({
  isOpen = true,
  open,
  onClose,
  activeCluster,
  cluster,
  selectedCustomers = [],
  customers = [],
  onCampaignCreated,
  onSuccess,
}) {
  const effectiveCluster = activeCluster || cluster;
  const effectiveCustomers = selectedCustomers.length > 0 ? selectedCustomers : customers;
  const effectiveCallback = onCampaignCreated || onSuccess;
  const isVisible = isOpen !== false && open !== false;

  if (!isVisible || !effectiveCluster) return null;
  ...
```

### Step 2: Normalize Calling Sites
Update [`RetentionAndCampaignsView.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/components/RetentionAndCampaignsView.jsx) and [`AdminDashboardPage.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/pages/AdminDashboardPage.jsx) to pass explicit props:
```jsx
<CampaignPreviewModal
  isOpen={isPreviewOpen}
  activeCluster={activeCluster}
  selectedCustomers={getSelectedCustomerObjects()}
  onClose={() => setIsPreviewOpen(false)}
  onCampaignCreated={handleCampaignCreated}
/>
```

---

## 8. Immutability & Safety Confirmation

- **MongoDB State:** Zero modifications were made during this diagnostic.
- **Model Integrity:** Active model `2b2147fd4057` remains bit-for-bit intact with verified SHA256 checksums.
- **Database Baseline:** Exactly 4 users, 2 legitimate customers, 2 orders, 2 campaigns, 0 snapshots.
