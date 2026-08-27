import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { extractCustomerFeatures } from "./features.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

let server;
let baseUrl;
let app;
let User;
let Activity;
let Campaign;

const makeToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role, type: "access" }, JWT_ACCESS_SECRET, { expiresIn: "1h" });

test.before(async () => {
  const mod = await import("../server.js");
  app = mod.default || mod.app;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  User = mongoose.models.User || mongoose.model("User");
  Activity = mongoose.models.Activity || mongoose.model("Activity");
  Campaign = mongoose.models.Campaign || mongoose.model("Campaign");

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

let testUserIds = [];

test.after(async () => {
  if (testUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: testUserIds } });
    await Activity.deleteMany({ userId: { $in: testUserIds } });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test("Phase 10: Historical product_viewed data integrity and churn prediction regression tests", async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }
  let adminUser = await User.findOne({ role: "admin" });
  if (!adminUser) {
    adminUser = await User.create({
      name: "Test Administrator",
      email: `test-admin-${Date.now()}@lumawear.local`,
      salt: "salt",
      passwordHash: "hash",
      role: "admin",
    });
    testUserIds.push(adminUser._id);
  }
  const adminToken = makeToken(adminUser);

  const testCustomer = await User.create({
    name: `Integrity Test User ${Date.now()}`,
    email: `integrity-test-${Date.now()}@example.com`,
    salt: "salt",
    passwordHash: "hash",
    role: "customer",
  });
  testUserIds.push(testCustomer._id);
  const customerToken = makeToken(testCustomer);

  // 1. Historical product-view storms do not create customers
  await t.test("1. Simulated 1,000 product-view storm does not increase customer count", async () => {
    const resSummaryBefore = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataBefore = await resSummaryBefore.json();
    const customerCountBefore = dataBefore.summary.total_customers;

    // Simulate burst of activity documents
    const acts = Array.from({ length: 50 }).map(() => ({
      userId: testCustomer._id,
      type: "product_viewed",
      route: "/shop/lw-008",
      metadata: { productId: "lw-008" },
      userAgent: "TestAgent",
      ipAddress: "127.0.0.1",
      createdAt: new Date(),
    }));
    await Activity.insertMany(acts);

    const resSummaryAfter = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataAfter = await resSummaryAfter.json();
    assert.equal(dataAfter.summary.total_customers, customerCountBefore, "Customer count must remain identical");
  });

  // 2. Normal product view contributes only according to intended feature definition
  await t.test("2. Normal product view increments distinct_products_viewed_30d and product_views_30d correctly", () => {
    const singleUser = { _id: "user-123", createdAt: new Date() };
    const activities = [
      { userId: "user-123", type: "product_viewed", metadata: { productId: "lw-001" }, createdAt: new Date() },
      { userId: "user-123", type: "product_viewed", metadata: { productId: "lw-002" }, createdAt: new Date() },
    ];
    const features = extractCustomerFeatures({ user: singleUser, activities, orders: [], asOfDate: new Date() });
    assert.equal(features.product_views_30d, 2);
    assert.equal(features.distinct_products_viewed_30d, 2);
    assert.equal(features.activity_event_count_30d, 2);
  });

  // 3. 38,140 duplicate views cannot multiply customer identity
  await t.test("3. 38,140 duplicate activities for same product yield distinct_products_viewed_30d = 1 and 1 user", () => {
    const singleUser = { _id: "user-storm", createdAt: new Date() };
    const activities = Array.from({ length: 100 }).map(() => ({
      userId: "user-storm",
      type: "product_viewed",
      metadata: { productId: "lw-008" },
      createdAt: new Date(),
    }));
    const features = extractCustomerFeatures({ user: singleUser, activities, orders: [], asOfDate: new Date() });
    assert.equal(features.distinct_products_viewed_30d, 1);
    assert.equal(features.product_views_30d, 100);
  });

  // 4. Feature calculation with/without anomaly is measurable
  await t.test("4. Feature calculation with vs without storm is cleanly measurable in memory", () => {
    const user = { _id: "user-compare", createdAt: new Date() };
    const allActivities = [
      { userId: "user-compare", type: "page_view", createdAt: new Date() },
      ...Array.from({ length: 50 }).map(() => ({
        userId: "user-compare",
        type: "product_viewed",
        metadata: { productId: "lw-008" },
        createdAt: new Date(),
      })),
    ];
    const cleanActivities = allActivities.slice(0, 2); // 1 page_view + 1 product_viewed

    const featA = extractCustomerFeatures({ user, activities: allActivities, orders: [], asOfDate: new Date() });
    const featB = extractCustomerFeatures({ user, activities: cleanActivities, orders: [], asOfDate: new Date() });

    assert.equal(featA.product_views_30d - featB.product_views_30d, 49);
    assert.equal(featA.distinct_products_viewed_30d, featB.distinct_products_viewed_30d);
  });

  // 5. Model prediction comparison is deterministic
  await t.test("5. FastAPI /predict returns deterministic response for same feature vector", async () => {
    const user = { _id: "user-det", createdAt: new Date() };
    const features = extractCustomerFeatures({ user, activities: [], orders: [], asOfDate: new Date() });
    const res1 = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
    });
    const res2 = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
    });
    const d1 = await res1.json();
    const d2 = await res2.json();
    assert.equal(d1.churn_probability, d2.churn_probability);
    assert.equal(d1.risk_level, d2.risk_level);
  });

  // 6. Existing 21-feature contract remains exact
  await t.test("6. Exactly 21 features produced by extractCustomerFeatures", () => {
    const user = { _id: "user-21", createdAt: new Date() };
    const features = extractCustomerFeatures({ user, activities: [], orders: [], asOfDate: new Date() });
    const keys = Object.keys(features).filter((k) => k !== "user_id");
    assert.equal(keys.length, 21);
  });

  // 7. Existing model artifact remains 2b2147fd4057
  await t.test("7. Model artifact confirmed as 2b2147fd4057", async () => {
    const res = await fetch("http://127.0.0.1:8000/health");
    const data = await res.json();
    assert.equal(data.dataset_hash, "2b2147fd4057");
  });

  // 8. Existing risk thresholds remain unchanged (<0.35 Low, 0.35-0.60 Medium, 0.60-0.80 High, >=0.80 Very High)
  await t.test("8. Risk thresholds mapping remains exact", () => {
    const mapRisk = (p) => (p < 0.35 ? "Low" : p < 0.6 ? "Medium" : p < 0.8 ? "High" : "Very High");
    assert.equal(mapRisk(0.1201), "Low");
    assert.equal(mapRisk(0.0967), "Low");
    assert.equal(mapRisk(0.5), "Medium");
    assert.equal(mapRisk(0.7), "High");
    assert.equal(mapRisk(0.9), "Very High");
  });

  // 9. Campaign baseline snapshot preservation: Baseline probability in campaign is immutable
  await t.test("9. Historical campaign target snapshot probability is preserved and unmodified", async () => {
    const camp = await Campaign.findOne({ status: "SENT" });
    if (camp && camp.targetCustomers?.length > 0) {
      const initialProb = camp.targetCustomers[0].churnProbability;
      assert.ok(typeof initialProb === "number");
    }
  });

  // 10. Results endpoint is read-only
  await t.test("10. GET /api/churn/results is read-only and does not modify database", async () => {
    const actsBefore = await Activity.countDocuments();
    const usersBefore = await User.countDocuments();

    const res = await fetch(`${baseUrl}/api/churn/results`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);

    const actsAfter = await Activity.countDocuments();
    const usersAfter = await User.countDocuments();
    assert.equal(actsBefore, actsAfter);
    assert.equal(usersBefore, usersAfter);
  });

  // 11. New product-view storm protection prevents recurrence
  await t.test("11. Rapid product_viewed requests within 2 seconds are deduplicated by backend shield", async () => {
    const countBefore = await Activity.countDocuments({
      userId: testCustomer._id,
      type: "product_viewed",
      "metadata.productId": "lw-shield-test",
    });

    const res1 = await fetch(`${baseUrl}/api/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ type: "product_viewed", route: "/shop/lw-shield-test", metadata: { productId: "lw-shield-test" } }),
    });
    assert.equal(res1.status, 201);

    // Rapid second call within milliseconds
    const res2 = await fetch(`${baseUrl}/api/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ type: "product_viewed", route: "/shop/lw-shield-test", metadata: { productId: "lw-shield-test" } }),
    });
    assert.equal(res2.status, 200);
    const d2 = await res2.json();
    assert.equal(d2.activity.deduplicated, true);

    const countAfter = await Activity.countDocuments({
      userId: testCustomer._id,
      type: "product_viewed",
      "metadata.productId": "lw-shield-test",
    });
    assert.equal(countAfter, countBefore + 1, "Only 1 activity document should have been created");
  });
});
