import mongoose from "mongoose";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const usersBefore = await db.collection("users").countDocuments({});
const adminsBefore = await db.collection("users").countDocuments({ role: "admin" });
const customersBefore = await db.collection("users").countDocuments({ role: "customer" });
const ordersBefore = await db.collection("orders").countDocuments({});
const activitiesBefore = await db.collection("activities").countDocuments({});

console.log("=================================================================");
console.log(" DATABASE BASELINE BEFORE FULL TEST SUITE");
console.log("=================================================================");
console.log(`Users:      ${usersBefore} (Admins: ${adminsBefore}, Customers: ${customersBefore})`);
console.log(`Orders:     ${ordersBefore}`);
console.log(`Activities: ${activitiesBefore}`);

await mongoose.disconnect();

console.log("\nRunning FULL backend test suite (npm test)...");
try {
  const testOutput = execSync("npm test", {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  console.log(testOutput);
} catch (err) {
  console.error("Test execution encountered error:", err.stdout || err.message);
}

await mongoose.connect(MONGODB_URI);
const dbAfter = mongoose.connection.db;

const usersAfter = await dbAfter.collection("users").countDocuments({});
const adminsAfter = await dbAfter.collection("users").countDocuments({ role: "admin" });
const customersAfter = await dbAfter.collection("users").countDocuments({ role: "customer" });
const ordersAfter = await dbAfter.collection("orders").countDocuments({});
const activitiesAfter = await dbAfter.collection("activities").countDocuments({});

console.log("\n=================================================================");
console.log(" DATABASE COUNTS AFTER FULL TEST SUITE");
console.log("=================================================================");
console.log(`Users:      ${usersAfter} (Diff: ${usersAfter - usersBefore})`);
console.log(`  Admins:    ${adminsAfter} (Diff: ${adminsAfter - adminsBefore})`);
console.log(`  Customers: ${customersAfter} (Diff: ${customersAfter - customersBefore})`);
console.log(`Orders:     ${ordersAfter} (Diff: ${ordersAfter - ordersBefore})`);
console.log(`Activities: ${activitiesAfter} (Diff: ${activitiesAfter - activitiesBefore})`);

const allUsersAfter = await dbAfter.collection("users").find({}).toArray();
console.log("\nRemaining Users in Database:");
allUsersAfter.forEach(u => {
  console.log(`  - [${u.role.padEnd(8)}] ID: ${u._id} | Name: ${u.name} | Email: ${u.email}`);
});

await mongoose.disconnect();
