import joblib
import pandas as pd
from pathlib import Path

pipeline = joblib.load(Path("artifacts/2b2147fd4057/churn_pipeline.joblib"))

results = []
for days_login in range(10, 22):
    for days_order in [25, 30, 35, 40, 45]:
        for events in [6, 8, 10, 12, 15]:
            for orders in [2, 3, 4]:
                cust = {
                    "tenure_days": 180,
                    "days_since_last_login": days_login,
                    "days_since_last_activity": max(1, days_login - 2),
                    "login_count_30d": max(1, events // 4),
                    "active_days_30d": max(1, events // 4),
                    "page_views_30d": events,
                    "product_views_30d": max(1, events // 2),
                    "cart_actions_30d": 1,
                    "wishlist_actions_30d": 1,
                    "order_count": orders,
                    "orders_30d": 0,
                    "days_since_last_order": days_order,
                    "total_spend": orders * 180.0,
                    "spend_30d": 0.0,
                    "average_order_value": 180.0,
                    "order_frequency": orders / 6.0,
                    "distinct_products_viewed_30d": max(1, events // 3),
                    "distinct_categories_ordered": 2,
                    "items_per_order": 1.8,
                    "activity_event_count_30d": events,
                    "preferred_order_category": "Outerwear",
                }
                df = pd.DataFrame([cust])
                prob = pipeline.predict_proba(df)[0, 1]
                if 0.50 <= prob < 0.75:
                    results.append((prob, days_login, days_order, events, orders))

print(f"Found {len(results)} High Risk (0.50 <= P < 0.75) combinations:")
for prob, login, order, ev, ords in sorted(results)[:15]:
    print(f"P = {prob:.4f} | days_login={login}, days_order={order}, events={ev}, orders={ords}")
