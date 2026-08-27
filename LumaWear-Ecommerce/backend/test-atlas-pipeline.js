import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
assert.ok(MONGODB_URI, "MONGODB_URI must be present in .env");
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

console.log("=================================================================");
console.log(" TESTING REAL ATLAS CUSTOMER DATA & ML PIPELINE INTEGRATION");
console.log("=================================================================");

const { app, User } = await import("./src/server.js");

if (mongoose.connection.readyState === 0) {
  await mongoose.connect(MONGODB_URI, { dbName: "lumawear" });
}

let server;
let baseUrl;

await new Promise((resolve) => {
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
});

const adminUser = await User.findOne({ role: "admin" }).lean();
assert.ok(adminUser, "Admin user must exist in Atlas");
const adminToken = jwt.sign(
  { sub: String(adminUser._id), role: "admin", type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

// 1. Fetch /api/churn/portfolio-summary
console.log("\n1. Calling GET /api/churn/portfolio-summary ...");
const portfolioRes = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});

assert.equal(portfolioRes.status, 200, "portfolio-summary must return 200");
const portfolioData = await portfolioRes.json();
assert.equal(portfolioData.success, true);
assert.equal(portfolioData.mode, "LIVE");
assert.equal(portfolioData.isSynthetic, false);

console.log(`Summary:`);
console.log(`  Total Customers:     ${portfolioData.summary.total_customers}`);
console.log(`  Scored Customers:    ${portfolioData.summary.scored_customers}`);
console.log(`  Average Churn Prob:  ${(portfolioData.summary.average_churn_probability * 100).toFixed(2)}%`);
console.log(`  High Risk Count:     ${portfolioData.summary.high_risk_count}`);

console.log(`\nRisk Distribution across 8 Atlas Customers:`);
console.log(`  - Low Risk:       ${portfolioData.risk_distribution.low.count} (${portfolioData.risk_distribution.low.percentage}%)`);
console.log(`  - Medium Risk:    ${portfolioData.risk_distribution.medium.count} (${portfolioData.risk_distribution.medium.percentage}%)`);
console.log(`  - High Risk:      ${portfolioData.risk_distribution.high.count} (${portfolioData.risk_distribution.high.percentage}%)`);
console.log(`  - Very High Risk: ${portfolioData.risk_distribution.very_high.count} (${portfolioData.risk_distribution.very_high.percentage}%)`);

console.log(`\nScored Atlas Customers:`);
console.table(
  portfolioData.customers.map((c) => ({
    _id: c.user_id,
    name: c.name,
    email: c.email,
    risk: c.risk_level,
    prob: `${(c.churn_probability * 100).toFixed(1)}%`,
    timeline: c.churn_timeline,
    spend: `$${c.metrics?.total_spend ?? 0}`,
    orders: c.metrics?.order_count ?? 0,
    events30d: c.metrics?.activity_event_count_30d ?? 0,
    topDriver: c.top_driver ? `${c.top_driver.label} (${c.top_driver.direction === "increases_churn" ? "▲ Increases" : "▼ Reduces"})` : "None",
  }))
);

// 2. Fetch /api/admin/users
console.log("\n2. Calling GET /api/admin/users ...");
const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
assert.equal(usersRes.status, 200);
const usersData = await usersRes.json();
console.log(`  Found ${usersData.users.length} registered accounts in /api/admin/users:`);
for (const u of usersData.users) {
  console.log(`  - [${u.role.padEnd(8)}] ${u.name.padEnd(18)} <${u.email}> (ID: ${u._id})`);
}

// 3. Fetch /api/churn/results
console.log("\n3. Calling GET /api/churn/results ...");
const resultsRes = await fetch(`${baseUrl}/api/churn/results`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
assert.equal(resultsRes.status, 200);
const resultsData = await resultsRes.json();
console.log(`  Campaigns in Results: ${resultsData.summary.totalCampaigns}`);

await new Promise((resolve) => server.close(resolve));
await mongoose.disconnect();

console.log("\n🎉 ALL ATLAS PIPELINE TESTS PASSED!");
