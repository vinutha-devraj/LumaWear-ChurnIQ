import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const adminUser = await db.collection("users").findOne({ role: "admin" });
const token = jwt.sign(
  { sub: String(adminUser._id), role: "admin", type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

console.log("=================================================================");
console.log(" 1. DIRECT CALL TO /api/churn/results");
console.log("=================================================================");

const resResults = await fetch("http://127.0.0.1:4000/api/churn/results", {
  headers: { Authorization: `Bearer ${token}` },
});

console.log(`HTTP Status: ${resResults.status}`);
const dataResults = await resResults.json();

console.log("\nSummary Object from /api/churn/results:");
console.log(JSON.stringify(dataResults.summary, null, 2));

console.log(`\nTotal Campaigns in Results: ${dataResults.campaigns?.length}`);

console.log("\n=================================================================");
console.log(" 2. DIRECT CALL TO /api/churn/campaigns");
console.log("=================================================================");

const resCampaigns = await fetch("http://127.0.0.1:4000/api/churn/campaigns", {
  headers: { Authorization: `Bearer ${token}` },
});

console.log(`HTTP Status: ${resCampaigns.status}`);
const dataCampaigns = await resCampaigns.json();
console.log(`Total Campaigns from /api/churn/campaigns: ${dataCampaigns.campaigns?.length}`);

console.log("\n=================================================================");
console.log(" 3. DIRECT CALL TO /api/churn/portfolio-summary");
console.log("=================================================================");

const resPortfolio = await fetch("http://127.0.0.1:4000/api/churn/portfolio-summary", {
  headers: { Authorization: `Bearer ${token}` },
});

console.log(`HTTP Status: ${resPortfolio.status}`);
const dataPortfolio = await resPortfolio.json();
console.log("Portfolio Summary:", JSON.stringify(dataPortfolio.summary, null, 2));

console.log("\n=================================================================");
console.log(" 4. DIRECT CALL TO /api/admin/users");
console.log("=================================================================");

const resUsers = await fetch("http://127.0.0.1:4000/api/admin/users", {
  headers: { Authorization: `Bearer ${token}` },
});

console.log(`HTTP Status: ${resUsers.status}`);
const dataUsers = await resUsers.json();
console.log(`Total users from /api/admin/users: ${dataUsers.users?.length}`);

await mongoose.disconnect();
