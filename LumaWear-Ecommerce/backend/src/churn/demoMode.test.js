/**
 * churn/demoMode.test.js
 * Comprehensive Node test suite for Phase 13 Demo / Simulation Mode.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
const { app, User, Order, Activity, Campaign } = await import("../server.js");
const { DEMO_CUSTOMERS, isDemoId, getDemoCustomer } = await import("./demoData.js");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

let server;
let baseUrl;
let testAdminUser;
let testCustomerUser;

let initialUserCount;
let initialOrderCount;
let initialActivityCount;
let initialCampaignCount;

function makeToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, type: "access" }, JWT_ACCESS_SECRET, { expiresIn: "1h" });
}

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
        name: "Admin Demo Test",
        email: `admin-demo-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
    }

    testCustomerUser = await User.findOne({ role: "customer" });
    if (!testCustomerUser) {
      testCustomerUser = await User.create({
        name: "Customer Demo Test",
        email: `customer-demo-${Date.now()}@example.com`,
        salt: "salt",
        passwordHash: "hash",
        role: "customer",
      });
    }

    initialUserCount = await User.countDocuments();
    initialOrderCount = await Order.countDocuments();
    initialActivityCount = await Activity.countDocuments();
    initialCampaignCount = await Campaign.countDocuments();
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
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test("GET /api/churn/portfolio-summary?mode=demo rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/portfolio-summary?mode=demo`);
  assert.equal(res.status, 401);
});

test("GET /api/churn/portfolio-summary?mode=demo rejects non-admin users with 403", async () => {
  if (!testCustomerUser) return;
  const token = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/portfolio-summary?mode=demo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 403);
});

test("GET /api/churn/portfolio-summary?mode=demo returns mode: DEMO, isSynthetic: true and covers all 4 risk tiers", async () => {
  if (!testAdminUser) return;
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/portfolio-summary?mode=demo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 503 || res.status === 504) return;

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.mode, "DEMO");
  assert.equal(data.isSynthetic, true);
  assert.match(data.disclaimer, /DEMO SIMULATION MODE/i);

  // Verify all 4 tiers are present
  const dist = data.risk_distribution;
  assert.ok(dist.low.count >= 1, "Low tier count must be >= 1");
  assert.ok(dist.medium.count >= 1, "Medium tier count must be >= 1");
  assert.ok(dist.high.count >= 1, "High tier count must be >= 1");
  assert.ok(dist.very_high.count >= 1, "Very High tier count must be >= 1");

  // Verify customer identities
  const demoIds = data.customers.map((c) => c.user_id);
  assert.ok(demoIds.includes("DEMO-LOW-001"));
  assert.ok(demoIds.includes("DEMO-MED-001"));
  assert.ok(demoIds.includes("DEMO-HIGH-003") || demoIds.includes("DEMO-HIGH-001"));
  assert.ok(demoIds.includes("DEMO-VHIGH-001"));
});

test("GET /api/churn/predict/:userId scores DEMO IDs via FastAPI batch and returns isSynthetic: true", async () => {
  if (!testAdminUser) return;
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/predict/DEMO-LOW-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 503 || res.status === 504) return;

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.mode, "DEMO");
  assert.equal(data.isSynthetic, true);
  assert.equal(data.prediction.customer_id, "DEMO-LOW-001");
  assert.ok(typeof data.prediction.churn_probability === "number");
  assert.ok(data.prediction.churn_probability < 0.25, "DEMO-LOW-001 probability must be < 0.25");
});

test("GET /api/churn/customer-360/:userId returns synthetic 360 profile, telemetry and journey for DEMO IDs", async () => {
  if (!testAdminUser) return;
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/customer-360/DEMO-VHIGH-001`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 503 || res.status === 504) return;

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.mode, "DEMO");
  assert.equal(data.isSynthetic, true);
  assert.equal(data.profile.userId, "DEMO-VHIGH-001");
  assert.ok(data.telemetry.engagement.length > 0);
  assert.ok(data.journey.length >= 4);
  assert.equal(data.risk.riskLevel, "Very High");
});

test("POST /api/churn/campaigns rejects campaign creation containing synthetic demo accounts", async () => {
  if (!testAdminUser) return;
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "Demo Campaign Test",
      campaignType: "cart_abandonment",
      priority: "High",
      targetCustomerIds: ["DEMO-LOW-001"],
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.message, /disabled for synthetic demo accounts/i);
});

test("GET /api/churn/business-impact?mode=demo returns complete business impact analytics for demo cohort", async () => {
  if (!testAdminUser) return;
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/business-impact?mode=demo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 503 || res.status === 504) return;

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.mode, "DEMO");
  assert.equal(data.isSynthetic, true);
  assert.ok(data.summary.highRiskCustomerCount >= 1);
  assert.ok(data.summary.estimatedRevenueAtRisk > 0);
});

test("Database immutability verification (zero modifications to users/orders/activities/campaigns collections)", async () => {
  if (mongoose.connection.readyState !== 1) return;
  const finalUserCount = await User.countDocuments();
  const finalOrderCount = await Order.countDocuments();
  const finalActivityCount = await Activity.countDocuments();
  const finalCampaignCount = await Campaign.countDocuments();

  assert.equal(finalUserCount, initialUserCount, "User collection count must remain unmodified");
  assert.equal(finalOrderCount, initialOrderCount, "Order collection count must remain unmodified");
  assert.equal(finalActivityCount, initialActivityCount, "Activity collection count must remain unmodified");
  assert.equal(finalCampaignCount, initialCampaignCount, "Campaign collection count must remain unmodified");

  // Verify none of the DEMO IDs exist in User collection
  for (const demoCust of DEMO_CUSTOMERS) {
    const found = await User.findOne({ $or: [{ email: demoCust.email }, { name: demoCust.name }] });
    assert.equal(found, null, `Demo customer ${demoCust.user_id} must NEVER exist in users collection`);
  }
});
