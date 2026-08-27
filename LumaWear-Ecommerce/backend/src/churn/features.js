const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const LABEL_OBSERVATION_DAYS = 90;

const SUCCESSFUL_ORDER_STATUSES = new Set(["confirmed", "completed", "pending"]);
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
const CART_ACTIVITY_TYPES = new Set(["cart_add", "cart_update", "cart_remove", "cart_clear"]);

function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toId(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function isAtOrBefore(date, asOfTime) {
  return date !== null && date.getTime() <= asOfTime;
}

function isInWindow(date, asOfTime, windowStartTime) {
  const time = date?.getTime();
  return time !== undefined && time > windowStartTime && time <= asOfTime;
}

function getActivitiesBefore(activities, asOfTime) {
  return (Array.isArray(activities) ? activities : []).filter((activity) => {
    const date = toDate(activity?.createdAt);
    return isAtOrBefore(date, asOfTime) && MEANINGFUL_ACTIVITY_TYPES.has(activity?.type);
  }).sort((left, right) => toDate(left.createdAt).getTime() - toDate(right.createdAt).getTime());
}

function getSuccessfulOrdersBefore(orders, userId, asOfTime) {
  const normalizedUserId = toId(userId);
  return (Array.isArray(orders) ? orders : [])
    .filter((order) => {
      const date = toDate(order?.createdAt);
      return (
        toId(order?.userId) === normalizedUserId &&
        SUCCESSFUL_ORDER_STATUSES.has(order?.status) &&
        isAtOrBefore(date, asOfTime)
      );
    })
    .sort((left, right) => toDate(left.createdAt).getTime() - toDate(right.createdAt).getTime());
}

function sumOrderTotals(orders) {
  return orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function daysBetween(asOfTime, earlierTime) {
  return Math.floor((asOfTime - earlierTime) / DAY_MS);
}

function getWindowBounds(asOfTime) {
  return {
    asOfTime,
    windowStartTime: asOfTime - WINDOW_DAYS * DAY_MS,
  };
}

function getPreferredCategory(orders) {
  const categories = new Map();

  for (const order of orders) {
    const orderTime = toDate(order.createdAt).getTime();
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const category = String(item?.category || "").trim();
      if (!category) continue;

      const existing = categories.get(category) || { quantity: 0, latestOrderTime: -Infinity };
      existing.quantity += Number(item.quantity) || 0;
      existing.latestOrderTime = Math.max(existing.latestOrderTime, orderTime);
      categories.set(category, existing);
    }
  }

  return [...categories.entries()]
    .sort((left, right) => {
      const quantityDifference = right[1].quantity - left[1].quantity;
      if (quantityDifference !== 0) return quantityDifference;

      const dateDifference = right[1].latestOrderTime - left[1].latestOrderTime;
      if (dateDifference !== 0) return dateDifference;
      return left[0].localeCompare(right[0]);
    })
    .at(0)?.[0] || null;
}

function getDistinctViewedProducts(activities) {
  const productIds = new Set();
  for (const activity of activities) {
    if (activity.type !== "product_viewed") continue;
    const productId = activity.metadata?.productId;
    if (productId !== null && productId !== undefined && String(productId).trim()) {
      productIds.add(String(productId));
    }
  }
  return productIds.size;
}

function getOrderedItemStats(orders) {
  const categories = new Set();
  let quantity = 0;

  for (const order of orders) {
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const category = String(item?.category || "").trim();
      if (category) categories.add(category);
      quantity += Number(item?.quantity) || 0;
    }
  }

  return { categories, quantity };
}

function hasSuccessfulOrder(orders, userId, asOfTime) {
  return getSuccessfulOrdersBefore(orders, userId, asOfTime).length > 0;
}

/**
 * Extract one point-in-time feature row from already-loaded LumaWear records.
 * Missing history remains null where the feature has no meaningful value.
 */
