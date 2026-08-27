import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHURN_DATASET_COLUMNS,
  MODEL_FEATURE_COLUMNS,
  generateChurnDataset,
} from "./dataset.js";
import { serializeRowsToCsv } from "./exportDataset.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../..");
const DATA_DIR = path.resolve(BACKEND_DIR, "data");
const DEFAULT_OUTPUT_PATH = path.resolve(DATA_DIR, "lumawear_churn_dataset.csv");

const PRODUCT_CATALOG = [
  { id: "lw-001", name: "Oversized Linen Shirt", category: "Shirts", price: 68 },
  { id: "lw-002", name: "Tailored Wide-Leg Trouser", category: "Trousers", price: 96 },
  { id: "lw-003", name: "Cropped Denim Jacket", category: "Jackets", price: 99 },
  { id: "lw-004", name: "Slip Midi Dress", category: "Dresses", price: 104 },
  { id: "lw-005", name: "Relaxed Oxford Shirt", category: "Shirts", price: 78 },
  { id: "lw-006", name: "Pleated Utility Trousers", category: "Trousers", price: 88 },
  { id: "lw-007", name: "Chunky Knit Cardigan", category: "Sweaters", price: 110 },
  { id: "lw-008", name: "Minimal Leather Sneakers", category: "Shoes", price: 112 },
  { id: "lw-009", name: "Classic Cotton Tee", category: "T-Shirts", price: 34 },
  { id: "lw-010", name: "Wool Blend Coat", category: "Outerwear", price: 185 },
  { id: "lw-011", name: "Silk Blend Blouse", category: "Shirts", price: 92 },
  { id: "lw-012", name: "Straight Raw Denim", category: "Trousers", price: 95 },
  { id: "lw-013", name: "Ribbed Crewneck Sweater", category: "Sweaters", price: 84 },
  { id: "lw-014", name: "Structured Tote Bag", category: "Accessories", price: 120 },
  { id: "lw-015", name: "Everyday Chelsea Boots", category: "Shoes", price: 140 },
  { id: "lw-016", name: "Merino Wool Scarf", category: "Accessories", price: 48 },
];

const ALL_CATEGORIES = [
  "Shirts",
  "Trousers",
  "Jackets",
  "Dresses",
  "Sweaters",
  "Shoes",
  "T-Shirts",
  "Outerwear",
  "Accessories",
];

export function createSeededRng(initialSeed = 42) {
  let s = (initialSeed >>> 0) || 1;
  return function random() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeOrderFinancials(items) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.lineTotal;
  }
  subtotal = Number(subtotal.toFixed(2));
  const shipping = subtotal === 0 ? 0 : subtotal >= 75 ? 0 : 8;
  const discount = subtotal > 250 ? Number((subtotal * 0.08).toFixed(2)) : 0;
  const total = Number((subtotal + shipping - discount).toFixed(2));
  return { subtotal, shipping, discount, total };
}

function buildSimulatedOrder({ userId, orderDate, preferredCategory, rng }) {
  const numItems = 1 + Math.floor(rng() * 3);
  const items = [];

  for (let k = 0; k < numItems; k++) {
    let product;
    if (preferredCategory && rng() < 0.65) {
      const catProducts = PRODUCT_CATALOG.filter((p) => p.category === preferredCategory);
      product = catProducts[Math.floor(rng() * catProducts.length)] || PRODUCT_CATALOG[Math.floor(rng() * PRODUCT_CATALOG.length)];
    } else {
      product = PRODUCT_CATALOG[Math.floor(rng() * PRODUCT_CATALOG.length)];
    }

    const quantity = 1 + (rng() < 0.2 ? 1 : 0);
    const unitPrice = product.price;
    const lineTotal = unitPrice * quantity;

    items.push({
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity,
      unitPrice,
      lineTotal,
    });
  }

  const financials = computeOrderFinancials(items);

  return {
    userId,
    status: "completed",
    items,
    ...financials,
    createdAt: new Date(orderDate.getTime()),
  };
}

