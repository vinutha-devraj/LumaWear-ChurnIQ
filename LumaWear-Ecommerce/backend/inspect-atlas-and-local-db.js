import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const LOCAL_URI = "mongodb://127.0.0.1:27017/lumawear";
const ATLAS_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI;

console.log("=================================================================");
console.log(" FORENSIC DATABASE AUDIT: LOCAL & ATLAS INSPECTION");
console.log("=================================================================");

async function inspectConnection(name, uri) {
  console.log(`\n--- Inspecting [${name}] (${uri.replace(/:([^@]+)@/, ":****@")}) ---`);
  try {
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    console.log(`✅ Connected successfully to ${conn.name}`);

    const collections = await conn.db.listCollections().toArray();
    console.log(`Collections found (${collections.length}):`, collections.map(c => c.name));

    const usersCount = collections.some(c => c.name === "users") ? await conn.db.collection("users").countDocuments() : 0;
    const adminCount = collections.some(c => c.name === "users") ? await conn.db.collection("users").countDocuments({ role: "admin" }) : 0;
    const customerCount = collections.some(c => c.name === "users") ? await conn.db.collection("users").countDocuments({ role: { $ne: "admin" } }) : 0;
    const ordersCount = collections.some(c => c.name === "orders") ? await conn.db.collection("orders").countDocuments() : 0;
    const activitiesCount = collections.some(c => c.name === "activities") ? await conn.db.collection("activities").countDocuments() : 0;
    const campaignsCount = collections.some(c => c.name === "campaigns") ? await conn.db.collection("campaigns").countDocuments() : 0;
    const snapshotsCount = collections.some(c => c.name === "churnpredictionsnapshots") ? await conn.db.collection("churnpredictionsnapshots").countDocuments() : 0;

    console.log(`Summary for [${name}]:`);
    console.log(`  Total Users:  ${usersCount} (Admins: ${adminCount}, Customers: ${customerCount})`);
    console.log(`  Orders:       ${ordersCount}`);
    console.log(`  Activities:   ${activitiesCount}`);
    console.log(`  Campaigns:    ${campaignsCount}`);
    console.log(`  Snapshots:    ${snapshotsCount}`);

    if (customerCount > 0) {
      const sampleCustomers = await conn.db.collection("users").find({ role: { $ne: "admin" } }).project({ name: 1, email: 1, role: 1, createdAt: 1 }).toArray();
      console.log(`  Customer Roster in [${name}]:`, sampleCustomers);
    }

    await conn.close();
    return { success: true, name, usersCount, customerCount, ordersCount, activitiesCount, campaignsCount };
  } catch (err) {
    console.log(`❌ Failed to connect to [${name}]: ${err.message}`);
    return { success: false, name, error: err.message };
  }
}

await inspectConnection("Local MongoDB", LOCAL_URI);
if (ATLAS_URI && ATLAS_URI !== LOCAL_URI) {
  await inspectConnection("Atlas MongoDB", ATLAS_URI);
}
console.log("\n=================================================================");
