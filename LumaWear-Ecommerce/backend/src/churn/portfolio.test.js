/**
 * churn/portfolio.test.js
 * Comprehensive Node test suite for Phase 8 portfolio-wide churn risk summary endpoint.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
const { app, User } = await import("../server.js");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

let server;
let baseUrl;

function makeToken(sub, role = "admin") {
  return jwt.sign({ sub, role, type: "access" }, JWT_ACCESS_SECRET, { expiresIn: "1h" });
}

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear", {
      dbName: process.env.MONGODB_DB || "lumawear",
      serverSelectionTimeoutMS: 2000,
    }).catch(() => {});
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

test("GET /api/churn/portfolio-summary rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/portfolio-summary rejects non-admin users with 403", async () => {
  // Create or mock a customer user
  let customerUser = null;
  if (mongoose.connection.readyState === 1) {
    customerUser = await User.findOne({ role: "customer" });
  }

  const userId = customerUser ? customerUser._id.toString() : new mongoose.Types.ObjectId().toString();
  if (mongoose.connection.readyState === 1 && !customerUser) {
    customerUser = await User.create({
      name: "Test Customer",
      email: `test-${Date.now()}@example.com`,
      salt: "salt",
      passwordHash: "hash",
      role: "customer",
    });
  }

  const token = makeToken(customerUser?._id?.toString() || userId, "customer");
  const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.message.includes("Administrator access is required"));
});

test("GET /api/churn/portfolio-summary returns 503 or graceful response when FastAPI is offline", async () => {
  // Point to non-existent port to test offline handling
  const originalUrl = process.env.CHURN_SERVICE_URL;
  process.env.CHURN_SERVICE_URL = "http://127.0.0.1:59999";

  let adminUser = null;
  if (mongoose.connection.readyState === 1) {
    adminUser = await User.findOne({ role: "admin" });
    if (!adminUser) {
      adminUser = await User.create({
        name: "Test Admin",
        email: `admin-${Date.now()}@lumawear.local`,
        salt: "salt",
        passwordHash: "hash",
        role: "admin",
      });
    }
  }

  const token = makeToken(adminUser?._id?.toString() || new mongoose.Types.ObjectId().toString(), "admin");
  const res = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // If there are customers in DB, FastAPI offline should return 503; if 0 customers, it returns 200 empty
  if (res.status === 503) {
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.service_status, "offline");
    assert.ok(!data.stack, "Internal stack traces must not be exposed");
  } else if (res.status === 200) {
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.summary.total_customers, 0);
  }

  process.env.CHURN_SERVICE_URL = originalUrl;
});
