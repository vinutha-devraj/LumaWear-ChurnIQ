import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  CHURN_DATASET_COLUMNS,
  MODEL_FEATURE_COLUMNS,
  generateChurnDatasetFromDatabase,
} from "./dataset.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LABEL_WINDOW_DAYS = 90;
const SUCCESSFUL_ORDER_STATUSES = new Set(["confirmed", "completed"]);
const MEANINGFUL_ACTIVITY_TYPES = new Set([
  "auth_login",
  "page_view",
  "product_viewed",
  "cart_add",
  "cart_update",
  "cart_remove",
  "cart_clear",
  "wishlist_toggle",
  "order_placed",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../..");
const DATA_DIR = path.resolve(BACKEND_DIR, "data");
const DEFAULT_OUTPUT_PATH = path.resolve(DATA_DIR, "lumawear_churn_dataset.csv");

dotenv.config({ path: path.resolve(BACKEND_DIR, ".env") });

function toDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseArgs(argv = process.argv.slice(2)) {
  const parsed = {};
  for (const arg of argv) {
    const [flag, value] = arg.split("=");
    if (!flag.startsWith("--") || value === undefined) continue;
    parsed[flag.slice(2)] = value;
  }
  return {
    outputPath: parsed.output || DEFAULT_OUTPUT_PATH,
    startDate: parsed.startDate || null,
    endDate: parsed.endDate || null,
    observationDate: parsed.observationDate || new Date().toISOString(),
    monthStep: Math.max(1, Number(parsed.monthStep || 1)),
  };
}

function monthStartUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonthsUtc(date, amount) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

export function buildMonthlyAsOfDates({ startDate, endDate, monthStep = 1 }) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const result = [];
  let cursor = monthStartUtc(start);
  const endMonth = monthStartUtc(end);

  while (cursor.getTime() <= endMonth.getTime()) {
    result.push(new Date(cursor.getTime()));
    cursor = addMonthsUtc(cursor, monthStep);
  }
  return result;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeRowsToCsv(rows, columns = CHURN_DATASET_COLUMNS) {
  const header = columns.join(",");
  const lines = (Array.isArray(rows) ? rows : []).map((row) => columns.map((column) => csvEscape(row[column])).join(","));
  return [header, ...lines].join("\n");
}

function createReadOnlyModels(connection) {
  const userSchema = new mongoose.Schema({}, { strict: false, collection: "users" });
  const activitySchema = new mongoose.Schema({}, { strict: false, collection: "activities" });
  const orderSchema = new mongoose.Schema({}, { strict: false, collection: "orders" });

  return {
    UserModel: connection.models.ChurnExportUser || connection.model("ChurnExportUser", userSchema),
    ActivityModel: connection.models.ChurnExportActivity || connection.model("ChurnExportActivity", activitySchema),
    OrderModel: connection.models.ChurnExportOrder || connection.model("ChurnExportOrder", orderSchema),
  };
}

async function readDateBounds(connection) {
  const orders = connection.collection("orders");
  const activities = connection.collection("activities");

  const [earliestOrder, latestOrder, earliestSuccessfulOrder, earliestMeaningfulActivity] = await Promise.all([
    orders.find({ createdAt: { $type: "date" } }).sort({ createdAt: 1 }).limit(1).toArray(),
    orders.find({ createdAt: { $type: "date" } }).sort({ createdAt: -1 }).limit(1).toArray(),
    orders
      .find({ status: { $in: [...SUCCESSFUL_ORDER_STATUSES] }, createdAt: { $type: "date" } })
      .sort({ createdAt: 1 })
      .limit(1)
      .toArray(),
    activities
      .find({ type: { $in: [...MEANINGFUL_ACTIVITY_TYPES] }, createdAt: { $type: "date" } })
      .sort({ createdAt: 1 })
      .limit(1)
      .toArray(),
  ]);

  return {
    earliestOrderDate: earliestOrder[0]?.createdAt || null,
    latestOrderDate: latestOrder[0]?.createdAt || null,
    earliestSuccessfulOrderDate: earliestSuccessfulOrder[0]?.createdAt || null,
    earliestMeaningfulActivityDate: earliestMeaningfulActivity[0]?.createdAt || null,
  };
}

function computeAsOfRange({
  startDateArg,
  endDateArg,
  observationDate,
  latestOrderDate,
  earliestSuccessfulOrderDate,
  earliestMeaningfulActivityDate,
}) {
  const observation = toDate(observationDate);
  if (!observation) throw new Error("Invalid observationDate");

  const maxByLabel = new Date(observation.getTime() - LABEL_WINDOW_DAYS * DAY_MS);
  const latestDataDate = [latestOrderDate, maxByLabel]
    .map(toDate)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())
    .at(0);

  const derivedStart = [earliestSuccessfulOrderDate, earliestMeaningfulActivityDate]
    .map(toDate)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())
    .at(0);

  const startDate = toDate(startDateArg) || derivedStart;
  const endDate = toDate(endDateArg) || latestDataDate;

  return { startDate, endDate, observationDate: observation, maxByLabel };
}

