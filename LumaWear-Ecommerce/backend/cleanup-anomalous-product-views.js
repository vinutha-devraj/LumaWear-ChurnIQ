import fs from "node:fs/promises";
import path from "node:path";
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
const WINDOW_START = new Date("2026-08-26T07:12:36.145Z");
const WINDOW_END = new Date("2026-08-26T07:22:21.746Z");
const BACKUP_FILE = path.join(process.cwd(), "anomalous-product-views-backup-2026-08-26.json");
const FASTAPI_URL = "http://127.0.0.1:8000";

console.log("=================================================================");
console.log(" STEP 1: DRY RUN & ANOMALY VERIFICATION");
console.log("=================================================================");

// Query matching anomaly
const anomalyFilter = {
  userId: TARGET_USER_ID,
  type: "product_viewed",
  "metadata.productId": TARGET_PRODUCT_ID,
  createdAt: { $gte: WINDOW_START, $lte: WINDOW_END },
};

const matchingCount = await db.collection("activities").countDocuments(anomalyFilter);
console.log(`Matching documents found: ${matchingCount}`);

if (matchingCount !== 38140) {
  console.error(`[SAFETY ABORT] Expected exactly 38,140 matching documents, found ${matchingCount}. Aborting!`);
  await mongoose.disconnect();
  process.exit(1);
}

// Find earliest and latest matching document
const earliestDoc = await db.collection("activities").find(anomalyFilter).sort({ createdAt: 1, _id: 1 }).limit(1).toArray();
const latestDoc = await db.collection("activities").find(anomalyFilter).sort({ createdAt: -1, _id: -1 }).limit(1).toArray();

console.log("Earliest document in burst:");
console.log(`  _id: ${earliestDoc[0]._id}`);
console.log(`  createdAt: ${earliestDoc[0].createdAt.toISOString()}`);
console.log(`  metadata:`, earliestDoc[0].metadata);

console.log("Latest document in burst:");
console.log(`  _id: ${latestDoc[0]._id}`);
console.log(`  createdAt: ${latestDoc[0].createdAt.toISOString()}`);
console.log(`  metadata:`, latestDoc[0].metadata);

// Check if any product_viewed exist outside window
const outsideWindowCount = await db.collection("activities").countDocuments({
  userId: TARGET_USER_ID,
  type: "product_viewed",
  $or: [
    { createdAt: { $lt: WINDOW_START } },
    { createdAt: { $gt: WINDOW_END } },
  ],
});
console.log(`Product views for this user outside anomaly window: ${outsideWindowCount}`);

// Record baseline collection counts before any deletion
const usersCountBefore = await db.collection("users").countDocuments({});
const nonAdminUsersBefore = await db.collection("users").countDocuments({ role: { $ne: "admin" } });
const ordersCountBefore = await db.collection("orders").countDocuments({});
const campaignsCountBefore = await db.collection("campaigns").countDocuments({});
const snapshotsCountBefore = await db.collection("churn_prediction_snapshots").countDocuments({});
const activitiesCountBefore = await db.collection("activities").countDocuments({});
const productViewsCountBefore = await db.collection("activities").countDocuments({ type: "product_viewed" });

console.log("\nBaseline Database Counts Before Cleanup:");
console.log(`  Total Users: ${usersCountBefore} (Non-admin: ${nonAdminUsersBefore})`);
console.log(`  Total Orders: ${ordersCountBefore}`);
console.log(`  Total Campaigns: ${campaignsCountBefore}`);
console.log(`  Total Snapshots: ${snapshotsCountBefore}`);
console.log(`  Total Activities: ${activitiesCountBefore} (Product views: ${productViewsCountBefore})`);

console.log("\n=================================================================");
console.log(" STEP 2: CREATING LOCAL BACKUP");
console.log("=================================================================");

console.log(`Exporting ${matchingCount} documents to: ${BACKUP_FILE}...`);
const allMatchingDocs = await db.collection("activities").find(anomalyFilter).sort({ createdAt: 1, _id: 1 }).toArray();

await fs.writeFile(BACKUP_FILE, JSON.stringify(allMatchingDocs, null, 2), "utf8");

const fileStats = await fs.stat(BACKUP_FILE);
console.log(`Backup written successfully (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB).`);

const backupRaw = await fs.readFile(BACKUP_FILE, "utf8");
const backupParsed = JSON.parse(backupRaw);

if (backupParsed.length !== 38140) {
  console.error(`[SAFETY ABORT] Backup file verification failed! Expected 38,140 items, found ${backupParsed.length}. Aborting!`);
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`[BACKUP VERIFIED] Exactly ${backupParsed.length} records verified in backup file.`);

console.log("\n=================================================================");
console.log(" STEP 3 & 4: PRESERVE FIRST EVENT & DELETE DUPLICATES");
console.log("=================================================================");

const firstLegitimateEvent = earliestDoc[0];
console.log(`Preserving first legitimate event: ID ${firstLegitimateEvent._id} at ${firstLegitimateEvent.createdAt.toISOString()}`);

