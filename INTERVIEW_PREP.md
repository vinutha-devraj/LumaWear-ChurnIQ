# LumaWear ChurnIQ — Interview Preparation & Technical Q&A

---

## 1. 2-Minute Project Elevator Pitch (SDE / ML Interview)

> *"LumaWear ChurnIQ is an end-to-end machine learning platform integrated into a full-stack e-commerce store that predicts and prevents customer churn across a 90-day horizon. 
>
> Many churn projects simply run offline batch scripts on stale CSVs. In ChurnIQ, I designed a production-ready dual-service architecture: an Express/Mongoose backend powers the storefront and captures point-in-time behavioral events, while a Python FastAPI microservice serves a high-performance XGBoost inference engine.
>
> To avoid data leakage, I formulated strict point-in-time snapshot logic across 21 domain-specific behavioral and transactional features. The model achieves a 5-fold cross-validated ROC-AUC of 0.837. Rather than treating the model as a black box, I embedded a SHAP TreeExplainer into the inference pipeline, attributing exact log-odds contributions to individual behaviors in real time. These SHAP drivers dynamically trigger personalized e-commerce retention actions—such as automated cart-recovery incentives, VIP outreach, or onboarding rewards.
>
> In the React admin dashboard, store operators can inspect any live customer and receive continuous risk scores, visual SHAP impact bars, and actionable retention steps—computed strictly from live MongoDB records with zero synthetic dependencies."*

---

## 2. 20 Technical Interview Questions & Answers

### 1. Why did you build this churn system?
**Answer**: E-commerce customer acquisition costs are 5–7x higher than retention costs. Traditional stores only notice churn after a customer has permanently stopped buying. ChurnIQ proactively detects early engagement decay (login recency, browsing drops, cart abandonment) and triggers retention actions before the customer is lost.

### 2. Why XGBoost?
**Answer**: Tabular e-commerce behavioral data contains non-linear interactions, skewed distributions (spend, tenure), and mixed numeric/categorical types. XGBoost natively handles sparsity, handles feature scaling implicitly, prevents overfitting via L1/L2 regularization and tree depth constraints, and integrates with TreeSHAP for millisecond-latency local explainability.

### 3. Why 21 features?
**Answer**: The 21 features span 5 critical dimensions of consumer lifecycle: Tenure/Recency (3), 30-Day Engagement (7), Order History (5), Monetary Value (3), and Merchandising Affinity (3). This captures RFM (Recency, Frequency, Monetary) alongside digital intent signals (page views, cart toggles, category affinity).

### 4. How did you prevent temporal leakage?
**Answer**: I enforced strict point-in-time temporal boundaries (`asOfDate`). When generating training snapshots, all feature extraction queries strictly filter `timestamp <= asOfDate`. The subsequent 90-day window (`asOfDate` to `asOfDate + 90d`) is isolated exclusively to determine the ground truth binary label `churn`.

### 5. Why use point-in-time snapshots?
**Answer**: Taking multiple historical snapshots per customer at fixed calendar dates (e.g., monthly) accurately replicates real-world production inference conditions, increases sample size without data snooping, and allows the model to learn seasonal and behavioral decay dynamics.

### 6. What does ROC-AUC 0.837 mean?
**Answer**: A Receiver Operating Characteristic Area Under the Curve of 0.837 means that given a randomly chosen churner and a randomly chosen non-churner, the model assigns a higher churn probability to the churner 83.7% of the time across all classification thresholds.

### 7. Why is training AUC (0.9736) higher than CV AUC (0.8370)?
**Answer**: Gradient boosted decision trees fit high-capacity ensembles that achieve near-perfect discrimination on training leaves. The 5-fold Stratified CV ROC-AUC of 0.8370 ± 0.0108 confirms strong out-of-fold generalization without catastrophic overfitting.

### 8. How does SHAP work here?
**Answer**: I use Lundberg et al.'s `TreeExplainer`, which calculates exact game-theoretic Shapley values by traversing the XGBoost decision trees. For any live customer, SHAP decomposes the model's base probability output into individual positive and negative feature impact values ($\sum SHAP_i = f(x) - E[f(x)]$), providing local explainability.