/**
 * Probabilistic dynamic customer lifecycle simulator.
 * Models continuous cohort arrivals, dynamic state transitions (Active, CoolingDown, Dormant),
 * natural reactivations, and unexpected churn.
 */
export function generateSyntheticRawData({
  numCustomers = 1100,
  startDate = "2025-01-01T00:00:00.000Z",
  observationDate = "2026-06-01T00:00:00.000Z",
  seed = 42,
} = {}) {
  const rng = createSeededRng(seed);
  const startMs = new Date(startDate).getTime();
  const obsMs = new Date(observationDate).getTime();

  const users = [];
  const activities = [];
  const orders = [];

  for (let i = 1; i <= numCustomers; i++) {
    const userId = `u-${String(i).padStart(4, "0")}`;

    // Stagger customer registration across Jan 2025 to mid Jan 2026 (380 days)
    const joinOffsetDays = Math.floor(rng() * 380);
    const userCreatedAt = new Date(startMs + joinOffsetDays * DAY_MS);
    users.push({
      _id: userId,
      createdAt: new Date(userCreatedAt.getTime()),
    });

    const preferredCategory = ALL_CATEGORIES[Math.floor(rng() * ALL_CATEGORIES.length)];

    // Customer propensities
    const avgOrderInterval = 35 + Math.floor(rng() * 55); // 35-90 days
    const avgSessionInterval = 4 + Math.floor(rng() * 10); // 4-14 days
    const monthlyChurnHazard = 0.08 + rng() * 0.10; // 8-18% monthly chance to cool down
    const monthlyReactivation = 0.06 + rng() * 0.08; // 6-14% chance dormant returns

    let state = "ACTIVE"; // "ACTIVE" | "COOLING_DOWN" | "DORMANT"
    let cursorMs = userCreatedAt.getTime();
    let lastOrderMs = cursorMs;

    // Initial registration session
    activities.push({
      userId,
      type: "auth_login",
      createdAt: new Date(cursorMs),
    });
    activities.push({
      userId,
      type: "page_view",
      route: "/",
      createdAt: new Date(cursorMs + 2000),
    });
    activities.push({
      userId,
      type: "product_viewed",
      metadata: { productId: "lw-001", category: "Shirts" },
      createdAt: new Date(cursorMs + 60000),
    });

    // Initial order placement (97% place an initial order within 1-12 days of joining)
    if (rng() < 0.97) {
      const firstOrderOffsetDays = 1 + Math.floor(rng() * 10);
      const firstOrderTime = cursorMs + firstOrderOffsetDays * DAY_MS + Math.floor(rng() * 3600000);
      if (firstOrderTime <= obsMs) {
        const firstOrder = buildSimulatedOrder({
          userId,
          orderDate: new Date(firstOrderTime),
          preferredCategory,
          rng,
        });
        orders.push(firstOrder);

        activities.push({
          userId,
          type: "auth_login",
          createdAt: new Date(firstOrderTime - 600000),
        });
        activities.push({
          userId,
          type: "page_view",
          route: "/shop",
          createdAt: new Date(firstOrderTime - 500000),
        });
        activities.push({
          userId,
          type: "cart_add",
          createdAt: new Date(firstOrderTime - 300000),
        });
        activities.push({
          userId,
          type: "order_placed",
          metadata: { total: firstOrder.total, subtotal: firstOrder.subtotal },
          createdAt: new Date(firstOrderTime),
        });
        activities.push({
          userId,
          type: "cart_clear",
          createdAt: new Date(firstOrderTime + 1000),
        });

        lastOrderMs = firstOrderTime;
        cursorMs = firstOrderTime;
      }
    }

    // Dynamic lifecycle event simulation forward through observation horizon
    while (cursorMs < obsMs) {
      let stepDays;
      if (state === "ACTIVE") {
        stepDays = Math.max(2, Math.round(avgSessionInterval + (rng() * 6 - 3)));
      } else if (state === "COOLING_DOWN") {
        stepDays = Math.max(8, Math.round(avgSessionInterval * 2.8 + (rng() * 12 - 6)));
      } else {
        // DORMANT
        stepDays = 25 + Math.floor(rng() * 30);
      }

      cursorMs += stepDays * DAY_MS;
      if (cursorMs > obsMs) break;

      const sessionDate = new Date(cursorMs);
      const daysSinceOrder = Math.floor((cursorMs - lastOrderMs) / DAY_MS);

      // Probabilistic state transitions
      const monthFraction = stepDays / 30;
      if (state === "ACTIVE") {
        if (rng() < monthlyChurnHazard * monthFraction) {
          state = "COOLING_DOWN";
        } else if (rng() < 0.035 * monthFraction) {
          // Sudden churn (competitor switch, moving, dissatisfaction)
          state = "DORMANT";
        }
      } else if (state === "COOLING_DOWN") {
        if (daysSinceOrder > 70 && rng() < 0.45 * monthFraction) {
          state = "DORMANT";
        } else if (rng() < 0.18 * monthFraction) {
          // Re-engagement recovery
          state = "ACTIVE";
        }
      } else if (state === "DORMANT") {
        if (rng() < monthlyReactivation * monthFraction) {
          // Marketing win-back / organic reactivation
          state = "ACTIVE";
        }
      }

      // Generate activity in this session based on state
      if (state === "ACTIVE") {
        activities.push({
          userId,
          type: "auth_login",
          createdAt: new Date(sessionDate.getTime()),
        });
        const numViews = 2 + Math.floor(rng() * 5);
        for (let v = 0; v < numViews; v++) {
          activities.push({
            userId,
            type: "page_view",
            route: "/shop",
            createdAt: new Date(sessionDate.getTime() + (v + 1) * 20000),
          });
          const prod = PRODUCT_CATALOG[Math.floor(rng() * PRODUCT_CATALOG.length)];
          activities.push({
            userId,
            type: "product_viewed",
            metadata: { productId: prod.id, category: prod.category },
            createdAt: new Date(sessionDate.getTime() + (v + 1) * 40000),
          });
        }
        if (rng() < 0.35) {
          activities.push({
            userId,
            type: "wishlist_toggle",
            createdAt: new Date(sessionDate.getTime() + 10 * 60000),
          });
        }
        if (rng() < 0.50) {
          activities.push({
            userId,
            type: "cart_add",
            createdAt: new Date(sessionDate.getTime() + 12 * 60000),
          });
        }

        // Order probability
        let orderProb = 0.12;
        if (daysSinceOrder >= avgOrderInterval) {
          orderProb = 0.60;
        } else if (daysSinceOrder >= avgOrderInterval * 0.7) {
          orderProb = 0.30;
        }

        if (rng() < orderProb) {
          const ord = buildSimulatedOrder({ userId, orderDate: sessionDate, preferredCategory, rng });
          orders.push(ord);
          activities.push({
            userId,
            type: "order_placed",
            metadata: { total: ord.total },
            createdAt: new Date(sessionDate.getTime() + 15 * 60000),
          });
          activities.push({
            userId,
            type: "cart_clear",
            createdAt: new Date(sessionDate.getTime() + 16 * 60000),
          });
          lastOrderMs = cursorMs;
        }
      } else if (state === "COOLING_DOWN") {
        // Reduced browsing activity
        activities.push({
          userId,
          type: "auth_login",
          createdAt: new Date(sessionDate.getTime()),
        });
        activities.push({
          userId,
          type: "page_view",
          route: "/shop",
          createdAt: new Date(sessionDate.getTime() + 20000),
        });
        const prod = PRODUCT_CATALOG[Math.floor(rng() * PRODUCT_CATALOG.length)];
        activities.push({
          userId,
          type: "product_viewed",
          metadata: { productId: prod.id, category: prod.category },
          createdAt: new Date(sessionDate.getTime() + 40000),
        });

        if (rng() < 0.25) {
          activities.push({
            userId,
            type: "cart_add",
            createdAt: new Date(sessionDate.getTime() + 60000),
          });
        }

        // Low order probability in cooling down
        let orderProb = 0.05;
        if (daysSinceOrder >= avgOrderInterval * 1.3) {
          orderProb = 0.18;
        }
        if (rng() < orderProb) {
          const ord = buildSimulatedOrder({ userId, orderDate: sessionDate, preferredCategory, rng });
          orders.push(ord);
          activities.push({
            userId,
            type: "order_placed",
            metadata: { total: ord.total },
            createdAt: new Date(sessionDate.getTime() + 10 * 60000),
          });
          lastOrderMs = cursorMs;
          state = "ACTIVE"; // order reactivates them
        }
      } else {
        // DORMANT: sporadic login without purchase
        if (rng() < 0.10) {
          activities.push({
            userId,
            type: "auth_login",
            createdAt: new Date(sessionDate.getTime()),
          });
          activities.push({
            userId,
            type: "page_view",
            route: "/",
            createdAt: new Date(sessionDate.getTime() + 20000),
          });
        }
      }
    }
  }

  // Sort activities, orders, and users chronologically
  activities.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  users.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return { users, activities, orders };
}

