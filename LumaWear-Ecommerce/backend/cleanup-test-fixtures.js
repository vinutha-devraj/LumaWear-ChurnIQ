import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" STEP 5: SAFELY IDENTIFY EXISTING 50 RETENTION TEST FIXTURES");
console.log("=================================================================");

const fixtureFilter = {
  role: "customer",
  name: { $in: ["Retention Customer One", "Retention Customer Two"] },
  email: /^retention[12]-\d+@example\.com$/,
};

const matchingFixtures = await db.collection("users").find(fixtureFilter).sort({ createdAt: 1 }).toArray();
const fixtureCount = matchingFixtures.length;

console.log(`Matched retention test fixtures: ${fixtureCount} (Expected: 50)`);

if (fixtureCount > 0) {
  console.log(`Earliest fixture: ${matchingFixtures[0]._id} (${matchingFixtures[0].createdAt?.toISOString()}) - ${matchingFixtures[0].name} [${matchingFixtures[0].email.split("@")[0]}@example.com]`);
  console.log(`Latest fixture:   ${matchingFixtures[fixtureCount - 1]._id} (${matchingFixtures[fixtureCount - 1].createdAt?.toISOString()}) - ${matchingFixtures[fixtureCount - 1].name} [${matchingFixtures[fixtureCount - 1].email.split("@")[0]}@example.com]`);
}

const nonFixtureUsers = await db.collection("users").find({
  _id: { $nin: matchingFixtures.map(f => f._id) }
}).toArray();

console.log(`\nPreserved Non-Fixture Users: ${nonFixtureUsers.length} (Expected: 4)`);
nonFixtureUsers.forEach(u => {
  const emailPrefix = u.email ? u.email.split("@")[0] : "no_email";
  const domain = u.email ? u.email.split("@")[1] : "no_domain";
  const maskedPrefix = emailPrefix.length <= 2 ? emailPrefix[0] + "***" : emailPrefix[0] + "***" + emailPrefix[emailPrefix.length - 1];
  console.log(`  - [${u.role.padEnd(8)}] ID: ${u._id} | Name: ${u.name} | Email: ${maskedPrefix}@${domain}`);
});

if (fixtureCount !== 50) {
  console.error(`[SAFETY ABORT] Expected exactly 50 fixture documents, found ${fixtureCount}. Aborting deletion!`);
  await mongoose.disconnect();
  process.exit(1);
}

if (nonFixtureUsers.length !== 4) {
  console.error(`[SAFETY ABORT] Expected exactly 4 non-fixture users, found ${nonFixtureUsers.length}. Aborting deletion!`);
  await mongoose.disconnect();
  process.exit(1);
}

console.log("\n=================================================================");
console.log(" STEP 6: DELETE ONLY THE IDENTIFIED 50 FIXTURES");
console.log("=================================================================");

const deleteResult = await db.collection("users").deleteMany(fixtureFilter);
console.log(`Deleted fixture users count: ${deleteResult.deletedCount}`);

console.log("\n=================================================================");
console.log(" STEP 7 & 8: POST-CLEANUP VERIFICATION ACROSS ALL COLLECTIONS");
console.log("=================================================================");

const totalUsersAfter = await db.collection("users").countDocuments({});
const adminsAfter = await db.collection("users").countDocuments({ role: "admin" });
const customersAfter = await db.collection("users").countDocuments({ role: "customer" });
const remainingFixtures = await db.collection("users").countDocuments(fixtureFilter);

const totalOrders = await db.collection("orders").countDocuments({});
const totalCampaigns = await db.collection("campaigns").countDocuments({});
const totalSnapshots = await db.collection("churn_prediction_snapshots").countDocuments({});
const totalActivities = await db.collection("activities").countDocuments({});

console.log(`Total Users in DB: ${totalUsersAfter} (Expected: 4)`);
console.log(`  Admins: ${adminsAfter} (Expected: 2)`);
console.log(`  Customers: ${customersAfter} (Expected: 2)`);
console.log(`  Remaining Test Fixtures: ${remainingFixtures} (Expected: 0)`);
console.log(`\nOther Collections Verification:`);
console.log(`  Total Orders:     ${totalOrders} (Expected: 2)`);
console.log(`  Total Campaigns:  ${totalCampaigns}`);
console.log(`  Total Snapshots:  ${totalSnapshots} (Expected: 0)`);
console.log(`  Total Activities: ${totalActivities} (Expected: 233)`);

// Check legitimate customer accounts explicitly
const shivuCustomer = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId("6a8704de95bfe658bec9dc05") });
const shashiCustomer = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId("6a8e91d0757ba1c728e8caaf") });

console.log(`\nLegitimate Customer Accounts Check:`);
console.log(`  Shivu customer exists:  ${shivuCustomer ? "YES (ID: " + shivuCustomer._id + ")" : "NO"}`);
console.log(`  Shashi customer exists: ${shashiCustomer ? "YES (ID: " + shashiCustomer._id + ")" : "NO"}`);

await mongoose.disconnect();