function getClassPercentage(count, total) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

function buildDatasetChecks({ result, observationDate }) {
  const errors = [];
  const warnings = [];

  if (result.rows.length === 0) {
    errors.push("No dataset rows were generated.");
  }

  if (result.summary.churn0 === 0 || result.summary.churn1 === 0) {
    warnings.push("Only one churn class is present. Do not proceed to model training.");
  }

  if (MODEL_FEATURE_COLUMNS.length !== 21) {
    errors.push("Expected exactly 21 model features.");
  }

  if (MODEL_FEATURE_COLUMNS.includes("user_id") || MODEL_FEATURE_COLUMNS.includes("as_of_date")) {
    errors.push("Metadata columns leaked into model feature columns.");
  }

  const duplicateKeyCount = result.rows.length - new Set(result.rows.map((row) => `${row.user_id}::${row.as_of_date}`)).size;
  if (duplicateKeyCount > 0) {
    errors.push(`Detected ${duplicateKeyCount} duplicate (user_id, as_of_date) rows.`);
  }

  const observation = toDate(observationDate);
  const latestFeatureAllowed = observation.getTime() - LABEL_WINDOW_DAYS * DAY_MS;
  const invalidAsOfRows = result.rows.filter((row) => {
    const asOf = toDate(row.as_of_date);
    return !asOf || asOf.getTime() > latestFeatureAllowed;
  }).length;
  if (invalidAsOfRows > 0) {
    errors.push(`${invalidAsOfRows} rows violate as-of date cutoff for label window completeness.`);
  }

  const unsafeColumns = ["email", "password", "address", "phone", "ipAddress", "userAgent"];
  const leakedColumns = unsafeColumns.filter((column) => CHURN_DATASET_COLUMNS.includes(column));
  if (leakedColumns.length > 0) {
    errors.push(`Sensitive columns leaked into CSV schema: ${leakedColumns.join(", ")}`);
  }

  return { errors, warnings };
}

function printSummary({ result, asOfDates, dateBounds }) {
  const rows = result.rows;
  const summary = result.summary;

  console.log("\nDataset statistics:");
  console.log(`- total rows: ${rows.length}`);
  console.log(`- unique customers: ${summary.uniqueCustomers}`);
  console.log(`- number of as-of dates: ${summary.asOfDateCount}`);
  console.log(`- churn = 0: ${summary.churn0}`);
  console.log(`- churn = 1: ${summary.churn1}`);
  console.log(`- class distribution: churn=0 ${getClassPercentage(summary.churn0, rows.length)}% | churn=1 ${getClassPercentage(summary.churn1, rows.length)}%`);

  console.log("\nSkipped:");
  console.log(`- no successful order: ${summary.skippedNoOrder}`);
  console.log(`- incomplete 90-day window: ${summary.skippedIncompleteLabelWindow}`);
  console.log(`- invalid rows: ${summary.invalidRows}`);
  console.log(`- duplicate rows: ${summary.skippedDuplicateRow}`);

  console.log("\nMissing values:");
  for (const featureName of MODEL_FEATURE_COLUMNS) {
    const missingCount = summary.missingValueSummary[featureName] || 0;
    const missingPct = rows.length === 0 ? 0 : Number(((missingCount / rows.length) * 100).toFixed(2));
    console.log(`${featureName}:`);
    console.log(`  missing_count: ${missingCount}`);
    console.log(`  missing_percentage: ${missingPct}%`);
  }

  console.log("\nDate range:");
  console.log(`- Earliest as-of date: ${asOfDates[0]?.toISOString().slice(0, 10) || "n/a"}`);
  console.log(`- Latest as-of date: ${asOfDates.at(-1)?.toISOString().slice(0, 10) || "n/a"}`);
  console.log(`- Earliest order date: ${toDate(dateBounds.earliestOrderDate)?.toISOString() || "n/a"}`);
  console.log(`- Latest order date: ${toDate(dateBounds.latestOrderDate)?.toISOString() || "n/a"}`);

  console.log("\nReal-data limitation report:");
  console.log(`- eligible customers represented: ${summary.uniqueCustomers}`);
  console.log(`- usable historical snapshots: ${rows.length}`);
  console.log(`- class balance check: churn=0 ${summary.churn0}, churn=1 ${summary.churn1}`);

  const highMissing = MODEL_FEATURE_COLUMNS
    .map((featureName) => {
      const missingCount = summary.missingValueSummary[featureName] || 0;
      const missingPct = rows.length === 0 ? 0 : (missingCount / rows.length) * 100;
      return { featureName, missingPct };
    })
    .filter((item) => item.missingPct >= 20)
    .sort((a, b) => b.missingPct - a.missingPct);

  if (highMissing.length === 0) {
    console.log("- substantial missing features (>=20%): none detected");
  } else {
    console.log(`- substantial missing features (>=20%): ${highMissing.map((item) => `${item.featureName} (${item.missingPct.toFixed(2)}%)`).join(", ")}`);
  }

  if (rows.length < 200 || summary.uniqueCustomers < 50) {
    console.log("- dataset size warning: snapshot/customer volume is low for robust ML training; collect more history before training.");
  } else {
    console.log("- dataset size check: historical volume appears non-trivial; still validate leakage and drift before any training.");
  }
}

