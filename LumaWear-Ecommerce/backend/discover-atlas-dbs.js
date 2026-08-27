import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const rawAtlasUri = process.env.MONGODB_ATLAS_URI;
if (!rawAtlasUri) {
  console.error("No MONGODB_ATLAS_URI found in .env");
  process.exit(1);
}

// Connect to admin to list all databases
const client = await mongoose.createConnection(rawAtlasUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
const adminDb = client.db.admin();
const dbs = await adminDb.listDatabases();

console.log("=================================================================");
console.log(" MONGODB ATLAS CLUSTER DISCOVERY");
console.log("=================================================================");
console.log("Databases on Atlas Cluster:");
for (const dbInfo of dbs.databases) {
  console.log(`- Database: '${dbInfo.name}' (sizeOnDisk: ${dbInfo.sizeOnDisk})`);
  const specificDbConn = client.useDb(dbInfo.name);
  const collections = await specificDbConn.db.listCollections().toArray();
  console.log(`  Collections (${collections.length}):`, collections.map(c => c.name));
  for (const col of collections) {
    const count = await specificDbConn.db.collection(col.name).countDocuments();
    console.log(`    - ${col.name}: ${count} documents`);
    if (col.name === "users" && count > 0) {
      const sample = await specificDbConn.db.collection(col.name).find().project({ name: 1, email: 1, role: 1 }).toArray();
      console.log(`      Sample users:`, sample);
    }
  }
}

await client.close();
console.log("=================================================================");
