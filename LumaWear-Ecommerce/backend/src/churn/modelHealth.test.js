/**
 * churn/modelHealth.test.js
 * Comprehensive Node test suite for Phase 11 ML Model Health, Data Drift & Monitoring.
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
        email: `admin-mlops-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
    }

    testCustomerUser = await User.findOne({ role: "customer" });
    if (!testCustomerUser) {
      testCustomerUser = await User.create({
        name: "Customer User MLOps",
        email: `customer-mlops-${Date.now()}@example.com`,
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

test("GET /api/churn/model-health rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/model-health`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/model-health rejects non-admin users with 403", async () => {
  const customerToken = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/model-health`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.message.includes("Administrator access is required"));
});

test("GET /api/churn/model-health returns complete model status, data quality, drift, infrastructure health and preserves database immutability", async () => {
  const initialUserCount = await User.countDocuments();
  const initialOrderCount = await Order.countDocuments();
  const initialActivityCount = await Activity.countDocuments();
  const initialCampaignCount = await Campaign.countDocuments();

  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/model-health`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);

  // 1. Model Status & Metadata Verification
  assert.ok(data.model);
  assert.equal(data.model.activeModelId, "2b2147fd4057", "Active model ID must be 2b2147fd4057");
  assert.equal(data.model.rawFeatureCount, 21, "Raw feature count must be 21");
  assert.equal(data.model.transformedFeatureCount, 29, "Transformed feature count must be 29");
  assert.equal(data.model.cvRocAuc, 0.837);
  assert.ok(data.model.artifactIntegrity.pipeline);
  assert.ok(data.model.artifactIntegrity.shapExplainer);

  // 2. Infrastructure Health Probes
  assert.ok(data.infrastructure);
  assert.ok(data.infrastructure.express);
  assert.ok(data.infrastructure.fastapi);
  assert.ok(data.infrastructure.mongodb);
  assert.equal(data.infrastructure.express.status, "HEALTHY");
  assert.ok(["HEALTHY", "DEGRADED", "OFFLINE"].includes(data.infrastructure.fastapi.status));
  assert.ok(["HEALTHY", "DEGRADED"].includes(data.infrastructure.mongodb.status));

  // 3. Latency Metrics
  assert.ok(data.latency);
  assert.ok(typeof data.latency.totalAnalyticsLatencyMs === "number");
  assert.ok(typeof data.latency.featureExtractionLatencyMs === "number");

  // 4. Data Quality & 21-Feature Contract
  assert.ok(data.dataQuality);
  assert.ok(Array.isArray(data.dataQuality.featureQuality));
  assert.equal(data.dataQuality.featureQuality.length, 21, "Must evaluate exactly 21 raw features");

  const sampleFeature = data.dataQuality.featureQuality[0];
  assert.ok(sampleFeature.feature);
  assert.ok(sampleFeature.label);
  assert.ok(typeof sampleFeature.missingPercentage === "number");

  // 5. Data Drift & PSI Metrics
  assert.ok(data.drift);
  assert.ok(data.drift.summary);
  assert.equal(data.drift.summary.totalFeaturesEvaluated, 21);
  assert.ok(Array.isArray(data.drift.features));
  assert.equal(data.drift.features.length, 21);
  assert.ok(data.drift.disclaimer.includes("Drift indicates"));

  // 6. Prediction Health
  assert.ok(data.predictionHealth);
  assert.ok(typeof data.predictionHealth.successRate === "number");
  assert.ok(Array.isArray(data.predictionHealth.distributionHistogram));
  assert.equal(data.predictionHealth.distributionHistogram.length, 10);

  // 7. Operational Alerts
  assert.ok(Array.isArray(data.alerts));
  assert.ok(data.alerts.length >= 1);

  // 8. Database Immutability Check
  const finalUserCount = await User.countDocuments();
  const finalOrderCount = await Order.countDocuments();
  const finalActivityCount = await Activity.countDocuments();
  const finalCampaignCount = await Campaign.countDocuments();

  assert.equal(finalUserCount, initialUserCount, "Users collection must remain strictly unchanged");
  assert.equal(finalOrderCount, initialOrderCount, "Orders collection must remain strictly unchanged");
  assert.equal(finalActivityCount, initialActivityCount, "Activities collection must remain strictly unchanged");
  assert.equal(finalCampaignCount, initialCampaignCount, "Campaigns collection must remain strictly unchanged");
});
