process.env.NODE_ENV = "test";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import assert from "node:assert/strict";

dotenv.config();

const MONGODB_URI = "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

if (mongoose.connection.readyState === 0) {
  await mongoose.connect(MONGODB_URI);
}

const { app, User, Campaign } = await import("./src/server.js");

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

console.log("=================================================================");
console.log(" VERIFYING STAGE CAMPAIGN & RETENTION STRATEGY PIPELINE FLOW");
console.log("=================================================================");

const adminUser = await User.findOne({ role: "admin" }).lean();
const targetCustomer = await User.findOne({ role: { $ne: "admin" } }).lean();

assert.ok(adminUser, "Admin user must exist");
assert.ok(targetCustomer, "Target customer must exist");

const token = jwt.sign(
  { sub: String(adminUser._id), role: "admin", type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

// 1. Verify 7 Retention Strategies from GET /api/churn/retention-opportunities
const resOpp = await fetch(`${baseUrl}/api/churn/retention-opportunities`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log(`1. GET /api/churn/retention-opportunities: Success=${resOpp.success}`);
console.log(`   Found ${resOpp.clusters?.length} retention strategies:`);
const expectedTypes = [
  "cart_abandonment",
  "inactivity_reengagement",
  "wishlist_followup",
  "product_recommendation",
  "new_customer_onboarding",
  "vip_retention",
  "category_promotion",
];
resOpp.clusters?.forEach((c) => {
  console.log(`   - [${c.type}] "${c.title}" (Priority: ${c.priority}, Targets: ${c.customerCount})`);
  assert.ok(expectedTypes.includes(c.type), `Strategy type ${c.type} must be one of the 7 valid playbooks`);
});

// 2. Stage a Strategy Campaign for Customer X with Strategy Y (in a tracked, isolated manner)
const initialCampaignCount = await Campaign.countDocuments();
const testStrategy = "cart_abandonment";
const testPayload = {
  name: "Temporary Verification Cart Win-Back Campaign",
  campaignType: testStrategy,
  strategy: testStrategy,
  priority: "High",
  targetCustomerIds: [String(targetCustomer._id)],
  suggestedMessage: "Items in your cart are waiting!",
  customerProbabilities: {
    [String(targetCustomer._id)]: 0.1603,
  },
  customerRiskLevels: {
    [String(targetCustomer._id)]: "Low",
  },
  customerTopDrivers: {
    [String(targetCustomer._id)]: "Cart Actions",
  },
};

console.log(`\n2. Staging Campaign with Strategy '${testStrategy}' for Customer '${targetCustomer.name}' (${targetCustomer._id})...`);
const createRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(testPayload),
}).then((r) => r.json());

console.log(`   POST /api/churn/campaigns response:`, createRes.success ? "201 Created" : createRes);
assert.equal(createRes.success, true);
const stagedCamp = createRes.campaign;
assert.ok(stagedCamp.campaignId.startsWith("CAMP-"));
assert.equal(stagedCamp.status, "PLANNED");
assert.equal(stagedCamp.campaignType, testStrategy);

const createdCampaignId = stagedCamp.campaignId;

try {
  // 3. Verify that GET /api/churn/campaigns lists the staged campaign with strategy
  const campList = await fetch(`${baseUrl}/api/churn/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  const foundInHistory = campList.campaigns.find((c) => c.campaignId === createdCampaignId);
  console.log(`\n3. GET /api/churn/campaigns:`);
  console.log(`   Found staged campaign in history: ${Boolean(foundInHistory)}`);
  assert.ok(foundInHistory, "Staged campaign must appear in campaign history");
  assert.equal(foundInHistory.status, "PLANNED");
  assert.equal(foundInHistory.campaignType, testStrategy);

  // 4. Verify that GET /api/churn/results reflects the staged campaign, customer, and strategy
  const resultsRes = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());

  console.log(`\n4. GET /api/churn/results:`);
  const foundInResults = resultsRes.campaigns.find((c) => c.campaignId === createdCampaignId);
  console.log(`   Found staged campaign in results: ${Boolean(foundInResults)}`);
  assert.ok(foundInResults, "Staged campaign must appear in results evaluation");
  assert.equal(foundInResults.strategy, testStrategy);
  assert.equal(foundInResults.strategyName, "Cart Abandonment Recovery");
  assert.equal(foundInResults.status, "PLANNED");

  const targetCustomerResult = foundInResults.customers.find((cust) => cust.userId === String(targetCustomer._id));
  console.log(`   Target customer in results customer list: ${Boolean(targetCustomerResult)}`);
  assert.ok(targetCustomerResult, "Target customer must be present in evaluated campaign customers");
  assert.equal(targetCustomerResult.strategy, testStrategy);
  assert.equal(targetCustomerResult.strategyName, "Cart Abandonment Recovery");
  console.log(`   Customer Strategy: '${targetCustomerResult.strategyName}'`);
  console.log(`   Customer Baseline Risk: ${(targetCustomerResult.before.churnProbability * 100).toFixed(1)}%`);
  console.log(`   Customer Latest Live Risk: ${(targetCustomerResult.after.churnProbability * 100).toFixed(1)}%`);
  console.log(`   Customer Risk Transition: '${targetCustomerResult.change.riskTierTransition}'`);

  console.log(`\n✅ PIPELINE PROVEN: Customer (${targetCustomer.name}) -> Strategy (${testStrategy}) -> Campaign (${createdCampaignId}) -> Results API`);
} finally {
  // 5. TEARDOWN: Clean up the temporary verification campaign immediately
  console.log(`\n5. Teardown: Deleting temporary verification campaign ${createdCampaignId}...`);
  await Campaign.deleteOne({ campaignId: createdCampaignId });
  console.log(`   Teardown complete. Zero database pollution.`);
}

const remainingCampaigns = await Campaign.countDocuments();
console.log(`\nFinal state in MongoDB:`);
console.log(`  Campaigns count: ${remainingCampaigns} (Expected: ${initialCampaignCount})`);
assert.equal(remainingCampaigns, initialCampaignCount);

await new Promise((resolve) => server.close(resolve));
await mongoose.disconnect();
console.log(`\n🎉 ALL VERIFICATION CHECKS PASSED!`);
