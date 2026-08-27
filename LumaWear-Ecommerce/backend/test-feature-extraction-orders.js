import mongoose from "mongoose";
import dotenv from "dotenv";
import { extractCustomerFeatures } from "./src/churn/features.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" TESTING FEATURE EXTRACTION WITH CURRENT FEATURES.JS");
console.log("=================================================================");

const users = await db.collection("users").find({ role: { $ne: "admin" } }).toArray();

for (const user of users) {
  const uid = user._id;
  const activities = await db.collection("activities").find({ userId: uid }).toArray();
  const orders = await db.collection("orders").find({ userId: uid }).toArray();

  const feat = extractCustomerFeatures({
    user,
    activities,
    orders,
    asOfDate: new Date(),
  });

  console.log(`Customer: ${user.name} (${user.email})`);
  console.log(`  Raw Orders in DB: ${orders.length} (Statuses: ${orders.map(o => o.status).join(", ")})`);
  console.log(`  Extracted order_count:           ${feat.order_count}`);
  console.log(`  Extracted orders_30d:            ${feat.orders_30d}`);
  console.log(`  Extracted total_spend:           ${feat.total_spend}`);
  console.log(`  Extracted days_since_last_order: ${feat.days_since_last_order}`);
  console.log(`  Extracted days_since_last_act:   ${feat.days_since_last_activity}`);
  console.log(`  Extracted activity_event_count:  ${feat.activity_event_count_30d}`);
  console.log("");
}

await mongoose.disconnect();
