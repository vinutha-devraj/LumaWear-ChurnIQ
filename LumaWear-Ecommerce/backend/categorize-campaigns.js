import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const campaigns = await db.collection("campaigns").find({}).sort({ createdAt: 1 }).toArray();
console.log(`Total campaigns in MongoDB: ${campaigns.length}`);

const legitimateCampaigns = [];
const testArtifactCampaigns = [];

campaigns.forEach((c) => {
  const name = c.name || c.campaignName || "";
  const isRetentionTest = name === "Q3 Abandoned Cart Win-Back" || name === "Cancelled Campaign Test";
  const isEffectivenessTest = name === "Effectiveness Test Campaign";
  const isResultsTest = name.startsWith("Results Test Campaign");

  if (isRetentionTest || isEffectivenessTest || isResultsTest) {
    testArtifactCampaigns.push({
      id: c.campaignId || c._id,
      name,
      status: c.status,
      type: c.campaignType,
      targetCount: c.targetCustomers?.length || 0,
      targetUserIds: (c.targetCustomers || []).map(tc => tc.userId || tc.customerId),
      createdAt: c.createdAt,
      sourceTest: isRetentionTest ? "retention.test.js" : isEffectivenessTest ? "retentionEffectiveness.test.js" : "results.test.js"
    });
  } else {
    legitimateCampaigns.push({
      id: c.campaignId || c._id,
      name,
      status: c.status,
      type: c.campaignType,
      targetCount: c.targetCustomers?.length || 0,
      targetUserIds: (c.targetCustomers || []).map(tc => tc.userId || tc.customerId),
      createdAt: c.createdAt,
    });
  }
});

console.log("\n=================================================================");
console.log(" 1. LEGITIMATE PRODUCTION CAMPAIGNS");
console.log("=================================================================");
console.log(`Count: ${legitimateCampaigns.length}`);
console.table(legitimateCampaigns);

console.log("\n=================================================================");
console.log(" 2. TEST SUITE ARTIFACT CAMPAIGNS IN MONGODB");
console.log("=================================================================");
console.log(`Count: ${testArtifactCampaigns.length}`);

const testSummaryBySource = {};
testArtifactCampaigns.forEach(tc => {
  testSummaryBySource[tc.sourceTest] = (testSummaryBySource[tc.sourceTest] || 0) + 1;
});
console.table(Object.entries(testSummaryBySource).map(([source, count]) => ({ "Test Source": source, "Campaigns Created": count })));

console.log("\n=================================================================");
console.log(" 3. TARGET USER IDS IN TEST ARTIFACT CAMPAIGNS");
console.log("=================================================================");
const testTargetIds = new Set();
testArtifactCampaigns.forEach(tc => {
  tc.targetUserIds.forEach(id => {
    if (id) testTargetIds.add(String(id));
  });
});
console.log(`Unique Target User IDs in Test Campaigns: ${testTargetIds.size}`);

// Check how many of these target user IDs exist in current MongoDB users collection
const existingUsersCount = await db.collection("users").countDocuments({ _id: { $in: Array.from(testTargetIds).map(id => {
  try { return new mongoose.Types.ObjectId(id); } catch { return id; }
}) } });

console.log(`How many of these target user IDs exist in MongoDB today: ${existingUsersCount}`);

await mongoose.disconnect();
