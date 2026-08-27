"""
backend/recommender.py

Generates personalized retention recommendations based on customer feature values,
top SHAP drivers, and churn probability.

Supports both:
1. LumaWear-native e-commerce behavioral features (primary)
2. Benchmark dataset features (backward compatibility)
"""

from typing import List, Dict, Any, Optional


# ─── LumaWear-Native Recommendation Rules ─────────────────────────────────────
# Fired when customer has LumaWear features (or SHAP points to them)
LUMAWEAR_RULES = {
    "days_since_last_activity": {
        "condition": lambda v, c, p: v is not None and float(v) >= 14,
        "recommendation": (
            "Customer has been inactive for {days_since_last_activity} days. "
            "Send a personalized win-back campaign with a time-limited comeback discount."
        ),
        "priority": "High",
    },
    "days_since_last_login": {
        "condition": lambda v, c, p: v is not None and float(v) >= 14,
        "recommendation": (
            "No login recorded for {days_since_last_login} days. "
            "Trigger a re-engagement email or push notification highlighting new arrivals and curated collections."
        ),
        "priority": "High",
    },
    "cart_abandonment": {
        "condition": lambda v, c, p: (
            c.get("cart_actions_30d") is not None
            and float(c.get("cart_actions_30d", 0)) > 0
            and float(c.get("orders_30d", 0) or 0) == 0
        ),
        "recommendation": (
            "Cart abandonment detected ({cart_actions_30d} cart actions in 30d with 0 orders). "
            "Send an abandoned-cart reminder with a limited-time incentive or free shipping offer."
        ),
        "priority": "High",
        "feature_key": "cart_actions_30d",
    },
    "browse_without_purchase": {
        "condition": lambda v, c, p: (
            c.get("product_views_30d") is not None
            and float(c.get("product_views_30d", 0)) >= 5
            and float(c.get("orders_30d", 0) or 0) == 0
        ),
        "recommendation": (
            "Customer browsed {product_views_30d} products recently without placing an order. "
            "Send personalized recommendations based on recently viewed products."
        ),
        "priority": "Medium",
        "feature_key": "product_views_30d",
    },
    "vip_retention": {
        "condition": lambda v, c, p: (
            c.get("total_spend") is not None
            and float(c.get("total_spend", 0)) >= 400
            and p >= 0.45
        ),
        "recommendation": (
            "High-value customer (${total_spend} lifetime spend) showing elevated churn risk ({churn_pct}%). "
            "Prioritize VIP retention outreach with dedicated support and exclusive loyalty perks."
        ),
        "priority": "High",
        "feature_key": "total_spend",
    },
    "category_preference": {
        "condition": lambda v, c, p: (
            c.get("preferred_order_category") is not None
            and str(c.get("preferred_order_category")).strip() != ""
            and str(c.get("preferred_order_category")).strip().lower() not in ["none", "nan", "null"]
        ),
        "recommendation": (
            "Customer shows strong affinity for '{preferred_order_category}'. "
            "Promote products, seasonal drops, and promotional bundles from the customer's preferred category."
        ),
        "priority": "Medium",
        "feature_key": "preferred_order_category",
    },
    "low_engagement": {
        "condition": lambda v, c, p: (
            c.get("login_count_30d") is not None
            and c.get("activity_event_count_30d") is not None
            and float(c.get("login_count_30d", 0)) <= 1
            and float(c.get("activity_event_count_30d", 0)) <= 5
        ),
        "recommendation": (
            "Very low engagement ({activity_event_count_30d} total activity events in 30 days). "
            "Trigger re-engagement communication with top-trending items and personalized rewards."
        ),
        "priority": "High",
        "feature_key": "activity_event_count_30d",
    },
    "days_since_last_order": {
        "condition": lambda v, c, p: v is not None and float(v) >= 30,
        "recommendation": (
            "Customer has not ordered in {days_since_last_order} days. "
            "Send a replenishment reminder with personalized product recommendations and express checkout."
        ),
        "priority": "Medium",
    },
    "wishlist_actions_30d": {
        "condition": lambda v, c, p: (
            c.get("wishlist_actions_30d") is not None
            and float(c.get("wishlist_actions_30d", 0)) > 0
            and float(c.get("orders_30d", 0) or 0) == 0
        ),
        "recommendation": (
            "Customer added items to wishlist ({wishlist_actions_30d} actions) without recent purchases. "
            "Send price-drop alerts or low-stock notifications for saved wishlist items."
        ),
        "priority": "Low",
    },
    "tenure_days": {
        "condition": lambda v, c, p: v is not None and float(v) <= 30,
        "recommendation": (
            "New customer (tenure: {tenure_days} days). "
            "Enroll in early-onboarding loyalty journey with a 2nd-order milestone reward to build long-term retention."
        ),
        "priority": "Medium",
    },
    "order_frequency": {
        "condition": lambda v, c, p: (
            c.get("order_frequency") is not None
            and float(c.get("order_frequency", 0)) < 0.5
            and float(c.get("order_count", 0) or 0) > 0
        ),
        "recommendation": (
            "Low order cadence detected. Offer free shipping threshold or multi-item bundle incentives "
            "to increase purchase frequency."
        ),
        "priority": "Low",
    },
}

