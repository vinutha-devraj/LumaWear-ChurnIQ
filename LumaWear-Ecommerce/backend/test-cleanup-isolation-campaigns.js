import mongoose from "mongoose";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const usersBefore = await db.collection("users").countDocuments({});
const campaignsBefore = await db.collection("campaigns").countDocuments({});
const ordersBefore = await db.collection("orders").countDocuments({});

console.log("=================================================================");
console.log(" BASELINE BEFORE TEST ISOLATION RUN");
console.log("=================================================================");
console.log(`Users:     ${usersBefore}`);
console.log(`Campaigns: ${campaignsBefore}`);
console.log(`Orders:    ${ordersBefore}`);

await mongoose.disconnect();

console.log("\nRunning node --test src/churn/retentionEffectiveness.test.js src/churn/results.test.js...");
try {
  const output = execSync("node --test src/churn/retentionEffectiveness.test.js src/churn/results.test.js", {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  console.log(output);
} catch (err) {
  console.error("Test execution failed:", err.stdout || err.message);
}

await mongoose.connect(MONGODB_URI);
const dbAfter = mongoose.connection.db;

const usersAfter = await dbAfter.collection("users").countDocuments({});
const campaignsAfter = await dbAfter.collection("campaigns").countDocuments({});
const ordersAfter = await dbAfter.collection("orders").countDocuments({});

console.log("\n=================================================================");
console.log(" COUNTS AFTER TEST ISOLATION RUN");
console.log("=================================================================");
console.log(`Users:     ${usersAfter} (Diff: ${usersAfter - usersBefore})`);
console.log(`Campaigns: ${campaignsAfter} (Diff: ${campaignsAfter - campaignsBefore})`);
console.log(`Orders:    ${ordersAfter} (Diff: ${ordersAfter - ordersBefore})`);

await mongoose.disconnect();
