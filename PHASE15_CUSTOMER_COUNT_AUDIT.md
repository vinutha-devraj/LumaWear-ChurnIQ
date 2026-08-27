# Phase 15 Engineering Audit: Total Customer Count & Entity Identity Verification

**Audit Date:** August 27, 2026  
**Audited Scope:** Customer Identity Definition, Portfolio Customer Counting, Multi-Device/Session Aggregation, Activity Logging, and Demo Mode Isolation.  
**Active ML Model ID:** `2b2147fd4057` (XGBoost Classifier with ROC-AUC 0.837) — **Strictly Untouched**  
**Feature Contract:** 21 Native LumaWear Features — **Strictly Untouched**

---

## 1. Executive Summary & Root Cause Analysis

### Question: "Why was the customer count increasing or suspected of increasing?"
In e-commerce architectures with continuous user tracking, developers often worry that repeated customer actions (logins, session refreshes, device switches, product clicks, cart additions, or order placements) might inadvertently spawn new customer identities or cause activity records to be counted as separate customers.

Our end-to-end architectural audit revealed:
1. **Canonical Identity Source**: Customer identity is strictly determined by individual user account documents in the MongoDB **`users`** collection (`role: { $ne: "admin" }`).
2. **Activity & Session Isolation**: The **`activities`**, **`refresh_tokens`**, and **`orders`** collections store relational events referencing `userId`. Multiple activity events (e.g. 50 page views, 10 logins from different devices) point to the same canonical `userId`.
3. **Point-in-Time Feature Grouping**: In `server.js`, activities and orders are fetched in bulk ($O(1)$ batch queries) and grouped in-memory by `userId` using HashMaps (`activitiesByUser.get(uid)`). The feature extraction loop iterates over distinct `users`, extracting exactly one 21-feature row per customer account.
4. **Deduplication Safeguard Added**: To guarantee mathematical determinism across all database scenarios, we reinforced all customer queries (`/api/churn/portfolio-summary`, `/api/admin/users`, `/api/churn/retention-opportunities`, `/api/churn/business-impact`, `/api/churn/model-health`) with explicit in-memory `Map` deduplication by canonical `_id`.

---

## 2. Complete Data Flow

```
MongoDB Database
  ├── users collection (Canonical customer records: unique _id & email)
  ├── activities collection (Point-in-time events: page_view, login, cart_add linked by userId)
  └── orders collection (Completed purchases linked by userId)
          │
          ▼
Node.js / Express Backend (GET /api/churn/portfolio-summary)
  ├─ 1. Query: User.find({ role: { $ne: "admin" } })
  ├─ 2. Deduplicate: userMap.set(String(u._id), u) -> Exactly N unique customer accounts
  ├─ 3. Group: activitiesByUser.get(uid), ordersByUser.get(uid)
  ├─ 4. Extract: 1 feature vector per user -> extractCustomerFeatures(user, activities, orders)
  └─ 5. Set: summary.total_customers = users.length
          │
          ▼
FastAPI ChurnIQ Engine (POST /predict/batch)
  └─ Vectorized XGBoost scoring (2b2147fd4057) across N customer vectors
          │
          ▼
React Frontend (AdminDashboardPage.jsx)
  ├─ State: setPortfolioData(data) replaces state (zero accumulation/concatenation)
  └─ UI Card: summary.total_customers (Displays exact count N)
```

---

## 3. Detailed Audit Matrix

| Area Audited | Collection / Mechanism | Observed Behavior | Integrity Status |
| :--- | :--- | :--- | :--- |
| **Authentication & Logins** | `User.findOne({ email })`, `Activity.create({ type: 'auth_login' })` | Login updates `lastLoginAt` and creates 1 Activity document. **Zero User creation.** | ✅ PASS |
| **Session Refreshes & Devices** | `RefreshToken.create`, `userAgent` | Device headers and refresh tokens are stored in `refresh_tokens`/`activities` under existing `userId`. **Zero User creation.** | ✅ PASS |
| **Activity Logging** | `Activity.create({ userId })` | Storefront telemetry (`page_view`, `product_view`, `cart_add`, `wishlist_toggle`) adds documents to `activities` referencing `userId`. **Zero User creation.** | ✅ PASS |
| **Order Placement** | `Order.create({ userId })` | Authenticated checkout uses `req.user._id`. Guest checkout looks up `User.findOne({ email })` to reuse existing account if email exists. | ✅ PASS |
| **Prediction & Customer 360** | `GET /api/churn/predict/:userId`, `GET /api/churn/customer-360/:userId` | Read-only queries against `users`, `activities`, `orders`. **Zero mutations.** | ✅ PASS |
| **Demo Mode Isolation** | In-Memory `DEMO_CUSTOMERS` (`demoData.js`) | Demo personas are completely synthetic and in-memory. `GET /api/churn/portfolio-summary?mode=demo` returns 12. Real `users` collection is **100% untouched.** | ✅ PASS |
| **React State Management** | `useState`, `setPortfolioData` | `AdminDashboardPage.jsx` replaces state on each refresh. No appending or concatenation. | ✅ PASS |

---

## 4. Question: "How does the system now know that multiple activities belong to the same customer?"

1. **Foreign Key Binding**: When a customer performs actions (browsing products, adding to cart, logging in across iPhone, Mac, or Windows), every event written to the `activities` collection includes the foreign key:
   $$\text{Activity.userId} = \text{User.\_id}$$
2. **In-Memory Grouping by Hash Key**: During portfolio analysis, Express loads all relevant activities and orders in a single database roundtrip and groups them by stringified `userId`:
   ```javascript
   const activitiesByUser = new Map();
   for (const act of allActivities) {
     const uid = String(act.userId);
     if (!activitiesByUser.has(uid)) activitiesByUser.set(uid, []);
     activitiesByUser.get(uid).push(act);
   }
   ```
3. **Iterating Over Canonical Customer Accounts**: The system iterates over the unique `users` array—never over `activities`. For each unique user, it fetches `activitiesByUser.get(uid)` and aggregates their 30-day activity counts, login counts, and order recency into that single customer's 21-feature representation.
4. **Result**: 1 user account with 10 logins, 50 page views, 5 orders, and 4 device sessions equals **exactly 1 Customer** on the dashboard.

---

## 5. Verification Test Suite: `customerCountAudit.test.js`

We constructed a dedicated automated test suite (`backend/src/churn/customerCountAudit.test.js`) verifying all 7 specified audit cases against the live Node/MongoDB API:

```
# Subtest: Phase 15 Audit: Exact customer count validation and deduplication across multiple scenarios
    ok 1 - Case 1: 1 user + 1 activity yields exactly 1 customer
    ok 2 - Case 2: 1 user + 10 login activities yields exactly 1 customer
    ok 3 - Case 3: 1 user + 50 activities + 5 orders yields exactly 1 customer
    ok 4 - Case 4: 2 users + many activities yields exactly 2 customers
    ok 5 - Case 5: Same user using multiple devices/userAgents yields exactly 1 customer
    ok 6 - Case 6: Demo personas do not increase live customer count and remain isolated
    ok 7 - Case 7: Refreshing the Admin Dashboard repeatedly does not increase customer count
```

### Full Test Suite Results
- **Node.js Backend**: **98 / 98 tests passed (0 failed)** across all 11 test suites.
- **Frontend Production Build**: **Built in 37.08s with 0 errors**.
- **Python ML Inference & Security**: **22 / 22 tests passed (0 failed)**.
- **ML Model & Weights**: Model `2b2147fd4057` remains 100% active, untouched, and un-retrained.
