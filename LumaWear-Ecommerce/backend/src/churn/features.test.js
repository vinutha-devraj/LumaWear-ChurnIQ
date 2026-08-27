import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateChurnLabel,
  extractAllCustomerFeatures,
  extractCustomerFeatures,
  churnFeatureNames,
} from "./features.js";

const asOfDate = "2025-04-30T12:00:00.000Z";
const user = { _id: "user-1", createdAt: "2025-01-01T12:00:00.000Z" };

const activities = [
  { userId: "user-1", type: "auth_login", createdAt: "2025-04-01T10:00:00.000Z" },
  { userId: "user-1", type: "auth_login", createdAt: "2025-04-15T10:00:00.000Z" },
  { userId: "user-1", type: "page_view", createdAt: "2025-04-15T11:00:00.000Z" },
  { userId: "user-1", type: "product_viewed", metadata: { productId: "p1" }, createdAt: "2025-04-15T12:00:00.000Z" },
  { userId: "user-1", type: "product_viewed", metadata: { productId: "p1" }, createdAt: "2025-04-16T12:00:00.000Z" },
  { userId: "user-1", type: "product_viewed", metadata: { productId: "p2" }, createdAt: "2025-04-16T13:00:00.000Z" },
  { userId: "user-1", type: "product_viewed", createdAt: "2025-04-16T14:00:00.000Z" },
  { userId: "user-1", type: "cart_add", createdAt: "2025-04-16T15:00:00.000Z" },
  { userId: "user-1", type: "cart_update", createdAt: "2025-04-16T16:00:00.000Z" },
  { userId: "user-1", type: "cart_remove", createdAt: "2025-04-17T16:00:00.000Z" },
  { userId: "user-1", type: "cart_clear", createdAt: "2025-04-18T16:00:00.000Z" },
  { userId: "user-1", type: "wishlist_toggle", createdAt: "2025-04-18T17:00:00.000Z" },
  { userId: "user-1", type: "auth_refresh", createdAt: "2025-04-19T17:00:00.000Z" },
  { userId: "user-1", type: "page_view", createdAt: "2025-03-01T10:00:00.000Z" },
  { userId: "user-2", type: "auth_login", createdAt: "2025-04-20T10:00:00.000Z" },
];

const orders = [
  {
    userId: "user-1",
    status: "completed",
    total: 100,
    createdAt: "2025-02-01T12:00:00.000Z",
    items: [
      { productId: "p1", category: "Shirts", quantity: 2, unitPrice: 40, lineTotal: 80 },
      { productId: "p3", category: "Shoes", quantity: 1, unitPrice: 20, lineTotal: 20 },
    ],
  },
  {
    userId: "user-1",
    status: "confirmed",
    total: 50,
    createdAt: "2025-04-20T12:00:00.000Z",
    items: [{ productId: "p4", category: "Shoes", quantity: 2, unitPrice: 25, lineTotal: 50 }],
  },
  {
    userId: "user-1",
    status: "draft",
    total: 999,
    createdAt: "2025-04-21T12:00:00.000Z",
    items: [{ productId: "p5", category: "Ignored", quantity: 99, unitPrice: 10, lineTotal: 990 }],
  },
  {
    userId: "user-1",
    status: "cancelled",
    total: 888,
    createdAt: "2025-04-22T12:00:00.000Z",
    items: [{ productId: "p6", category: "Ignored", quantity: 88, unitPrice: 10, lineTotal: 880 }],
  },
  {
    userId: "user-1",
    status: "completed",
    total: 500,
    createdAt: "2025-05-01T12:00:00.000Z",
    items: [{ productId: "future", category: "Future", quantity: 10, unitPrice: 50, lineTotal: 500 }],
  },
];

test("exports the approved feature names", () => {
  assert.equal(churnFeatureNames.length, 21);
});

test("extracts tenure, login recency, and login count in the fixed window", () => {
  const features = extractCustomerFeatures({ user, activities, orders, asOfDate });

  assert.equal(features.tenure_days, 119);
  assert.equal(features.days_since_last_login, 15);
  assert.equal(features.login_count_30d, 2);
});

test("counts distinct active days and meaningful activity categories", () => {
  const features = extractCustomerFeatures({ user, activities, orders, asOfDate });

  assert.equal(features.active_days_30d, 5);
  assert.equal(features.page_views_30d, 1);
  assert.equal(features.product_views_30d, 4);
  assert.equal(features.cart_actions_30d, 4);
  assert.equal(features.wishlist_actions_30d, 1);
  assert.equal(features.activity_event_count_30d, 12);
});

test("filters successful orders and calculates order and spend features", () => {
  const features = extractCustomerFeatures({ user, activities, orders, asOfDate });

  assert.equal(features.order_count, 2);
  assert.equal(features.orders_30d, 1);
  assert.equal(features.days_since_last_order, 10);
  assert.equal(features.total_spend, 150);
  assert.equal(features.spend_30d, 50);
  assert.equal(features.average_order_value, 75);
});

test("calculates preferred category and ordered item aggregates", () => {
  const features = extractCustomerFeatures({ user, activities, orders, asOfDate });

  assert.equal(features.preferred_order_category, "Shoes");
  assert.equal(features.distinct_categories_ordered, 2);
  assert.equal(features.items_per_order, 2.5);
  assert.equal(features.order_frequency, 2 / (119 / 30));
});

test("counts distinct viewed products and ignores missing product ids", () => {
  const features = extractCustomerFeatures({ user, activities, orders, asOfDate });

  assert.equal(features.distinct_products_viewed_30d, 2);
});

