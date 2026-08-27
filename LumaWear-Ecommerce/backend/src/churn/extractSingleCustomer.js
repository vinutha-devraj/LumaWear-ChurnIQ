/**
 * extractSingleCustomer.js
 * CLI helper to extract the 21 LumaWear features for a single customer
 * using the official extractCustomerFeatures implementation.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { extractCustomerFeatures } from "./features.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../..");

dotenv.config({ path: path.resolve(BACKEND_DIR, ".env") });

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.log(JSON.stringify({ success: false, error: "userId argument is required" }));
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";
  const dbName = process.env.MONGODB_DB || "lumawear";

  try {
    await mongoose.connect(mongoUri, { dbName, serverSelectionTimeoutMS: 3000 });
    const connection = mongoose.connection;

    const userCol = connection.collection("users");
    const activityCol = connection.collection("activities");
    const orderCol = connection.collection("orders");

    // Try finding by ObjectId or string ID
    let user = null;
    try {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await userCol.findOne({ _id: new mongoose.Types.ObjectId(userId) });
      }
    } catch {
      // Ignore invalid ObjectId cast
    }

    if (!user) {
      user = await userCol.findOne({ $or: [{ _id: userId }, { id: userId }, { userId: userId }] });
    }

    if (!user) {
      console.log(JSON.stringify({ success: false, error: `Customer '${userId}' not found in database` }));
      process.exit(0);
    }

    const uid = user._id;
    const [activities, orders] = await Promise.all([
      activityCol.find({ userId: uid }).toArray(),
      orderCol.find({ userId: uid }).toArray(),
    ]);

    const features = extractCustomerFeatures({
      user,
      activities,
      orders,
      asOfDate: new Date(),
    });

    console.log(JSON.stringify({ success: true, user_id: userId, features }));
  } catch (error) {
    console.log(JSON.stringify({ success: false, error: error.message }));
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main().catch((err) => {
  console.log(JSON.stringify({ success: false, error: err.message }));
});
