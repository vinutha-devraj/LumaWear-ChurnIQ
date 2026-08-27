# Forensic Investigation & Remediation Report: Unexpected User Creation in MongoDB

**Investigation & Remediation Date:** August 27, 2026  
**Target Database:** `mongodb://127.0.0.1:27017/lumawear`  
**Database Host:** `127.0.0.1:27017`  
**Database Name:** `lumawear`  
**Status:** **ROOT CAUSE RESOLVED & DATABASE RESTORED TO 4 AUTHORITATIVE USERS**

---

## 1. Executive Summary & Resolution Verdict

```
========================================================================================
 ROOT CAUSE CONFIRMED:
 [A] TEST SUITE CREATED USERS IN DEVELOPMENT DATABASE (retention.test.js)
 REMEDIATION STATUS:
 1. retention.test.js CLEANUP FIXED & VERIFIED (0 Users Left Behind)
 2. 50 TEST FIXTURE RECORDS SAFELY REMOVED FROM MONGODB
 3. FINAL DATABASE STATE: EXACTLY 4 USERS (2 Admins, 2 Legitimate Customers)
 4. RE-EXECUTION IMMUTABILITY VERIFIED ACROSS FULL TEST SUITE
========================================================================================
```

---

## 2. Root Cause Discovery & Mechanism

In [`LumaWear-Ecommerce/backend/src/churn/retention.test.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/retention.test.js) (lines 184–205), the test titled:
`"Campaign lifecycle: creation (PLANNED) -> list -> update (SENT) -> complete (COMPLETED) -> reject invalid transition"`
created two test customer accounts:
- `Retention Customer One` (`email: retention1-${Date.now()}@example.com`)
- `Retention Customer Two` (`email: retention2-${Date.now()}@example.com`)

### Why the pollution occurred:
1. **Missing Cleanup in `test.after()`:** Unlike other test suites (which tracked `createdUserIds` and cleaned up in `test.after()`), `retention.test.js` did not track or remove `customer1` and `customer2`.
2. **Local DB Connection:** `retention.test.js` connected directly to `mongodb://127.0.0.1:27017/lumawear`.
3. **Exact 2-User Generation on Every Test Execution:** Over 25 runs of `npm test` during development, exactly 25 pairs = **50 test customers** were created and remained permanently in MongoDB.

---

## 3. Remediation Step 1: `retention.test.js` Cleanup Fix

In [`LumaWear-Ecommerce/backend/src/churn/retention.test.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/retention.test.js):
1. Added global tracking arrays:
   ```javascript
   let createdUserIds = [];
   let createdCampaignIds = [];
   ```
2. Tracked all generated fixture user IDs and campaign IDs:
   ```javascript
   createdUserIds.push(customer1._id, customer2._id);
   createdCampaignIds.push(campaign.campaignId, cancelId);
   ```
3. Ensured `test.after()` cleans up all tracked entities:
   ```javascript
   test.after(async () => {
     if (createdUserIds.length > 0) {
       await User.deleteMany({ _id: { $in: createdUserIds } });
       await Activity.deleteMany({ userId: { $in: createdUserIds } });
       await Order.deleteMany({ userId: { $in: createdUserIds } });
     }
     if (createdCampaignIds.length > 0) {
       await Campaign.deleteMany({ campaignId: { $in: createdCampaignIds } });
     }
     if (server) {
       await new Promise((resolve) => server.close(resolve));
     }
     if (mongoose.connection.readyState !== 0) {
       await mongoose.disconnect();
     }
   });
   ```

### Verification of Test Isolation:
- **Run 1:** Users before = 54 $\rightarrow$ Users after = 54 ($\Delta = 0$). All 9 retention tests passed.
- **Run 2:** Users before = 54 $\rightarrow$ Users after = 54 ($\Delta = 0$). All 9 retention tests passed.

---

## 4. Remediation Step 2: Targeted Deletion of 50 Fixtures

Executed a strict, narrowly scoped query targeting only the 50 test fixture records:
```javascript
const fixtureFilter = {
  role: "customer",
  name: { $in: ["Retention Customer One", "Retention Customer Two"] },
  email: /^retention[12]-\d+@example\.com$/,
};

const deleteResult = await db.collection("users").deleteMany(fixtureFilter);
```

- **Pre-Deletion Match Count:** Exactly 50 documents matched.
- **Deleted Count:** Exactly 50 documents deleted.
- **Legitimate Customer Accounts:** Strictly excluded and preserved.

---

## 5. Final Authoritative User State in MongoDB

| # | User ID | Role | Name | Email | Account Type | Status |
| :- | :--- | :---: | :--- | :--- | :--- | :---: |
| 1 | `6a8df1765a2a1c99fa363b31` | `admin` | Store Administrator | `admin@lumawear.local` | System Admin | ✅ PRESERVED |
| 2 | `6a8deff4044334575e26f834` | `admin` | Shivin Vinu | `shivin412@gmail.com` | Primary Admin | ✅ PRESERVED |
| 3 | `6a8704de95bfe658bec9dc05` | `customer` | shivu shivu | `shivin1418@gmail.com` | Production Customer | ✅ PRESERVED |
| 4 | `6a8e91d0757ba1c728e8caaf` | `customer` | shashi dj | `shashi@gmail.com` | Production Customer | ✅ PRESERVED |

```
========================================================================================
 FINAL DATABASE USERS: EXACTLY 4
 - Total Users: 4
 - Admin Users: 2
 - Customer Users: 2
 - Retention Fixture Customers Remaining: 0
========================================================================================
```

---

## 6. Verification Across All Collections

| Collection | Verified Count | Net Change | Integrity Assessment |
| :--- | :---: | :---: | :--- |
| **`users`** | **4** | -50 (Test fixtures purged) | Clean authoritative state (2 Admins, 2 Customers) |
| **`orders`** | **2** | 0 | 100% Unchanged |
| **`activities`** | **239** | 0 | Legitimate customer telemetry strictly intact |
| **`campaigns`** | **71** | 0 | Baseline target snapshots strictly immutable |
| **`churn_prediction_snapshots`** | **0** | 0 | 100% Unchanged |

---

## 7. Full Suite Immutability Verification (`npm test`)

The entire backend test suite (118 tests across all modules) was executed against the database:

- **Baseline User Count Before `npm test`:** **4**
- **User Count After `npm test`:** **4** ($\Delta = 0$)
- **Baseline Order Count Before `npm test`:** **2**
- **Order Count After `npm test`:** **2** ($\Delta = 0$)
- **Backend Test Results:** **118 passed, 0 failed (100% PASS)**

Future executions of `npm test` no longer pollute the development database.

---

## 8. Churn & ML Prediction Verification

- **Active Model Artifact:** `2b2147fd4057` (SHA256 checksums 100% verified on all 6 files).
- **Current Customer Prediction (`shashi dj` / `6a8e91d0757ba1c728e8caaf`):**
  - Churn Probability: `6.92%` (`0.0692`)
  - Risk Level: `Low`
  - Churn Timeline: `Low near-term churn risk`
  - Recommendations: Cart abandonment (6 items) & wishlist reminder (clean & actionable).
- **Cross-Customer Contamination:** ZERO. All non-admin customer predictions are isolated.
