import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;
const adminUser = await db.collection("users").findOne({ role: "admin" });
const token = jwt.sign({ sub: adminUser._id.toString(), role: "admin", type: "access" }, JWT_ACCESS_SECRET, { expiresIn: "1h" });

const res = await fetch("http://127.0.0.1:4000/api/churn/results", {
  headers: { Authorization: `Bearer ${token}` }
});

const data = await res.json();
console.log("=== RESULTS DASHBOARD API DATA ===");
console.log(JSON.stringify(data, null, 2));

await mongoose.disconnect();
