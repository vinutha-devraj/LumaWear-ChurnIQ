/**
 * churn/businessImpact.test.js
 * Comprehensive Node test suite for Phase 10 Business Impact & Revenue-at-Risk Analytics.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
const { app, User, Order, Activity } = await import("../server.js");

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
        email: `admin-biz-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
    }

    testCustomerUser = await User.findOne({ role: "customer" });
    if (!testCustomerUser) {
      testCustomerUser = await User.create({
        name: "Customer User",
        email: `customer-biz-${Date.now()}@example.com`,
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

test("GET /api/churn/business-impact rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/business-impact`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/business-impact rejects non-admin users with 403", async () => {
  const customerToken = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/business-impact`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.message.includes("Administrator access is required"));
});

test("GET /api/churn/business-impact calculates revenue at risk, tier distributions, and preserves database immutability", async () => {
  const initialUserCount = await User.countDocuments();
  const initialOrderCount = await Order.countDocuments();
  const initialActivityCount = await Activity.countDocuments();

  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/business-impact`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // If FastAPI is running, status is 200; if offline in unit test environment, status is 503
  if (res.status === 200) {
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.summary, "summary object must exist");
    assert.ok(typeof data.summary.totalCustomerValue === "number");
    assert.ok(typeof data.summary.estimatedRevenueAtRisk === "number");
    assert.ok(data.summary.totalCustomerValue >= 0, "totalCustomerValue cannot be negative");
    assert.ok(data.summary.estimatedRevenueAtRisk >= 0, "estimatedRevenueAtRisk cannot be negative");
    assert.ok(data.summary.revenueAtRiskPercentage >= 0 && data.summary.revenueAtRiskPercentage <= 100);

    // Verify Tier Breakdown
    assert.ok(data.tierBreakdown.low, "tierBreakdown.low must exist");
    assert.ok(data.tierBreakdown.medium, "tierBreakdown.medium must exist");
    assert.ok(data.tierBreakdown.high, "tierBreakdown.high must exist");
    assert.ok(data.tierBreakdown.very_high, "tierBreakdown.very_high must exist");

    assert.ok(data.tierBreakdown.low.revenueAtRisk >= 0);
    assert.ok(data.tierBreakdown.high.revenueAtRisk >= 0);

    // Verify Disclaimer presence
    assert.ok(data.disclaimer.includes("Estimated Revenue at Risk"));
    assert.ok(data.disclaimer.includes("not represent guaranteed future revenue loss"));

    // Verify Top Customers
    assert.ok(Array.isArray(data.topValueAtRiskCustomers));
    if (data.topValueAtRiskCustomers.length > 0) {
      const top = data.topValueAtRiskCustomers[0];
      assert.ok(top.userId);
      assert.ok(typeof top.historicalSpend === "number");
      assert.ok(typeof top.revenueAtRisk === "number");
      assert.ok(top.topDriver);
      assert.ok(top.recommendedAction);
    }
  } else {
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.service_status, "offline");
  }

  // Database Immutability Check
  const finalUserCount = await User.countDocuments();
  const finalOrderCount = await Order.countDocuments();
  const finalActivityCount = await Activity.countDocuments();

  assert.equal(finalUserCount, initialUserCount, "Users collection must remain strictly unchanged");
  assert.equal(finalOrderCount, initialOrderCount, "Orders collection must remain strictly unchanged");
  assert.equal(finalActivityCount, initialActivityCount, "Activities collection must remain strictly unchanged");
});