### 9. How does live prediction work?
**Answer**: Admin clicks "Analyze Risk" in React $\rightarrow$ Express receives `GET /api/churn/predict/:userId` $\rightarrow$ Express proxies to FastAPI `POST /predict/live-customer` $\rightarrow$ FastAPI invokes feature extraction layer to pull live User, Activity, and Order documents from MongoDB $\rightarrow$ calculates 21 point-in-time features $\rightarrow$ passes vector through XGBoost Pipeline and SHAP Explainer $\rightarrow$ returns continuous probability, risk tier, SHAP drivers, and retention rules to the React UI.

### 10. Why FastAPI + Node instead of putting everything in one backend?
**Answer**: Separation of concerns. Node.js with Express and Mongoose is exceptionally well-suited for I/O-bound e-commerce transactions, WebSockets, and storefront routing. Python with FastAPI, scikit-learn, XGBoost, and SHAP leverages native C/C++ compiled numerical libraries for ML operations.

### 11. Why is FastAPI hidden behind Express?
**Answer**: Security and architecture cleanliness. Express acts as the single authenticated API Gateway, enforcing JWT token validation and Admin RBAC. The Python inference microservice remains shielded inside the internal network without exposing model ports or requiring duplicate auth middleware.

### 12. How does the recommendation engine work?
**Answer**: The recommendation engine maps top SHAP feature directions and specific customer behavioral signals (e.g., cart actions without orders, high inactivity, VIP spend threshold) to actionable retention plays (cart incentives, win-back discounts, onboarding rewards) with prioritized urgency levels (High, Medium, Low).

### 13. What happens if FastAPI goes down?
**Answer**: Express wraps the upstream FastAPI call in an `AbortController` timeout (5000ms) with a try/catch block, returning HTTP 503 Service Unavailable with a friendly message. In the React UI, the modal displays a graceful error alert and a "Retry Analysis" button without breaking the dashboard.

### 14. What happens if a customer has no order history?
**Answer**: Features like `days_since_last_order`, `average_order_value`, and `preferred_order_category` are safely passed as `null`/`None`. The preprocessing pipeline imputes median values for numerics and applies `"Unknown"` category encoding, allowing the model to evaluate new customers based on browsing and tenure signals.

### 15. How would you deploy this system in production?
**Answer**: Containerize Express and FastAPI using Docker. Deploy Express on an autoscaling Node cluster behind an Nginx reverse proxy / Cloudflare CDN. Deploy FastAPI on a containerized service (e.g., AWS ECS or Google Cloud Run). Use MongoDB Atlas with read replicas for analytics queries, and Redis for caching frequent prediction results.

### 16. How would you improve the model in the future?
**Answer**: Incorporate search query NLP semantics, discount sensitivity indices, return/refund rates, and customer support ticket sentiment. Explore temporal sequence models (e.g., Temporal Fusion Transformers or LSTM-based event encoders) alongside gradient boosting.

### 17. What are the limitations of the current model?
**Answer**: Point-in-time tabular features aggregate event counts over fixed 30-day windows, which may compress high-frequency sub-day event dynamics. Cold-start customers with zero tenure require heuristic default baselines until initial activity is recorded.

### 18. How would you monitor model drift?
**Answer**: Track population stability index (PSI) and Wasserstein distance on input feature distributions over time. Monitor monthly actual churn rates against predicted risk bands to detect concept drift and trigger automated retraining pipelines.

### 19. How would you handle class imbalance?
**Answer**: The dataset has a 30.62% churn rate. In Phase 3, I configured `scale_pos_weight = 2.2654` inside XGBoost, which balances the gradient updates between minority and majority classes, ensuring high recall on churners without sacrificing precision.

### 20. How would you scale predictions to millions of users?
**Answer**: Decouple real-time on-demand scoring from scheduled offline batch inference. Use Celery / Apache Kafka with Ray or Spark workers to run nightly batch scoring across millions of user accounts, persisting risk scores to a fast read-optimized key-value store (e.g., DynamoDB/Redis) for instant dashboard retrieval.
