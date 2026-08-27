# Retention Strategy Email Execution & Telemetry Audit (Dry-Run Mode)

**Audit Date:** August 27, 2026  
**System:** LumaWear-Ecommerce Storefront, Express Backend & ChurnIQ Retention Subsystem  
**Execution Mode:** **STRICT DRY-RUN (Zero External Email Transmission)**  
**Active ML Model Artifact:** `2b2147fd4057` (All 6 SHA256 Checksums 100% Verified)  
**MongoDB Authoritative State:** `127.0.0.1:27017` / Database: `lumawear` (Zero Test Pollution)  

---

## 1. Architectural Overview & Safe Email Execution Pipeline

```
Admin Selects Retention Opportunity / Strategy
       ↓
Staged Campaign Created in MongoDB (`status: "PLANNED"`)
       ↓
Admin Previews Personalized Email Copy:
  POST /api/churn/campaigns/:id/email-preview
       ↓
Admin Executes Email Dispatch:
  POST /api/churn/campaigns/:id/send-emails (Dry-Run Provider)
       ↓
1. Validates Recipient Email Addresses
2. Generates Tailored Strategy Subject & HTML/Text Body
3. Dispatches via Dry-Run Provider (Simulated Delivery + Message ID)
4. Outbound Telemetry Recorded to MongoDB (`Activity: retention_email_sent`)
5. Campaign Transitions from `PLANNED` → `SENT`
       ↓
Customer Baseline Churn Risk Remains FROZEN (Immutable)
Live Churn Risk Recalculates dynamically only when real customer events/purchases occur
```

---

## 2. Files Changed & Added

