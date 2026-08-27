import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { extractCustomerFeatures } from "./src/churn/features.js";

dotenv.config();

const MONGODB_URI = "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";
const FASTAPI_URL = "http://127.0.0.1:8000";

if (mongoose.connection.readyState === 0) {
  await mongoose.connect(MONGODB_URI);
}
const db = mongoose.connection.db;

const TARGET_USER_ID_STR = "6a8e91d0757ba1c728e8caaf";
const TARGET_USER_ID = new mongoose.Types.ObjectId(TARGET_USER_ID_STR);
const TARGET_PRODUCT_ID = "lw-008";

console.log("=================================================================");
console.log(" STEP 4: LIVE FEATURE RECALCULATION TEST");
console.log("=================================================================");

const targetUser = await db.collection("users").findOne({ _id: TARGET_USER_ID });
const initialActs = await db.collection("activities").find({ userId: TARGET_USER_ID }).toArray();
const initialOrders = await db.collection("orders").find({ userId: TARGET_USER_ID }).toArray();

const featuresBefore = extractCustomerFeatures({
  user: targetUser,
  activities: initialActs,
  orders: initialOrders,
  asOfDate: new Date(),
});

console.log("Baseline Features Before New Event:");
console.log(`  product_views_30d:            ${featuresBefore.product_views_30d} (Expected: 1)`);
console.log(`  distinct_products_viewed_30d: ${featuresBefore.distinct_products_viewed_30d} (Expected: 1)`);
console.log(`  activity_event_count_30d:     ${featuresBefore.activity_event_count_30d} (Expected: 46)`);

// Create exactly ONE legitimate new product_viewed event via server API or Activity insertion
console.log("\nCreating exactly ONE legitimate new product view event for lw-008...");

const token = jwt.sign({ sub: TARGET_USER_ID_STR, role: "customer", type: "access" }, JWT_ACCESS_SECRET, { expiresIn: "1h" });

// We use the running backend API on port 4000 to test the complete end-to-end telemetry pathway
const actRes = await fetch("http://127.0.0.1:4000/api/activity", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    type: "product_viewed",
    route: `/shop/${TARGET_PRODUCT_ID}`,
    metadata: { productId: TARGET_PRODUCT_ID },
  }),
});

const actData = await actRes.json();
console.log("Activity API Response:", actData);

// Re-query database to verify live persistence
const updatedActs = await db.collection("activities").find({ userId: TARGET_USER_ID }).toArray();
const featuresAfter = extractCustomerFeatures({
  user: targetUser,
  activities: updatedActs,
  orders: initialOrders,
  asOfDate: new Date(),
});

console.log("\nUpdated Features After Live Event:");
console.log(`  product_views_30d:            ${featuresAfter.product_views_30d} (Expected: 2)`);
console.log(`  distinct_products_viewed_30d: ${featuresAfter.distinct_products_viewed_30d} (Expected: 1)`);
console.log(`  activity_event_count_30d:     ${featuresAfter.activity_event_count_30d} (Expected: 47)`);

console.log("\nFull 21 Features Table After Live Event:");
console.table(Object.entries(featuresAfter).map(([k, v]) => ({ Feature: k, Value: v })));

console.log("\n=================================================================");
console.log(" STEP 5: PREDICTION AFTER LIVE EVENT");
console.log("=================================================================");

const predRes = await fetch(`${FASTAPI_URL}/predict`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(featuresAfter),
});

const predData = await predRes.json();
console.log("FastAPI Prediction Result:");
console.log(`  Churn Prediction: ${predData.churn_prediction} (${predData.churn_label})`);
console.log(`  Churn Probability: ${predData.churn_probability} (${predData.churn_percentage}%)`);
console.log(`  Risk Level: ${predData.risk_level}`);
console.log(`  Churn Timeline: ${predData.churn_timeline}`);
console.log(`  Top SHAP Feature: ${predData.top_shap_features?.[0]?.feature} (${predData.top_shap_features?.[0]?.shap_value})`);
console.log("\nRecommendations:");
for (const rec of predData.recommendations || []) {
  console.log(`  - [${rec.priority}] (${rec.driven_by}): ${rec.recommendation}`);
}

await mongoose.disconnect();
