import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const targetUserId = "6a8e91d0757ba1c728e8caaf";
const campaigns = await db.collection("campaigns").find({
  targetCustomerIds: targetUserId
}).toArray();

console.log(JSON.stringify(campaigns, null, 2));

await mongoose.disconnect();
