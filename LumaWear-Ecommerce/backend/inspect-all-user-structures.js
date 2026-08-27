import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const users = await db.collection("users").find({}).sort({ createdAt: 1 }).toArray();

console.log("=================================================================");
console.log(" FULL STRUCTURAL AUDIT OF ALL 54 USERS IN MONGODB");
console.log("=================================================================");

users.forEach((u, i) => {
  console.log(
    `#${String(i + 1).padStart(2, "0")} | ` +
    `ID: ${u._id} | ` +
    `Role: ${String(u.role).padEnd(8)} | ` +
    `CreatedAt: ${u.createdAt ? u.createdAt.toISOString() : "NO_CREATED_AT"} | ` +
    `Name: ${String(u.name || u.firstName || u.username).padEnd(25)} | ` +
    `EmailPrefix: ${u.email ? u.email.split("@")[0].padEnd(30) : "NO_EMAIL"} | ` +
    `Domain: ${u.email ? u.email.split("@")[1] : "NO_DOMAIN"}`
  );
});

await mongoose.disconnect();
