import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection.db;

const result = await db.collection("activities").aggregate([
    {
        $match: {
            type: "product_viewed"
        }
    },
    {
        $group: {
            _id: "$userId",
            count: { $sum: 1 }
        }
    },
    {
        $sort: {
            count: -1
        }
    },
    {
        $limit: 20
    }
]).toArray();

console.table(result);

await mongoose.disconnect();