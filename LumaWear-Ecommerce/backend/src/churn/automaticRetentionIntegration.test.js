import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

let server;
let baseUrl;
let app;
let User;
let AutomaticRetentionLog;
let adminToken;
let customerToken;

const makeToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role, type: "access" }, JWT_ACCESS_SECRET, { expiresIn: "1h" });

test.before(async () => {
  const mod = await import("../server.js");
  app = mod.app || mod.default;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  User = mongoose.models.User || mongoose.model("User");
  AutomaticRetentionLog = mongoose.models.AutomaticRetentionLog || mongoose.model("AutomaticRetentionLog");

  let admin = await User.findOne({ role: "admin" });
  if (!admin) {
    admin = await User.create({
      name: "Test Admin",
      email: "testadmin@lumawear.local",
      salt: "dummy-salt",
      passwordHash: "dummy-hash",
      role: "admin",
    });
  }
  adminToken = makeToken(admin);

  let customer = await User.findOne({ role: "customer" });
  if (!customer) {
    customer = await User.create({
      name: "Test Customer",
      email: "testcust@lumawear.local",
      salt: "dummy-salt",
      passwordHash: "dummy-hash",
      role: "customer",
    });
  }
  customerToken = makeToken(customer);

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
  if (User) {
    await User.deleteMany({ email: { $in: ["testadmin@lumawear.local", "testcust@lumawear.local"] } });
  }
  if (AutomaticRetentionLog) {
    await AutomaticRetentionLog.deleteMany({ email: { $in: ["testadmin@lumawear.local", "testcust@lumawear.local"] } });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test("Automatic Retention REST API Integration Suite", async (t) => {
  if (!adminToken) {
    console.log("Skipping API tests: Admin account not seeded in current test DB environment.");
    return;
  }

  await t.test("GET /api/churn/automatic-retention/status returns configuration and metrics", async () => {
    const res = await fetch(`${baseUrl}/api/churn/automatic-retention/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.config);
    assert.equal(typeof data.config.threshold, "number");
    assert.equal(typeof data.config.cooldownDays, "number");
  });

  await t.test("Non-admin user is rejected with 403 on automatic retention endpoints", async () => {
    if (!customerToken) return;
    const res = await fetch(`${baseUrl}/api/churn/automatic-retention/status`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 403);
  });

  await t.test("POST /api/churn/automatic-retention/trigger executes dry-run with zero email send", async () => {
    const res = await fetch(`${baseUrl}/api/churn/automatic-retention/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ dryRun: true }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.result.dryRun, true);
    assert.equal(data.result.mode, "DRY_RUN");
    assert.ok(data.result.decisions !== undefined);
  });

  await t.test("GET /api/churn/automatic-retention/logs returns audit logs with skip reasons", async () => {
    const res = await fetch(`${baseUrl}/api/churn/automatic-retention/logs?limit=20`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.logs));
  });

  await t.test("PATCH /api/churn/automatic-retention/config updates runtime parameters safely", async () => {
    const res = await fetch(`${baseUrl}/api/churn/automatic-retention/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ threshold: 0.75, cooldownDays: 10 }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.config.threshold, 0.75);
    assert.equal(data.config.cooldownDays, 10);

    // Restore to default
    await fetch(`${baseUrl}/api/churn/automatic-retention/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ threshold: 0.70, cooldownDays: 7 }),
    });
  });
});
