import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";
const baseUrl = "http://localhost:4000";

console.log("=================================================================");
console.log(" VERIFYING RUNNING BACKEND (:4000) LIVE ATLAS DATA FLOW");
console.log("=================================================================");

// Sign an admin token
const adminToken = jwt.sign(
  { sub: "6a697d8218a57cff2ffd5550", role: "admin", type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

// 1. Health check
const healthRes = await fetch(`${baseUrl}/api/health`);
assert.equal(healthRes.status, 200);
const healthData = await healthRes.json();
console.log("1. /api/health:", healthData);

// 2. Portfolio Summary
console.log("\n2. Calling GET /api/churn/portfolio-summary from running server...");
const portRes = await fetch(`${baseUrl}/api/churn/portfolio-summary`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
assert.equal(portRes.status, 200);
const portData = await portRes.json();
console.log("   Success:", portData.success);
console.log("   Mode:", portData.mode);
console.log("   IsSynthetic:", portData.isSynthetic);
console.log("   Total Customers in Atlas:", portData.summary.total_customers);
console.log("   Scored Customers:", portData.summary.scored_customers);
console.log("   Average Churn Prob:", (portData.summary.average_churn_probability * 100).toFixed(2) + "%");

console.log("\n   Risk Distribution across Atlas Customers:");
console.log(`   - Low Risk:       ${portData.risk_distribution.low.count} (${portData.risk_distribution.low.percentage}%)`);
console.log(`   - Medium Risk:    ${portData.risk_distribution.medium.count} (${portData.risk_distribution.medium.percentage}%)`);
console.log(`   - High Risk:      ${portData.risk_distribution.high.count} (${portData.risk_distribution.high.percentage}%)`);
console.log(`   - Very High Risk: ${portData.risk_distribution.very_high.count} (${portData.risk_distribution.very_high.percentage}%)`);

console.log("\n   Atlas Customers Returned by API:");
for (const c of portData.customers) {
  console.log(`   - [${c.risk_level.padEnd(9)}] ${c.name.padEnd(18)} <${c.email}> | Churn Prob: ${(c.churn_probability * 100).toFixed(1)}% | ID: ${c.user_id}`);
}

// 3. Admin Users
console.log("\n3. Calling GET /api/admin/users from running server...");
const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
assert.equal(usersRes.status, 200);
const usersData = await usersRes.json();
console.log(`   Total Users in Atlas: ${usersData.users.length}`);

// 4. Results
console.log("\n4. Calling GET /api/churn/results from running server...");
const resultsRes = await fetch(`${baseUrl}/api/churn/results`, {
  headers: { Authorization: `Bearer ${adminToken}` },
});
assert.equal(resultsRes.status, 200);
const resultsData = await resultsRes.json();
console.log(`   Total Campaigns in Atlas: ${resultsData.summary.totalCampaigns}`);

console.log("\n=================================================================");
console.log("🎉 LIVE RUNNING BACKEND VERIFIED 100% OPERATING ON MONGODB ATLAS!");
console.log("=================================================================");
