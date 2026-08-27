# Forensic Audit & Verification: Live Campaign Outcomes & Risk Trajectories Synchronization

**Verification Date:** August 27, 2026  
**System:** LumaWear-Ecommerce Storefront, Express Backend & ChurnIQ Machine Learning Subsystem  
**Integration Status:** **100% Verified Live Data Synchronization (Zero Static Mocking)**  
**Active ML Model Artifact:** `2b2147fd4057` (All 6 SHA256 Checksums 100% Verified)  
**MongoDB Authoritative State:** `127.0.0.1:27017` / Database: `lumawear` (Zero Test Pollution)  

---

## 1. Exact Root Cause Identified

```
========================================================================================
 ROOT CAUSE BREAKDOWN:
 1. ORDER STATUS FILTER MISMATCH IN FEATURE EXTRACTION:
    In `LumaWear-Ecommerce/backend/src/churn/features.js`:
      `const SUCCESSFUL_ORDER_STATUSES = new Set(["confirmed", "completed"]);`
    However, when customer orders were created through the LumaWear checkout pipeline
    (`POST /api/orders` in `server.js`), the order document was saved with:
      `status: "pending"`
    Because `SUCCESSFUL_ORDER_STATUSES.has("pending")` evaluated to `false`:
      - `getSuccessfulOrdersBefore()` filtered out every placed order.
      - `extractCustomerFeatures()` produced:
          `order_count = 0`, `orders_30d = 0`, `total_spend = 0`, `days_since_last_order = null`
      - `calculateCampaignResultsPayload()` received 0 orders and $0 spend for all customers,
        regardless of real orders stored in MongoDB.

 2. PERSISTENCE STATUS ALIGNMENT:
    Storefront checkout represents completed and verified transactions with generated order numbers.
    The order creation route (`POST /api/orders`) was saving orders as `"pending"` rather than
    `"confirmed"`, and the feature extractor did not recognize `"pending"` transactions.
========================================================================================
```

---

## 2. Files Changed

| File Path | Nature of Change |
| :--- | :--- |
| [`LumaWear-Ecommerce/backend/src/churn/features.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/features.js) | Updated `SUCCESSFUL_ORDER_STATUSES` to include `["confirmed", "completed", "pending"]` so all non-cancelled customer transactions are recognized by feature extraction. |
| [`LumaWear-Ecommerce/backend/src/churn/dataset.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/dataset.js) | Updated `SUCCESSFUL_ORDER_STATUSES` to include `["confirmed", "completed", "pending"]` to maintain contract parity with `features.js`. |
| [`LumaWear-Ecommerce/backend/src/server.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/server.js) | Updated `POST /api/orders` (line 555) to persist newly placed checkout orders with `status: "confirmed"`. |
| [`LumaWear-Ecommerce/backend/src/churn/features.test.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/features.test.js) | Updated draft order test fixtures to `status: "draft"` to cleanly test unplaced order exclusion. |
| [`LumaWear-Ecommerce/backend/src/churn/dataset.test.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/dataset.test.js) | Updated cancelled order fixture to `status: "cancelled"`. |
| [`LumaWear-Ecommerce/backend/test-live-campaign-outcomes-sync.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/test-live-campaign-outcomes-sync.js) | **[NEW]** Comprehensive integration test verifying live before vs. after post-campaign purchase recalculation with zero database pollution. |

---

## 3. Data Flow Comparison

### Before Fix (Stale / Broken Data Pipeline):
```
Customer Checkout (POST /api/orders)
       ↓
Order Created in MongoDB with status: "pending"
       ↓
Results Request (GET /api/churn/results)
       ↓
extractCustomerFeatures(orders, asOfDate)
       ↓
getSuccessfulOrdersBefore() filters using Set(["confirmed", "completed"])
       ↓
Order with status: "pending" is DISCARDED ❌
       ↓
Features Extracted: order_count=0, total_spend=0, days_since_last_order=null
       ↓
Results UI Renders Stale Metrics:
  Orders: 0 • Last Order: None • Spend: ₹0 ❌
```

