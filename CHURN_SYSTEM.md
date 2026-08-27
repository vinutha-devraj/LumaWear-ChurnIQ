# LumaWear ChurnIQ — Machine Learning & Explainability System

## 1. Problem Formulation & Churn Definition

In apparel e-commerce, customer churn is defined over a **90-day observation window**:
- **Churn = 1**: A customer with at least one historical interaction who places **0 successful orders** during the 90 days following the observation cutoff date.
- **Churn = 0**: A customer who completes at least **1 successful order** within the 90-day observation window.

---

## 2. 21 LumaWear-Native Feature Space

The model utilizes 21 point-in-time behavioral and transactional features across 5 operational dimensions:

| Dimension | Feature Name | Type | Description |
| :--- | :--- | :--- | :--- |
| **Tenure & Recency** | `tenure_days` | Float | Days since customer registration |
| | `days_since_last_login` | Float | Recency of last authenticated sign-in session |
| | `days_since_last_activity` | Float | Recency of any storefront action (page view, cart, order) |
| **30-Day Engagement** | `login_count_30d` | Float | Total login sessions in past 30 days |
| | `active_days_30d` | Float | Distinct days with logged activity in past 30 days |
| | `page_views_30d` | Float | Total storefront page views in past 30 days |
| | `product_views_30d` | Float | Product detail pages viewed in past 30 days |
| | `cart_actions_30d` | Float | Add-to-cart, cart updates, and removals in past 30 days |
| | `wishlist_actions_30d` | Float | Wishlist additions/removals in past 30 days |
| | `activity_event_count_30d` | Float | Total event stream volume in past 30 days |
| | `distinct_products_viewed_30d`| Float | Unique catalog items inspected in past 30 days |
| **Order History** | `order_count` | Float | Total lifetime successful orders |
| | `orders_30d` | Float | Orders placed in past 30 days |
| | `days_since_last_order` | Float | Recency of last completed purchase |
| | `order_frequency` | Float | Purchase cadence normalized per 30-day period |
| | `items_per_order` | Float | Average items per completed order |
| **Monetary Value** | `total_spend` | Float | Total lifetime monetary value spent ($) |
| | `spend_30d` | Float | Total spend in past 30 days ($) |
| | `average_order_value` | Float | Mean order dollar amount ($) |
| **Merchandising** | `preferred_order_category` | Categorical | Most ordered category (Tops, Bottoms, Outerwear, Footwear, Accessories) |
| | `distinct_categories_ordered` | Float | Breadth of distinct categories purchased from |

---

## 3. Point-in-Time Extraction & Zero Future Leakage

To prevent data snooping and target leakage:
1. **As-Of Timestamp Filtering**: Every event (activity, login, order) is filtered strictly with `timestamp <= asOfDate`.
2. **Observation Boundary**: Features are computed strictly inside the historical observation period; the 90-day future window is used ONLY to compute the binary ground truth `churn` target.
3. **Audit Verification**: Verified with automated unit test injecting massive future events; feature vectors before and after future injection remain bit-for-bit identical.

---

## 4. Model Architecture & Cross-Validation

- **Algorithm**: Extreme Gradient Boosting (`XGBClassifier`)
- **Active Model Artifact**: `artifacts/2b2147fd4057`
- **Training Snapshots**: 7,912 point-in-time records
- **Class Balance**: 30.62% positive churn class (`scale_pos_weight = 2.2654`)
- **Validation**: 5-Fold Stratified Cross-Validation
- **5-Fold CV ROC-AUC**: `0.8370 ± 0.0108`
- **Training ROC-AUC**: `0.9736`

---

## 5. SHAP Explainability Architecture

The system serializes a `shap.TreeExplainer` fitted on the XGBoost estimator. For every inference request:
1. Preprocessed customer feature vector is passed to the explainer.
2. Explainer computes individual feature contributions (log-odds impact).
3. The top 5 contributors are ranked by absolute magnitude $|SHAP_i|$.
4. Direction is mapped:
   - $SHAP_i > 0 \rightarrow$ `"increases_churn"` (Raises risk)
   - $SHAP_i \le 0 \rightarrow$ `"reduces_churn"` (Protects customer / lowers risk)

---

## 6. E-Commerce Retention Recommendation Rules

Recommendations are triggered by combining SHAP drivers and live customer signals:
- **Cart Abandonment**: Cart actions $\ge 1$ in 30d with 0 orders $\rightarrow$ Abandoned cart incentive email with free shipping.
- **Browse Without Purchase**: Product views $\ge 5$ in 30d with 0 orders $\rightarrow$ Dynamic product recommendations based on viewed items.
- **Inactivity Win-Back**: Days inactive $\ge 14$ days $\rightarrow$ Time-limited comeback discount.
- **VIP Outreach**: Lifetime spend $\ge \$400$ and elevated churn risk $\rightarrow$ Dedicated loyalty support and VIP perks.
- **Category Affinity**: Strong preference for category $\rightarrow$ New seasonal drop alerts for preferred category.
- **New Customer Onboarding**: Account tenure $\le 14$ days $\rightarrow$ 2nd-order milestone reward journey.
