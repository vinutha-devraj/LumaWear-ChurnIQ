import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CHURN_DATASET_COLUMNS,
  MODEL_FEATURE_COLUMNS,
  generateChurnDataset,
} from "./dataset.js";
import {
  createSeededRng,
  generateSyntheticRawData,
  generateAndExportHistoricalDemo,
  getDefaultAsOfDates,
} from "./generateHistoricalDemo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_CSV_OUTPUT = path.resolve(__dirname, "../../data/test_lumawear_churn_dataset.csv");

test("createSeededRng produces deterministic sequence", () => {
  const rng1 = createSeededRng(12345);
  const rng2 = createSeededRng(12345);

  const seq1 = Array.from({ length: 10 }, () => rng1());
  const seq2 = Array.from({ length: 10 }, () => rng2());

  assert.deepEqual(seq1, seq2);
});

test("generateSyntheticRawData respects temporal constraints and ordering", () => {
  const { users, activities, orders } = generateSyntheticRawData({
    numCustomers: 50,
    startDate: "2025-01-01T00:00:00.000Z",
    observationDate: "2026-06-01T00:00:00.000Z",
    seed: 999,
  });

  assert.equal(users.length, 50);
  assert.ok(activities.length > 50);
  assert.ok(orders.length > 50);

  const userJoinDates = new Map(users.map((u) => [u._id, u.createdAt.getTime()]));

  // Check activity timestamps are after user join
  for (const act of activities) {
    const joinTime = userJoinDates.get(act.userId);
    assert.ok(joinTime !== undefined);
    assert.ok(
      act.createdAt.getTime() >= joinTime,
      `Activity for ${act.userId} occurred before join date`
    );
  }

  // Check order timestamps are after user join
  for (const ord of orders) {
    const joinTime = userJoinDates.get(ord.userId);
    assert.ok(joinTime !== undefined);
    assert.ok(
      ord.createdAt.getTime() >= joinTime,
      `Order for ${ord.userId} occurred before join date`
    );
    assert.equal(ord.status, "completed");
  }
});

test("generateChurnDataset with synthetic raw data produces both classes and valid columns", () => {
  const asOfDates = [
    "2025-06-01T00:00:00.000Z",
    "2025-07-01T00:00:00.000Z",
    "2025-08-01T00:00:00.000Z",
  ];
  const observationDate = "2026-01-01T00:00:00.000Z";

  const { users, activities, orders } = generateSyntheticRawData({
    numCustomers: 100,
    startDate: "2025-01-01T00:00:00.000Z",
    observationDate,
    seed: 42,
  });

  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates,
    observationDate,
  });

  assert.ok(result.rows.length > 50);
  assert.ok(result.summary.churn0 > 0, "Expected at least one retained customer row (churn=0)");
  assert.ok(result.summary.churn1 > 0, "Expected at least one churned customer row (churn=1)");
  assert.equal(result.summary.invalidRows, 0, "Expected zero invalid rows");
  assert.equal(result.summary.skippedDuplicateRow, 0, "Expected zero duplicate rows");
  assert.equal(result.columns.length, 24);
  assert.deepEqual(result.columns, CHURN_DATASET_COLUMNS);
  assert.deepEqual(result.modelFeatureColumns, MODEL_FEATURE_COLUMNS);
});

