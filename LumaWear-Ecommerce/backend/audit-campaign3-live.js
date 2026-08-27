import mongoose from "mongoose";
import dotenv from "dotenv";
import { extractCustomerFeatures } from "./src/churn/features.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" READ-ONLY AUDIT OF LIVE EVALUATION FOR CAMPAIGN #3 (Shirisha M P)");
console.log("=================================================================");

const campaign = await db.collection("campaigns").findOne({ campaignId: "CAMP-1787820331766-381F0A" });
const user = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId("6a8ff08e0817cc310fc5479d") });
const orders = await db.collection("orders").find({ userId: user._id }).sort({ createdAt: 1 }).toArray();
const activities = await db.collection("activities").find({ userId: user._id }).sort({ createdAt: 1 }).toArray();

console.log(`Campaign Created At: ${campaign.createdAt.toISOString()}`);
console.log(`Orders in DB (${orders.length}):`);
orders.forEach((o, i) => {
  console.log(`  Order #${i+1}: ${o.orderNumber} | Total: $${o.total} | Status: ${o.status} | Created: ${o.createdAt.toISOString()}`);
});

const beforeFeat = extractCustomerFeatures({
  user,
  activities,
  orders,
  asOfDate: campaign.createdAt,
});

const latestFeat = extractCustomerFeatures({
  user,
  activities,
  orders,
  asOfDate: new Date(),
});

console.log(`\nBEFORE CAMPAIGN (Frozen as of ${campaign.createdAt.toISOString()}):`);
console.log(`  order_count:           ${beforeFeat.order_count} (Order #1 placed before campaign)`);
console.log(`  total_spend:           $${beforeFeat.total_spend}`);
console.log(`  days_since_last_order: ${beforeFeat.days_since_last_order}`);

console.log(`\nLATEST LIVE STATE (Recalculated with live orders):`);
console.log(`  order_count:           ${latestFeat.order_count} (Order #1 + Order #2 placed after campaign)`);
console.log(`  total_spend:           $${latestFeat.total_spend}`);
console.log(`  days_since_last_order: ${latestFeat.days_since_last_order}`);
console.log(`  orders_30d:            ${latestFeat.orders_30d}`);

console.log(`\nOBSERVED DELTA ON RESULTS PAGE:`);
console.log(`  Order Delta: +${latestFeat.order_count - beforeFeat.order_count}`);
console.log(`  Spend Delta: +$${(latestFeat.total_spend - beforeFeat.total_spend).toFixed(2)}`);

await mongoose.disconnect();
