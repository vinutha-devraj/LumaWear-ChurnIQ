import mongoose from "mongoose";
import dotenv from "dotenv";
import { extractCustomerFeatures } from "./src/churn/features.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=== PHASE 2: QUANTIFYING HISTORICAL ANOMALY ===");

const totalProductViews = await db.collection("activities").countDocuments({ type: "product_viewed" });
const totalActivities = await db.collection("activities").countDocuments({});
const totalUsers = await db.collection("users").countDocuments({ role: { $ne: "admin" } });
const totalOrders = await db.collection("orders").countDocuments({});

console.log(`Total non-admin users: ${totalUsers}`);
console.log(`Total activities: ${totalActivities}`);
console.log(`Total product_viewed activities: ${totalProductViews}`);
console.log(`Total orders: ${totalOrders}`);

// Breakdown of product_viewed by user and product
const productViewBreakdown = await db.collection("activities").aggregate([
  { $match: { type: "product_viewed" } },
  {
    $group: {
      _id: { userId: "$userId", productId: "$metadata.productId" },
      count: { $sum: 1 },
      firstSeen: { $min: "$createdAt" },
      lastSeen: { $max: "$createdAt" },
      userAgents: { $addToSet: "$userAgent" },
      ipAddresses: { $addToSet: "$ipAddress" },
    }
  },
  { $sort: { count: -1 } }
]).toArray();

console.log("\n--- Product Views by User and Product ---");
console.log(JSON.stringify(productViewBreakdown, null, 2));

// Breakdown of all activities by type
const activityTypeBreakdown = await db.collection("activities").aggregate([
  {
    $group: {
      _id: "$type",
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } }
]).toArray();

console.log("\n--- All Activity Types Breakdown ---");
console.table(activityTypeBreakdown);

// Target user details
const targetUserId = productViewBreakdown[0]._id.userId;
const targetUser = await db.collection("users").findOne({ _id: targetUserId });
console.log("\n--- Target User Info ---");
console.log(`User ID: ${targetUserId}`);
console.log(`Name: ${targetUser?.name}`);
console.log(`Email: ${targetUser?.email}`);
console.log(`Role: ${targetUser?.role}`);
console.log(`Created At: ${targetUser?.createdAt}`);

// Calculate timing details for the anomaly
const firstSeen = new Date(productViewBreakdown[0].firstSeen);
const lastSeen = new Date(productViewBreakdown[0].lastSeen);
const durationMs = lastSeen.getTime() - firstSeen.getTime();
const durationSec = durationMs / 1000;
const durationMin = durationSec / 60;
const eventsCount = productViewBreakdown[0].count;
const eventsPerSec = eventsCount / (durationSec || 1);
const eventsPerMin = eventsCount / (durationMin || 1);

console.log(`\n--- Anomaly Timing Statistics ---`);
console.log(`First Timestamp: ${firstSeen.toISOString()}`);
console.log(`Last Timestamp:  ${lastSeen.toISOString()}`);
console.log(`Duration: ${durationMs} ms (~${durationSec.toFixed(2)}s / ${durationMin.toFixed(2)} min)`);
console.log(`Rate: ${eventsPerSec.toFixed(2)} events/sec (~${eventsPerMin.toFixed(2)} events/min)`);

// Check if all 38,140 events have identical metadata
const metadataSamples = await db.collection("activities").aggregate([
  { $match: { userId: targetUserId, type: "product_viewed" } },
  { $group: { _id: "$metadata", count: { $sum: 1 } } }
]).toArray();
console.log("\n--- Metadata Variations ---");
console.log(JSON.stringify(metadataSamples, null, 2));

// Check User-Agent and IP breakdown for the anomaly
const uaIpBreakdown = await db.collection("activities").aggregate([
  { $match: { userId: targetUserId, type: "product_viewed" } },
  {
    $group: {
      _id: { userAgent: "$userAgent", ipAddress: "$ipAddress" },
      count: { $sum: 1 }
    }
  }
]).toArray();
console.log("\n--- User-Agent & IP Breakdown ---");
console.log(JSON.stringify(uaIpBreakdown, null, 2));

