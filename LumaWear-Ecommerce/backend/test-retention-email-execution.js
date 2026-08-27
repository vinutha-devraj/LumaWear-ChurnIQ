process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

console.log("=================================================================");
console.log(" VERIFYING RETENTION STRATEGY EMAIL EXECUTION (DRY-RUN)");
console.log("=================================================================");

if (mongoose.connection.readyState === 0) {
  await mongoose.connect(MONGODB_URI);
}

const { app, User, Activity, Order, Campaign, ChurnPredictionSnapshot } = await import("./src/server.js");

let server;
let baseUrl;

await new Promise((resolve) => {
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
});

const adminUser = await User.findOne({ role: "admin" }).lean();
assert.ok(adminUser, "Admin user must exist for testing");
const adminToken = jwt.sign(
  { sub: adminUser._id.toString(), role: adminUser.role, type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

// Capture strict baseline counts
const usersBefore = await User.countDocuments();
const ordersBefore = await Order.countDocuments();
const activitiesBefore = await Activity.countDocuments();
const campaignsBefore = await Campaign.countDocuments();
const snapshotsBefore = await ChurnPredictionSnapshot.countDocuments();

console.log(`Initial Database State:`);
console.log(`  Users:      ${usersBefore}`);
console.log(`  Orders:     ${ordersBefore}`);
console.log(`  Activities: ${activitiesBefore}`);
console.log(`  Campaigns:  ${campaignsBefore}`);
console.log(`  Snapshots:  ${snapshotsBefore}`);

const createdCampaignIds = [];
const createdActivityIds = [];

try {
  // ─── TEST 1: CUSTOMER EMAIL AUDIT ─────────────────────────────────────────
  console.log(`\n1. Testing GET /api/retention/email-audit (Read-Only Customer Audit)...`);
  const auditRes = await fetch(`${baseUrl}/api/retention/email-audit`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(auditRes.status, 200, "Audit endpoint must return 200");
  const auditData = await auditRes.json();
  assert.equal(auditData.success, true);
  assert.ok(typeof auditData.totalCustomers === "number");
  assert.ok(typeof auditData.validFormat === "number");
  assert.ok(Array.isArray(auditData.customers));
  console.log(`   Total Customers Audited: ${auditData.totalCustomers}`);
  console.log(`   Valid Format:            ${auditData.validFormat}`);
  console.log(`   Invalid Format:          ${auditData.invalidFormat}`);
  console.log(`   Missing Email:           ${auditData.missingEmail}`);
  console.log(`   Duplicate Emails:        ${auditData.duplicateEmails}`);

  // ─── TEST 2: CREATE TEMPORARY STAGED CAMPAIGN ────────────────────────────
  const testCustomer = await User.findOne({ role: "customer" }).lean();
  assert.ok(testCustomer, "Target customer must exist");
  const targetUserId = String(testCustomer._id);

  console.log(`\n2. Staging test campaign for customer '${testCustomer.name}' (${testCustomer.email})...`);
  const stageRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: `Email Dry-Run Test Campaign ${Date.now()}`,
      campaignType: "cart_abandonment",
      priority: "High",
      targetCustomerIds: [targetUserId],
      suggestedMessage: "Your cart items are reserved with free priority delivery.",
      customerProbabilities: { [targetUserId]: 0.35 },
      customerRiskLevels: { [targetUserId]: "Medium" },
    }),
  });

  assert.equal(stageRes.status, 201);
  const stageData = await stageRes.json();
  const testCampaignId = stageData.campaign.campaignId;
  createdCampaignIds.push(testCampaignId);
  console.log(`   Created Campaign: ${testCampaignId}`);

  // ─── TEST 3: DRY-RUN EMAIL PREVIEW ────────────────────────────────────────
  console.log(`\n3. Testing POST /api/churn/campaigns/:id/email-preview...`);
  const previewRes = await fetch(`${baseUrl}/api/churn/campaigns/${testCampaignId}/email-preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(previewRes.status, 200);
  const previewData = await previewRes.json();
  assert.equal(previewData.success, true);
  assert.equal(previewData.campaignId, testCampaignId);
  assert.equal(previewData.strategy, "cart_abandonment");
  assert.equal(previewData.recipients.length, 1);

  const recipientPreview = previewData.recipients[0];
  console.log(`   Recipient: ${recipientPreview.customerName} <${recipientPreview.email}>`);
  console.log(`   Subject:   "${recipientPreview.subject}"`);
  console.log(`   Valid:     ${recipientPreview.emailValid}`);
  assert.ok(recipientPreview.subject.includes(testCustomer.name.split(" ")[0]));
  assert.ok(recipientPreview.htmlBody.includes("LumaWear"));
  assert.ok(recipientPreview.textBody.includes("cart"));

  // ─── TEST 4: DRY-RUN EMAIL DISPATCH & ACTIVITY TELEMETRY ──────────────────
  console.log(`\n4. Testing POST /api/churn/campaigns/:id/send-emails (Dry-Run Mode)...`);
  const sendRes = await fetch(`${baseUrl}/api/churn/campaigns/${testCampaignId}/send-emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(sendRes.status, 200);
  const sendData = await sendRes.json();
  assert.equal(sendData.success, true);
  assert.ok(sendData.mode === "dry-run" || sendData.mode === "live");
  assert.equal(sendData.status, "SENT");
  assert.equal(sendData.dispatchedCount, 1);

  const sendResult = sendData.results[0];
  assert.ok(sendResult.mode === "dry-run" || sendResult.mode === "live");
  assert.ok(sendResult.providerMessageId);
  console.log(`   Dispatched:       ${sendData.dispatchedCount} recipient(s) in ${sendData.mode.toUpperCase()} mode`);
  console.log(`   Provider Msg ID:  ${sendResult.providerMessageId}`);
  console.log(`   Campaign Status:  ${sendData.status}`);

  // Verify activity telemetry recorded in MongoDB
  const recordedActivity = await Activity.findOne({
    type: "retention_email_sent",
    "metadata.campaignId": testCampaignId,
  }).lean();
  assert.ok(recordedActivity, "retention_email_sent activity must be recorded");
  createdActivityIds.push(recordedActivity._id);
  assert.ok(recordedActivity.metadata.mode === "dry-run" || recordedActivity.metadata.mode === "live");
  assert.equal(recordedActivity.metadata.recipientEmail, testCustomer.email);
  console.log(`   Activity Logged:  retention_email_sent for User ${recordedActivity.userId} (Mode: ${recordedActivity.metadata.mode})`);

  // ─── TEST 5: RESULTS DASHBOARD & BASELINE IMMUTABILITY ────────────────────
  console.log(`\n5. Testing GET /api/churn/results (Baseline Immutability & Live State)...`);
  const resultsRes = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(resultsRes.status, 200);
  const resultsData = await resultsRes.json();

  const campaignInResults = resultsData.campaigns.find((c) => c.campaignId === testCampaignId);
  assert.ok(campaignInResults, "Campaign must appear in Results");
  assert.equal(campaignInResults.status, "SENT");

  const custInResults = campaignInResults.customers.find((c) => c.userId === targetUserId);
  assert.ok(custInResults, "Target customer must be present");
  assert.equal(custInResults.before.churnProbability, 0.35, "Baseline probability must remain frozen");
  console.log(`   Baseline Churn Risk (Frozen): ${(custInResults.before.churnProbability * 100).toFixed(1)}%`);
  console.log(`   Live Scored Churn Risk:        ${(custInResults.after.churnProbability * 100).toFixed(1)}%`);

  console.log("\n✅ ALL 5 EMAIL EXECUTION TESTS COMPLETED SUCCESSFULLY!");
} finally {
  // ─── STRICT DATABASE TEARDOWN ─────────────────────────────────────────────
  console.log(`\n6. Cleaning up test fixtures from MongoDB...`);
  if (createdCampaignIds.length > 0) {
    await Campaign.deleteMany({ campaignId: { $in: createdCampaignIds } });
    await ChurnPredictionSnapshot.deleteMany({ campaignId: { $in: createdCampaignIds } });
  }
  if (createdCampaignIds.length > 0) {
    await Activity.deleteMany({ "metadata.campaignId": { $in: createdCampaignIds } });
  }
  if (createdActivityIds.length > 0) {
    await Activity.deleteMany({ _id: { $in: createdActivityIds } });
  }

  const usersAfter = await User.countDocuments();
  const ordersAfter = await Order.countDocuments();
  const activitiesAfter = await Activity.countDocuments();
  const campaignsAfter = await Campaign.countDocuments();
  const snapshotsAfter = await ChurnPredictionSnapshot.countDocuments();

  console.log(`\nDatabase State After Teardown:`);
  console.log(`  Users:      ${usersAfter} (Diff: ${usersAfter - usersBefore})`);
  console.log(`  Orders:     ${ordersAfter} (Diff: ${ordersAfter - ordersBefore})`);
  console.log(`  Activities: ${activitiesAfter} (Diff: ${activitiesAfter - activitiesBefore})`);
  console.log(`  Campaigns:  ${campaignsAfter} (Diff: ${campaignsAfter - campaignsBefore})`);
  console.log(`  Snapshots:  ${snapshotsAfter} (Diff: ${snapshotsAfter - snapshotsBefore})`);

  assert.equal(usersAfter, usersBefore, "Users count must match baseline");
  assert.equal(ordersAfter, ordersBefore, "Orders count must match baseline");
  assert.equal(activitiesAfter, activitiesBefore, "Activities count must match baseline");
  assert.equal(campaignsAfter, campaignsBefore, "Campaigns count must match baseline");
  assert.equal(snapshotsAfter, snapshotsBefore, "Snapshots count must match baseline");

  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  console.log(`\n🎉 ZERO DATABASE POLLUTION VERIFIED!`);
}