# OHE category rules for LumaWear
LUMAWEAR_OHE_RULES = {
    "preferred_order_category_": {
        "priority": "Medium",
        "recommendation": (
            "Customer frequently purchases from '{category}'. "
            "Feature new arrivals and exclusive deals from this category in upcoming outreach."
        ),
    }
}


# ─── Benchmark Dataset Recommendation Rules (Backward Compatibility) ─────────
BENCHMARK_RULES = {
    "Complain": {
        "condition": lambda v, c, p: v is not None and float(v) >= 0.5,
        "recommendation": (
            "URGENT: Customer raised a complaint. Assign a dedicated support agent immediately. "
            "Follow up within 24 hours with a goodwill coupon (10-15% off next order)."
        ),
        "priority": "High",
    },
    "Tenure": {
        "condition": lambda v, c, p: v is not None and float(v) < 3,
        "recommendation": (
            "New customer (low tenure). Trigger a welcome loyalty programme — "
            "offer a milestone reward after 3rd and 6th month to build long-term retention."
        ),
        "priority": "High",
    },
    "SatisfactionScore": {
        "condition": lambda v, c, p: v is not None and float(v) <= 2,
        "recommendation": (
            "Low satisfaction score detected. Send a personalised feedback survey within 48 hours. "
            "Offer a service-recovery discount of 10-15% on the next order."
        ),
        "priority": "High",
    },
    "DaySinceLastOrder": {
        "condition": lambda v, c, p: v is not None and float(v) >= 7,
        "recommendation": (
            "Customer inactive for {DaySinceLastOrder} days. Launch a re-engagement campaign: "
            "personalised product recommendations + time-limited offer."
        ),
        "priority": "Medium",
    },
    "CashbackAmount": {
        "condition": lambda v, c, p: v is not None and float(v) < 150,
        "recommendation": (
            "Below-average cashback usage. Highlight cashback benefits in the next push notification "
            "to reinforce platform value and drive repeat purchases."
        ),
        "priority": "Medium",
    },
    "CouponUsed": {
        "condition": lambda v, c, p: v is not None and float(v) == 0,
        "recommendation": (
            "Customer has never used coupons. Send personalised coupon bundles matching "
            "their preferred order category to incentivise the next purchase."
        ),
        "priority": "Medium",
    },
    "OrderCount": {
        "condition": lambda v, c, p: v is not None and float(v) <= 1,
        "recommendation": (
            "Low order frequency. Introduce a 'Buy 3 Get 1 Free' offer or "
            "a monthly subscription benefit to increase order cadence."
        ),
        "priority": "Medium",
    },
    "HourSpendOnApp": {
        "condition": lambda v, c, p: v is not None and float(v) <= 1,
        "recommendation": (
            "Low app engagement. Push a personalised in-app notification with "
            "curated deals to increase session time and product discovery."
        ),
        "priority": "Medium",
    },
    "WarehouseToHome": {
        "condition": lambda v, c, p: v is not None and float(v) > 20,
        "recommendation": (
            "Long delivery distance may be causing frustration. "
            "Offer express delivery upgrade or highlight nearest fulfilment option."
        ),
        "priority": "Medium",
    },
}


# ─── Fallback Retention Actions ────────────────────────────────────────────────
FALLBACK_RECOMMENDATIONS = [
    {
        "recommendation": "Enroll customer in the VIP loyalty programme to increase brand affinity and repeat purchases.",
        "priority": "Medium",
    },
    {
        "recommendation": "Send a personalized monthly digest of top-trending products matching customer interests.",
        "priority": "Low",
    },
    {
        "recommendation": "Offer a surprise loyalty credit or reward on their next order to boost customer retention.",
        "priority": "Low",
    },
    {
        "recommendation": "Enable smart push notifications for restocks and price drops in preferred categories.",
        "priority": "Low",
    },
    {
        "recommendation": "Proactively reach out via in-app customer support to collect feedback on recent shopping experiences.",
        "priority": "Low",
    },
]


