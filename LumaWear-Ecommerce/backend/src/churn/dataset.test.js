import assert from "node:assert/strict";
import test from "node:test";

import {
  CHURN_DATASET_COLUMNS,
  MODEL_FEATURE_COLUMNS,
  generateChurnDataset,
} from "./dataset.js";

function buildFixture() {
  const users = [
    { _id: "u1", createdAt: "2024-10-01T00:00:00.000Z" },
    { _id: "u2", createdAt: "2024-11-15T00:00:00.000Z" },
    { _id: "u3", createdAt: "2024-12-20T00:00:00.000Z" },
    { _id: "", createdAt: "2024-09-01T00:00:00.000Z" },
  ];

  const activities = [
    { userId: "u1", type: "auth_login", createdAt: "2025-01-10T09:00:00.000Z" },
    { userId: "u1", type: "page_view", createdAt: "2025-01-10T09:10:00.000Z" },
    { userId: "u1", type: "product_viewed", metadata: { productId: "p-1" }, createdAt: "2025-01-11T09:00:00.000Z" },
    { userId: "u1", type: "cart_add", createdAt: "2025-01-11T10:00:00.000Z" },
    { userId: "u2", type: "auth_login", createdAt: "2025-01-12T08:00:00.000Z" },
    { userId: "u2", type: "wishlist_toggle", createdAt: "2025-01-13T08:00:00.000Z" },
    { userId: "u2", type: "product_viewed", metadata: { productId: "p-2" }, createdAt: "2025-01-13T09:00:00.000Z" },
    { userId: "u2", type: "auth_refresh", createdAt: "2025-01-13T10:00:00.000Z" },
    { userId: "u1", type: "auth_login", createdAt: "2025-04-20T00:00:00.000Z" },
  ];

  const orders = [
    {
      userId: "u1",
      status: "completed",
      total: 120,
      subtotal: 120,
      createdAt: "2024-12-15T00:00:00.000Z",
      items: [{ productId: "p-1", category: "Shirts", quantity: 2, unitPrice: 60, lineTotal: 120 }],
    },
    {
      userId: "u2",
      status: "confirmed",
      total: 90,
      subtotal: 90,
      createdAt: "2024-12-20T00:00:00.000Z",
      items: [{ productId: "p-2", category: "Shoes", quantity: 1, unitPrice: 90, lineTotal: 90 }],
    },
    {
      userId: "u2",
      status: "completed",
      total: 80,
      subtotal: 80,
      createdAt: "2025-02-20T00:00:00.000Z",
      items: [{ productId: "p-3", category: "Shoes", quantity: 1, unitPrice: 80, lineTotal: 80 }],
    },
    {
      userId: "u3",
      status: "cancelled",
      total: 999,
      subtotal: 999,
      createdAt: "2024-12-29T00:00:00.000Z",
      items: [{ productId: "p-9", category: "Ignore", quantity: 3, unitPrice: 333, lineTotal: 999 }],
    },
    {
      userId: "u1",
      status: "completed",
      total: 150,
      subtotal: 150,
      createdAt: "2025-05-20T00:00:00.000Z",
      items: [{ productId: "p-4", category: "Shirts", quantity: 3, unitPrice: 50, lineTotal: 150 }],
    },
    {
      userId: "",
      status: "completed",
      total: 50,
      subtotal: 50,
      createdAt: "2024-12-10T00:00:00.000Z",
      items: [{ productId: "p-0", category: "Misc", quantity: 1, unitPrice: 50, lineTotal: 50 }],
    },
  ];

  return { users, activities, orders };
}

test("churn=1 and churn=0 labels are generated across users", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  const rowsByUser = new Map(result.rows.map((row) => [row.user_id, row]));
  assert.equal(rowsByUser.get("u1").churn, 1);
  assert.equal(rowsByUser.get("u2").churn, 0);
});

test("one customer row is labeled churn=1", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  const row = result.rows.find((item) => item.user_id === "u1");
  assert.ok(row);
  assert.equal(row.churn, 1);
});

test("one customer row is labeled churn=0", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  const row = result.rows.find((item) => item.user_id === "u2");
  assert.ok(row);
  assert.equal(row.churn, 0);
});

