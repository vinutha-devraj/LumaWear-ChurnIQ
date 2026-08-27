/**
 * churn/retention.test.js
 * Comprehensive Node test suite for Phase 9 Retention Action Center APIs,
 * opportunity synthesis, campaign lifecycle state machine, and database isolation.
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
        email: `admin-retention-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
      createdUserIds.push(testAdminUser._id);
    }

    testCustomerUser = await User.findOne({ role: "customer" });
    if (!testCustomerUser) {
      testCustomerUser = await User.create({
        name: "Customer User",
        email: `customer-retention-${Date.now()}@example.com`,
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
  if (createdUserIds.length > 0) {
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Activity.deleteMany({ userId: { $in: createdUserIds } });
    await Order.deleteMany({ userId: { $in: createdUserIds } });
  }
  if (createdCampaignIds.length > 0) {
    await Campaign.deleteMany({ campaignId: { $in: createdCampaignIds } });
    await mongoose.connection.db?.collection("churn_prediction_snapshots")?.deleteMany({ campaignId: { $in: createdCampaignIds } });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test("GET /api/churn/retention-opportunities rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/retention-opportunities`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/retention-opportunities rejects non-admin users with 403", async () => {
  const customerToken = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/retention-opportunities`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.message.includes("Administrator access is required"));
});

test("POST /api/churn/campaigns rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignType: "cart_abandonment" }),
  });
  assert.equal(res.status, 401);
});

test("POST /api/churn/campaigns rejects non-admin requests with 403", async () => {
  const customerToken = makeToken(testCustomerUser);
  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${customerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ campaignType: "cart_abandonment" }),
  });
  assert.equal(res.status, 403);
});

test("POST /api/churn/campaigns validates campaignType", async () => {
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignType: "invalid_campaign_type",
      priority: "High",
      targetCustomerIds: [testCustomerUser._id.toString()],
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.message.includes("Invalid campaignType"));
});

test("POST /api/churn/campaigns validates priority", async () => {
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignType: "cart_abandonment",
      priority: "SuperUrgent",
      targetCustomerIds: [testCustomerUser._id.toString()],
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.message.includes("Invalid priority"));
});

test("POST /api/churn/campaigns rejects empty target customer list", async () => {
  const token = makeToken(testAdminUser);
  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignType: "cart_abandonment",
      priority: "High",
      targetCustomerIds: [],
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.message.includes("non-empty array"));
});

test("POST /api/churn/campaigns rejects nonexistent customer IDs", async () => {
  const token = makeToken(testAdminUser);
  const fakeId = new mongoose.Types.ObjectId().toString();

  const res = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignType: "cart_abandonment",
      priority: "High",
      targetCustomerIds: [fakeId],
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.message.includes("do not exist in the database"));
});

test("Campaign lifecycle: creation (PLANNED) -> list -> update (SENT) -> complete (COMPLETED) -> reject invalid transition", async () => {
  let customer1 = null;
  let customer2 = null;

  if (mongoose.connection.readyState === 1) {
    customer1 = await User.create({
      name: "Retention Customer One",
      email: `retention1-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    createdUserIds.push(customer1._id);

    customer2 = await User.create({
      name: "Retention Customer Two",
      email: `retention2-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
    createdUserIds.push(customer2._id);
  }

  const token = makeToken(testAdminUser);
  const initialUserCount = await User.countDocuments();
  const initialOrderCount = await Order.countDocuments();
  const initialActivityCount = await Activity.countDocuments();

  // 1. Create Campaign (with duplicate ID in request to verify deduplication)
  const createRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Q3 Abandoned Cart Win-Back",
      campaignType: "cart_abandonment",
      priority: "High",
      targetCustomerIds: [customer1._id.toString(), customer2._id.toString(), customer1._id.toString()],
      suggestedMessage: "Items in your cart are waiting!",
      customerProbabilities: {
        [customer1._id.toString()]: 0.784,
        [customer2._id.toString()]: 0.652,
      },
    }),
  });

  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  assert.equal(createData.success, true);
  const campaign = createData.campaign;
  createdCampaignIds.push(campaign.campaignId);
  assert.ok(campaign.campaignId.startsWith("CAMP-"));
  assert.equal(campaign.status, "PLANNED");
  assert.equal(campaign.customerCount, 2, "Duplicate customer IDs should be deduplicated to 2");
  assert.equal(campaign.targetCustomers.length, 2);
  assert.equal(campaign.createdBy.name, testAdminUser.name);

  // 2. List campaigns
  const listRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.ok(listData.campaigns.some((c) => c.campaignId === campaign.campaignId));

  // 3. Status Transition: PLANNED -> SENT
  const sentRes = await fetch(`${baseUrl}/api/churn/campaigns/${campaign.campaignId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SENT" }),
  });
  assert.equal(sentRes.status, 200);
  const sentData = await sentRes.json();
  assert.equal(sentData.campaign.status, "SENT");

  // 4. Status Transition: SENT -> COMPLETED
  const compRes = await fetch(`${baseUrl}/api/churn/campaigns/${campaign.campaignId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "COMPLETED" }),
  });
  assert.equal(compRes.status, 200);
  const compData = await compRes.json();
  assert.equal(compData.campaign.status, "COMPLETED");

  // 5. Invalid Transition: COMPLETED -> PLANNED (Terminal state rejection)
  const invalidRes = await fetch(`${baseUrl}/api/churn/campaigns/${campaign.campaignId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PLANNED" }),
  });
  assert.equal(invalidRes.status, 400);
  const invalidData = await invalidRes.json();
  assert.ok(invalidData.message.includes("cannot change campaign from 'COMPLETED'"));

  // 6. Test Cancellation on a new campaign (PLANNED -> CANCELLED)
  const cancelCampRes = await fetch(`${baseUrl}/api/churn/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cancelled Campaign Test",
      campaignType: "vip_retention",
      priority: "High",
      targetCustomerIds: [customer1._id.toString()],
    }),
  });
  const cancelCampData = await cancelCampRes.json();
  const cancelId = cancelCampData.campaign.campaignId;
  createdCampaignIds.push(cancelId);

  const cancelActionRes = await fetch(`${baseUrl}/api/churn/campaigns/${cancelId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  assert.equal(cancelActionRes.status, 200);
  const cancelActionData = await cancelActionRes.json();
  assert.equal(cancelActionData.campaign.status, "CANCELLED");

  // 7. Verify Database Isolation: users, orders, activities collections remain untouched
  const finalUserCount = await User.countDocuments();
  const finalOrderCount = await Order.countDocuments();
  const finalActivityCount = await Activity.countDocuments();

  assert.equal(finalUserCount, initialUserCount, "Users collection must remain strictly unmodified");
  assert.equal(finalOrderCount, initialOrderCount, "Orders collection must remain strictly unmodified");
  assert.equal(finalActivityCount, initialActivityCount, "Activities collection must remain strictly unmodified");
});