export function getDefaultAsOfDates() {
  return [
    "2025-06-01T00:00:00.000Z",
    "2025-07-01T00:00:00.000Z",
    "2025-08-01T00:00:00.000Z",
    "2025-09-01T00:00:00.000Z",
    "2025-10-01T00:00:00.000Z",
    "2025-11-01T00:00:00.000Z",
    "2025-12-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
    "2026-02-01T00:00:00.000Z",
    "2026-03-01T00:00:00.000Z",
  ];
}

export async function generateAndExportHistoricalDemo({
  numCustomers = 1100,
  startDate = "2025-01-01T00:00:00.000Z",
  observationDate = "2026-06-01T00:00:00.000Z",
  asOfDates = getDefaultAsOfDates(),
  outputPath = DEFAULT_OUTPUT_PATH,
  seed = 42,
} = {}) {
  const { users, activities, orders } = generateSyntheticRawData({
    numCustomers,
    startDate,
    observationDate,
    seed,
  });

  const datasetResult = generateChurnDataset({
    users,
    activities,
    orders,
    asOfDates,
    observationDate,
  });

  const { rows, summary, columns } = datasetResult;

  if (rows.length === 0) {
    throw new Error("Synthetic generation produced 0 rows.");
  }

  const csv = serializeRowsToCsv(rows, columns);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${csv}\n`, "utf8");

  const churnRatePct = summary.generatedRows > 0
    ? Number(((summary.churn1 / summary.generatedRows) * 100).toFixed(2))
    : 0;

  // Compute breakdown by as_of_date
  const byAsOfDate = {};
  for (const r of rows) {
    if (!byAsOfDate[r.as_of_date]) {
      byAsOfDate[r.as_of_date] = { total: 0, churn0: 0, churn1: 0 };
    }
    byAsOfDate[r.as_of_date].total += 1;
    if (r.churn === 0) byAsOfDate[r.as_of_date].churn0 += 1;
    if (r.churn === 1) byAsOfDate[r.as_of_date].churn1 += 1;
  }

  // Compute feature statistics by churn class
  const c0Rows = rows.filter((r) => r.churn === 0);
  const c1Rows = rows.filter((r) => r.churn === 1);

  const calcMean = (arr, key) => (arr.reduce((s, x) => s + (Number(x[key]) || 0), 0) / (arr.length || 1));
  const calcMedian = (arr, key) => {
    if (!arr.length) return 0;
    const sorted = arr.map((x) => Number(x[key]) || 0).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };

  const featureClassStats = {};
  for (const key of [
    "days_since_last_activity",
    "activity_event_count_30d",
    "days_since_last_order",
    "orders_30d",
    "login_count_30d",
    "active_days_30d",
    "total_spend",
    "order_count",
    "average_order_value",
  ]) {
    featureClassStats[key] = {
      churn0Mean: Number(calcMean(c0Rows, key).toFixed(2)),
      churn0Median: Number(calcMedian(c0Rows, key).toFixed(2)),
      churn1Mean: Number(calcMean(c1Rows, key).toFixed(2)),
      churn1Median: Number(calcMedian(c1Rows, key).toFixed(2)),
    };
  }

  const stats = {
    totalRows: summary.generatedRows,
    uniqueCustomers: summary.uniqueCustomers,
    asOfDateCount: summary.asOfDateCount,
    asOfDateRange: `${asOfDates[0]?.slice(0, 10)} to ${asOfDates.at(-1)?.slice(0, 10)}`,
    churn0: summary.churn0,
    churn1: summary.churn1,
    churnRatePct,
    byAsOfDate,
    featureClassStats,
    duplicateRows: summary.skippedDuplicateRow,
    invalidRows: summary.invalidRows,
    featureCount: MODEL_FEATURE_COLUMNS.length,
    outputPath,
    missingValueSummary: summary.missingValueSummary,
  };

  printDatasetReport(stats);

  return {
    ...datasetResult,
    stats,
    outputPath,
  };
}

function printDatasetReport(stats) {
  console.log("============================================================");
  console.log(" LUMAWEAR HISTORICAL CHURN DATASET GENERATION REPORT");
  console.log("============================================================");
  console.log(`- total rows:           ${stats.totalRows.toLocaleString()}`);
  console.log(`- unique customers:     ${stats.uniqueCustomers.toLocaleString()}`);
  console.log(`- number of as-of dates:${stats.asOfDateCount}`);
  console.log(`- as-of date range:     ${stats.asOfDateRange}`);
  console.log(`- churn = 0:            ${stats.churn0.toLocaleString()} (${(100 - stats.churnRatePct).toFixed(2)}%)`);
  console.log(`- churn = 1:            ${stats.churn1.toLocaleString()} (${stats.churnRatePct}%)`);
  console.log(`- churn rate:           ${stats.churnRatePct}%`);
  console.log(`- duplicate rows:       ${stats.duplicateRows}`);
  console.log(`- invalid rows:         ${stats.invalidRows}`);
  console.log(`- number of features:   ${stats.featureCount} (21 LumaWear-native features)`);
  console.log(`- output file:          ${stats.outputPath}`);
  console.log("------------------------------------------------------------");
  console.log("Churn rate by as_of_date:");
  for (const [dateStr, counts] of Object.entries(stats.byAsOfDate || {})) {
    const rate = counts.total > 0 ? ((counts.churn1 / counts.total) * 100).toFixed(2) : "0.00";
    console.log(`  ${dateStr}: ${counts.churn1}/${counts.total} (${rate}%) [retained: ${counts.churn0}]`);
  }
  console.log("------------------------------------------------------------");
  console.log("Behavioral feature comparison by churn class (Mean / Median):");
  for (const [feat, s] of Object.entries(stats.featureClassStats || {})) {
    console.log(
      `  ${feat.padEnd(28)} | churn=0: mean=${String(s.churn0Mean).padEnd(7)} med=${String(s.churn0Median).padEnd(6)} | churn=1: mean=${String(s.churn1Mean).padEnd(7)} med=${String(s.churn1Median).padEnd(6)}`
    );
  }
  console.log("------------------------------------------------------------");
  console.log("Missing value count per feature:");
  for (const [feat, count] of Object.entries(stats.missingValueSummary || {})) {
    const pct = stats.totalRows ? ((count / stats.totalRows) * 100).toFixed(1) : 0;
    console.log(`  ${feat.padEnd(30)}: ${count} (${pct}%)`);
  }
  console.log("============================================================");
}

async function main() {
  try {
    await generateAndExportHistoricalDemo();
  } catch (err) {
    console.error("Historical dataset generation failed:", err);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void main();
}