console.log("\n=== PHASE 3 & 4: FEATURE EXTRACTION & MODEL PREDICTION WITH VS WITHOUT ANOMALY ===");

// Fetch all activities and orders for target user
const allActivities = await db.collection("activities").find({ userId: targetUserId }).toArray();
const allOrders = await db.collection("orders").find({ userId: targetUserId }).toArray();

const asOfDate = new Date();

// Scenario A: WITH anomaly (Current Production DB)
const featuresWithAnomaly = extractCustomerFeatures({
  user: targetUser,
  activities: allActivities,
  orders: allOrders,
  asOfDate,
});

// Scenario B: WITHOUT anomaly (Filter out the 38,140 loop events)
// Keep 1 legitimate view for lw-008 on that date or remove the storm
const activitiesWithoutAnomaly = allActivities.filter((act, index) => {
  if (act.type === "product_viewed" && act.metadata?.productId === "lw-008") {
    // Keep exactly 1 product_viewed event for lw-008
    return index === 0;
  }
  return true;
});

const featuresWithoutAnomaly = extractCustomerFeatures({
  user: targetUser,
  activities: activitiesWithoutAnomaly,
  orders: allOrders,
  asOfDate,
});

console.log("\n--- 21-Feature Comparison Table ---");
const featureKeys = Object.keys(featuresWithAnomaly).filter(k => k !== "user_id");
const comparisonTable = featureKeys.map(key => {
  const valWith = featuresWithAnomaly[key];
  const valWithout = featuresWithoutAnomaly[key];
  let absDelta = "0";
  let pctDelta = "0.00%";
  let affected = "NO";

  if (typeof valWith === "number" && typeof valWithout === "number") {
    const diff = valWith - valWithout;
    absDelta = diff.toString();
    if (valWithout !== 0) {
      pctDelta = `${((diff / valWithout) * 100).toFixed(2)}%`;
    } else if (diff !== 0) {
      pctDelta = "N/A (from 0)";
    }
    affected = diff !== 0 ? "YES" : "NO";
  } else if (valWith !== valWithout) {
    absDelta = `${valWithout} -> ${valWith}`;
    pctDelta = "N/A";
    affected = "YES";
  }

  return {
    Feature: key,
    "With Anomaly": valWith,
    "Without Anomaly": valWithout,
    "Absolute Delta": absDelta,
    "Percentage Delta": pctDelta,
    "Materially Affected?": affected,
  };
});
console.table(comparisonTable);

// Send to FastAPI /predict
console.log("\n--- Calling FastAPI /predict for Scenario A vs Scenario B ---");
const FASTAPI_URL = "http://127.0.0.1:8000";

async function predict(features) {
  const res = await fetch(`${FASTAPI_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FastAPI prediction failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

try {
  const predWith = await predict(featuresWithAnomaly);
  const predWithout = await predict(featuresWithoutAnomaly);

  console.log("\n--- Full Prediction Response ---");
  console.log("Scenario A:", JSON.stringify(predWith, null, 2));
  console.log("Scenario B:", JSON.stringify(predWithout, null, 2));

  const probDiff = predWith.churn_probability - predWithout.churn_probability;
  console.log(`\nDelta Probability: ${probDiff > 0 ? "+" : ""}${probDiff.toFixed(6)}`);
  console.log(`Risk Level Changed: ${predWith.risk_level !== predWithout.risk_level ? "YES" : "NO"}`);
} catch (err) {
  console.error("FastAPI error:", err.message);
}

// Portfolio-level check: Check if any other user has product_viewed or is affected
const otherUsersWithProductViews = await db.collection("activities").aggregate([
  { $match: { type: "product_viewed", userId: { $ne: targetUserId } } },
  { $group: { _id: "$userId", count: { $sum: 1 } } }
]).toArray();

console.log("\n--- Other Users with product_viewed activities ---");
console.log(`Count of other users with product_viewed: ${otherUsersWithProductViews.length}`);

await mongoose.disconnect();
