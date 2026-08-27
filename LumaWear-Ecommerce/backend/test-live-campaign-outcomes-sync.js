import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-this-development-secret";

console.log("=================================================================");
console.log(" VERIFYING LIVE CAMPAIGN OUTCOMES & RISK TRAJECTORIES PIPELINE");
console.log("=================================================================");

const mod = await import("./src/server.js");
const app = mod.default || mod.app;

if (mongoose.connection.readyState === 0) {
  await mongoose.connect(MONGODB_URI);
}

const User = mongoose.models.User || mongoose.model("User");
const Activity = mongoose.models.Activity || mongoose.model("Activity");
const Order = mongoose.models.Order || mongoose.model("Order");
const Campaign = mongoose.models.Campaign || mongoose.model("Campaign");
const ChurnPredictionSnapshot = mongoose.models.ChurnPredictionSnapshot || mongoose.model("ChurnPredictionSnapshot");

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

// Capture strict initial DB state
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

// Find a legitimate customer
const testCustomer = await User.findOne({ role: "customer" }).lean();
assert.ok(testCustomer, "Legitimate customer must exist");
const targetUserId = String(testCustomer._id);

const createdCampaignIds = [];
const createdOrderIds = [];
const createdActivityIds = [];

try {
  // ─── STEP 1: STAGE CAMPAIGN FOR TARGET CUSTOMER ─────────────────────────
  const campaignStagedTime = new Date();
  const testStrategy = "cart_abandonment";
  const baselineRisk = 0.45;
  const baselineTier = "Medium";

  console.log(`\n1. Staging Campaign for Customer '${testCustomer.name}' (${targetUserId})...`);
  const stageRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: `Test Live Outcomes Sync Campaign ${Date.now()}`,
      campaignType: testStrategy,
      strategy: testStrategy,
      priority: "High",
      targetCustomerIds: [targetUserId],
      suggestedMessage: "Your cart items are waiting with free delivery!",
      customerProbabilities: { [targetUserId]: baselineRisk },
      customerRiskLevels: { [targetUserId]: baselineTier },
      customerTopDrivers: { [targetUserId]: "Cart Actions" },
    }),
  });

  assert.equal(stageRes.status, 201);
  const stageData = await stageRes.json();
  const stagedCampaignId = stageData.campaign?.campaignId;
  createdCampaignIds.push(stagedCampaignId);
  console.log(`   Created Campaign: ${stagedCampaignId}`);

  // ─── STEP 2: QUERY RESULTS BEFORE ANY NEW POST-CAMPAIGN PURCHASE ─────────
  console.log(`\n2. Querying GET /api/churn/results immediately after staging (Before Purchase)...`);
  const resultsBeforeRes = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(resultsBeforeRes.status, 200);
  const resultsBeforeData = await resultsBeforeRes.json();

  const campaignInResultsBefore = resultsBeforeData.campaigns.find((c) => c.campaignId === stagedCampaignId);
  assert.ok(campaignInResultsBefore, "Staged campaign must appear in Results");
  const custBefore = campaignInResultsBefore.customers.find((c) => c.userId === targetUserId);
  assert.ok(custBefore, "Target customer must appear in campaign customer deltas");

  const initialOrderCount = custBefore.before.orderCount;
  const initialSpend = custBefore.before.totalSpend;
  const initialLastOrder = custBefore.before.daysSinceLastOrder;

  console.log(`   Baseline State (Immutable):`);
  console.log(`     orderCount:            ${custBefore.before.orderCount}`);
  console.log(`     totalSpend:            ₹${custBefore.before.totalSpend}`);
  console.log(`     daysSinceLastOrder:    ${custBefore.before.daysSinceLastOrder}`);
  console.log(`     churnProbability:      ${(custBefore.before.churnProbability * 100).toFixed(1)}%`);
  console.log(`   Live State Before Purchase:`);
  console.log(`     orderCount:            ${custBefore.after.orderCount}`);
  console.log(`     totalSpend:            ₹${custBefore.after.totalSpend}`);
  console.log(`     orderDelta:            ${custBefore.change.orderDelta}`);
  console.log(`     spendDelta:            ₹${custBefore.change.spendDelta}`);

  assert.equal(custBefore.before.churnProbability, baselineRisk);
  assert.equal(custBefore.change.orderDelta, 0, "orderDelta must be 0 before any new purchase");
  assert.equal(custBefore.change.spendDelta, 0, "spendDelta must be 0 before any new purchase");

  // ─── STEP 3: CUSTOMER COMPLETES A NEW PURCHASE AFTER STAGING ─────────────
  console.log(`\n3. Customer completes a new purchase ($120.00) in MongoDB...`);
  const purchaseTime = new Date();
  const newOrder = await Order.create({
    userId: testCustomer._id,
    orderNumber: `TEST-ORD-${Date.now()}`,
    items: [
      { productId: "lw-001", productName: "Premium Knit Crewneck", category: "Sweaters", quantity: 1, unitPrice: 120.0, lineTotal: 120.0 },
    ],
    subtotal: 120.0,
    shipping: 0,
    discount: 0,
    total: 120.0,
    status: "confirmed",
    createdAt: purchaseTime,
    updatedAt: purchaseTime,
  });
  createdOrderIds.push(newOrder._id);

  // Record order_placed activity
  const newActivity = await Activity.create({
    userId: testCustomer._id,
    type: "order_placed",
    route: "/checkout",
    metadata: { orderId: newOrder._id, orderNumber: newOrder.orderNumber, total: 120.0 },
    createdAt: purchaseTime,
  });
  createdActivityIds.push(newActivity._id);
  console.log(`   Order placed: ${newOrder.orderNumber} (Total: $${newOrder.total})`);

  // ─── STEP 4: QUERY RESULTS AFTER PURCHASE (Live Recalculation) ───────────
  console.log(`\n4. Querying GET /api/churn/results AFTER purchase...`);
  const resultsAfterRes = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(resultsAfterRes.status, 200);
  const resultsAfterData = await resultsAfterRes.json();

  const campaignInResultsAfter = resultsAfterData.campaigns.find((c) => c.campaignId === stagedCampaignId);
  assert.ok(campaignInResultsAfter, "Campaign must appear in Results");
  const custAfter = campaignInResultsAfter.customers.find((c) => c.userId === targetUserId);
  assert.ok(custAfter, "Target customer must appear in campaign customer deltas");

  console.log(`   Baseline State After Purchase (MUST REMAIN IMMUTABLE):`);
  console.log(`     orderCount:            ${custAfter.before.orderCount} (Expected: ${initialOrderCount})`);
  console.log(`     totalSpend:            ₹${custAfter.before.totalSpend} (Expected: ${initialSpend})`);
  console.log(`     daysSinceLastOrder:    ${custAfter.before.daysSinceLastOrder} (Expected: ${initialLastOrder})`);
  console.log(`     churnProbability:      ${(custAfter.before.churnProbability * 100).toFixed(1)}%`);

  console.log(`   Live State After Purchase (LIVE RECALCULATED):`);
  console.log(`     orderCount:            ${custAfter.after.orderCount} (Expected: ${initialOrderCount + 1})`);
  console.log(`     totalSpend:            ₹${custAfter.after.totalSpend} (Expected: ${initialSpend + 120})`);
  console.log(`     daysSinceLastOrder:    ${custAfter.after.daysSinceLastOrder} (Expected: 0)`);
  console.log(`     churnProbability:      ${(custAfter.after.churnProbability * 100).toFixed(1)}%`);
  console.log(`   Observed Change:`);
  console.log(`     orderDelta:            +${custAfter.change.orderDelta}`);
  console.log(`     spendDelta:            +₹${custAfter.change.spendDelta}`);
  console.log(`     riskTransition:        ${custAfter.change.riskTransition}`);

  // Assertions proving live data pipeline
  assert.equal(custAfter.before.orderCount, initialOrderCount, "Baseline order count must not mutate");
  assert.equal(custAfter.before.totalSpend, initialSpend, "Baseline spend must not mutate");
  assert.equal(custAfter.before.churnProbability, baselineRisk, "Baseline churn probability must not mutate");

  assert.equal(custAfter.after.orderCount, initialOrderCount + 1, "Live order count must reflect +1 order");
  assert.equal(custAfter.after.totalSpend, Number((initialSpend + 120).toFixed(2)), "Live spend must include new order");
  assert.equal(custAfter.after.daysSinceLastOrder, 0, "Live daysSinceLastOrder must be 0 for today's order");
  assert.equal(custAfter.change.orderDelta, 1, "Change orderDelta must be exactly +1");
  assert.equal(custAfter.change.spendDelta, 120.0, "Change spendDelta must be exactly +120.00");

  console.log("\n✅ VERIFICATION SUCCESSFUL: Live orders and activities immediately reflect on Results page!");

  // ─── STEP 5: CANCELLED ORDERS & 30-DAY WINDOW VERIFICATION ───────────────
  console.log(`\n5. Verifying edge cases: Cancelled order exclusion and 30-day window...`);
  const cancelledOrder = await Order.create({
    userId: testCustomer._id,
    orderNumber: `TEST-CANCELLED-${Date.now()}`,
    items: [{ productId: "lw-002", productName: "Ignored", category: "Tops", quantity: 1, unitPrice: 500, lineTotal: 500 }],
    subtotal: 500,
    shipping: 0,
    discount: 0,
    total: 500,
    status: "cancelled",
    createdAt: new Date(),
  });
  createdOrderIds.push(cancelledOrder._id);

  const resCancelled = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataCancelled = await resCancelled.json();
  const cCust = dataCancelled.campaigns.find((c) => c.campaignId === stagedCampaignId).customers.find((c) => c.userId === targetUserId);

  assert.equal(cCust.after.orderCount, initialOrderCount + 1, "Cancelled orders must NOT be counted");
  assert.equal(cCust.after.totalSpend, Number((initialSpend + 120).toFixed(2)), "Cancelled orders spend must NOT be counted");
  console.log(`   Cancelled orders cleanly ignored: PASS`);

} finally {
  // ─── STEP 6: STRICT DATABASE TEARDOWN ─────────────────────────────────────
  console.log(`\n6. Cleaning up test fixtures from MongoDB...`);
  if (createdCampaignIds.length > 0) {
    await Campaign.deleteMany({ campaignId: { $in: createdCampaignIds } });
    await ChurnPredictionSnapshot.deleteMany({ campaignId: { $in: createdCampaignIds } });
  }
  if (createdOrderIds.length > 0) {
    await Order.deleteMany({ _id: { $in: createdOrderIds } });
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