| File Path | Description |
| :--- | :--- |
| [`LumaWear-Ecommerce/backend/src/churn/retentionEmailTemplates.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/retentionEmailTemplates.js) | **[NEW]** Centralized personalized subject, HTML, and text email generators for all 7 retention strategies. |
| [`LumaWear-Ecommerce/backend/src/churn/emailService.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/churn/emailService.js) | **[NEW]** Modular email service providing validation, batch auditing, personalized campaign preview generation, and dry-run provider dispatch. |
| [`LumaWear-Ecommerce/backend/src/server.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/src/server.js) | Added `GET /api/retention/email-audit`, `POST /api/churn/campaigns/:id/email-preview`, and `POST /api/churn/campaigns/:id/send-emails`. |
| [`LumaWear-Ecommerce/frontend/src/components/EmailPreviewModal.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/components/EmailPreviewModal.jsx) | **[NEW]** Admin modal for rendering personalized HTML/text strategy email previews and executing dry-run dispatches. |
| [`LumaWear-Ecommerce/frontend/src/components/RetentionAndCampaignsView.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/components/RetentionAndCampaignsView.jsx) | Added "📧 Email Preview" action button on campaign history cards to inspect strategy email copy and trigger dry-run dispatch. |
| [`LumaWear-Ecommerce/frontend/src/components/ResultsDashboard.jsx`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/frontend/src/components/ResultsDashboard.jsx) | Added "📧 Email Preview" button on Results cards for inspecting sent retention messages alongside before/after outcomes. |
| [`LumaWear-Ecommerce/backend/test-retention-email-execution.js`](file:///c:/Users/vinus/OneDrive/Desktop/Majorproject/LumaWear-Ecommerce/backend/test-retention-email-execution.js) | **[NEW]** Comprehensive end-to-end integration test verifying validation, previews, dry-run dispatch, activity logging, and baseline immutability. |

---

## 3. Routes Added

### 1. `GET /api/retention/email-audit` (Read-Only)
- **Authentication:** Admin only
- **Purpose:** Diagnostic audit of customer email formatting and delivery readiness.
- **Output:**
```json
{
  "success": true,
  "totalCustomers": 3,
  "validFormat": 3,
  "invalidFormat": 0,
  "missingEmail": 0,
  "duplicateEmails": 0,
  "customers": [
    {
      "userId": "6a8704de95bfe658bec9dc05",
      "name": "shivu shivu",
      "email": "shivin1418@gmail.com",
      "isCustomer": true,
      "isValidFormat": true
    }
  ]
}
```

### 2. `POST /api/churn/campaigns/:campaignId/email-preview`
- **Authentication:** Admin only
- **Purpose:** Generates personalized HTML and plain text previews for every customer targeted by the campaign without sending anything.
- **Output:**
```json
{
  "success": true,
  "campaignId": "CAMP-1787826816328-871F0E",
  "strategy": "cart_abandonment",
  "recipientCount": 1,
  "validRecipientCount": 1,
  "recipients": [
    {
      "customerId": "6a8704de95bfe658bec9dc05",
      "customerName": "shivu shivu",
      "email": "shivin1418@gmail.com",
      "emailValid": true,
      "subject": "Hi shivu, you left something stylish in your cart!",
      "textBody": "Hi shivu,\n\nWe noticed you left some curated apparel pieces waiting in your cart...",
      "htmlBody": "<div style=\"...\">...</div>"
    }
  ]
}
```

### 3. `POST /api/churn/campaigns/:campaignId/send-emails`
- **Authentication:** Admin only
- **Purpose:** Dispatches retention strategy emails via configured provider (default: Dry-Run), logs `retention_email_sent` activity, and transitions campaign status from `PLANNED` $\rightarrow$ `SENT`.
- **Output:**
```json
{
  "success": true,
  "campaignId": "CAMP-1787826816328-871F0E",
  "status": "SENT",
  "mode": "dry-run",
  "dispatchedCount": 1,
  "totalTargeted": 1,
  "results": [
    {
      "customerId": "6a8704de95bfe658bec9dc05",
      "name": "shivu shivu",
      "email": "shivin1418@gmail.com",
      "success": true,
      "mode": "dry-run",
      "provider": "dry-run",
      "providerMessageId": "dry-run-1787826816379-37a462c7",
      "subject": "Hi shivu, you left something stylish in your cart!",
      "dispatchedAt": "2026-08-27T10:33:36.379Z"
    }
  ]
}
```

---

## 4. Retention Strategy Mapping Matrix (All 7 Strategies)

| Strategy ID | Strategy Name | Trigger Condition | Tailored Email Subject | Personalized Body Focus |
| :--- | :--- | :--- | :--- | :--- |
| `cart_abandonment` | Cart Abandonment Recovery | `cart_actions_30d > 0` & `orders_30d == 0` | *Hi {firstName}, you left something stylish in your cart!* | Reminds customer of reserved cart items with complimentary priority delivery perk. |
| `inactivity_reengagement` | Inactivity Re-engagement | `days_since_last_activity >= 14` | *We miss you at LumaWear, {firstName}! Here's what's new.* | Highlights trending seasonal drops and comeback essentials. |
| `wishlist_followup` | Wishlist Follow-up | `wishlist_actions_30d > 0` & `orders_30d == 0` | *Your wishlist favorites are waiting for you, {firstName}!* | Alerts customer to stock status and high-demand sizes of saved items. |
| `product_recommendation` | Product Recommendations | `product_views_30d >= 5` & `orders_30d == 0` | *Handpicked recommendations curated for you, {firstName}* | Curates top apparel tailored to recent catalog browsing history. |
| `new_customer_onboarding` | New Customer Onboarding | `tenure_days <= 14` & `order_count <= 1` | *Welcome to the LumaWear family, {firstName}!* | Welcomes new member, introduces craftsmanship standards and onboarding perk. |
| `vip_retention` | VIP Retention | `total_spend >= $400` & `churn_prob >= 0.45` | *Exclusive VIP Privilege & Dedicated Support for {firstName}* | High-touch concierge outreach with code `LUMAVIP-CONCIERGE` and priority access. |
| `category_promotion` | Category-Based Promotion | Customer has defined `preferred_order_category` | *New {category} arrivals tailored to your style, {firstName}* | Direct link and preview of new arrivals in customer's favorite category. |

---

## 5. Machine Learning Non-Causal Integrity & Baseline Immutability

```
========================================================================================
 NON-CAUSAL MACHINE LEARNING INTEGRITY GUARANTEE:
 1. NO ARTIFICIAL PROBABILITY MODIFICATION:
    Sending a retention email (dry-run or real) DOES NOT decrement churn probability.
    There is no `prob = prob - delta` or artificial damping logic in any file.

 2. TELEMETRY AUDITABILITY:
    `retention_email_sent` activities are saved in MongoDB for compliance and tracking,
    but they do NOT artificially manipulate customer engagement metrics.

 3. LIVE FEATURE EXTRACTION:
    Live churn scores update ONLY when legitimate customer actions (such as orders,
    logins, or browsing) occur in MongoDB.

 4. BASELINE SNAPSHOT PRESERVATION:
    The baseline churn probability and feature metrics captured at campaign creation time
    remain 100% frozen and immutable on the Results Dashboard.
========================================================================================
```

---

## 6. Verification Results: Build, Tests & Database Immutability

### A. Full Backend Test Suite:
```bash
npm test
# Result:
# tests 123
# suites 0
# pass 123
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 40523.4246
```

### B. Frontend Production Build:
```bash
npm run build
# Result:
# ✓ 1678 modules transformed.
# dist/assets/index-CM98cUuB.css   42.15 kB │ gzip:   8.06 kB
# dist/assets/index-rbhw5ej8.js   427.97 kB │ gzip: 107.46 kB
# ✓ built in 1.75s with 0 errors.
```

### C. Active Model Artifact Checksums (`2b2147fd4057`):
```
✅ churn_pipeline.joblib     : 22e25c41c093cea2... [MATCH]
✅ shap_explainer.joblib     : 932e2f98fc33107c... [MATCH]
✅ schema.json               : 624e40207b696e5c... [MATCH]
✅ model_metadata.json       : 99daa38794ece988... [MATCH]
✅ feature_importance.json   : 8fa9994018848843... [MATCH]
✅ feature_order.json        : 9178db63525025fd... [MATCH]
```

### D. MongoDB Database Counts (Zero Test Pollution):
- `users`: 5 (2 admins, 3 customers)
- `orders`: 4
- `activities`: 329
- `campaigns`: 3
- `churn_prediction_snapshots`: 0 orphaned snapshots