def _format_text(template: str, customer_data: dict, churn_prob: float) -> str:
    """Format template string safely using customer_data and churn_prob."""
    values = {k: ("" if v is None else v) for k, v in customer_data.items()}
    values["churn_pct"] = round(churn_prob * 100, 1)

    # Format numeric values cleanly
    for k, v in list(values.items()):
        if isinstance(v, float) and v.is_integer():
            values[k] = int(v)
        elif isinstance(v, float):
            values[k] = round(v, 2)

    try:
        return template.format(**values)
    except KeyError:
        # Fallback if a template key is missing
        return template


def generate_recommendations(
    top_shap_features: list,
    customer_data: dict,
    churn_probability: float,
    n: int = 3,
) -> list:
    """
    Generate up to n personalised retention recommendations.

    Args:
        top_shap_features: list of dicts with {"feature": ..., "shap_value": ..., "direction": ...}
        customer_data: dict of raw feature values
        churn_probability: predicted probability of churn (0.0 – 1.0)
        n: maximum number of recommendations to return

    Returns:
        list of recommendation dicts with keys:
            - driven_by: str
            - shap_impact: Optional[float]
            - recommendation: str
            - priority: str ("High", "Medium", "Low")
    """
    recommendations: List[Dict[str, Any]] = []
    seen_features = set()

    # Determine if dataset is LumaWear or Benchmark
    is_lumawear = any(
        k in customer_data
        for k in [
            "days_since_last_activity",
            "days_since_last_login",
            "activity_event_count_30d",
            "cart_actions_30d",
            "product_views_30d",
            "tenure_days",
            "total_spend",
        ]
    )

    # 1. First pass: Evaluate SHAP drivers pushing toward churn (shap_value > 0)
    for feat_info in top_shap_features or []:
        if len(recommendations) >= n:
            break

        feature = feat_info.get("feature", "")
        shap_val = feat_info.get("shap_value", 0.0)

        # Only prioritize features that increase churn risk
        if shap_val <= 0:
            continue

        # Check LumaWear exact feature
        if is_lumawear:
            # Check direct rule
            if feature in LUMAWEAR_RULES:
                rule = LUMAWEAR_RULES[feature]
                val = customer_data.get(feature)
                if rule["condition"](val, customer_data, churn_probability):
                    rec_text = _format_text(rule["recommendation"], customer_data, churn_probability)
                    recommendations.append({
                        "driven_by": feature,
                        "shap_impact": round(float(shap_val), 4),
                        "recommendation": rec_text,
                        "priority": rule["priority"],
                    })
                    seen_features.add(feature)
                    continue

            # Check OHE feature (e.g., preferred_order_category_Outerwear)
            if feature.startswith("preferred_order_category_"):
                category = feature.replace("preferred_order_category_", "")
                rule = LUMAWEAR_OHE_RULES["preferred_order_category_"]
                rec_text = rule["recommendation"].replace("{category}", category)
                recommendations.append({
                    "driven_by": feature,
                    "shap_impact": round(float(shap_val), 4),
                    "recommendation": rec_text,
                    "priority": rule["priority"],
                })
                seen_features.add("preferred_order_category")
                continue
        else:
            # Benchmark rules check
            if feature in BENCHMARK_RULES:
                rule = BENCHMARK_RULES[feature]
                val = customer_data.get(feature)
                if rule["condition"](val, customer_data, churn_probability):
                    rec_text = _format_text(rule["recommendation"], customer_data, churn_probability)
                    recommendations.append({
                        "driven_by": feature,
                        "shap_impact": round(float(shap_val), 4),
                        "recommendation": rec_text,
                        "priority": rule["priority"],
                    })
                    seen_features.add(feature)
                    continue

    # 2. Second pass: Evaluate feature rules based on raw customer profile
    rules_dict = LUMAWEAR_RULES if is_lumawear else BENCHMARK_RULES

    for rule_key, rule in rules_dict.items():
        if len(recommendations) >= n:
            break

        feature_key = rule.get("feature_key", rule_key)
        if feature_key in seen_features or rule_key in seen_features:
            continue

        raw_val = customer_data.get(feature_key)
        try:
            if rule["condition"](raw_val, customer_data, churn_probability):
                rec_text = _format_text(rule["recommendation"], customer_data, churn_probability)
                recommendations.append({
                    "driven_by": feature_key,
                    "shap_impact": None,
                    "recommendation": rec_text,
                    "priority": rule["priority"],
                })
                seen_features.add(feature_key)
                seen_features.add(rule_key)
        except Exception:
            continue

    # 3. Third pass: Fill any remaining slots with contextual fallbacks
    for fallback in FALLBACK_RECOMMENDATIONS:
        if len(recommendations) >= n:
            break
        recommendations.append({
            "driven_by": "general_retention",
            "shap_impact": None,
            "recommendation": fallback["recommendation"],
            "priority": fallback["priority"],
        })

    return recommendations