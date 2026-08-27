import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection.db;

const result = await db.collection("activities").aggregate([
    {
        $group: {
            _id: "$type",
            count: { $sum: 1 }
        }
    },
    {
        $sort: {
            count: -1
        }
    }
]).toArray();

console.table(result);

await mongoose.disconnect();