// Strict deletion query: Only documents matching the exact user, type, product, window, and strictly after the first event
const deleteFilter = {
  userId: TARGET_USER_ID,
  type: "product_viewed",
  "metadata.productId": TARGET_PRODUCT_ID,
  _id: { $ne: firstLegitimateEvent._id },
  createdAt: { $gte: firstLegitimateEvent.createdAt, $lte: WINDOW_END },
};

const duplicateCountToDelete = await db.collection("activities").countDocuments(deleteFilter);
console.log(`Duplicate records identified for deletion: ${duplicateCountToDelete}`);

if (duplicateCountToDelete !== 38139) {
  console.error(`[SAFETY ABORT] Expected exactly 38,139 duplicates to delete, found ${duplicateCountToDelete}. Aborting!`);
  await mongoose.disconnect();
  process.exit(1);
}

const deleteResult = await db.collection("activities").deleteMany(deleteFilter);
console.log(`Delete operation complete: deletedCount = ${deleteResult.deletedCount}`);

if (deleteResult.deletedCount !== 38139) {
  console.error(`[SAFETY WARNING] Deleted ${deleteResult.deletedCount} instead of 38,139!`);
}

console.log("\n=================================================================");
console.log(" STEP 5: VERIFICATION AFTER CLEANUP");
console.log("=================================================================");

const remainingMatchingCount = await db.collection("activities").countDocuments(anomalyFilter);
const remainingPreservedDoc = await db.collection("activities").findOne({ _id: firstLegitimateEvent._id });

const usersCountAfter = await db.collection("users").countDocuments({});
const nonAdminUsersAfter = await db.collection("users").countDocuments({ role: { $ne: "admin" } });
const ordersCountAfter = await db.collection("orders").countDocuments({});
const campaignsCountAfter = await db.collection("campaigns").countDocuments({});
const snapshotsCountAfter = await db.collection("churn_prediction_snapshots").countDocuments({});
const activitiesCountAfter = await db.collection("activities").countDocuments({});
const productViewsCountAfter = await db.collection("activities").countDocuments({ type: "product_viewed" });

console.log("Database Counts After Cleanup:");
console.log(`  Matching burst documents remaining: ${remainingMatchingCount} (Expected: 1)`);
console.log(`  Preserved document exists: ${remainingPreservedDoc ? "YES (ID: " + remainingPreservedDoc._id + ")" : "NO"}`);
console.log(`  Total Users: ${usersCountAfter} (Non-admin: ${nonAdminUsersAfter}) [Diff: ${usersCountAfter - usersCountBefore}]`);
console.log(`  Total Orders: ${ordersCountAfter} [Diff: ${ordersCountAfter - ordersCountBefore}]`);
console.log(`  Total Campaigns: ${campaignsCountAfter} [Diff: ${campaignsCountAfter - campaignsCountBefore}]`);
console.log(`  Total Snapshots: ${snapshotsCountAfter} [Diff: ${snapshotsCountAfter - snapshotsCountBefore}]`);
console.log(`  Total Activities: ${activitiesCountAfter} (Product views: ${productViewsCountAfter}) [Diff: ${activitiesCountAfter - activitiesCountBefore}]`);

console.log("\n=================================================================");
console.log(" STEP 6: RE-RUN CHURN FEATURE EXTRACTION");
console.log("=================================================================");

const targetUser = await db.collection("users").findOne({ _id: TARGET_USER_ID });
const userActivitiesAfter = await db.collection("activities").find({ userId: TARGET_USER_ID }).toArray();
const userOrdersAfter = await db.collection("orders").find({ userId: TARGET_USER_ID }).toArray();

const featuresAfter = extractCustomerFeatures({
  user: targetUser,
  activities: userActivitiesAfter,
  orders: userOrdersAfter,
  asOfDate: new Date(),
});

console.log("Features After Cleanup for Target Customer:");
console.table(Object.entries(featuresAfter).map(([k, v]) => ({ Feature: k, Value: v })));

console.log("\n=================================================================");
console.log(" STEP 7: RE-RUN ACTIVE MODEL PREDICTION (2b2147fd4057)");
console.log("=================================================================");

const predRes = await fetch(`${FASTAPI_URL}/predict`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(featuresAfter),
});

if (!predRes.ok) {
  const errText = await predRes.text();
  console.error(`FastAPI prediction failed: ${errText}`);
} else {
  const predData = await predRes.json();
  console.log("Prediction After Cleanup:");
  console.log(`  Churn Probability: ${predData.churn_probability} (${predData.churn_percentage}%)`);
  console.log(`  Risk Level: ${predData.risk_level}`);
  console.log(`  Churn Timeline: ${predData.churn_timeline}`);
  console.log(`  Top SHAP Feature: ${predData.top_shap_features?.[0]?.feature} (${predData.top_shap_features?.[0]?.shap_value})`);
  console.log(`  Recommendations Count: ${predData.recommendations?.length}`);
  if (predData.recommendations?.length > 0) {
    console.log("  Top Recommendation:", predData.recommendations[0].recommendation);
  }
}

await mongoose.disconnect();
