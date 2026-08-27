import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("Connected to MongoDB:", MONGODB_URI);

const users = await db.collection("users").find({}).sort({ createdAt: 1, _id: 1 }).toArray();
console.log(`Total users in DB: ${users.length}`);

// Redact helper: e.g. "john.doe@example.com" -> "j***e@example.com", "test-user-12345@lumawear.com" -> "t***5@lumawear.com"
function maskEmail(email) {
  if (!email) return "undefined";
  const [local, domain] = email.split("@");
  if (!domain) return local.slice(0, 2) + "***";
  const maskedLocal = local.length <= 2 ? local[0] + "***" : local[0] + "***" + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

function maskName(name) {
  if (!name) return "undefined";
  return name.length <= 2 ? name[0] + "*" : name[0] + "***" + name[name.length - 1];
}

console.log("\n=================================================================");
console.log(" 1. ALL USERS AUDIT (CHRONOLOGICAL)");
console.log("=================================================================");

users.forEach((u, i) => {
  console.log(
    `#${String(i + 1).padStart(2, "0")} | ID: ${u._id} | Role: ${String(u.role).padEnd(8)} | ` +
    `Created: ${u.createdAt ? u.createdAt.toISOString() : "NO_CREATED_AT"} | ` +
    `Email: ${maskEmail(u.email).padEnd(28)} | Name: ${maskName(u.name || u.firstName || u.username)}`
  );
});

console.log("\n=================================================================");
console.log(" 2. TIMESTAMP CLUSTERING & PAIR ANALYSIS");
console.log("=================================================================");

const timestampGroups = {};
users.forEach(u => {
  const tsKey = u.createdAt ? u.createdAt.toISOString() : "NO_DATE";
  if (!timestampGroups[tsKey]) timestampGroups[tsKey] = [];
  timestampGroups[tsKey].push(u);
});

console.log("Identified Timestamp Clusters:");
for (const [ts, group] of Object.entries(timestampGroups)) {
  if (group.length > 1) {
    console.log(`\nCluster at ${ts} (${group.length} users):`);
    group.forEach(u => {
      console.log(`  - ID: ${u._id} | Role: ${u.role} | EmailPattern: ${maskEmail(u.email)} | RawFields: [${Object.keys(u).join(", ")}]`);
    });
  }
}

console.log("\n=================================================================");
console.log(" 3. EMAIL PATTERN & DOMAIN ANALYSIS");
console.log("=================================================================");

const emailPatterns = {};
users.forEach(u => {
  if (!u.email) {
    emailPatterns["NO_EMAIL"] = (emailPatterns["NO_EMAIL"] || 0) + 1;
    return;
  }
  const domain = u.email.split("@")[1] || "NO_DOMAIN";
  let pattern = domain;
  if (u.email.startsWith("test") || u.email.includes("test")) pattern += " (contains 'test')";
  if (u.email.startsWith("admin")) pattern += " (contains 'admin')";
  if (u.email.startsWith("demo")) pattern += " (contains 'demo')";
  if (/^user\d+@/i.test(u.email)) pattern += " (matches userN@)";
  if (/^customer\d+@/i.test(u.email)) pattern += " (matches customerN@)";
  if (/^case\d+/i.test(u.email)) pattern += " (matches caseN...)";
  emailPatterns[pattern] = (emailPatterns[pattern] || 0) + 1;
});

console.table(Object.entries(emailPatterns).map(([pattern, count]) => ({ Pattern: pattern, Count: count })));

console.log("\n=================================================================");
console.log(" 4. CHECK USER ACTIVITIES PER USER");
console.log("=================================================================");

const activitiesByUser = await db.collection("activities").aggregate([
  { $group: { _id: "$userId", count: { $sum: 1 }, types: { $addToSet: "$type" } } }
]).toArray();

const actMap = new Map(activitiesByUser.map(a => [String(a._id), a]));

console.log(`Total users with activities: ${activitiesByUser.length}`);
users.forEach((u, i) => {
  const actInfo = actMap.get(String(u._id));
  if (actInfo) {
    console.log(`User #${i+1} (${u._id}) | Role: ${u.role} | Email: ${maskEmail(u.email)} | Activities: ${actInfo.count} (${actInfo.types.join(", ")})`);
  }
});

await mongoose.disconnect();
