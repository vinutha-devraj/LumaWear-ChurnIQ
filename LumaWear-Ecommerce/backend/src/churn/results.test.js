/**
 * churn/results.test.js
 * Comprehensive Node test suite for Phase 14 Real Before vs After Campaign Results.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
const { app, User, Order, Activity, Campaign, ChurnPredictionSnapshot } = await import("../server.js");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

let server;
let baseUrl;
let testAdminUser;
let testCustomerUser;

function makeToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, type: "access" }, JWT_ACCESS_SECRET, { expiresIn: "1h" });
}

let createdUserIds = [];
let createdCampaignIds = [];

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear", {
      dbName: process.env.MONGODB_DB || "lumawear",
      serverSelectionTimeoutMS: 2000,
    }).catch(() => {});
  }

  if (mongoose.connection.readyState === 1) {
    testAdminUser = await User.findOne({ role: "admin" });
    if (!testAdminUser) {
      testAdminUser = await User.create({
        name: "Admin Results Test",
        email: `admin-results-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
      createdUserIds.push(testAdminUser._id);
    }

    testCustomerUser = await User.findOne({ role: "customer" });
    if (!testCustomerUser) {
      testCustomerUser = await User.create({
        name: "Customer Results Test",
        email: `customer-results-${Date.now()}@example.com`,
        salt: "salt",
        passwordHash: "hash",
        role: "customer",
      });
      createdUserIds.push(testCustomerUser._id);
    }
  }

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (createdCampaignIds.length > 0) {
    await Campaign.deleteMany({ campaignId: { $in: createdCampaignIds } });
    await ChurnPredictionSnapshot.deleteMany({ campaignId: { $in: createdCampaignIds } });
  }
  if (createdUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Activity.deleteMany({ userId: { $in: createdUserIds } });
    await Order.deleteMany({ userId: { $in: createdUserIds } });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test("GET /api/churn/results rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/results`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/results rejects non-admin users with 403", async () => {
  const customerToken = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.message.includes("Administrator access is required"));
});

test("GET /api/churn/results returns real before vs after comparison, percentage points, and disclaimer", async () => {
  const token = makeToken(testAdminUser);

  // 1. Create a staged test campaign to verify results calculations
  const createRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      campaignType: "cart_abandonment",
      priority: "High",
      name: `Results Test Campaign ${Date.now()}`,
      targetCustomerIds: [testCustomerUser._id.toString()],
      customerProbabilities: { [testCustomerUser._id.toString()]: 0.82 },
      customerRiskLevels: { [testCustomerUser._id.toString()]: "Very High" },
      suggestedMessage: "Complete your order with exclusive 15% discount!",
    }),
  });

  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  assert.ok(createData.campaign);
  assert.ok(createData.campaign.campaignId);
  createdCampaignIds.push(createData.campaign.campaignId);

  // 2. Query /api/churn/results
  const res = await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.ok(data.summary);
  assert.ok(typeof data.summary.totalCampaigns === "number");
  assert.ok(typeof data.summary.totalCustomersTargeted === "number");
  assert.ok(typeof data.summary.customersWithReducedRisk === "number");
  assert.ok(typeof data.summary.customersWithIncreasedRisk === "number");
  assert.ok(typeof data.summary.customersWithUnchangedRisk === "number");
  assert.ok(typeof data.summary.averageRiskChange === "number");
  assert.ok(Array.isArray(data.campaigns));

  // Verify disclaimer text
  assert.ok(data.disclaimer);
  assert.ok(
    data.disclaimer.includes(
      "Results show observed changes in customer behavior and predicted churn risk between the campaign baseline and the latest available customer state"
    )
  );
  assert.ok(
    data.disclaimer.includes(
      "A reduction in predicted churn risk does not by itself prove that the campaign caused the improvement"
    )
  );

  // Find the created campaign
  const targetCampaign = data.campaigns.find((c) => c.campaignId === createData.campaign.campaignId);
  assert.ok(targetCampaign, "Created campaign must be in results list");
  assert.equal(targetCampaign.targetCustomerCount, 1);
  assert.equal(targetCampaign.averageBaselineChurnProbability, 0.82);

  // Verify customer deltas and structured before vs after
  assert.ok(Array.isArray(targetCampaign.customers));
  assert.equal(targetCampaign.customers.length, 1);

  const customerResult = targetCampaign.customers[0];
  assert.equal(customerResult.userId, testCustomerUser._id.toString());

  // Before state check
  assert.ok(customerResult.before);
  assert.equal(customerResult.before.churnProbability, 0.82);
  assert.equal(customerResult.before.riskLevel, "Very High");
  assert.ok(typeof customerResult.before.orderCount === "number");
  assert.ok(typeof customerResult.before.totalSpend === "number");

  // After / Latest state check
  assert.ok(customerResult.after);
  assert.ok(typeof customerResult.after.churnProbability === "number");
  assert.ok(["Low", "Medium", "High", "Very High"].includes(customerResult.after.riskLevel));
  assert.ok(typeof customerResult.after.orderCount === "number");
  assert.ok(typeof customerResult.after.totalSpend === "number");

  // Change check
  assert.ok(customerResult.change);
  assert.ok(typeof customerResult.change.probabilityChange === "number");
  assert.ok(typeof customerResult.change.percentagePoints === "number");
  assert.ok(["Reduced", "Increased", "Unchanged"].includes(customerResult.change.status));
  assert.ok(customerResult.change.riskTierTransition.includes("Very High →"));
});

test("Baseline snapshot preservation: Historical baseline probability is immutable", async () => {
  const token = makeToken(testAdminUser);

  const snapshot = await ChurnPredictionSnapshot.findOne({ userId: testCustomerUser._id.toString() })
    .sort({ capturedAt: -1 })
    .lean();

  if (snapshot) {
    const originalProb = snapshot.churnProbability;
    const originalDate = snapshot.capturedAt;

    // Fetch /api/churn/results again
    await fetch(`${baseUrl}/api/churn/results`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Verify snapshot in database was not overwritten or mutated
    const currentSnapshot = await ChurnPredictionSnapshot.findById(snapshot._id).lean();
    assert.equal(currentSnapshot.churnProbability, originalProb, "Baseline probability in snapshot must not change");
    assert.equal(
      new Date(currentSnapshot.capturedAt).getTime(),
      new Date(originalDate).getTime(),
      "Snapshot timestamp must remain historical"
    );
  }
});

test("Synthetic DEMO-* customers cannot create real campaign records", async () => {
  const token = makeToken(testAdminUser);

  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      campaignType: "vip_retention",
      priority: "High",
      name: "Demo Persona Campaign Attempt",
      targetCustomerIds: ["DEMO-HIGH-01"],
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.message.includes("disabled for synthetic demo accounts"));
});

test("Database read-only integrity: Analytics endpoints do not mutate users, orders, or activities", async () => {
  const token = makeToken(testAdminUser);

  const [initialUsers, initialOrders, initialActivities] = await Promise.all([
    User.countDocuments(),
    Order.countDocuments(),
    Activity.countDocuments(),
  ]);

  await fetch(`${baseUrl}/api/churn/results`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const [finalUsers, finalOrders, finalActivities] = await Promise.all([
    User.countDocuments(),
    Order.countDocuments(),
    Activity.countDocuments(),
  ]);

  assert.equal(finalUsers, initialUsers, "Users collection count must remain unchanged");
  assert.equal(finalOrders, initialOrders, "Orders collection count must remain unchanged");
  assert.equal(finalActivities, initialActivities, "Activities collection count must remain unchanged");
});
