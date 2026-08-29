import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import dotenv from "dotenv";
import "../server.js";
import { extractCustomerFeatures } from "./features.js";
import {
  isEligibleForAutomaticRetention,
  selectRetentionStrategy,
  checkCustomerCooldown,
  executeAutomaticRetentionBatch,
  getAutomaticRetentionConfig,
  updateAutomaticRetentionConfig,
} from "./automaticRetentionService.js";
import { stopAutomaticRetentionScheduler } from "./automaticRetentionScheduler.js";
import { getEmailConfigurationStatus } from "./emailService.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";
const TEST_RECIPIENT_EMAIL = "vinuvin412@gmail.com";

test("Controlled Single Live Email Dispatch Test", async (t) => {
  console.log("\n=================================================================");
  console.log(" STARTING CONTROLLED LIVE AUTOMATIC RETENTION EMAIL TEST");
  console.log("=================================================================");
  console.log("Test Recipient:             ", TEST_RECIPIENT_EMAIL);

  // 1. Ensure scheduler is stopped
  stopAutomaticRetentionScheduler();
  console.log("Background Scheduler:        STOPPED");

  // 2. Connect to database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DB || "lumawear",
    });
  }

  const User = mongoose.models.User || mongoose.model("User");
  const Activity = mongoose.models.Activity || mongoose.model("Activity");
  const Order = mongoose.models.Order || mongoose.model("Order");
  const Campaign = mongoose.models.Campaign || mongoose.model("Campaign");
  const AutomaticRetentionLog =
    mongoose.models.AutomaticRetentionLog || mongoose.model("AutomaticRetentionLog");

  // 3. Baseline Database Snapshot
  const initialUsersCount = await User.countDocuments();
  const initialActivitiesCount = await Activity.countDocuments();
  const initialOrdersCount = await Order.countDocuments();
  const initialCampaignsCount = await Campaign.countDocuments();
  const initialLogsCount = await AutomaticRetentionLog.countDocuments();

  console.log("\n--- BASELINE DATABASE COUNTS ---");
  console.log("Users:                      ", initialUsersCount);
  console.log("Activities:                 ", initialActivitiesCount);
  console.log("Orders:                     ", initialOrdersCount);
  console.log("Campaigns:                  ", initialCampaignsCount);
  console.log("Automatic Retention Logs:   ", initialLogsCount);

  // 4. Verify SMTP configuration
  const emailStatus = getEmailConfigurationStatus();
  console.log("\n--- SMTP CONFIGURATION CHECK ---");
  console.log("SMTP Configured:            ", emailStatus.smtpConfigured);
  console.log("Host:                       ", emailStatus.smtpHost, `(${emailStatus.smtpHostName})`);
  console.log("User:                       ", emailStatus.smtpUser);
  console.log("Active Mode:                ", emailStatus.mode.toUpperCase());

  assert.equal(emailStatus.smtpConfigured, true, "SMTP must be configured for live send test");

  // 5. Construct Isolated Test Customer Scenario
  const now = new Date();
  const testUserId = new mongoose.Types.ObjectId();

  const testCustomer = {
    _id: testUserId,
    customerId: String(testUserId),
    name: "Vinutha D",
    email: TEST_RECIPIENT_EMAIL,
    role: "customer",
    createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    lastLoginAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
    marketingOptOut: false,
  };

  const testActivities = [
    {
      userId: String(testUserId),
      type: "auth_login",
      createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      metadata: {},
    },
  ];

  const testOrders = [
    {
      userId: String(testUserId),
      status: "completed",
      total: 45,
      items: [{ category: "Apparel", quantity: 1 }],
      createdAt: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000),
    },
  ];

  // 6. Real Feature Extraction & Real ChurnIQ Inference
  const extractedFeatures = extractCustomerFeatures({
    user: testCustomer,
    activities: testActivities,
    orders: testOrders,
    asOfDate: now,
  });

  const churnIQResponse = await fetch("http://127.0.0.1:8000/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(extractedFeatures),
  });

  assert.equal(churnIQResponse.ok, true, "ChurnIQ FastAPI prediction service must be reachable");

  const realPrediction = await churnIQResponse.json();
  const realChurnProbability = Number(realPrediction.churn_probability);

  console.log("\n--- REAL ML INFERENCE RESULT ---");
  console.log("Model ID:                   ", realPrediction.model_id || "2b2147fd4057");
  console.log("Churn Probability:          ", (realChurnProbability * 100).toFixed(2) + "%");
  console.log("Risk Level:                 ", realPrediction.risk_level);
  console.log("Churn Label:                ", realPrediction.churn_label);

  assert.ok(realChurnProbability >= 0.70, "Real churn probability must be >= 0.70");

  // 7. Strategy Selection & Eligibility Verification
  const eligibility = isEligibleForAutomaticRetention(testCustomer, realPrediction, {
    threshold: 0.70,
  });
  const strategySelection = selectRetentionStrategy(testCustomer, extractedFeatures, realPrediction);
  const cooldownCheck = await checkCustomerCooldown(
    String(testUserId),
    { cooldownDays: 7 },
    { AutomaticRetentionLog, Activity, Campaign }
  );

  // 8. PRE-SEND SAFETY GATE ASSERTIONS
  console.log("\n=================================================================");
  console.log(" PRE-SEND SAFETY GATE VERIFICATION");
  console.log("=================================================================");
  console.log("Test Customer ID:           ", String(testUserId));
  console.log("Test Recipient:             ", TEST_RECIPIENT_EMAIL);
  console.log("Real Churn Probability:     ", realChurnProbability);
  console.log("Configured Threshold:       ", 0.70);
  console.log("Eligibility Result:         ", eligibility.eligible);
  console.log("Marketing Opt-Out:          ", testCustomer.marketingOptOut);
  console.log("In Cooldown:                ", cooldownCheck.inCooldown);
  console.log("Selected Strategy:          ", strategySelection.strategy);
  console.log("Trigger Reason:             ", strategySelection.triggerReason);
  console.log("Scheduler Status:           ", "STOPPED");
  console.log("Mode for this invocation:   ", "LIVE (1 real email dispatch)");
  console.log("=================================================================");

  assert.equal(eligibility.eligible, true);
  assert.equal(testCustomer.email, TEST_RECIPIENT_EMAIL);
  assert.ok(realChurnProbability >= 0.70);
  assert.equal(testCustomer.marketingOptOut, false);
  assert.equal(cooldownCheck.inCooldown, false);

  // Temporarily configure runtime for single live execution
  updateAutomaticRetentionConfig({ enabled: true, dryRun: false });

  // 9. EXECUTE SINGLE LIVE DISPATCH
  console.log("\n>>> DISPATCHING SINGLE LIVE AUTOMATIC RETENTION EMAIL TO", TEST_RECIPIENT_EMAIL, "...");
  const liveResult = await executeAutomaticRetentionBatch({
    isDryRun: false,
    forceTrigger: true,
    triggeredBy: "controlled_live_email_verification",
    models: { User, Activity, Order, AutomaticRetentionLog, Campaign },
    customCustomers: [testCustomer],
    customPredictions: [
      {
        customer_id: String(testUserId),
        churn_probability: realChurnProbability,
        risk_level: realPrediction.risk_level,
      },
    ],
  });

  console.log("\n--- LIVE DISPATCH EXECUTION RESULT ---");
  console.log("Executed:                   ", liveResult.executed);
  console.log("Mode:                       ", liveResult.mode);
  console.log("Evaluated:                  ", liveResult.evaluatedCount);
  console.log("Eligible:                   ", liveResult.eligibleCount);
  console.log("Live Sent:                  ", liveResult.sentCount);
  console.log("Failed:                     ", liveResult.failedCount);

  assert.equal(liveResult.sentCount, 1, "Exactly 1 live email must be sent");
  assert.equal(liveResult.failedCount, 0, "Zero failures allowed during live send");

  // 10. POST-SEND DATABASE VERIFICATION
  const newLog = await AutomaticRetentionLog.findOne({ customerId: String(testUserId) }).lean();
  const newActivity = await Activity.findOne({
    $or: [{ userId: String(testUserId) }, { "metadata.customerId": String(testUserId) }],
    type: "retention_email_sent",
  }).lean();

  console.log("\n--- POST-SEND TELEMETRY VERIFICATION ---");
  console.log("AutomaticRetentionLog Record: ");
  console.log("  - Status:                 ", newLog?.status);
  console.log("  - Mode:                   ", newLog?.mode);
  console.log("  - Decision:               ", newLog?.decision);
  console.log("  - Strategy:               ", newLog?.campaignType);
  console.log("  - Churn Probability:      ", newLog?.churnProbability);
  console.log("  - Provider Message ID:    ", newLog?.providerMessageId);
  console.log("  - Sent At:                ", newLog?.sentAt);
  console.log("  - Cooldown Until:         ", newLog?.cooldownUntil);
  console.log("  - Metadata isAutomatic:   ", newLog?.metadata?.isAutomatic);

  console.log("Activity Record: ");
  console.log("  - Type:                   ", newActivity?.type);
  console.log("  - isAutomatic:            ", newActivity?.metadata?.isAutomatic);
  console.log("  - Strategy:               ", newActivity?.metadata?.strategy);
  console.log("  - Recipient:              ", newActivity?.metadata?.recipientEmail);

  assert.equal(newLog?.status, "SENT");
  assert.equal(newLog?.decision, "sent");
  assert.equal(newLog?.mode, "live");
  assert.equal(newLog?.email, TEST_RECIPIENT_EMAIL);
  assert.ok(newLog?.churnProbability >= 0.70);
  assert.equal(newLog?.metadata?.isAutomatic, true);
  assert.ok(newLog?.sentAt);
  assert.ok(newLog?.cooldownUntil);

  assert.equal(newActivity?.type, "retention_email_sent");
  assert.equal(newActivity?.metadata?.isAutomatic, true);

  // 11. SECOND-ATTEMPT COOLDOWN VERIFICATION (IDEMPOTENCY)
  console.log("\n--- TESTING SECOND ATTEMPT (COOLDOWN PROTECTION) ---");
  const secondAttemptResult = await executeAutomaticRetentionBatch({
    isDryRun: false,
    forceTrigger: true,
    triggeredBy: "controlled_live_email_second_attempt",
    models: { User, Activity, Order, AutomaticRetentionLog, Campaign },
    customCustomers: [testCustomer],
    customPredictions: [
      {
        customer_id: String(testUserId),
        churn_probability: realChurnProbability,
        risk_level: realPrediction.risk_level,
      },
    ],
  });

  console.log("Second Attempt Evaluated:   ", secondAttemptResult.evaluatedCount);
  console.log("Second Attempt Eligible:    ", secondAttemptResult.eligibleCount);
  console.log("Second Attempt Sent:        ", secondAttemptResult.sentCount, "(Must be 0)");
  console.log("Second Attempt Skipped:     ", secondAttemptResult.skippedCount);
  console.log("Second Attempt Skip Reason: ", secondAttemptResult.decisions[0]?.skipReason);

  assert.equal(secondAttemptResult.sentCount, 0, "Second attempt MUST send 0 emails");
  assert.equal(secondAttemptResult.skippedCount, 1, "Second attempt MUST be skipped");
  assert.equal(secondAttemptResult.decisions[0]?.skipReason, "cooldown_active");

  // 12. CLEANUP TEMPORARY TEST DATA
  console.log("\n--- CLEANING UP TEMPORARY TEST DATA ---");
  await AutomaticRetentionLog.deleteMany({ customerId: String(testUserId) });
  await Activity.deleteMany({
    $or: [{ userId: String(testUserId) }, { "metadata.customerId": String(testUserId) }],
  });

  const finalUsersCount = await User.countDocuments();
  const finalActivitiesCount = await Activity.countDocuments();
  const finalOrdersCount = await Order.countDocuments();
  const finalCampaignsCount = await Campaign.countDocuments();
  const finalLogsCount = await AutomaticRetentionLog.countDocuments();

  console.log("Users Count After Cleanup:       ", finalUsersCount, `(Diff: ${finalUsersCount - initialUsersCount})`);
  console.log("Activities Count After Cleanup:  ", finalActivitiesCount, `(Diff: ${finalActivitiesCount - initialActivitiesCount})`);
  console.log("Orders Count After Cleanup:      ", finalOrdersCount, `(Diff: ${finalOrdersCount - initialOrdersCount})`);
  console.log("Campaigns Count After Cleanup:   ", finalCampaignsCount, `(Diff: ${finalCampaignsCount - initialCampaignsCount})`);
  console.log("Logs Count After Cleanup:        ", finalLogsCount, `(Diff: ${finalLogsCount - initialLogsCount})`);

  // 13. RESTORE CONFIGURATION TO SAFE STANDBY
  updateAutomaticRetentionConfig({ enabled: false, dryRun: true });
  console.log("\n--- RESTORING CONFIGURATION ---");
  const restoredConfig = getAutomaticRetentionConfig();
  console.log("AUTOMATIC_RETENTION_ENABLED: ", restoredConfig.enabled, "(false)");
  console.log("AUTOMATIC_RETENTION_DRY_RUN: ", restoredConfig.dryRun, "(true)");

  assert.equal(restoredConfig.enabled, false);
  assert.equal(restoredConfig.dryRun, true);

  console.log("\n=================================================================");
  console.log(" CONTROLLED LIVE TEST COMPLETED SUCCESSFULLY WITH 1 REAL EMAIL");
  console.log("=================================================================");
});
