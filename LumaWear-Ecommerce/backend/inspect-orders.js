import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" INSPECTING MONGODB ORDERS COLLECTION");
console.log("=================================================================");

const orders = await db.collection("orders").find({}).toArray();
console.log(`Total orders in MongoDB: ${orders.length}\n`);

orders.forEach((o, i) => {
  console.log(`Order #${i + 1}:`);
  console.log(`  _id:         ${o._id}`);
  console.log(`  orderNumber: ${o.orderNumber}`);
  console.log(`  userId:      ${o.userId} (type: ${typeof o.userId}, isObjectId: ${o.userId instanceof mongoose.Types.ObjectId})`);
  console.log(`  status:      ${o.status}`);
  console.log(`  total:       ${o.total}`);
  console.log(`  items:       ${o.items?.length}`);
  console.log(`  createdAt:   ${o.createdAt?.toISOString()}`);
  console.log("");
});

await mongoose.disconnect();