test("customer without prior successful order is excluded", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  assert.ok(!result.rows.some((row) => row.user_id === "u3"));
  assert.ok(result.summary.skippedNoOrder >= 1);
});

test("incomplete 90-day windows are excluded", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-06-01T00:00:00.000Z"],
    observationDate: "2025-07-15T00:00:00.000Z",
  });

  assert.equal(result.rows.length, 0);
  assert.ok(result.summary.skippedIncompleteLabelWindow > 0);
});

test("multiple as-of dates and multiple rows per customer are generated", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z", "2025-03-01T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  assert.ok(result.rows.length >= 3);
  const u2Rows = result.rows.filter((row) => row.user_id === "u2");
  assert.equal(u2Rows.length, 2);
});

test("same customer can have multiple historical rows", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z", "2025-02-15T00:00:00.000Z", "2025-03-01T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  const userRows = result.rows.filter((row) => row.user_id === "u1");
  assert.ok(userRows.length >= 2);
});

test("future orders do not affect feature values but do affect labels", () => {
  const { users, activities, orders } = buildFixture();
  const asOf = "2025-01-15T00:00:00.000Z";
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: [asOf],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  const u1 = result.rows.find((row) => row.user_id === "u1");
  assert.equal(u1.order_count, 1);
  assert.equal(u1.total_spend, 120);
  assert.equal(u1.churn, 1);
});

test("duplicate (user_id, as_of_date) rows are prevented", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z", "2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  const uniqueKeys = new Set(result.rows.map((row) => `${row.user_id}::${row.as_of_date}`));
  assert.equal(uniqueKeys.size, result.rows.length);
  assert.ok(result.summary.skippedDuplicateRow > 0);
});

test("column order is exact and model features are exactly 21", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  assert.deepEqual(result.columns, CHURN_DATASET_COLUMNS);
  assert.equal(MODEL_FEATURE_COLUMNS.length, 21);
});

test("metadata fields are excluded from model feature columns", () => {
  assert.ok(!MODEL_FEATURE_COLUMNS.includes("user_id"));
  assert.ok(!MODEL_FEATURE_COLUMNS.includes("as_of_date"));
  assert.ok(!MODEL_FEATURE_COLUMNS.includes("churn"));
});

test("future order impacts only label, not feature totals", () => {
  const { users, activities, orders } = buildFixture();
  const asOfDate = "2025-03-01T00:00:00.000Z";
  const withFuture = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: [asOfDate],
    observationDate: "2025-08-01T00:00:00.000Z",
  });
  const withoutFuture = generateChurnDataset({
    users,
    activities,
    orders: orders.filter((order) => order.createdAt !== "2025-05-20T00:00:00.000Z"),
    asOfDates: [asOfDate],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  const withFutureRow = withFuture.rows.find((row) => row.user_id === "u1");
  const withoutFutureRow = withoutFuture.rows.find((row) => row.user_id === "u1");

  assert.equal(withFutureRow.total_spend, withoutFutureRow.total_spend);
  assert.equal(withFutureRow.order_count, withoutFutureRow.order_count);
  assert.notEqual(withFutureRow.churn, withoutFutureRow.churn);
  assert.ok(!MODEL_FEATURE_COLUMNS.includes("user_id"));
  assert.ok(!MODEL_FEATURE_COLUMNS.includes("as_of_date"));
});

test("invalid rows are reported in summary", () => {
  const { users, activities, orders } = buildFixture();
  const result = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates: ["2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  });

  assert.ok(result.summary.invalidRows >= 1);
  assert.ok((result.summary.invalidRowReasons.missing_user_id || 0) >= 1);
});

test("output is deterministic for identical input", () => {
  const { users, activities, orders } = buildFixture();
  const args = {
    users,
    activities,
    orders,
    asOfDates: ["2025-03-01T00:00:00.000Z", "2025-01-15T00:00:00.000Z"],
    observationDate: "2025-08-01T00:00:00.000Z",
  };

  const first = generateChurnDataset(args);
  const second = generateChurnDataset(args);
  assert.deepEqual(first, second);
});
