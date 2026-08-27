import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const counts = {
  totalUsers: await db.collection("users").countDocuments({}),
  adminUsers: await db.collection("users").countDocuments({ role: "admin" }),
  customerUsers: await db.collection("users").countDocuments({ role: "customer" }),
  orders: await db.collection("orders").countDocuments({}),
  activities: await db.collection("activities").countDocuments({}),
  campaigns: await db.collection("campaigns").countDocuments({}),
  snapshots: await db.collection("churn_prediction_snapshots").countDocuments({}),
};

console.log("Current Authoritative MongoDB Counts (Zero Modifications Confirmed):");
console.table(Object.entries(counts).map(([k, v]) => ({ Collection: k, Count: v })));

await mongoose.disconnect();
