import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

let server;
let baseUrl;
let app;
let User;
let Activity;
let Order;

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
  Order = mongoose.models.Order || mongoose.model("Order");

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

let createdUserIds = [];

test.after(async () => {
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

test("Phase 15 Audit: Exact customer count validation and deduplication across multiple scenarios", async (t) => {
  // Create admin for testing
  let admin = await User.findOne({ role: "admin" });
  if (!admin) {
    admin = await User.create({
      name: "Audit Admin",
      email: `audit-admin-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "admin",
    });
    createdUserIds.push(admin._id);
  }
  const adminToken = makeToken(admin);

  // Baseline real customers
  const initialCustomerCount = await User.countDocuments({ role: { $ne: "admin" } });

  // -------------------------------------------------------------------------
  // CASE 1: 1 User + 1 Activity = Exactly 1 Customer
  // -------------------------------------------------------------------------
  await t.test("Case 1: 1 user + 1 activity yields exactly 1 customer", async () => {
    const user1 = await User.create({
      name: `User One ${Date.now()}`,
      email: `user-one-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    createdUserIds.push(user1._id);

    await Activity.create({
      userId: user1._id,
      type: "page_view",
      route: "/catalog",
      userAgent: "Mozilla/5.0",
      ipAddress: "127.0.0.1",
    });

    const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.summary.total_customers, initialCustomerCount + 1);
  });

  // -------------------------------------------------------------------------
  // CASE 2: 1 User + 10 Login Activities = Exactly 1 Customer
  // -------------------------------------------------------------------------
  await t.test("Case 2: 1 user + 10 login activities yields exactly 1 customer", async () => {
    const user2 = await User.create({
      name: `User Two ${Date.now()}`,
      email: `user-two-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    createdUserIds.push(user2._id);

    const loginActivities = Array.from({ length: 10 }).map((_, i) => ({
      userId: user2._id,
      type: "auth_login",
      route: "/api/auth/login",
      metadata: { attempt: i + 1 },
      userAgent: "Mozilla/5.0",
      ipAddress: "127.0.0.1",
    }));
    await Activity.insertMany(loginActivities);

    const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    // User1 + User2 = initial + 2
    assert.equal(data.summary.total_customers, initialCustomerCount + 2);
  });

  // -------------------------------------------------------------------------
  // CASE 3: 1 User + 50 Activities + 5 Orders = Exactly 1 Customer
  // -------------------------------------------------------------------------
  await t.test("Case 3: 1 user + 50 activities + 5 orders yields exactly 1 customer", async () => {
    const user3 = await User.create({
      name: `User Three ${Date.now()}`,
      email: `user-three-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    createdUserIds.push(user3._id);

    // 50 mixed activities
    const activities = Array.from({ length: 50 }).map((_, i) => ({
      userId: user3._id,
      type: i % 3 === 0 ? "cart_add" : i % 2 === 0 ? "product_view" : "page_view",
      route: `/products/${i}`,
      userAgent: "Mozilla/5.0",
      ipAddress: "127.0.0.1",
    }));
    await Activity.insertMany(activities);

    // 5 orders
    const orders = Array.from({ length: 5 }).map((_, i) => ({
      userId: user3._id,
      orderNumber: `LW-AUDIT-${Date.now()}-${i}`,
      items: [
        {
          productId: "audit-p1",
          productName: "Audit Silk Shirt",
          category: "Tops",
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        },
      ],
      subtotal: 100,
      shipping: 0,
      discount: 0,
      total: 100,
      status: "completed",
    }));
    await Order.insertMany(orders);

    const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    // User1 + User2 + User3 = initial + 3
    assert.equal(data.summary.total_customers, initialCustomerCount + 3);
  });

  // -------------------------------------------------------------------------
  // CASE 4: 2 Users + Many Activities = Exactly 2 Customers
  // -------------------------------------------------------------------------
  await t.test("Case 4: 2 users + many activities yields exactly 2 customers", async () => {
    const user4A = await User.create({
      name: `User Four A ${Date.now()}`,
      email: `user-four-a-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    const user4B = await User.create({
      name: `User Four B ${Date.now()}`,
      email: `user-four-b-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    createdUserIds.push(user4A._id, user4B._id);

    const manyActs = [
      ...Array.from({ length: 25 }).map(() => ({
        userId: user4A._id,
        type: "page_view",
        route: "/tops",
      })),
      ...Array.from({ length: 30 }).map(() => ({
        userId: user4B._id,
        type: "product_view",
        route: "/dresses",
      })),
    ];
    await Activity.insertMany(manyActs);

    const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    // initial + 3 (previous) + 2 (new) = initial + 5
    assert.equal(data.summary.total_customers, initialCustomerCount + 5);
  });

  // -------------------------------------------------------------------------
  // CASE 5: Same User Using Multiple Devices = Exactly 1 Customer
  // -------------------------------------------------------------------------
  await t.test("Case 5: Same user using multiple devices/userAgents yields exactly 1 customer", async () => {
    const user5 = await User.create({
      name: `User Five MultiDevice ${Date.now()}`,
      email: `user-five-device-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    createdUserIds.push(user5._id);

    // iPhone, Android, Mac Chrome, Windows Edge sessions
    const deviceAgents = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      "Mozilla/5.0 (Linux; Android 13; SM-S908B)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ];

    const deviceActs = deviceAgents.flatMap((agent, idx) => [
      { userId: user5._id, type: "auth_login", userAgent: agent, ipAddress: `192.168.1.${10 + idx}` },
      { userId: user5._id, type: "page_view", userAgent: agent, ipAddress: `192.168.1.${10 + idx}` },
      { userId: user5._id, type: "cart_add", userAgent: agent, ipAddress: `192.168.1.${10 + idx}` },
    ]);
    await Activity.insertMany(deviceActs);

    const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    // initial + 5 (previous) + 1 (new) = initial + 6
    assert.equal(data.summary.total_customers, initialCustomerCount + 6);
  });

  // -------------------------------------------------------------------------
  // CASE 6: Demo Personas Do Not Increase Live Customer Count
  // -------------------------------------------------------------------------
  await t.test("Case 6: Demo personas do not increase live customer count and remain isolated", async () => {
    // 1. Fetch live count
    const liveRes = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const liveData = await liveRes.json();
    const currentLiveCount = liveData.summary.total_customers;

    // 2. Fetch demo summary
    const demoRes = await fetch(`${baseUrl}/api/churn/portfolio-summary?mode=demo`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(demoRes.status, 200);
    const demoData = await demoRes.json();
    assert.equal(demoData.mode, "DEMO");
    assert.equal(demoData.isSynthetic, true);
    assert.equal(demoData.summary.total_customers, 12, "Demo mode should show 12 synthetic customers");

    // 3. Fetch live count again to prove zero pollution
    const postDemoLiveRes = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const postDemoLiveData = await postDemoLiveRes.json();
    assert.equal(postDemoLiveData.summary.total_customers, currentLiveCount, "Live customer count must not change");
  });

  // -------------------------------------------------------------------------
  // CASE 7: Repeated Dashboard Refreshes Do Not Increase Customer Count
  // -------------------------------------------------------------------------
  await t.test("Case 7: Refreshing the Admin Dashboard repeatedly does not increase customer count", async () => {
    const firstRes = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const firstData = await firstRes.json();
    const countBaseline = firstData.summary.total_customers;

    // Perform 5 consecutive refreshes
    for (let i = 0; i < 5; i++) {
      const refreshRes = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const refreshData = await refreshRes.json();
      assert.equal(
        refreshData.summary.total_customers,
        countBaseline,
        `Refresh #${i + 1} must preserve exact customer count`
      );
    }
  });
});