export async function exportChurnDatasetPreview(options = {}) {
  const args = { ...parseArgs([]), ...options };
  const observationDate = toDate(args.observationDate);
  if (!observationDate) throw new Error("Invalid observation date.");

  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI || "mongodb://127.0.0.1:27017/lumawear";
  const dbName = process.env.MONGODB_DB || "lumawear";

  await mongoose.connect(mongoUri, { dbName, serverSelectionTimeoutMS: 10000 });
  try {
    const dateBounds = await readDateBounds(mongoose.connection);
    const range = computeAsOfRange({
      startDateArg: args.startDate,
      endDateArg: args.endDate,
      observationDate,
      latestOrderDate: dateBounds.latestOrderDate,
      earliestSuccessfulOrderDate: dateBounds.earliestSuccessfulOrderDate,
      earliestMeaningfulActivityDate: dateBounds.earliestMeaningfulActivityDate,
    });

    if (!range.startDate || !range.endDate || range.startDate.getTime() > range.endDate.getTime()) {
      console.log("No valid date range found from existing data (requires >= 90 days of history before observation date). Dataset was not generated.");
      return { rows: [], summary: { generatedRows: 0 }, columns: [...CHURN_DATASET_COLUMNS] };
    }

    const asOfDates = buildMonthlyAsOfDates({
      startDate: range.startDate,
      endDate: range.endDate,
      monthStep: args.monthStep,
    });

    const { UserModel, ActivityModel, OrderModel } = createReadOnlyModels(mongoose.connection);
    const result = await generateChurnDatasetFromDatabase({
      asOfDates,
      observationDate,
      userModel: UserModel,
      activityModel: ActivityModel,
      orderModel: OrderModel,
    });

    const checks = buildDatasetChecks({ result, observationDate });
    for (const warning of checks.warnings) console.warn(`WARNING: ${warning}`);
    if (checks.errors.length > 0) {
      for (const error of checks.errors) console.error(`ERROR: ${error}`);
      throw new Error("Dataset quality checks failed. CSV was not written.");
    }

    await fs.mkdir(path.dirname(args.outputPath), { recursive: true });
    const csv = serializeRowsToCsv(result.rows, result.columns);
    await fs.writeFile(args.outputPath, `${csv}\n`, "utf8");

    printSummary({ result, asOfDates, dateBounds });
    console.log(`\nCSV written to: ${args.outputPath}`);

    return {
      ...result,
      outputPath: args.outputPath,
      asOfDates,
      dateBounds,
      checks,
    };
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  try {
    const args = parseArgs();
    await exportChurnDatasetPreview(args);
  } catch (error) {
    console.error("Dataset export failed:", error.message || error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void main();
}
