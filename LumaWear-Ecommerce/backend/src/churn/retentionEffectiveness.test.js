/**
 * churn/retentionEffectiveness.test.js
 * Comprehensive Node test suite for Phase 12 Retention Effectiveness & Experiment Analytics.
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
        name: "Admin User",
        email: `admin-eff-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
      createdUserIds.push(testAdminUser._id);
    }

    testCustomerUser = await User.findOne({ role: "customer" });
    if (!testCustomerUser) {
      testCustomerUser = await User.create({
        name: "Customer Effectiveness Test",
        email: `customer-eff-${Date.now()}@example.com`,
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

test("GET /api/churn/campaign-effectiveness rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/campaign-effectiveness`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/campaign-effectiveness rejects non-admin users with 403", async () => {
  const customerToken = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/campaign-effectiveness`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.message.includes("Administrator access is required"));
});

test("GET /api/churn/campaign-effectiveness calculates observational risk changes and contains non-causal disclaimer", async () => {
  const token = makeToken(testAdminUser);

  // 1. Create a staged test campaign to verify effectiveness calculations
  const createRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      campaignType: "cart_abandonment",
      name: "Effectiveness Test Campaign",
      priority: "High",
      targetCustomerIds: [testCustomerUser._id.toString()],
      customerProbabilities: { [testCustomerUser._id.toString()]: 0.72 },
      customerRiskLevels: { [testCustomerUser._id.toString()]: "High" },
      customerTopDrivers: { [testCustomerUser._id.toString()]: "Cart Abandonment" },
      suggestedMessage: "Complete your order with free shipping.",
    }),
  });
  assert.equal(createRes.status, 201);
  const { campaign } = await createRes.json();
  if (campaign?.campaignId) {
    createdCampaignIds.push(campaign.campaignId);
  }

  // 2. Fetch campaign effectiveness
  const res = await fetch(`${baseUrl}/api/churn/campaign-effectiveness`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.summary);
  assert.ok(typeof data.summary.totalCampaigns === "number");
  assert.ok(typeof data.summary.totalCustomersTargeted === "number");
  assert.ok(Array.isArray(data.campaigns));
  assert.ok(data.campaigns.length >= 1);
  assert.ok(data.disclaimer.includes("observed changes") || data.disclaimer.includes("observational"));
  assert.ok(data.disclaimer.includes("campaign") || data.disclaimer.includes("causality"));

  const matchedCampaign = data.campaigns.find((c) => c.campaignId === campaign.campaignId);
  assert.ok(matchedCampaign);
  assert.equal(matchedCampaign.targetCustomerCount, 1);
  assert.equal(matchedCampaign.highRiskTargetCount, 1);
  assert.equal(matchedCampaign.averageBaselineChurnProbability, 0.72);
  assert.ok(typeof matchedCampaign.averageLatestChurnProbability === "number");
  assert.ok(typeof matchedCampaign.averageRiskChange === "number");
  assert.ok(Array.isArray(matchedCampaign.customerDeltas));
});

test("GET /api/churn/risk-movement/:userId returns 404 for unknown customer", async () => {
  const token = makeToken(testAdminUser);
  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await fetch(`${baseUrl}/api/churn/risk-movement/${fakeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.message.includes("not found"));
});

test("GET /api/churn/risk-movement/:userId returns full before-vs-after risk transitions and timeline", async () => {
  const token = makeToken(testAdminUser);
  const uid = testCustomerUser._id.toString();

  const res = await fetch(`${baseUrl}/api/churn/risk-movement/${uid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.userId, uid);
  assert.ok(data.user);
  assert.ok(data.earliestRisk);
  assert.ok(typeof data.earliestRisk.churnProbability === "number");
  assert.ok(data.earliestRisk.riskLevel);
  assert.ok(data.latestRisk);
  assert.ok(typeof data.latestRisk.churnProbability === "number");
  assert.ok(data.latestRisk.riskLevel);
  assert.ok(typeof data.probabilityChange === "number");
  assert.ok(data.riskTierTransition.includes("→"));
  assert.ok(Array.isArray(data.timeline));
  assert.ok(data.timeline.length >= 1);
  assert.ok(data.disclaimer.includes("observed change in model prediction"));
});

test("Snapshot isolation: users, orders, activities collections remain unmodified", async () => {
  const initialUserCount = await User.countDocuments();
  const initialOrderCount = await Order.countDocuments();
  const initialActivityCount = await Activity.countDocuments();

  const token = makeToken(testAdminUser);
  await fetch(`${baseUrl}/api/churn/campaign-effectiveness`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await fetch(`${baseUrl}/api/churn/risk-movement/${testCustomerUser._id.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const finalUserCount = await User.countDocuments();
  const finalOrderCount = await Order.countDocuments();
  const finalActivityCount = await Activity.countDocuments();

  assert.equal(finalUserCount, initialUserCount, "Users count must not change");
  assert.equal(finalOrderCount, initialOrderCount, "Orders count must not change");
  assert.equal(finalActivityCount, initialActivityCount, "Activities count must not change");
});
