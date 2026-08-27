import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { extractCustomerFeatures } from "./src/churn/features.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const TARGET_USER_ID_STR = "6a8e91d0757ba1c728e8caaf";
const TARGET_USER_ID = new mongoose.Types.ObjectId(TARGET_USER_ID_STR);
const TARGET_PRODUCT_ID = "lw-008";
const WINDOW_START = new Date("2026-08-26T07:12:36.000Z");
const WINDOW_END = new Date("2026-08-26T07:22:22.000Z");
const FASTAPI_URL = "http://127.0.0.1:8000";

console.log("=================================================================");
console.log(" PHASE 1: VERIFY DATABASE CLEANUP");
console.log("=================================================================");

const totalActivities = await db.collection("activities").countDocuments({});
const totalProductViews = await db.collection("activities").countDocuments({ type: "product_viewed" });

console.log(`Total activities in DB: ${totalActivities} (Expected: 231)`);
console.log(`Total product_viewed activities in DB: ${totalProductViews} (Expected: 1)`);

const remainingPV = await db.collection("activities").find({ type: "product_viewed" }).toArray();
console.log("\nRemaining product_viewed documents:");
console.log(JSON.stringify(remainingPV, null, 2));

const burstWindowCount = await db.collection("activities").countDocuments({
  userId: TARGET_USER_ID,
  type: "product_viewed",
  "metadata.productId": TARGET_PRODUCT_ID,
  createdAt: { $gte: WINDOW_START, $lte: WINDOW_END },
});
console.log(`Matching records in original anomaly window: ${burstWindowCount} (Expected: 1)`);

console.log("\n=================================================================");
console.log(" PHASE 2: VERIFY OTHER COLLECTIONS");
console.log("=================================================================");

const totalUsers = await db.collection("users").countDocuments({});
const nonAdminUsers = await db.collection("users").countDocuments({ role: { $ne: "admin" } });
const adminUsers = await db.collection("users").countDocuments({ role: "admin" });
const totalOrders = await db.collection("orders").countDocuments({});
const totalCampaigns = await db.collection("campaigns").countDocuments({});
const totalSnapshots = await db.collection("churn_prediction_snapshots").countDocuments({});

console.log(`Total users: ${totalUsers} (Non-admin: ${nonAdminUsers}, Admin: ${adminUsers})`);
console.log(`Total orders: ${totalOrders}`);
console.log(`Total campaigns: ${totalCampaigns}`);
console.log(`Total snapshots: ${totalSnapshots}`);
console.log(`Total activities: ${totalActivities}`);

console.log("\n=================================================================");
console.log(" PHASE 3: CUSTOMER IDENTITY & ORPHAN CHECK");
console.log("=================================================================");

