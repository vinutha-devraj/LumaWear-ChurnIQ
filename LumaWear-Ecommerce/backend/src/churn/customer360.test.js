/**
 * churn/customer360.test.js
 * Comprehensive Node test suite for Phase 10 Customer 360° Intelligence View.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
const { app, User, Order, Activity, Campaign } = await import("../server.js");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

let server;
let baseUrl;
let testAdminUser;
let testCustomerUser;

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
        name: "Admin User",
        email: `admin-c360-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
    }

    testCustomerUser = await User.findOne({ role: "customer" });
    if (!testCustomerUser) {
      testCustomerUser = await User.create({
        name: "Customer User 360",
        email: `customer-c360-${Date.now()}@example.com`,
        salt: "salt",
        passwordHash: "hash",
        role: "customer",
      });
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
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test("GET /api/churn/customer-360/:userId rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/customer-360/${testCustomerUser._id}`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/customer-360/:userId rejects non-admin users with 403", async () => {
  const customerToken = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/customer-360/${testCustomerUser._id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.message.includes("Administrator access is required"));
});

test("GET /api/churn/customer-360/:userId returns 404 for unknown customer ID", async () => {
  const token = makeToken(testAdminUser);
  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await fetch(`${baseUrl}/api/churn/customer-360/${fakeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.message.includes("not found"));
});

test("GET /api/churn/customer-360/:userId returns complete 360 profile, journey, telemetry and preserves database immutability", async () => {
  const initialUserCount = await User.countDocuments();
  const initialOrderCount = await Order.countDocuments();
  const initialActivityCount = await Activity.countDocuments();

  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/customer-360/${testCustomerUser._id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  // 1. Profile Verification
  assert.ok(data.profile);
  assert.equal(data.profile.userId, testCustomerUser._id.toString());
  assert.equal(data.profile.email, testCustomerUser.email);
  assert.ok(typeof data.profile.tenureDays === "number");

  // 2. Risk Scorecard Verification
  assert.ok(data.risk);
  assert.ok(typeof data.risk.churnProbability === "number");
  assert.ok(["Low", "Medium", "High", "Very High"].includes(data.risk.riskLevel));
  assert.ok(Array.isArray(data.risk.topSHAPDrivers));

  // 3. Business Metrics Verification
  assert.ok(data.businessMetrics);
  assert.ok(typeof data.businessMetrics.totalSpend === "number");
  assert.ok(typeof data.businessMetrics.orderCount === "number");
  assert.ok(typeof data.businessMetrics.estimatedRevenueAtRisk === "number");
  assert.ok(data.businessMetrics.estimatedRevenueAtRisk >= 0);

  // 4. Customer Journey Verification
  assert.ok(Array.isArray(data.journey));
  assert.ok(data.journey.length >= 1, "Must contain at least account_created milestone");
  assert.equal(data.journey[0].type, "account_created");

  // 5. 21-Feature Telemetry Verification
  assert.ok(data.telemetry);
  assert.ok(Array.isArray(data.telemetry.engagement), "engagement telemetry must be array");
  assert.ok(Array.isArray(data.telemetry.purchasing), "purchasing telemetry must be array");
  assert.ok(Array.isArray(data.telemetry.customerProfile), "customerProfile telemetry must be array");
  assert.equal(
    data.telemetry.engagement.length + data.telemetry.purchasing.length + data.telemetry.customerProfile.length,
    21,
    "Must group exactly 21 features"
  );

  // 6. Orders and Activities Verification
  assert.ok(Array.isArray(data.orders));
  assert.ok(Array.isArray(data.activities));

  // 7. Retention Context
  assert.ok(data.retentionContext);
  assert.ok(Array.isArray(data.retentionContext.applicableClusters));
  assert.ok(Array.isArray(data.retentionContext.targetedCampaigns));

  // 8. Database Immutability Check
  const finalUserCount = await User.countDocuments();
  const finalOrderCount = await Order.countDocuments();
  const finalActivityCount = await Activity.countDocuments();

  assert.equal(finalUserCount, initialUserCount, "Users collection must remain strictly unchanged");
  assert.equal(finalOrderCount, initialOrderCount, "Orders collection must remain strictly unchanged");
  assert.equal(finalActivityCount, initialActivityCount, "Activities collection must remain strictly unchanged");
});