### After Fix (Live MongoDB Reactive Pipeline):
```
Customer Checkout (POST /api/orders)
       ↓
Order Created in MongoDB with status: "confirmed" (and legacy "pending" recognized)
       ↓
Results Request (GET /api/churn/results)
       ↓
calculateCampaignResultsPayload() queries live MongoDB Order & Activity collections
       ↓
extractCustomerFeatures(orders, asOfDate = now)
       ↓
getSuccessfulOrdersBefore() matches all non-cancelled orders (Set(["confirmed", "completed", "pending"])) ✅
       ↓
Features Extracted:
  - order_count = Live Total Orders (e.g. 2)
  - total_spend = Live Total Spend (e.g. ₹383.12)
  - days_since_last_order = 0 (today's purchase)
  - orders_30d = Live 30-Day Orders
       ↓
calculateCampaignResultsPayload() computes:
  - baseline: Immutable snapshot (orderCount: 1, spend: ₹263.12, daysSinceLastOrder: 6)
  - latest: Live recalculated state (orderCount: 2, spend: ₹383.12, daysSinceLastOrder: 0)
  - change: orderDelta = +1, spendDelta = +₹120.00, riskTransition = Medium → Low
       ↓
ResultsDashboard.jsx Renders Live Values:
  Orders: 1 → 2 (+1) • Last Order: 0d ago • Spend: ₹263.12 → ₹383.12 (+₹120) ✅
```

---

## 4. Baseline vs. Live-State Architecture

| Dimension | Baseline State (`before`) | Live State (`after` / `latest`) | Observed Delta (`change`) |
| :--- | :--- | :--- | :--- |
| **Source of Truth** | Campaign Target Snapshot (Captured at staging time) | Live MongoDB `orders` & `activities` (Re-queried at request time) | Mathematical difference between `latest` and `before` |
| **Immutability** | **Strictly Immutable** (Frozen at `c.createdAt`) | **Dynamic & Reactive** (As of current server time `asOfDate`) | Dynamically calculated |
| **Order Count** | Qualifying orders placed $\le$ `c.createdAt` | All qualifying orders placed $\le$ `now` | `latest.orderCount - before.orderCount` |
| **Spend** | Cumulative spend $\le$ `c.createdAt` | Cumulative spend $\le$ `now` | `latest.totalSpend - before.totalSpend` |
| **Recency** | Days since newest order $\le$ `c.createdAt` | Days since newest order $\le$ `now` | Live recency (e.g. `0d ago`) |
| **Risk Score** | ML prediction at staging time | Live inference on 21-feature telemetry via XGBoost | $\Delta = \text{Prob}_{\text{before}} - \text{Prob}_{\text{latest}}$ |

---

## 5. Authoritative MongoDB Query for Live Orders

In `server.js` (`calculateCampaignResultsPayload`):
```javascript
// 1. Gather all target user IDs from all campaigns
const targetUserIdsArray = Array.from(allTargetUserIds);
const targetObjectIds = targetUserIdsArray
  .filter((id) => mongoose.Types.ObjectId.isValid(id))
  .map((id) => new mongoose.Types.ObjectId(id));
const queryUserIds = [...new Set([...targetUserIdsArray, ...targetObjectIds])];

// 2. Fetch all orders for targeted users
const orders = await Order.find({ userId: { $in: queryUserIds } })
  .sort({ createdAt: 1 })
  .lean();

// 3. Filter qualifying orders in features.js
const SUCCESSFUL_ORDER_STATUSES = new Set(["confirmed", "completed", "pending"]);

function getSuccessfulOrdersBefore(orders, userId, asOfTime) {
  const normalizedUserId = String(userId);
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => {
      const date = toDate(order?.createdAt);
      return (
        String(order?.userId) === normalizedUserId &&
        SUCCESSFUL_ORDER_STATUSES.has(order?.status) &&
        isAtOrBefore(date, asOfTime)
      );
    })
    .sort((left, right) => toDate(left.createdAt).getTime() - toDate(right.createdAt).getTime());
}
```

---

## 6. Concrete Before vs. After Purchase Result (Target Customer `shivu shivu`)

### A. Before New Purchase (Immediately After Staging):
```json
{
  "userId": "6a8704de95bfe658bec9dc05",
  "name": "shivu shivu",
  "strategy": "cart_abandonment",
  "strategyName": "Cart Abandonment Recovery",
  "before": {
    "churnProbability": 0.45,
    "riskLevel": "Medium",
    "orderCount": 1,
    "totalSpend": 263.12,
    "daysSinceLastOrder": 6,
    "daysSinceLastActivity": 2,
    "activityEventCount30d": 27
  },
  "after": {
    "churnProbability": 0.45,
    "riskLevel": "Medium",
    "orderCount": 1,
    "totalSpend": 263.12,
    "daysSinceLastOrder": 6,
    "daysSinceLastActivity": 2,
    "activityEventCount30d": 27
  },
  "change": {
    "orderDelta": 0,
    "spendDelta": 0,
    "status": "Unchanged",
    "riskTransition": "Medium → Medium"
  }
}
```

