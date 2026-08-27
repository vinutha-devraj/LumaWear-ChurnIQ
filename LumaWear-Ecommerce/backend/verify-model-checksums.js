import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = path.resolve(__dirname, "../../ChurnProject/artifacts/2b2147fd4057");

const EXPECTED_PREFIXES = {
  "churn_pipeline.joblib": "22e25c41c093cea2",
  "shap_explainer.joblib": "932e2f98fc33107c",
  "schema.json": "624e40207b696e5c",
  "model_metadata.json": "99daa38794ece988",
  "feature_importance.json": "8fa9994018848843",
  "feature_order.json": "9178db63525025fd",
};

console.log("=================================================================");
console.log(" VERIFYING ACTIVE ML MODEL ARTIFACT CHECKSUMS (2b2147fd4057)");
console.log(` Artifact Directory: ${ARTIFACT_DIR}`);
console.log("=================================================================");

let allMatch = true;
for (const [file, prefix] of Object.entries(EXPECTED_PREFIXES)) {
  const filePath = path.join(ARTIFACT_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing: ${file}`);
    allMatch = false;
    continue;
  }
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  const match = hash.startsWith(prefix);
  console.log(`${match ? "✅" : "❌"} ${file.padEnd(25)} : ${hash.substring(0, 16)}... (Match: ${match})`);
  if (!match) allMatch = false;
}

if (allMatch) {
  console.log("\n🎉 ALL 6 ACTIVE MODEL ARTIFACT CHECKSUMS 100% MATCH!");
} else {
  console.error("\n❌ CHECKSUM MISMATCH!");
  process.exit(1);
}
