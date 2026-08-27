/**
 * config/featureLabels.js
 * Human-friendly labels and descriptions for all 21 LumaWear-native features.
 */

export const FEATURE_LABELS = {
  tenure_days: {
    label: "Account Tenure",
    unit: "days",
    description: "Number of days since user account creation",
  },
  days_since_last_login: {
    label: "Days Since Last Login",
    unit: "days",
    description: "Recency of last authenticated sign-in session",
  },
  days_since_last_activity: {
    label: "Days Since Last Activity",
    unit: "days",
    description: "Recency of any recorded customer interaction or page view",
  },
  login_count_30d: {
    label: "30-Day Logins",
    unit: "logins",
    description: "Total login sessions in the last 30 days",
  },
  active_days_30d: {
    label: "30-Day Active Days",
    unit: "days",
    description: "Distinct days with activity in the last 30 days",
  },
  page_views_30d: {
    label: "30-Day Page Views",
    unit: "views",
    description: "Total storefront page views in the last 30 days",
  },
  product_views_30d: {
    label: "30-Day Product Views",
    unit: "views",
    description: "Product detail pages inspected in the last 30 days",
  },
  cart_actions_30d: {
    label: "30-Day Cart Actions",
    unit: "actions",
    description: "Cart additions, updates, and removals in the last 30 days",
  },
  wishlist_actions_30d: {
    label: "30-Day Wishlist Actions",
    unit: "actions",
    description: "Wishlist toggles in the last 30 days",
  },
  order_count: {
    label: "Lifetime Orders",
    unit: "orders",
    description: "Total lifetime successful orders placed",
  },
  orders_30d: {
    label: "30-Day Orders",
    unit: "orders",
    description: "Successful orders placed in the last 30 days",
  },
  days_since_last_order: {
    label: "Days Since Last Order",
    unit: "days",
    description: "Recency of last completed purchase",
  },
  total_spend: {
    label: "Lifetime Spend",
    unit: "$",
    description: "Total lifetime dollar value spent on successful orders",
  },
  spend_30d: {
    label: "30-Day Spend",
    unit: "$",
    description: "Dollar amount spent in the last 30 days",
  },
  average_order_value: {
    label: "Average Order Value",
    unit: "$",
    description: "Average dollar value per completed order",
  },
  preferred_order_category: {
    label: "Preferred Category",
    unit: "",
    description: "Most frequently purchased product category",
  },
  order_frequency: {
    label: "Order Frequency",
    unit: "orders/mo",
    description: "Purchase cadence normalized per 30-day period",
  },
  distinct_products_viewed_30d: {
    label: "Unique Products Viewed",
    unit: "products",
    description: "Distinct catalog items browsed in the last 30 days",
  },
  distinct_categories_ordered: {
    label: "Categories Ordered",
    unit: "categories",
    description: "Number of unique categories purchased from",
  },
  items_per_order: {
    label: "Items Per Order",
    unit: "items",
    description: "Average quantity of items in each order",
  },
  activity_event_count_30d: {
    label: "30-Day Activity Events",
    unit: "events",
    description: "Total behavioral events logged across the platform in 30 days",
  },
};

export function getFeatureDisplay(featureName) {
  if (!featureName) return { label: "Unknown Feature", description: "" };

  // Handle OHE features like preferred_order_category_Outerwear
  if (featureName.startsWith("preferred_order_category_")) {
    const cat = featureName.replace("preferred_order_category_", "");
    return {
      label: `Category Preference: ${cat}`,
      unit: "",
      description: `Customer preference for ${cat} apparel`,
    };
  }

  return FEATURE_LABELS[featureName] || {
    label: featureName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    unit: "",
    description: "",
  };
}

export function formatFeatureLabel(featureName) {
  return getFeatureDisplay(featureName).label;
}

export function getFeatureDescription(featureName) {
  return getFeatureDisplay(featureName).description;
}

