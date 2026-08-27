import mongoose from "mongoose";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const usersBefore = await db.collection("users").countDocuments({});
const campaignsBefore = await db.collection("campaigns").countDocuments({});
console.log(`Users before test: ${usersBefore}`);
console.log(`Campaigns before test: ${campaignsBefore}`);

await mongoose.disconnect();

console.log("\nRunning ONLY retention test...");
try {
  const output = execSync("node --test src/churn/retention.test.js", {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  console.log(output);
} catch (e) {
  console.error("Test failed:", e.stdout || e.message);
}

await mongoose.connect(MONGODB_URI);
const dbAfter = mongoose.connection.db;
const usersAfter = await dbAfter.collection("users").countDocuments({});
const campaignsAfter = await dbAfter.collection("campaigns").countDocuments({});

console.log("\n=================================================================");
console.log(" ISOLATED TEST CLEANUP RESULTS (RUN 1)");
console.log("=================================================================");
console.log(`Users before:     ${usersBefore}`);
console.log(`Users after:      ${usersAfter} (Diff: ${usersAfter - usersBefore})`);
console.log(`Campaigns before: ${campaignsBefore}`);
console.log(`Campaigns after:  ${campaignsAfter} (Diff: ${campaignsAfter - campaignsBefore})`);

await mongoose.disconnect();
