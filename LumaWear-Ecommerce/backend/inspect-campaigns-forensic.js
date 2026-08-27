import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const campaigns = await db.collection("campaigns").find({}).sort({ createdAt: 1 }).toArray();
console.log(`Total campaigns in MongoDB: ${campaigns.length}`);

console.log("\n=================================================================");
console.log(" ALL CAMPAIGNS BREAKDOWN");
console.log("=================================================================");

const campaignNames = {};
campaigns.forEach((c, i) => {
  const name = c.name || c.campaignName || "Unnamed";
  campaignNames[name] = (campaignNames[name] || 0) + 1;
});

console.table(Object.entries(campaignNames).map(([name, count]) => ({ "Campaign Name": name, Count: count })));

console.log("\nSample 10 Campaigns:");
campaigns.slice(0, 10).forEach((c, i) => {
  console.log(
    `#${String(i + 1).padStart(2, "0")} | ` +
    `ID: ${c.campaignId || c._id} | ` +
    `Status: ${String(c.status).padEnd(10)} | ` +
    `Type: ${String(c.campaignType || c.type).padEnd(18)} | ` +
    `Targets: ${c.targetCustomers?.length || 0} | ` +
    `Name: ${c.name || c.campaignName} | ` +
    `CreatedAt: ${c.createdAt?.toISOString()}`
  );
});

console.log("\nLatest 10 Campaigns:");
campaigns.slice(-10).forEach((c, i) => {
  console.log(
    `#${String(campaigns.length - 10 + i + 1).padStart(2, "0")} | ` +
    `ID: ${c.campaignId || c._id} | ` +
    `Status: ${String(c.status).padEnd(10)} | ` +
    `Type: ${String(c.campaignType || c.type).padEnd(18)} | ` +
    `Targets: ${c.targetCustomers?.length || 0} | ` +
    `Name: ${c.name || c.campaignName} | ` +
    `CreatedAt: ${c.createdAt?.toISOString()}`
  );
});

// Check unique targetCustomerIds across all campaigns
const uniqueTargetCustomerIds = new Set();
campaigns.forEach(c => {
  if (Array.isArray(c.targetCustomers)) {
    c.targetCustomers.forEach(tc => {
      const cid = tc.customerId || tc.userId || tc._id;
      if (cid) uniqueTargetCustomerIds.add(String(cid));
    });
  }
});

console.log(`\nUnique Target Customer IDs across ALL 71 campaigns: ${uniqueTargetCustomerIds.size}`);

await mongoose.disconnect();
