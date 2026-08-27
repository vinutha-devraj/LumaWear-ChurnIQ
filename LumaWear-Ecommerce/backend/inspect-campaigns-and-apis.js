import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" 1. MONGODB READ-ONLY CAMPAIGNS COLLECTION");
console.log("=================================================================");

const campaigns = await db.collection("campaigns").find({}).sort({ createdAt: 1 }).toArray();
console.log(`Total campaigns in MongoDB: ${campaigns.length}\n`);

campaigns.forEach((c, idx) => {
  console.log(`Campaign #${idx + 1}:`);
  console.log(`  _id:                ${c._id}`);
  console.log(`  campaignId:         ${c.campaignId}`);
  console.log(`  name:               ${c.name}`);
  console.log(`  campaignType:       ${c.campaignType}`);
  console.log(`  status:             ${c.status}`);
  console.log(`  priority:           ${c.priority}`);
  console.log(`  targetCustomerIds:  ${JSON.stringify(c.targetCustomerIds)}`);
  console.log(`  targetCustomers:    ${c.targetCustomers?.length || 0} customer(s)`);
  if (c.targetCustomers) {
    c.targetCustomers.forEach(tc => {
      console.log(`    - UserID: ${tc.userId} | Name: ${tc.name} | BaseProb: ${tc.churnProbability} | Risk: ${tc.riskLevel}`);
    });
  }
  console.log(`  createdAt:          ${c.createdAt?.toISOString()}`);
  console.log(`  updatedAt:          ${c.updatedAt?.toISOString()}`);
  console.log("");
});

console.log("=================================================================");
console.log(" 2. COMPARISON: /api/churn/campaigns VS /api/churn/results");
console.log("=================================================================");

const adminUser = await db.collection("users").findOne({ role: "admin" });
const token = jwt.sign(
  { sub: String(adminUser._id), role: "admin", type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

const resCamp = await fetch("http://127.0.0.1:4000/api/churn/campaigns", {
  headers: { Authorization: `Bearer ${token}` },
}).then(r => r.json());

const resResults = await fetch("http://127.0.0.1:4000/api/churn/results", {
  headers: { Authorization: `Bearer ${token}` },
}).then(r => r.json());

console.log("GET /api/churn/campaigns response summary:");
console.log(`  Success: ${resCamp.success}`);
console.log(`  Total campaigns returned: ${resCamp.campaigns?.length}`);
resCamp.campaigns?.forEach(c => {
  console.log(`    * [${c.status.padEnd(9)}] ${c.campaignId} - "${c.name}" (Targets: ${c.targetCustomerIds?.length})`);
});

console.log("\nGET /api/churn/results response summary:");
console.log(`  Success: ${resResults.success}`);
console.log(`  Total campaigns evaluated: ${resResults.campaigns?.length}`);
console.log(`  Summary:`, JSON.stringify(resResults.summary, null, 2));
resResults.campaigns?.forEach(c => {
  console.log(`    * [${c.status.padEnd(9)}] ${c.campaignId} - "${c.name}" | Before Avg: ${(c.averageBaselineChurnProbability*100).toFixed(1)}% | Latest Avg: ${(c.averageLatestChurnProbability*100).toFixed(1)}% | Delta: ${c.averageRiskChange}`);
});

await mongoose.disconnect();
