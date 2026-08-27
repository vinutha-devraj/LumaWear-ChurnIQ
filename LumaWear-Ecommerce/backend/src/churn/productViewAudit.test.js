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
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

test("Phase 15 Audit: Product View Event Semantics & Storm Prevention", async (t) => {
  const customer = await User.create({
    name: `Product View Test Customer ${Date.now()}`,
    email: `pv-customer-${Date.now()}@example.com`,
    salt: "salt",
    passwordHash: "hash",
    role: "customer",
  });
  createdUserIds.push(customer._id);
  const token = makeToken(customer);

  // 1. Opening a product once -> exactly one product_viewed event created
  await t.test("Opening a product once creates exactly 1 product_viewed event", async () => {
    const initialCount = await Activity.countDocuments({
      userId: customer._id,
      type: "product_viewed",
      "metadata.productId": "lw-008",
    });

    const res = await fetch(`${baseUrl}/api/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: "product_viewed",
        route: "/shop/lw-008",
        metadata: { productId: "lw-008" },
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.activity.type, "product_viewed");
    assert.equal(data.activity.metadata.productId, "lw-008");

    const finalCount = await Activity.countDocuments({
      userId: customer._id,
      type: "product_viewed",
      "metadata.productId": "lw-008",
    });
    assert.equal(finalCount, initialCount + 1);
  });

  // 2. React re-render / storm burst (rapid duplicate calls within 2s) -> deduplicated gracefully
  await t.test("Rapid repeated product_viewed requests for same product are deduplicated", async () => {
    const countBefore = await Activity.countDocuments({
      userId: customer._id,
      type: "product_viewed",
      "metadata.productId": "lw-008",
    });

    // Simulate 5 rapid re-renders firing within milliseconds
    const responses = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        fetch(`${baseUrl}/api/activity`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "product_viewed",
            route: "/shop/lw-008",
            metadata: { productId: "lw-008" },
          }),
        })
      )
    );

    for (const res of responses) {
      assert.ok(res.status === 200 || res.status === 201);
    }

    const countAfter = await Activity.countDocuments({
      userId: customer._id,
      type: "product_viewed",
      "metadata.productId": "lw-008",
    });

    // Count should NOT have increased by 5!
    assert.equal(countAfter, countBefore, "Duplicate storm within 2s must not insert new activity records");
  });

  // 3. Opening a DIFFERENT product -> new product_viewed event is recorded immediately
  await t.test("Opening a different product creates a new product_viewed event", async () => {
    const res = await fetch(`${baseUrl}/api/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: "product_viewed",
        route: "/shop/lw-009",
        metadata: { productId: "lw-009" },
      }),
    });

    assert.equal(res.status, 201);
    const count = await Activity.countDocuments({
      userId: customer._id,
      type: "product_viewed",
      "metadata.productId": "lw-009",
    });
    assert.equal(count, 1);
  });

  // 4. Same customer on multiple devices -> activities linked to single user, user count unchanged
  await t.test("Same customer using multiple userAgent devices links to single customer entity", async () => {
    const devices = ["Mobile Safari", "Desktop Chrome", "Android Firefox"];
    for (const d of devices) {
      await fetch(`${baseUrl}/api/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": d,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "page_view",
          route: "/catalog",
        }),
      });
    }

    const userCount = await User.countDocuments({ _id: customer._id });
    assert.equal(userCount, 1, "User entity must remain exactly 1");

    const totalActs = await Activity.countDocuments({ userId: customer._id });
    assert.ok(totalActs >= 3);
  });
});
