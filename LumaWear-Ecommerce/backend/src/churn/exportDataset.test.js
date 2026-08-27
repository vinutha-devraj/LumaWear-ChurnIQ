import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMonthlyAsOfDates,
  serializeRowsToCsv,
} from "./exportDataset.js";

test("buildMonthlyAsOfDates returns deterministic month-start sequence", () => {
  const dates = buildMonthlyAsOfDates({
    startDate: "2025-01-15T00:00:00.000Z",
    endDate: "2025-04-27T00:00:00.000Z",
    monthStep: 1,
  });

  assert.deepEqual(
    dates.map((date) => date.toISOString().slice(0, 10)),
    ["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01"]
  );
});

test("serializeRowsToCsv preserves column order and escapes fields", () => {
  const rows = [
    {
      user_id: "u1",
      as_of_date: "2025-01-01",
      tenure_days: 123,
      preferred_order_category: "Shirts, Tops",
      churn: 1,
    },
    {
      user_id: "u2",
      as_of_date: "2025-02-01",
      tenure_days: null,
      preferred_order_category: "Quoted \"Category\"",
      churn: 0,
    },
  ];

  const csv = serializeRowsToCsv(rows, [
    "user_id",
    "as_of_date",
    "tenure_days",
    "preferred_order_category",
    "churn",
  ]);

  const lines = csv.split("\n");
  assert.equal(lines[0], "user_id,as_of_date,tenure_days,preferred_order_category,churn");
  assert.equal(lines[1], "u1,2025-01-01,123,\"Shirts, Tops\",1");
  assert.equal(lines[2], "u2,2025-02-01,,\"Quoted \"\"Category\"\"\",0");
});

test("buildMonthlyAsOfDates returns empty array when start date is after end date or invalid", () => {
  const inverted = buildMonthlyAsOfDates({
    startDate: "2026-08-20T00:00:00.000Z",
    endDate: "2026-05-27T00:00:00.000Z",
  });
  assert.deepEqual(inverted, []);

  const invalid = buildMonthlyAsOfDates({
    startDate: "not-a-date",
    endDate: "2025-01-01T00:00:00.000Z",
  });
  assert.deepEqual(invalid, []);
});

test("buildMonthlyAsOfDates supports multi-month steps", () => {
  const dates = buildMonthlyAsOfDates({
    startDate: "2025-01-01T00:00:00.000Z",
    endDate: "2025-07-01T00:00:00.000Z",
    monthStep: 2,
  });

  assert.deepEqual(
    dates.map((d) => d.toISOString().slice(0, 10)),
    ["2025-01-01", "2025-03-01", "2025-05-01", "2025-07-01"]
  );
});
