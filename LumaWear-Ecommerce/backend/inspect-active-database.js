import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ ERROR: MONGODB_URI environment variable is missing in backend/.env");
  process.exit(1);
}

const MONGODB_DB = process.env.MONGODB_DB || "lumawear";

console.log("=================================================================");
console.log(" ACTIVE DATABASE FORENSIC AUDIT (READ-ONLY)");
console.log("=================================================================");

try {
  await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB,
    serverSelectionTimeoutMS: 10000,
  });

  const host = mongoose.connection.host;
  const dbName = mongoose.connection.name;
  const isAtlas = MONGODB_URI.includes("mongodb+srv://") || host.includes("mongodb.net");

  console.log(`Connected Host:   ${host}`);
  console.log(`Database Name:    ${dbName}`);
  console.log(`Environment:      ${isAtlas ? "MongoDB Atlas (Cloud)" : "Local MongoDB"}`);

  const usersCount = await mongoose.connection.db.collection("users").countDocuments();
  const adminCount = await mongoose.connection.db.collection("users").countDocuments({ role: "admin" });
  const customerCount = await mongoose.connection.db.collection("users").countDocuments({ role: { $ne: "admin" } });
  const ordersCount = await mongoose.connection.db.collection("orders").countDocuments();
  const activitiesCount = await mongoose.connection.db.collection("activities").countDocuments();
  const campaignsCount = await mongoose.connection.db.collection("campaigns").countDocuments();
  const snapshotsCount = await mongoose.connection.db.collection("churnpredictionsnapshots").countDocuments();

  console.log("\nAuthoritative Document Counts in Active Database:");
  console.log(`  Users:          ${usersCount}`);
  console.log(`  Real Customers: ${customerCount}`);
  console.log(`  Admins:         ${adminCount}`);
  console.log(`  Orders:         ${ordersCount}`);
  console.log(`  Activities:     ${activitiesCount}`);
  console.log(`  Campaigns:      ${campaignsCount}`);
  console.log(`  Snapshots:      ${snapshotsCount}`);

  console.log("\nRegistered Customers in Active Database (Atlas users collection):");
  const customers = await mongoose.connection.db
    .collection("users")
    .find({ role: { $ne: "admin" } })
    .project({ name: 1, email: 1, role: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .toArray();

  console.table(
    customers.map((c) => ({
      _id: String(c._id),
      name: c.name,
      email: c.email,
      role: c.role,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "N/A",
    }))
  );

  console.log("=================================================================");
  console.log("✅ ACTIVE DATABASE AUDIT COMPLETE: 100% READ-ONLY");
  console.log("=================================================================");
} catch (err) {
  console.error("❌ Failed to connect to active database:", err.message);
} finally {
  await mongoose.disconnect();
}