test("returns null order-history features for a customer with no successful orders", () => {
  const features = extractCustomerFeatures({
    user: { _id: "user-no-orders", createdAt: "2025-01-01T00:00:00.000Z" },
    activities: [],
    orders,
    asOfDate,
  });

  assert.equal(features.days_since_last_order, null);
  assert.equal(features.average_order_value, null);
  assert.equal(features.preferred_order_category, null);
  assert.equal(features.items_per_order, null);
});

test("uses the as-of cutoff for activities and orders", () => {
  const features = extractCustomerFeatures({
    user,
    activities: [...activities, { userId: "user-1", type: "auth_login", createdAt: "2025-05-01T00:00:00.000Z" }],
    orders,
    asOfDate,
  });

  assert.equal(features.login_count_30d, 2);
  assert.equal(features.order_count, 2);
  assert.equal(features.total_spend, 150);
});

test("extractAllCustomerFeatures returns only eligible customers", () => {
  const rows = extractAllCustomerFeatures({
    users: [user, { _id: "user-2", createdAt: "2025-01-01T00:00:00.000Z" }],
    activities,
    orders,
    asOfDate,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].order_count, 2);
});

test("generates churn label 1 after a complete no-order observation window", () => {
  assert.equal(
    calculateChurnLabel({
      userId: "user-1",
      orders: orders.filter((order) => order.createdAt !== "2025-05-01T12:00:00.000Z"),
      asOfDate,
      observationDate: "2025-08-01T00:00:00.000Z",
    }),
    1
  );
});

test("generates churn label 0 when a successful future order exists", () => {
  assert.equal(
    calculateChurnLabel({
      userId: "user-1",
      orders,
      asOfDate,
      observationDate: "2025-08-01T00:00:00.000Z",
    }),
    0
  );

  assert.equal(
    calculateChurnLabel({
      userId: "user-1",
      orders: orders.filter((order) => order.createdAt !== "2025-05-01T12:00:00.000Z"),
      asOfDate,
      observationDate: "2025-08-01T00:00:00.000Z",
    }),
    1
  );
});

test("returns null when the future observation window is incomplete or customer is ineligible", () => {
  assert.equal(
    calculateChurnLabel({
      userId: "user-1",
      orders,
      asOfDate,
      observationDate: "2025-06-01T00:00:00.000Z",
    }),
    null
  );
  assert.equal(
    calculateChurnLabel({
      userId: "user-no-orders",
      orders,
      asOfDate,
      observationDate: "2025-08-01T00:00:00.000Z",
    }),
    null
  );
});

test("zero-division protection across order_frequency, average_order_value, and items_per_order", () => {
  // Case A: Customer joined on the exact as-of date (tenure_days = 0)
  const userZeroTenure = { _id: "user-zt", createdAt: asOfDate };
  const orderOnSameDay = [
    {
      userId: "user-zt",
      status: "completed",
      total: 100,
      createdAt: asOfDate,
      items: [{ productId: "p1", category: "Shirts", quantity: 2 }],
    },
  ];

  const featuresA = extractCustomerFeatures({
    user: userZeroTenure,
    activities: [],
    orders: orderOnSameDay,
    asOfDate,
  });

  assert.equal(featuresA.tenure_days, 0);
  assert.equal(featuresA.order_frequency, 1); // 1 / Math.max(0/30, 1) = 1 / 1 = 1
  assert.equal(featuresA.average_order_value, 100);
  assert.equal(featuresA.items_per_order, 2);

  // Case B: Customer with 0 orders
  const featuresB = extractCustomerFeatures({
    user: { _id: "user-no-order", createdAt: "2025-01-01T00:00:00.000Z" },
    activities: [],
    orders: [],
    asOfDate,
  });

  assert.equal(featuresB.order_frequency, 0);
  assert.equal(featuresB.average_order_value, null);
  assert.equal(featuresB.items_per_order, null);
  assert.equal(featuresB.preferred_order_category, null);
});

test("zero future leakage: all 21 features are identical before and after injecting massive future events", () => {
  const baseFeatures = extractCustomerFeatures({ user, activities, orders, asOfDate });

  // Inject future activities and future orders after asOfDate
  const futureActivities = [
    ...activities,
    { userId: "user-1", type: "auth_login", createdAt: "2025-05-05T00:00:00.000Z" },
    { userId: "user-1", type: "page_view", createdAt: "2025-05-05T00:05:00.000Z" },
    { userId: "user-1", type: "product_viewed", metadata: { productId: "p-future" }, createdAt: "2025-05-05T00:10:00.000Z" },
    { userId: "user-1", type: "cart_add", createdAt: "2025-05-05T00:15:00.000Z" },
    { userId: "user-1", type: "wishlist_toggle", createdAt: "2025-05-05T00:20:00.000Z" },
    { userId: "user-1", type: "order_placed", createdAt: "2025-05-05T00:30:00.000Z" },
  ];

  const futureOrders = [
    ...orders,
    {
      userId: "user-1",
      status: "completed",
      total: 9999,
      createdAt: "2025-05-05T00:30:00.000Z",
      items: [{ productId: "p-future", category: "FutureCategory", quantity: 50, unitPrice: 100, lineTotal: 5000 }],
    },
  ];

  const featuresWithFuture = extractCustomerFeatures({
    user,
    activities: futureActivities,
    orders: futureOrders,
    asOfDate,
  });

  for (const featureName of churnFeatureNames) {
    assert.deepEqual(
      featuresWithFuture[featureName],
      baseFeatures[featureName],
      `Leakage detected in feature '${featureName}': expected ${baseFeatures[featureName]}, got ${featuresWithFuture[featureName]}`
    );
  }
});