import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" FORENSIC READ-ONLY AUDIT OF CURRENT MONGODB DATABASE");
console.log("=================================================================");

// 1. USERS
const users = await db.collection("users").find({}).sort({ createdAt: 1 }).toArray();
console.log(`\n--- USERS (${users.length}) ---`);
users.forEach((u, idx) => {
  console.log(`User #${idx + 1}:`);
  console.log(`  _id:       ${u._id}`);
  console.log(`  name:      ${u.name}`);
  console.log(`  email:     ${u.email}`);
  console.log(`  role:      ${u.role}`);
  console.log(`  createdAt: ${u.createdAt?.toISOString?.() || u.createdAt}`);
  console.log(`  lastLogin: ${u.lastLoginAt?.toISOString?.() || u.lastLoginAt}`);
});

// 2. ORDERS
const orders = await db.collection("orders").find({}).sort({ createdAt: 1 }).toArray();
console.log(`\n--- ORDERS (${orders.length}) ---`);
orders.forEach((o, idx) => {
  const matchingUser = users.find((u) => String(u._id) === String(o.userId));
  console.log(`Order #${idx + 1}:`);
  console.log(`  _id:         ${o._id}`);
  console.log(`  orderNumber: ${o.orderNumber}`);
  console.log(`  userId:      ${o.userId} (${matchingUser?.name || "UNKNOWN"} - ${matchingUser?.email || "N/A"})`);
  console.log(`  status:      ${o.status}`);
  console.log(`  subtotal:    $${o.subtotal}`);
  console.log(`  total:       $${o.total}`);
  console.log(`  itemsCount:  ${o.items?.length}`);
  console.log(`  items:       ${JSON.stringify(o.items?.map(i => ({ productId: i.productId, name: i.productName, qty: i.quantity, total: i.lineTotal })))}`);
  console.log(`  createdAt:   ${o.createdAt?.toISOString?.() || o.createdAt}`);
});

// 3. CAMPAIGNS
const campaigns = await db.collection("campaigns").find({}).sort({ createdAt: 1 }).toArray();
console.log(`\n--- CAMPAIGNS (${campaigns.length}) ---`);
campaigns.forEach((c, idx) => {
  console.log(`Campaign #${idx + 1}:`);
  console.log(`  _id:          ${c._id}`);
  console.log(`  campaignId:   ${c.campaignId}`);
  console.log(`  name:         ${c.name}`);
  console.log(`  campaignType: ${c.campaignType}`);
  console.log(`  priority:     ${c.priority}`);
  console.log(`  status:       ${c.status}`);
  console.log(`  targetCount:  ${c.targetCustomerIds?.length}`);
  console.log(`  targetIds:    ${JSON.stringify(c.targetCustomerIds)}`);
  console.log(`  createdAt:    ${c.createdAt?.toISOString?.() || c.createdAt}`);
});

// 4. ACTIVITIES SUMMARY & BREAKDOWN
const activities = await db.collection("activities").find({}).sort({ createdAt: 1 }).toArray();
console.log(`\n--- ACTIVITIES (${activities.length}) ---`);

const actsByUser = {};
const actsByType = {};
activities.forEach((a) => {
  const uid = String(a.userId);
  actsByUser[uid] = (actsByUser[uid] || 0) + 1;
  actsByType[a.type] = (actsByType[a.type] || 0) + 1;
});

console.log(`Activities By User:`);
for (const [uid, count] of Object.entries(actsByUser)) {
  const user = users.find((u) => String(u._id) === uid);
  console.log(`  - User ${uid} (${user?.name || "Unknown"} / ${user?.email || "Unknown"}): ${count} activities`);
}

console.log(`\nActivities By Type:`);
for (const [type, count] of Object.entries(actsByType)) {
  console.log(`  - ${type.padEnd(25)}: ${count}`);
}

// 5. CHURN SNAPSHOTS
const snapshots = await db.collection("churn_prediction_snapshots").find({}).toArray();
console.log(`\n--- CHURN SNAPSHOTS (${snapshots.length}) ---`);

await mongoose.disconnect();
