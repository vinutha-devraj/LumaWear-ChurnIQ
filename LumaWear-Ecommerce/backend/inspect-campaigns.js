import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lumawear";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

console.log("=================================================================");
console.log(" INSPECTING MONGODB CAMPAIGNS COLLECTION");
console.log("=================================================================");

const campaigns = await db.collection("campaigns").find({}).toArray();
console.log(`Total campaigns in MongoDB: ${campaigns.length}\n`);

campaigns.forEach((c, i) => {
  console.log(`Campaign #${i + 1}:`);
  console.log(`  _id:         ${c._id}`);
  console.log(`  campaignId:  ${c.campaignId}`);
  console.log(`  name:        ${c.name}`);
  console.log(`  campaignType:${c.campaignType}`);
  console.log(`  status:      ${c.status}`);
  console.log(`  createdAt:   ${c.createdAt?.toISOString()}`);
  console.log("");
});

await mongoose.disconnect();
