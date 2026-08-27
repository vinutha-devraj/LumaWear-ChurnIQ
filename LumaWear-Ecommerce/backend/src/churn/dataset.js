import {
  calculateChurnLabel,
  churnFeatureNames,
  extractCustomerFeatures,
} from "./features.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LABEL_WINDOW_DAYS = 90;
const SUCCESSFUL_ORDER_STATUSES = new Set(["confirmed", "completed", "pending"]);

export const MODEL_FEATURE_COLUMNS = [...churnFeatureNames];
export const CHURN_DATASET_COLUMNS = ["user_id", "as_of_date", ...MODEL_FEATURE_COLUMNS, "churn"];

function toDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toId(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatAsOfDate(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function hasPriorSuccessfulOrder(orders, userId, asOfDate) {
  const asOf = toDate(asOfDate);
  if (!asOf) return false;
  const asOfTime = asOf.getTime();

  return (Array.isArray(orders) ? orders : []).some((order) => {
    const createdAt = toDate(order?.createdAt);
    return (
      toId(order?.userId) === toId(userId) &&
      SUCCESSFUL_ORDER_STATUSES.has(order?.status) &&
      createdAt !== null &&
      createdAt.getTime() <= asOfTime
    );
  });
}

function isObservationWindowComplete(asOfDate, observationDate) {
  const asOf = toDate(asOfDate);
  const observedThrough = toDate(observationDate);
  if (!asOf || !observedThrough) return false;
  return observedThrough.getTime() >= asOf.getTime() + LABEL_WINDOW_DAYS * DAY_MS;
}

function buildOrderedRow({ userId, asOfDate, features, churn }) {
  const base = {
    user_id: toId(userId),
    as_of_date: formatAsOfDate(asOfDate),
  };
  for (const featureName of MODEL_FEATURE_COLUMNS) {
    base[featureName] = featureName in features ? features[featureName] : null;
  }
  base.churn = churn;
  return base;
}

function getMissingValueSummary(rows) {
  const summary = {};
  for (const column of CHURN_DATASET_COLUMNS) {
    summary[column] = 0;
  }
  for (const row of rows) {
    for (const column of CHURN_DATASET_COLUMNS) {
      if (row[column] === null || row[column] === undefined || row[column] === "") {
        summary[column] += 1;
      }
    }
  }
  return summary;
}

function isValidChurnValue(value) {
  return value === 0 || value === 1;
}

function validateRow({ row, rowFeatures }) {
  const errors = [];
  const keys = Object.keys(row);

  if (!row.user_id) errors.push("missing_user_id");
  if (!row.as_of_date) errors.push("missing_as_of_date");
  if (!isValidChurnValue(row.churn)) errors.push("invalid_churn");

  if (MODEL_FEATURE_COLUMNS.length !== 21) {
    errors.push("invalid_model_feature_count");
  }

  for (const metadataColumn of ["user_id", "as_of_date", "churn"]) {
    if (MODEL_FEATURE_COLUMNS.includes(metadataColumn)) {
      errors.push("metadata_in_model_features");
      break;
    }
  }

  const expectedColumns = CHURN_DATASET_COLUMNS.join("|");
  const actualColumns = keys.join("|");
  if (expectedColumns !== actualColumns) {
    errors.push("nondeterministic_column_order");
  }

  const rowFeatureColumns = Object.keys(rowFeatures).filter((key) => MODEL_FEATURE_COLUMNS.includes(key));
  if (rowFeatureColumns.length !== 21) {
    errors.push("row_missing_model_features");
  }

  if (row.order_count < 1) {
    errors.push("ineligible_without_successful_order");
  }

  for (const nonNegativeField of [
    "tenure_days",
    "days_since_last_login",
    "days_since_last_activity",
    "days_since_last_order",
    "order_count",
    "orders_30d",
    "total_spend",
    "spend_30d",
    "active_days_30d",
    "activity_event_count_30d",
  ]) {
    const value = row[nonNegativeField];
    if (value !== null && value < 0) {
      errors.push(`negative_${nonNegativeField}`);
    }
  }

  if (row.orders_30d > row.order_count) {
    errors.push("orders_30d_exceeds_order_count");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function makeSummarySkeleton(inputUsers, inputAsOfDates, observationDate) {
  return {
    inputUsers,
    inputAsOfDates,
    observationDate: toDate(observationDate)?.toISOString() || null,
    candidateRows: 0,
    generatedRows: 0,
    skippedNoOrder: 0,
    skippedIncompleteLabelWindow: 0,
    skippedDuplicateRow: 0,
    invalidRows: 0,
    invalidRowReasons: {},
    uniqueCustomers: 0,
    asOfDateCount: 0,
    churn0: 0,
    churn1: 0,
    missingValueSummary: {},
  };
}

/**
 * Pure point-in-time dataset generator using in-memory records.
 */
export function generateChurnDataset({
  users = [],
  activities = [],
  orders = [],
  asOfDates = [],
  observationDate = new Date(),
}) {
  const normalizedUsers = (Array.isArray(users) ? users : [])
    .slice()
    .sort((left, right) => toId(left?._id ?? left?.id ?? left?.userId).localeCompare(toId(right?._id ?? right?.id ?? right?.userId)));
  const normalizedAsOfDates = (Array.isArray(asOfDates) ? asOfDates : [])
    .map((value) => toDate(value))
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

  const summary = makeSummarySkeleton(normalizedUsers.length, normalizedAsOfDates.length, observationDate);
  const rows = [];
  const seenKeys = new Set();

  const activitiesByUser = new Map();
  for (const activity of Array.isArray(activities) ? activities : []) {
    const uid = toId(activity?.userId);
    if (!activitiesByUser.has(uid)) activitiesByUser.set(uid, []);
    activitiesByUser.get(uid).push(activity);
  }

  const ordersByUser = new Map();
  for (const order of Array.isArray(orders) ? orders : []) {
    const uid = toId(order?.userId);
    if (!ordersByUser.has(uid)) ordersByUser.set(uid, []);
    ordersByUser.get(uid).push(order);
  }

  for (const asOfDate of normalizedAsOfDates) {
    for (const user of normalizedUsers) {
      summary.candidateRows += 1;
      const userId = user?._id ?? user?.id ?? user?.userId;
      const userOrders = ordersByUser.get(toId(userId)) || [];
      const userActivities = activitiesByUser.get(toId(userId)) || [];

      if (!hasPriorSuccessfulOrder(userOrders, userId, asOfDate)) {
        summary.skippedNoOrder += 1;
        continue;
      }

      if (!isObservationWindowComplete(asOfDate, observationDate)) {
        summary.skippedIncompleteLabelWindow += 1;
        continue;
      }

      const churn = calculateChurnLabel({
        userId,
        orders: userOrders,
        asOfDate,
        observationDate,
      });
      if (!isValidChurnValue(churn)) {
        summary.invalidRows += 1;
        summary.invalidRowReasons.invalid_churn_label = (summary.invalidRowReasons.invalid_churn_label || 0) + 1;
        continue;
      }

      const features = extractCustomerFeatures({ user, activities: userActivities, orders: userOrders, asOfDate });
      const row = buildOrderedRow({ userId, asOfDate, features, churn });
      const duplicateKey = `${row.user_id}::${row.as_of_date}`;

      if (seenKeys.has(duplicateKey)) {
        summary.skippedDuplicateRow += 1;
        continue;
      }

      const validation = validateRow({ row, rowFeatures: features });
      if (!validation.valid) {
        summary.invalidRows += 1;
        for (const reason of validation.errors) {
          summary.invalidRowReasons[reason] = (summary.invalidRowReasons[reason] || 0) + 1;
        }
        continue;
      }

      seenKeys.add(duplicateKey);
      rows.push(row);
      summary.generatedRows += 1;
      if (row.churn === 0) summary.churn0 += 1;
      if (row.churn === 1) summary.churn1 += 1;
    }
  }

  summary.uniqueCustomers = new Set(rows.map((row) => row.user_id)).size;
  summary.asOfDateCount = new Set(rows.map((row) => row.as_of_date)).size;
  summary.missingValueSummary = getMissingValueSummary(rows);

  return {
    columns: [...CHURN_DATASET_COLUMNS],
    modelFeatureColumns: [...MODEL_FEATURE_COLUMNS],
    rows,
    summary,
  };
}

/**
 * Optional MongoDB-facing loader that keeps extraction logic pure.
 */
export async function generateChurnDatasetFromDatabase({
  asOfDates,
  observationDate = new Date(),
  userModel,
  activityModel,
  orderModel,
}) {
  if (!userModel || !activityModel || !orderModel) {
    throw new Error("userModel, activityModel, and orderModel are required.");
  }

  const [users, activities, orders] = await Promise.all([
    userModel.find({}, { _id: 1, createdAt: 1 }).lean(),
    activityModel.find({}, { userId: 1, type: 1, metadata: 1, createdAt: 1 }).lean(),
    orderModel.find({}, { userId: 1, items: 1, subtotal: 1, total: 1, status: 1, createdAt: 1 }).lean(),
  ]);

  return generateChurnDataset({ users, activities, orders, asOfDates, observationDate });
}
