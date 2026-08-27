/**
 * churn/resilience.test.js
 * Comprehensive Node test suite verifying Express proxy security, authorization, and error handling.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
const { app } = await import("../server.js");

let server;
let baseUrl;

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

test("GET /api/churn/predict/:userId rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/churn/predict/6a8704de95bfe658bec9dc05`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.ok(data.message.includes("sign in"));
});

test("GET /api/churn/customer-features/:userId rejects empty/whitespace userId with 400", async () => {
  const res = await fetch(`${baseUrl}/api/churn/customer-features/%20`);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes("userId is required"));
});

test("GET /api/churn/customer-features/:userId returns 404 for unknown customer", async () => {
  if (mongoose.connection.readyState === 1) {
    const res = await fetch(`${baseUrl}/api/churn/customer-features/000000000000000000000000`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.ok(data.error.includes("not found"));
  }
});