test("synthetic data demonstrates realistic behavioral differences with overlapping distributions", () => {
  const asOfDates = getDefaultAsOfDates();
  const observationDate = "2026-06-01T00:00:00.000Z";

  const { users, activities, orders } = generateSyntheticRawData({
    numCustomers: 250,
    startDate: "2025-01-01T00:00:00.000Z",
    observationDate,
    seed: 777,
  });

  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates,
    observationDate,
  });

  const retainedRows = result.rows.filter((r) => r.churn === 0);
  const churnedRows = result.rows.filter((r) => r.churn === 1);

  assert.ok(retainedRows.length > 0);
  assert.ok(churnedRows.length > 0);

  const avgDaysSinceActivity = (rows) =>
    rows.reduce((sum, r) => sum + (Number(r.days_since_last_activity) || 0), 0) / rows.length;

  const avgDaysSinceOrder = (rows) =>
    rows.reduce((sum, r) => sum + (Number(r.days_since_last_order) || 0), 0) / rows.length;

  const avgOrders30d = (rows) =>
    rows.reduce((sum, r) => sum + (Number(r.orders_30d) || 0), 0) / rows.length;

  // General direction: churned customers on average are less recently active and order less recently
  assert.ok(
    avgDaysSinceActivity(churnedRows) > avgDaysSinceActivity(retainedRows),
    "Churned customers should have higher average days_since_last_activity"
  );
  assert.ok(
    avgDaysSinceOrder(churnedRows) > avgDaysSinceOrder(retainedRows),
    "Churned customers should have higher average days_since_last_order"
  );
  assert.ok(
    avgOrders30d(retainedRows) >= avgOrders30d(churnedRows),
    "Retained customers should have higher average orders_30d"
  );

  // Distribution overlap checks (non-deterministic separation):
  // 1. Some retained customers have days_since_last_activity > 14 days
  const retainedWithOlderActivity = retainedRows.filter((r) => r.days_since_last_activity > 14);
  assert.ok(
    retainedWithOlderActivity.length > 0,
    "Expected realistic overlap: some retained customers have days_since_last_activity > 14"
  );

  // 2. Some churned customers were active within the last 10 days before T
  const churnedWithRecentActivity = churnedRows.filter((r) => r.days_since_last_activity <= 10);
  assert.ok(
    churnedWithRecentActivity.length > 0,
    "Expected realistic overlap: some churned customers had recent activity <= 10 days"
  );

  // 3. No extreme artificial separation (mean days_since_last_activity for churn=0 should be > 5, churn=1 should be < 75)
  const meanRetainedActivity = avgDaysSinceActivity(retainedRows);
  const meanChurnedActivity = avgDaysSinceActivity(churnedRows);
  assert.ok(meanRetainedActivity >= 4 && meanRetainedActivity <= 25, `Retained activity mean (${meanRetainedActivity}) is realistic`);
  assert.ok(meanChurnedActivity >= 20 && meanChurnedActivity <= 75, `Churned activity mean (${meanChurnedActivity}) is realistic`);
});

test("monthly churn rate remains stable and non-monotonically increasing", () => {
  const asOfDates = getDefaultAsOfDates();
  const observationDate = "2026-06-01T00:00:00.000Z";

  const { users, activities, orders } = generateSyntheticRawData({
    numCustomers: 300,
    startDate: "2025-01-01T00:00:00.000Z",
    observationDate,
    seed: 42,
  });

  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates,
    observationDate,
  });

  const byDate = {};
  for (const r of result.rows) {
    if (!byDate[r.as_of_date]) byDate[r.as_of_date] = { total: 0, churn1: 0 };
    byDate[r.as_of_date].total += 1;
    if (r.churn === 1) byDate[r.as_of_date].churn1 += 1;
  }

  const rates = Object.values(byDate).map((c) => (c.churn1 / c.total) * 100);

  // Every month has a reasonable churn rate (between 10% and 50%)
  for (const rate of rates) {
    assert.ok(rate >= 10 && rate <= 50, `Monthly churn rate ${rate}% is within expected realistic bounds`);
  }

  // Verify the rates do NOT strictly monotonically increase across all consecutive pairs
  let strictlyIncreasingPairs = 0;
  for (let i = 1; i < rates.length; i++) {
    if (rates[i] > rates[i - 1]) strictlyIncreasingPairs++;
  }
  assert.ok(
    strictlyIncreasingPairs < rates.length - 1,
    "Monthly churn rate should exhibit natural fluctuations rather than strict monotonic increase"
  );
});

test("generateAndExportHistoricalDemo exports a valid CSV with complete report", async () => {
  try {
    const result = await generateAndExportHistoricalDemo({
      numCustomers: 100,
      asOfDates: ["2025-06-01T00:00:00.000Z", "2025-07-01T00:00:00.000Z"],
      observationDate: "2025-11-01T00:00:00.000Z",
      outputPath: TEST_CSV_OUTPUT,
      seed: 42,
    });

    assert.ok(result.stats.totalRows > 0);
    assert.equal(result.stats.invalidRows, 0);
    assert.equal(result.stats.featureCount, 21);
    assert.ok(result.stats.byAsOfDate);
    assert.ok(result.stats.featureClassStats);

    const fileContent = await fs.readFile(TEST_CSV_OUTPUT, "utf8");
    const lines = fileContent.trim().split("\n");
    assert.equal(lines[0], CHURN_DATASET_COLUMNS.join(","));
    assert.equal(lines.length, result.stats.totalRows + 1);
  } finally {
    await fs.rm(TEST_CSV_OUTPUT, { force: true });
  }
});
