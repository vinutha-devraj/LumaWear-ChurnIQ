# 🎬 Phase 11 Demo Guide — ML Model Monitoring & Health

This guide provides a crisp, confident 3–5 minute live presentation script for demonstrating **Phase 11: ML Model Monitoring, Data Drift & Prediction Health**.

---

## ⏱️ Live Demo Walkthrough (Step-by-Step)

| Step | Action & UI View | Speaking Script |
| :--- | :--- | :--- |
| **1. Introduction** | Navigate to `/admin` dashboard | *"In production machine learning, deploying a model is just step one. Today I will show our **ML Model Health & Monitoring Dashboard**, which provides real-time MLOps observability into model health, microservice latency, data quality, and statistical data drift."* |
| **2. Navigate to Model Health** | Click on the **'🩺 Model Health'** navigation tab | *"Here in the Model Health dashboard, store administrators can immediately see the verified status of our active XGBoost artifact (`2b2147fd4057`), our 5-fold cross-validated ROC-AUC of 0.837, and our verified 21-feature contract."* |
| **3. Infrastructure Latency Probes** | Point to the **Microservice Latency & Probes** grid | *"We run live latency probes across our dual-service architecture: our Express gateway (:4000) at 1ms, our FastAPI XGBoost inference engine (:8000) responding in 14ms, and our MongoDB database (:27017) at 2ms—all showing green healthy status."* |
| **4. Live Operational Alerts** | Highlight the **Live Alerts Banner** | *"Our automated rules engine evaluates latency and quality measurements in real time, confirming that all 21 raw features have zero schema violations and inference latency is well within our 250ms SLA."* |
| **5. Prediction Health & Histogram** | Point to the **Prediction Calibration & Histogram** section | *"Our prediction health section displays the live distribution of churn probabilities across our active customer portfolio—including our mean probability (38.4%), success rate (100%), and a 10-bucket probability histogram from 0.0 to 1.0."* |
| **6. Data Drift & PSI Monitor** | Click the **'📈 Data Drift & PSI Monitor'** sub-tab | *"In the Data Drift console, we compute the **Population Stability Index (PSI)** for all 21 behavioral features against our 7,912 training records. We clearly define thresholds: PSI < 0.10 is Stable, 0.10 to 0.25 is Warning, and >= 0.25 is Drift Detected."* |
| **7. Explain Drift Concept** | Highlight the **Drift Disclaimer Box** | *"Notice our prominent disclaimer: **'Drift indicates that the distribution of incoming customer data has changed relative to the reference distribution. It does not by itself prove that model performance has degraded.'** This is critical for executive communication."* |
| **8. Data Quality Completeness** | Click the **'🔬 21-Feature Data Quality'** sub-tab | *"Finally, our Data Quality table monitors feature missingness, minimums, means, medians, and maximums across all 21 inputs—verifying that sparse or zero-order accounts are handled cleanly without pipeline crashes."* |

---

## 🏆 Key Interview Talking Points

1. **Why PSI is Ideal for MLOps**: Population Stability Index provides a single bounded metric comparing binned reference and actual distributions without requiring ground truth labels.
2. **Lightweight Computation-on-Read**: We implemented on-demand health diagnostics without bloating local infrastructure with heavyweight external tools like Kafka, Celery, or Prometheus.
3. **Immutability & Safety**: Monitoring queries are strictly read-only and never mutate customer data, order history, or ML model weights.
