import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection.db;

const samples = await db.collection("activities")
  .find({
    type: "product_viewed",
    userId: new mongoose.Types.ObjectId("6a8e91d0757ba1c728e8caaf"),
    "metadata.productId": "lw-008"
  })
  .sort({ createdAt: 1 })
  .limit(10)
  .toArray();

console.dir(samples, { depth: 6 });

await mongoose.disconnect();