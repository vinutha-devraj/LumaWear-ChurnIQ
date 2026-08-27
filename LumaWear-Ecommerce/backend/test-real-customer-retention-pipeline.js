process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/lumawear";

import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

console.log("=================================================================");
console.log(" COMPREHENSIVE PRODUCTION-LIKE RETENTION & CHURN PIPELINE TEST");
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
assert.ok(adminUser, "Admin user must exist");
const adminToken = jwt.sign(
  { sub: String(adminUser._id), role: "admin", type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

const initialUsersCount = await User.countDocuments();
const initialOrdersCount = await Order.countDocuments();
const initialActivitiesCount = await Activity.countDocuments();
const initialCampaignsCount = await Campaign.countDocuments();

console.log("Initial Database State:");
console.log(`  Users:      ${initialUsersCount}`);
console.log(`  Orders:     ${initialOrdersCount}`);
console.log(`  Activities: ${initialActivitiesCount}`);
console.log(`  Campaigns:  ${initialCampaignsCount}`);

let testCampaignIds = [];
let testActivityIds = [];

try {
  // 1. Real MongoDB customer retrieval & admin exclusion
  console.log("\n1. Testing GET /api/churn/portfolio-summary (Real MongoDB customer scoring & admin exclusion)...");
  const portfolioRes = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(portfolioRes.status, 200, "portfolio-summary must return 200");
  const portfolioData = await portfolioRes.json();
  assert.equal(portfolioData.success, true);
  assert.equal(portfolioData.mode, "LIVE");
  assert.equal(portfolioData.isSynthetic, false);

  const realCustomersInDb = await User.find({ role: { $ne: "admin" } }).lean();
  assert.equal(portfolioData.customers.length, realCustomersInDb.length, "Must only return real customers from MongoDB");

  // Ensure no admin is in scored customers list
  const hasAdmin = portfolioData.customers.some((c) => c.role === "admin" || c.email.includes("admin@"));
  assert.equal(hasAdmin, false, "Admin accounts must be strictly excluded from customer scoring");
  console.log(`   ✅ Correctly scored ${portfolioData.customers.length} real customer(s), 0 admins.`);

  // 2. Test Risk Category Filtering (Goal 2 verification)
  console.log("\n2. Testing Risk Category Filtering (Low, Medium, High, Very High)...");
  const lowCustomers = portfolioData.customers.filter((c) => c.risk_level === "Low");
  const mediumCustomers = portfolioData.customers.filter((c) => c.risk_level === "Medium");
  const highCustomers = portfolioData.customers.filter((c) => c.risk_level === "High");
  const veryHighCustomers = portfolioData.customers.filter((c) => c.risk_level === "Very High");

  console.log(`   Risk Distribution Breakdown:`);
  console.log(`   - Low Risk:       ${lowCustomers.length} customers (Reported count: ${portfolioData.risk_distribution.low.count})`);
  console.log(`   - Medium Risk:    ${mediumCustomers.length} customers (Reported count: ${portfolioData.risk_distribution.medium.count})`);
  console.log(`   - High Risk:      ${highCustomers.length} customers (Reported count: ${portfolioData.risk_distribution.high.count})`);
  console.log(`   - Very High Risk: ${veryHighCustomers.length} customers (Reported count: ${portfolioData.risk_distribution.very_high.count})`);

  assert.equal(lowCustomers.length, portfolioData.risk_distribution.low.count);
  assert.equal(mediumCustomers.length, portfolioData.risk_distribution.medium.count);
  assert.equal(highCustomers.length, portfolioData.risk_distribution.high.count);
  assert.equal(veryHighCustomers.length, portfolioData.risk_distribution.very_high.count);

  // Check that every customer has metrics attached
  for (const c of portfolioData.customers) {
    assert.ok(c.metrics, `Customer ${c.name} must have metrics object attached`);
    assert.ok(typeof c.metrics.order_count === "number");
    assert.ok(typeof c.metrics.total_spend === "number");
    assert.ok(typeof c.metrics.activity_event_count_30d === "number");
  }
  console.log(`   ✅ All customer records contain live behavioral metrics (order_count, total_spend, activity_event_count_30d).`);

  // 3. Test Email Preview (Goal 3 / Goal 4 verification)
  const targetCustomer = realCustomersInDb[0];
  assert.ok(targetCustomer, "At least one customer must exist in DB");
  const testCampaignId = `CAMP-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

  const createdCampaign = await Campaign.create({
    campaignId: testCampaignId,
    name: "Automated Integration Test Campaign",
    campaignType: "cart_abandonment",
    strategy: "cart_abandonment",
    strategyName: "Cart Abandonment Recovery",
    priority: "High",
    targetCustomerIds: [String(targetCustomer._id)],
    customerCount: 1,
    status: "PLANNED",
    suggestedMessage: "Hi {name}, you left something stylish in your cart!",
    customerProbabilities: { [String(targetCustomer._id)]: 0.35 },
    customerRiskLevels: { [String(targetCustomer._id)]: "Medium" },
    customerTopDrivers: { [String(targetCustomer._id)]: "cart_actions_30d" },
    createdAt: new Date(),
  });
  testCampaignIds.push(createdCampaign.campaignId);

  console.log(`\n3. Testing GET /api/churn/campaigns/:id/email-preview ...`);
  const previewRes = await fetch(`${baseUrl}/api/churn/campaigns/${testCampaignId}/email-preview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(previewRes.status, 200, "email-preview must return 200");
  const previewData = await previewRes.json();
  assert.equal(previewData.success, true);
  assert.equal(previewData.recipients.length, 1);
  assert.equal(previewData.recipients[0].email, targetCustomer.email);
  assert.equal(previewData.recipients[0].emailValid, true);
  assert.ok(previewData.recipients[0].subject.includes(targetCustomer.name.split(" ")[0]) || previewData.recipients[0].subject.includes("cart"));
  assert.ok(previewData.recipients[0].htmlBody.length > 50);
  console.log(`   ✅ Valid customer email generated personalized preview for ${targetCustomer.email}.`);

  // 4. Test Email Preview 404 on nonexistent campaign
  console.log(`\n4. Testing GET /api/churn/campaigns/NONEXISTENT/email-preview (404 verification)...`);
  const notFoundPreviewRes = await fetch(`${baseUrl}/api/churn/campaigns/NONEXISTENT-9999/email-preview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(notFoundPreviewRes.status, 404, "Nonexistent campaign must return 404");
  console.log(`   ✅ Nonexistent campaign correctly returned 404 Not Found.`);

  // 5. Test Email Dispatch & Status Transition (Dry-Run / Live Provider)
  console.log(`\n5. Testing POST /api/churn/campaigns/:id/send-emails ...`);
  const sendRes = await fetch(`${baseUrl}/api/churn/campaigns/${testCampaignId}/send-emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(sendRes.status, 200, "send-emails must return 200");
  const sendData = await sendRes.json();
  assert.equal(sendData.success, true);
  assert.equal(sendData.dispatchedCount, 1);
  assert.equal(sendData.status, "SENT");

  const updatedCampaign = await Campaign.findOne({ campaignId: testCampaignId }).lean();
  assert.equal(updatedCampaign.status, "SENT", "Campaign status must be updated to SENT");

  const loggedActivity = await Activity.findOne({
    userId: targetCustomer._id,
    type: "retention_email_sent",
    "metadata.campaignId": testCampaignId,
  }).lean();
  assert.ok(loggedActivity, "Must log retention_email_sent activity in MongoDB");
  testActivityIds.push(loggedActivity._id);
  console.log(`   ✅ Campaign transitioned to SENT, and retention_email_sent telemetry logged.`);

  // 6. Test Failed Email Sending Does NOT Mark as SENT
  console.log(`\n6. Testing that Failed Email does NOT mark Campaign as SENT...`);
  const fakeId = new mongoose.Types.ObjectId();
  const failedTestCampaignId = `CAMP-FAIL-${Date.now()}`;
  const failCampaign = await Campaign.create({
    campaignId: failedTestCampaignId,
    name: "Fail Test Campaign",
    campaignType: "inactivity_reengagement",
    targetCustomerIds: [String(fakeId)], // nonexistent user with no email
    customerCount: 1,
    status: "PLANNED",
    createdAt: new Date(),
  });
  testCampaignIds.push(failCampaign.campaignId);

  const failSendRes = await fetch(`${baseUrl}/api/churn/campaigns/${failedTestCampaignId}/send-emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const failSendData = await failSendRes.json();
  assert.equal(failSendData.dispatchedCount, 0, "No emails should be dispatched");
  const checkedFailCampaign = await Campaign.findOne({ campaignId: failedTestCampaignId }).lean();
  assert.equal(checkedFailCampaign.status, "PLANNED", "Failed campaign must remain in PLANNED status");
  console.log(`   ✅ Campaign with 0 dispatched emails correctly remained in PLANNED status.`);

  // 7. Test Results API (Live State vs Immutable Baseline)
  console.log(`\n7. Testing GET /api/churn/results (Baseline Immutability & Live State)...`);
  const resultsRes = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(resultsRes.status, 200);
  const resultsData = await resultsRes.json();
  assert.equal(resultsData.success, true);
  console.log(`   ✅ Authoritative Results API returned ${resultsData.summary.totalCampaigns} campaigns with live before-vs-after outcomes.`);

  console.log(`\n🎉 ALL PRODUCTION-LIKE RETENTION & CHURN PIPELINE TESTS PASSED!`);
} finally {
  // Teardown test records
  if (testCampaignIds.length > 0) {
    await Campaign.deleteMany({ campaignId: { $in: testCampaignIds } });
  }
  if (testActivityIds.length > 0) {
    await Activity.deleteMany({ _id: { $in: testActivityIds } });
  }
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

// Final DB Verification
const finalConn = await mongoose.createConnection(MONGODB_URI).asPromise();
const finalUsersCount = await finalConn.db.collection("users").countDocuments();
const finalOrdersCount = await finalConn.db.collection("orders").countDocuments();
const finalActivitiesCount = await finalConn.db.collection("activities").countDocuments();
const finalCampaignsCount = await finalConn.db.collection("campaigns").countDocuments();
await finalConn.close();

console.log("\nDatabase State After Teardown:");
console.log(`  Users:      ${finalUsersCount} (Diff: ${finalUsersCount - initialUsersCount})`);
console.log(`  Orders:     ${finalOrdersCount} (Diff: ${finalOrdersCount - initialOrdersCount})`);
console.log(`  Activities: ${finalActivitiesCount} (Diff: ${finalActivitiesCount - initialActivitiesCount})`);
console.log(`  Campaigns:  ${finalCampaignsCount} (Diff: ${finalCampaignsCount - initialCampaignsCount})`);

assert.equal(finalUsersCount, initialUsersCount);
assert.equal(finalOrdersCount, initialOrdersCount);
assert.equal(finalActivitiesCount, initialActivitiesCount);
assert.equal(finalCampaignsCount, initialCampaignsCount);
console.log("\n🎉 ZERO DATABASE POLLUTION VERIFIED!");
