import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const snapshots = await db.collection("churn_prediction_snapshots").find({}).toArray();
console.log(`Total snapshots in MongoDB: ${snapshots.length}`);
console.log("Sample snapshots:", snapshots.slice(0, 5));

// Check unique campaignIds in snapshots
const campIds = [...new Set(snapshots.map(s => s.campaignId))];
console.log("Campaign IDs in snapshots:", campIds);

await mongoose.disconnect();