// Check for duplicate emails or user IDs in users
const usersAgg = await db.collection("users").aggregate([
  { $group: { _id: "$email", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();
console.log(`Duplicate emails in users collection: ${usersAgg.length}`);

// Check for orphan activities (activities with nonexistent userId)
const allUserIds = (await db.collection("users").find({}, { projection: { _id: 1 } }).toArray()).map(u => String(u._id));
const allUserIdsSet = new Set(allUserIds);

const allActs = await db.collection("activities").find({}).toArray();
const orphanDetails = [];
for (const act of allActs) {
  if (!allUserIdsSet.has(String(act.userId))) {
    orphanDetails.push({ _id: act._id, userId: act.userId, type: act.type, createdAt: act.createdAt });
  }
}
console.log(`Orphan activity records (nonexistent userId): ${orphanDetails.length}`);
if (orphanDetails.length > 0) {
  console.log("Orphan Activity Details:", JSON.stringify(orphanDetails, null, 2));
}

// Check activities of affected customer
const targetUserActs = await db.collection("activities").find({ userId: TARGET_USER_ID }).toArray();
console.log(`Total activities for target customer (${TARGET_USER_ID_STR}): ${targetUserActs.length}`);

console.log("\n=================================================================");
console.log(" PHASE 5: FEATURE EXTRACTION FOR TARGET CUSTOMER");
console.log("=================================================================");

const targetUser = await db.collection("users").findOne({ _id: TARGET_USER_ID });
const targetOrders = await db.collection("orders").find({ userId: TARGET_USER_ID }).toArray();

const featuresCurrent = extractCustomerFeatures({
  user: targetUser,
  activities: targetUserActs,
  orders: targetOrders,
  asOfDate: new Date(),
});

console.log("Current Extracted 21 Features:");
console.table(Object.entries(featuresCurrent).map(([k, v]) => ({ Feature: k, Value: v })));

console.log("\n=================================================================");
console.log(" PHASE 6: ML MODEL ARTIFACT INTEGRITY CHECK");
console.log("=================================================================");

const artifactsPath = path.resolve(process.cwd(), "..", "..", "ChurnProject", "artifacts", "2b2147fd4057");
console.log(`Checking model directory: ${artifactsPath}`);

const requiredFiles = [
  "churn_pipeline.joblib",
  "shap_explainer.joblib",
  "schema.json",
  "model_metadata.json",
  "feature_importance.json",
  "feature_order.json"
];

for (const f of requiredFiles) {
  const fPath = path.join(artifactsPath, f);
  const exists = await fs.access(fPath).then(() => true).catch(() => false);
  if (exists) {
    const stats = await fs.stat(fPath);
    const content = await fs.readFile(fPath);
    const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
    console.log(`  [OK] ${f.padEnd(25)} | Size: ${String(stats.size).padStart(8)} bytes | SHA256: ${hash}`);
  } else {
    console.error(`  [FAIL] Missing file: ${f}`);
  }
}

console.log("\n=================================================================");
console.log(" PHASE 7 & 8: FASTAPI PREDICTION & HISTORICAL SCENARIO COMPARISON");
console.log("=================================================================");

async function predict(features) {
  const res = await fetch(`${FASTAPI_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features),
  });
  if (!res.ok) throw new Error(`FastAPI error: ${res.status}`);
  return await res.json();
}

// Scenario A: Original Anomaly Vector (Recorded before cleanup)
const featuresScenarioA = {
  ...featuresCurrent,
  product_views_30d: 38140,
  activity_event_count_30d: 38185,
};

// Scenario B: Cleaned Production State (Current DB with 1 legitimate preserved view)
const featuresScenarioB = { ...featuresCurrent };

// Scenario C: Product View Excluded In-Memory
const featuresScenarioC = {
  ...featuresCurrent,
  product_views_30d: 0,
  distinct_products_viewed_30d: 0,
  activity_event_count_30d: 45,
};

const predA = await predict(featuresScenarioA);
const predB = await predict(featuresScenarioB);
const predC = await predict(featuresScenarioC);

console.log("Scenario Comparison Table:");
console.table([
  {
    Scenario: "A: Original Anomaly Burst",
    "product_views_30d": featuresScenarioA.product_views_30d,
    "activity_event_count_30d": featuresScenarioA.activity_event_count_30d,
    "Churn Probability": `${(predA.churn_probability * 100).toFixed(2)}%`,
    "Risk Tier": predA.risk_level,
    "Churn Timeline": predA.churn_timeline,
    "Top Recommendation": predA.recommendations?.[0]?.recommendation?.slice(0, 60) + "...",
  },
  {
    Scenario: "B: Cleaned Production (1 Preserved View)",
    "product_views_30d": featuresScenarioB.product_views_30d,
    "activity_event_count_30d": featuresScenarioB.activity_event_count_30d,
    "Churn Probability": `${(predB.churn_probability * 100).toFixed(2)}%`,
    "Risk Tier": predB.risk_level,
    "Churn Timeline": predB.churn_timeline,
    "Top Recommendation": predB.recommendations?.[0]?.recommendation?.slice(0, 60) + "...",
  },
  {
    Scenario: "C: Product View Excluded (0 Views)",
    "product_views_30d": featuresScenarioC.product_views_30d,
    "activity_event_count_30d": featuresScenarioC.activity_event_count_30d,
    "Churn Probability": `${(predC.churn_probability * 100).toFixed(2)}%`,
    "Risk Tier": predC.risk_level,
    "Churn Timeline": predC.churn_timeline,
    "Top Recommendation": predC.recommendations?.[0]?.recommendation?.slice(0, 60) + "...",
  },
]);

console.log("\n=================================================================");
console.log(" PHASE 9: CROSS-CUSTOMER CONTAMINATION AUDIT");
console.log("=================================================================");

const allNonAdminUsers = await db.collection("users").find({ role: { $ne: "admin" } }).toArray();
console.log(`Auditing all ${allNonAdminUsers.length} non-admin customer accounts...`);

let crossContaminatedUsers = 0;
let totalOtherCustomerProductViews = 0;

for (const u of allNonAdminUsers) {
  const uIdStr = String(u._id);
  const uActs = await db.collection("activities").find({ userId: u._id }).toArray();
  const pvCount = uActs.filter(a => a.type === "product_viewed").length;
  
  if (uIdStr !== TARGET_USER_ID_STR) {
    totalOtherCustomerProductViews += pvCount;
    if (pvCount > 0) {
      console.log(`  Customer ${uIdStr} (${u.email}) has ${pvCount} product_viewed activities`);
      crossContaminatedUsers++;
    }
  }
}

console.log(`Other customers with product views: ${crossContaminatedUsers}`);
console.log(`Total other customer product views: ${totalOtherCustomerProductViews}`);

console.log("\n=================================================================");
console.log(" PHASE 13: BACKUP FILE VERIFICATION");
console.log("=================================================================");

const backupFilePath = path.join(process.cwd(), "anomalous-product-views-backup-2026-08-26.json");
const backupExists = await fs.access(backupFilePath).then(() => true).catch(() => false);

if (backupExists) {
  const stats = await fs.stat(backupFilePath);
  const raw = await fs.readFile(backupFilePath, "utf8");
  const parsed = JSON.parse(raw);
  console.log(`Backup file exists: YES (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Document count in backup: ${parsed.length} (Expected: 38140)`);
  console.log(`Earliest record in backup: ${parsed[0]._id} (${parsed[0].createdAt})`);
  console.log(`Latest record in backup:   ${parsed[parsed.length - 1]._id} (${parsed[parsed.length - 1].createdAt})`);
} else {
  console.error("Backup file missing!");
}

await mongoose.disconnect();