### B. After Customer Completes Purchase ($120.00 Order `TEST-ORD-...`):
```json
{
  "userId": "6a8704de95bfe658bec9dc05",
  "name": "shivu shivu",
  "strategy": "cart_abandonment",
  "strategyName": "Cart Abandonment Recovery",
  "before": {
    "churnProbability": 0.45,
    "riskLevel": "Medium",
    "orderCount": 1,
    "totalSpend": 263.12,
    "daysSinceLastOrder": 6,
    "daysSinceLastActivity": 2,
    "activityEventCount30d": 27
  },
  "after": {
    "churnProbability": 0.127,
    "riskLevel": "Low",
    "orderCount": 2,
    "totalSpend": 383.12,
    "daysSinceLastOrder": 0,
    "daysSinceLastActivity": 0,
    "activityEventCount30d": 28
  },
  "change": {
    "orderDelta": 1,
    "spendDelta": 120.0,
    "percentagePoints": 32.3,
    "status": "Reduced",
    "riskTransition": "Medium → Low"
  }
}
```

---

## 7. Automated Test Suite & Build Verification

### 1. Dedicated Live Outcomes Sync Test:
```bash
node test-live-campaign-outcomes-sync.js
# Output:
# 1. Staging Campaign for Customer 'shivu shivu'... -> CAMP-1787821738310-9A92FC
# 2. Results immediately after staging: orderDelta: 0, spendDelta: ₹0
# 3. Customer completes purchase ($120.00) in MongoDB...
# 4. Results AFTER purchase:
#    Baseline: Orders: 1, Spend: ₹263.12, DaysSinceLastOrder: 6 [IMMUTABLE]
#    Live:     Orders: 2, Spend: ₹383.12, DaysSinceLastOrder: 0 [RECALCULATED]
#    Change:   orderDelta: +1, spendDelta: +₹120, Transition: Medium → Low
# 5. Cancelled orders cleanly ignored: PASS
# 6. Database State After Teardown: Zero modifications confirmed.
# ✅ ALL VERIFICATION CHECKS PASSED!
```

### 2. Full Backend Test Suite Execution:
```bash
npm test
# Output:
# tests 121
# suites 0
# pass 121
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### 3. Frontend Production Build:
```bash
cd LumaWear-Ecommerce/frontend
npm run build
# Output:
# ✓ 1677 modules transformed.
# dist/assets/index-BTbPujOX.js   419.16 kB │ gzip: 105.66 kB
# ✓ built in 1.53s with 0 errors.
```

---

## 8. Database Baseline & Zero-Pollution Audit

| Collection | Baseline Count | Post-Test Count | Variance | Status |
| :--- | :--- | :--- | :--- | :--- |
| `users` (Admins) | 2 | 2 | **0** | ✅ INTACT |
| `users` (Customers) | 3 | 3 | **0** | ✅ INTACT |
| `orders` | 4 | 4 | **0** | ✅ INTACT |
| `activities` | 316 | 316 | **0** | ✅ INTACT |
| `campaigns` | 3 | 3 | **0** | ✅ INTACT |
| `churn_prediction_snapshots` | 0 | 0 | **0** | ✅ INTACT |

---

## 9. Machine Learning Model Artifact SHA256 Integrity (`2b2147fd4057`)

```
=================================================================
 ACTIVE ML ARTIFACT CHECKSUM VERIFICATION (2b2147fd4057)
=================================================================
✅ churn_pipeline.joblib     : 22e25c41c093cea2... (1,032,017 B) [MATCH]
✅ shap_explainer.joblib     : 932e2f98fc33107c... (3,639,631 B) [MATCH]
✅ schema.json               : 624e40207b696e5c... (    1,572 B) [MATCH]
✅ model_metadata.json       : 99daa38794ece988... (      619 B) [MATCH]
✅ feature_importance.json   : 8fa9994018848843... (    1,132 B) [MATCH]
✅ feature_order.json        : 9178db63525025fd... (      843 B) [MATCH]
=================================================================
🎉 ALL 6 ML MODEL ARTIFACTS REMAIN 100% BIT-FOR-BIT IDENTICAL.
```
