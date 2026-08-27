import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" STEP 3: PRE-CLEANUP DATABASE SNAPSHOT & EXACT FIXTURE MATCHING");
console.log("=================================================================");

const initialCounts = {
  users: await db.collection("users").countDocuments({}),
  admins: await db.collection("users").countDocuments({ role: "admin" }),
  customers: await db.collection("users").countDocuments({ role: "customer" }),
  orders: await db.collection("orders").countDocuments({}),
  activities: await db.collection("activities").countDocuments({}),
  campaigns: await db.collection("campaigns").countDocuments({}),
  snapshots: await db.collection("churn_prediction_snapshots").countDocuments({}),
};

console.table(Object.entries(initialCounts).map(([col, count]) => ({ Collection: col, Count: count })));

const allCampaigns = await db.collection("campaigns").find({}).sort({ createdAt: 1 }).toArray();

const testFixtureQuery = {
  $or: [
    { name: { $in: ["Q3 Abandoned Cart Win-Back", "Cancelled Campaign Test", "Effectiveness Test Campaign"] } },
    { name: /^Results Test Campaign/ },
  ],
};

const matchingTestCampaigns = await db.collection("campaigns").find(testFixtureQuery).sort({ createdAt: 1 }).toArray();
const legitimateCampaigns = await db.collection("campaigns").find({
  name: { $nin: ["Q3 Abandoned Cart Win-Back", "Cancelled Campaign Test", "Effectiveness Test Campaign"] },
  $and: [{ name: { $not: /^Results Test Campaign/ } }],
}).sort({ createdAt: 1 }).toArray();

console.log(`\nTotal Campaigns in DB:        ${allCampaigns.length}`);
console.log(`Matched Test Fixtures:        ${matchingTestCampaigns.length}`);
console.log(`Legitimate Campaigns:         ${legitimateCampaigns.length}`);

console.log("\nLegitimate Production Campaigns (MUST BE PRESERVED):");
legitimateCampaigns.forEach((c, idx) => {
  console.log(`  [PRESERVED] #${idx + 1} | _id: ${c._id} | ID: ${c.campaignId} | Name: "${c.name}" | Status: ${c.status} | Targets: ${JSON.stringify(c.targetCustomerIds || [])} | CreatedAt: ${c.createdAt?.toISOString()}`);
});

console.log("\nListing All 69 Test Fixtures to be Deleted:");
matchingTestCampaigns.forEach((c, idx) => {
  console.log(
    `  #${String(idx + 1).padStart(2, "0")} | ` +
    `_id: ${c._id} | ` +
    `ID: ${c.campaignId} | ` +
    `Name: "${c.name.padEnd(32)}" | ` +
    `Status: ${c.status.padEnd(10)} | ` +
    `Targets: ${JSON.stringify(c.targetCustomerIds || []).padEnd(65)} | ` +
    `CreatedAt: ${c.createdAt?.toISOString()}`
  );
});

// CRITICAL SAFETY GATE: Exactly 69 test fixtures and exactly 2 legitimate campaigns
if (matchingTestCampaigns.length !== 69) {
  console.error(`\n🚨 SAFETY ERROR: Expected exactly 69 test campaigns, but matched ${matchingTestCampaigns.length}. ABORTING!`);
  await mongoose.disconnect();
  process.exit(1);
}

if (legitimateCampaigns.length !== 2) {
  console.error(`\n🚨 SAFETY ERROR: Expected exactly 2 legitimate campaigns, but found ${legitimateCampaigns.length}. ABORTING!`);
  await mongoose.disconnect();
  process.exit(1);
}

console.log("\n=================================================================");
console.log(" STEP 4: EXECUTING TARGETED DELETION OF EXACTLY 69 TEST FIXTURES");
console.log("=================================================================");

const testFixtureIds = matchingTestCampaigns.map(c => c._id);
const deleteResult = await db.collection("campaigns").deleteMany({ _id: { $in: testFixtureIds } });

console.log(`Documents Deleted: ${deleteResult.deletedCount}`);

if (deleteResult.deletedCount !== 69) {
  console.error(`\n🚨 ERROR: Deleted count ${deleteResult.deletedCount} !== 69!`);
} else {
  console.log("✅ Exactly 69 test fixture campaigns successfully deleted.");
}

console.log("\n=================================================================");
console.log(" STEP 5: POST-CLEANUP VERIFICATION");
console.log("=================================================================");

const postCounts = {
  users: await db.collection("users").countDocuments({}),
  admins: await db.collection("users").countDocuments({ role: "admin" }),
  customers: await db.collection("users").countDocuments({ role: "customer" }),
  orders: await db.collection("orders").countDocuments({}),
  activities: await db.collection("activities").countDocuments({}),
  campaigns: await db.collection("campaigns").countDocuments({}),
  snapshots: await db.collection("churn_prediction_snapshots").countDocuments({}),
};

console.table([
  { Collection: "Total Users", Before: initialCounts.users, After: postCounts.users, Delta: postCounts.users - initialCounts.users, Status: postCounts.users === 4 ? "OK (4)" : "ERROR" },
  { Collection: "Admins", Before: initialCounts.admins, After: postCounts.admins, Delta: postCounts.admins - initialCounts.admins, Status: postCounts.admins === 2 ? "OK (2)" : "ERROR" },
  { Collection: "Customers", Before: initialCounts.customers, After: postCounts.customers, Delta: postCounts.customers - initialCounts.customers, Status: postCounts.customers === 2 ? "OK (2)" : "ERROR" },
  { Collection: "Orders", Before: initialCounts.orders, After: postCounts.orders, Delta: postCounts.orders - initialCounts.orders, Status: postCounts.orders === 2 ? "OK (2)" : "ERROR" },
  { Collection: "Activities", Before: initialCounts.activities, After: postCounts.activities, Delta: postCounts.activities - initialCounts.activities, Status: postCounts.activities === initialCounts.activities ? "OK" : "CHANGED" },
  { Collection: "Campaigns", Before: initialCounts.campaigns, After: postCounts.campaigns, Delta: postCounts.campaigns - initialCounts.campaigns, Status: postCounts.campaigns === 2 ? "OK (2)" : "ERROR" },
  { Collection: "Snapshots", Before: initialCounts.snapshots, After: postCounts.snapshots, Delta: postCounts.snapshots - initialCounts.snapshots, Status: postCounts.snapshots === 0 ? "OK (0)" : "ERROR" },
]);

const remainingCampaigns = await db.collection("campaigns").find({}).toArray();
console.log("\nRemaining Campaigns in Database:");
remainingCampaigns.forEach((c, idx) => {
  console.log(`  #${idx + 1} | _id: ${c._id} | ID: ${c.campaignId} | Name: "${c.name}" | Status: ${c.status} | Targets: ${JSON.stringify(c.targetCustomerIds || [])}`);
});

await mongoose.disconnect();
