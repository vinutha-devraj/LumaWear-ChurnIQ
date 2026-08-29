# Controlled Live Automatic Retention Email Test Report

```
========================================================================================
CONTROLLED LIVE EMAIL TEST:                 SUCCESSFUL (EXACTLY 1 REAL EMAIL SENT)
TEST RECIPIENT:                             vi***12@gmail.com
REAL CHURN PROBABILITY:                     87.66% (>= 70.00% threshold)
DISPATCH METHOD:                            Production sendRetentionEmail() (Gmail SMTP)
DATABASE POLLUTION / LEAKS:                 0
ML MODEL MODIFIED:                          NO (Active Model: 2b2147fd4057)
21-FEATURE CONTRACT MODIFIED:               NO
MANUAL RETENTION FLOW MODIFIED:             NO
CURRENT PRODUCTION STATE:                   STANDBY (ENABLED=false, DRY_RUN=true)
========================================================================================
```

---

## 1. Test Metadata & Pre-Send Safety Gate

- **Test Date & Time**: `2026-08-29 16:57:45 UTC+05:30`
- **Explicit Test Recipient**: `vi***12@gmail.com` (verified against `TEST_RECIPIENT_EMAIL`)
- **Test Customer ID**: `6a92c20b220273f6d2766697`
- **Real Feature Extraction**: Extracted using production `extractCustomerFeatures()` in `features.js`
- **Real ML Churn Prediction**: Generated directly via running ChurnIQ FastAPI Engine (`POST http://127.0.0.1:8000/predict`)
  - **Churn Probability**: **`87.66%`** ($P = 0.8766$)
  - **Risk Level**: `Very High`
  - **Churn Label**: `Will Churn`
  - **Model ID**: `2b2147fd4057`
- **Configured Churn Threshold**: `0.70` (70.00%)
- **Basic Eligibility Check**: `eligible = true`, `skipReason = null`
- **Marketing Opt-Out**: `false`
- **Prior Cooldown Status**: `false` (clean history)
- **Selected Strategy**: `inactivity_reengagement` ("Inactivity Re-engagement" / We Miss You)
- **Trigger Reason**: `storefront_inactivity_exceeds_14d`
- **Background Scheduler State**: `STOPPED`

---

## 2. Live Dispatch Execution

The single live email dispatch was executed through the production `executeAutomaticRetentionBatch` pipeline using the existing `sendRetentionEmail()` Nodemailer transporter:

- **Targeted Accounts**: 1
- **Evaluated Count**: 1
- **Eligible Count**: 1
- **Real Emails Transmitted**: **1**
- **Failed Count**: 0
- **Recipient**: `vi***12@gmail.com`
- **Subject**: `"Vinutha, we've missed you at LumaWear!"`
- **Active SMTP Mode**: `LIVE (smtp.gmail.com:587)`

---

## 3. Post-Send Database Telemetry Verification

### A. `AutomaticRetentionLog` (`automatic_retention_logs` collection)
```json
{
  "customerId": "6a92c20b220273f6d2766697",
  "email": "vi***12@gmail.com",
  "campaignType": "inactivity_reengagement",
  "triggerReason": "storefront_inactivity_exceeds_14d",
  "churnProbability": 0.8766,
  "riskTier": "Very High",
  "decision": "sent",
  "status": "SENT",
  "mode": "live",
  "provider": "smtp",
  "sentAt": "2026-08-29T11:27:48.125Z",
  "cooldownUntil": "2026-09-05T11:27:48.125Z",
  "metadata": {
    "isAutomatic": true,
    "triggeredBy": "controlled_live_email_verification"
  }
}
```

### B. `Activity` (`activities` collection)
```json
{
  "userId": "6a92c20b220273f6d2766697",
  "type": "retention_email_sent",
  "route": "/api/churn/automatic-retention",
  "metadata": {
    "isAutomatic": true,
    "campaignType": "inactivity_reengagement",
    "strategy": "inactivity_reengagement",
    "recipientEmail": "vi***12@gmail.com",
    "provider": "smtp",
    "mode": "live"
  }
}
```

---

## 4. Second-Attempt Cooldown & Idempotency Check

Immediately following the live dispatch, a second automatic retention evaluation was triggered for the exact same customer profile:

- **Second Attempt Evaluated**: 1
- **Second Attempt Eligible**: 0
- **Second Attempt Sent**: **0** *(Zero additional emails transmitted)*
- **Second Attempt Skipped**: 1
- **Skip Reason**: `cooldown_active`
- **Result**: The 7-day cooldown database guard successfully blocked duplicate outreach.

---

## 5. Database State & Cleanup Audit

| Collection | Baseline Count | During Test | After Cleanup | Delta |
| :--- | :---: | :---: | :---: | :---: |
| **Users** | 9 | 9 | 9 | **0** |
| **Activities** | 4,169 | 4,170 | 4,169 | **0** |
| **Orders** | 1 | 1 | 1 | **0** |
| **Campaigns** | 19 | 19 | 19 | **0** |
| **Automatic Retention Logs** | 16 | 17 | 16 | **0** |

*Note: All temporary test telemetry records were cleanly removed. Zero persistent database mutations.*

---

## 6. System State Restoration

- **`AUTOMATIC_RETENTION_ENABLED`**: Restored to `false`
- **`AUTOMATIC_RETENTION_DRY_RUN`**: Restored to `true`
- **Background Scheduler**: `STOPPED`

---

## 7. Manual Flow Regression Verification

All manual retention regression test suites were re-executed following the live test:

| Test Suite | Command | Result |
| :--- | :--- | :---: |
| **Manual Email Execution** | `node --test test-retention-email-execution.js` | **PASS (100%)** |
| **Strategy Staging Flow** | `node --test test-stage-strategy-flow.js` | **PASS (100%)** |
| **Test Cleanup Isolation** | `node --test test-retention-cleanup-isolation.js` | **PASS (100%)** |
| **Auto Retention Unit Suite** | `node --test src/churn/automaticRetention.test.js` | **PASS (21/21)** |
| **Auto Retention API Suite** | `node --test src/churn/automaticRetentionIntegration.test.js` | **PASS (6/6)** |

---

## 8. Non-Negotiable Safety Attestations

1. **XGBoost Model**: Untouched (`artifacts/2b2147fd4057` remains active).
2. **21-Feature Contract**: Identical schema and ordering preserved.
3. **Campaign Documents**: Zero `Campaign` records created or mutated.
4. **Other Customers**: Zero other customers evaluated or emailed.
5. **Real Email Count**: **Exactly 1 email sent** to the verified recipient `vi***12@gmail.com`.