export function extractCustomerFeatures({ user, activities = [], orders = [], asOfDate }) {
  const asOf = toDate(asOfDate);
  if (!asOf) throw new Error("A valid asOfDate is required.");

  const asOfTime = asOf.getTime();
  const { windowStartTime } = getWindowBounds(asOfTime);
  const userId = user?._id ?? user?.id ?? user?.userId;
  const createdAt = toDate(user?.createdAt);
  const meaningfulActivities = getActivitiesBefore(activities, asOfTime);
  const windowActivities = meaningfulActivities.filter((activity) =>
    isInWindow(toDate(activity.createdAt), asOfTime, windowStartTime)
  );
  const userActivities = meaningfulActivities.filter((activity) => toId(activity.userId) === toId(userId));
  const userWindowActivities = windowActivities.filter((activity) => toId(activity.userId) === toId(userId));
  const successfulOrders = getSuccessfulOrdersBefore(orders, userId, asOfTime);
  const windowOrders = successfulOrders.filter((order) =>
    isInWindow(toDate(order.createdAt), asOfTime, windowStartTime)
  );
  const orderedItemStats = getOrderedItemStats(successfulOrders);
  const lastLogin = userActivities
    .filter((activity) => activity.type === "auth_login")
    .at(-1);
  const lastActivity = userActivities.at(-1);
  const lastOrder = successfulOrders.at(-1);
  const tenureDays = createdAt && createdAt.getTime() <= asOfTime ? daysBetween(asOfTime, createdAt.getTime()) : null;
  const orderCount = successfulOrders.length;
  const totalSpend = sumOrderTotals(successfulOrders);

  return {
    user_id: toId(userId),
    tenure_days: tenureDays,
    days_since_last_login: lastLogin ? daysBetween(asOfTime, toDate(lastLogin.createdAt).getTime()) : null,
    days_since_last_activity: lastActivity ? daysBetween(asOfTime, toDate(lastActivity.createdAt).getTime()) : null,
    login_count_30d: userWindowActivities.filter((activity) => activity.type === "auth_login").length,
    active_days_30d: new Set(userWindowActivities.map((activity) => toDate(activity.createdAt).toISOString().slice(0, 10))).size,
    page_views_30d: userWindowActivities.filter((activity) => activity.type === "page_view").length,
    product_views_30d: userWindowActivities.filter((activity) => activity.type === "product_viewed").length,
    cart_actions_30d: userWindowActivities.filter((activity) => CART_ACTIVITY_TYPES.has(activity.type)).length,
    wishlist_actions_30d: userWindowActivities.filter((activity) => activity.type === "wishlist_toggle").length,
    order_count: orderCount,
    orders_30d: windowOrders.length,
    days_since_last_order: lastOrder ? daysBetween(asOfTime, toDate(lastOrder.createdAt).getTime()) : null,
    total_spend: roundMoney(totalSpend),
    spend_30d: roundMoney(sumOrderTotals(windowOrders)),
    average_order_value: orderCount > 0 ? roundMoney(totalSpend / orderCount) : null,
    preferred_order_category: orderCount > 0 ? getPreferredCategory(successfulOrders) : null,
    order_frequency: orderCount > 0 && tenureDays !== null ? orderCount / Math.max(tenureDays / WINDOW_DAYS, 1) : 0,
    distinct_products_viewed_30d: getDistinctViewedProducts(userWindowActivities),
    distinct_categories_ordered: orderedItemStats.categories.size,
    items_per_order: orderCount > 0 ? orderedItemStats.quantity / orderCount : null,
    activity_event_count_30d: userWindowActivities.length,
  };
}

/**
 * Extract rows only for customers eligible for the recommended churn label.
 */
export function extractAllCustomerFeatures({ users = [], activities = [], orders = [], asOfDate }) {
  const asOf = toDate(asOfDate);
  if (!asOf) throw new Error("A valid asOfDate is required.");
  const asOfTime = asOf.getTime();

  return (Array.isArray(users) ? users : [])
    .filter((user) => hasSuccessfulOrder(orders, user?._id ?? user?.id ?? user?.userId, asOfTime))
    .map((user) => extractCustomerFeatures({ user, activities, orders, asOfDate: asOf }));
}

/**
 * Generate the future-window churn label. `observationDate` is injectable for
 * deterministic backfills and defaults to the current date only for labeling.
 */
export function calculateChurnLabel({ userId, orders = [], asOfDate, observationDate = new Date() }) {
  const asOf = toDate(asOfDate);
  const observedThrough = toDate(observationDate);
  if (!asOf || !observedThrough) throw new Error("Valid asOfDate and observationDate are required.");

  const asOfTime = asOf.getTime();
  const observationEndTime = asOfTime + LABEL_OBSERVATION_DAYS * DAY_MS;
  if (observedThrough.getTime() < observationEndTime) return null;

  const successfulOrders = (Array.isArray(orders) ? orders : []).filter((order) => {
    const orderDate = toDate(order?.createdAt);
    return (
      toId(order?.userId) === toId(userId) &&
      SUCCESSFUL_ORDER_STATUSES.has(order?.status) &&
      orderDate !== null
    );
  });
  const hadPriorOrder = successfulOrders.some((order) => toDate(order.createdAt).getTime() <= asOfTime);
  if (!hadPriorOrder) return null;

  const hasFutureOrder = successfulOrders.some((order) => {
    const orderTime = toDate(order.createdAt).getTime();
    return orderTime > asOfTime && orderTime <= observationEndTime;
  });

  return hasFutureOrder ? 0 : 1;
}

export const churnFeatureNames = [
  "tenure_days",
  "days_since_last_login",
  "days_since_last_activity",
  "login_count_30d",
  "active_days_30d",
  "page_views_30d",
  "product_views_30d",
  "cart_actions_30d",
  "wishlist_actions_30d",
  "order_count",
  "orders_30d",
  "days_since_last_order",
  "total_spend",
  "spend_30d",
  "average_order_value",
  "preferred_order_category",
  "order_frequency",
  "distinct_products_viewed_30d",
  "distinct_categories_ordered",
  "items_per_order",
  "activity_event_count_30d",
];

export const churnFeatureConstants = {
  successfulOrderStatuses: [...SUCCESSFUL_ORDER_STATUSES],
  meaningfulActivityTypes: [...MEANINGFUL_ACTIVITY_TYPES],
  windowDays: WINDOW_DAYS,
  labelObservationDays: LABEL_OBSERVATION_DAYS,
};