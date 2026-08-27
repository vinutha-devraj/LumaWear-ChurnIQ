# LumaWear ChurnIQ — Project Architecture & System Design

## 1. Executive Summary

LumaWear ChurnIQ is an end-to-end Machine Learning intelligence platform integrated directly into a production-grade MERN e-commerce storefront. It continuously assesses customer churn risk across a 90-day horizon, explains predictions using SHAP (SHapley Additive exPlanations), and generates personalized e-commerce retention actions.

---

## 2. End-to-End System Topology

```mermaid
graph TD
    subgraph ClientLayer [Storefront & Admin UI]
        AdminUI[React 18 Admin Dashboard /admin]
        StoreUI[LumaWear React Storefront]
        PortfolioUI[Portfolio Risk Analytics & Distribution]
        ImpactUI[Business Impact & Revenue-at-Risk Console]
        RetentionUI[Retention Action Center & Workspace]
        CampaignsUI[Campaign History & State Transitions]
        Customer360UI[Customer 360° Intelligence Modal]
        HealthUI[ML Model Health & Drift Dashboard]
        EffectivenessUI[Retention Effectiveness & Experiment Analytics]
        DrillDownModal[ChurnPredictionModal / Single Customer]
        RiskMovementModalUI[Risk Movement & Snapshot Timeline Modal]
        DemoToggleUI[Live vs. Demo Simulation Mode Switch]
    end

    subgraph ExpressGateway [LumaWear Node/Express Backend :4000]
        AuthMW[JWT Auth & RBAC Middleware]
        EcomAPI[Storefront REST Endpoints]
        SingleProxy[GET /api/churn/predict/:userId]
        PortfolioProxy[GET /api/churn/portfolio-summary ?mode=demo]
        ImpactProxy[GET /api/churn/business-impact ?mode=demo]
        C360Proxy[GET /api/churn/customer-360/:userId]
        HealthProxy[GET /api/churn/model-health]
        EffectivenessProxy[GET /api/churn/campaign-effectiveness]
        RiskMovementProxy[GET /api/churn/risk-movement/:userId]
        RetentionProxy[GET /api/churn/retention-opportunities]
        CampaignAPI[POST, GET, PATCH /api/churn/campaigns]
        BulkExtractor[Bulk O(1) MongoDB Feature Extractor]
        DemoStore[Isolated Synthetic Demo Personas - demoData.js]
        C360Synthesizer[Customer 360 Journey & Telemetry Synthesizer]
        ImpactEngine[Revenue-at-Risk Aggregation Engine]
        DriftEngine[Population Stability Index PSI Engine]
        TrajectoryEngine[Longitudinal Risk Movement Engine]
        ClusterEngine[Action Cluster Synthesis Engine]
        Aggregator[Portfolio Risk & SHAP Aggregator]
    end

    subgraph DataStorage [MongoDB Storage :27017]
        UsersColl[(Users Collection - Read-only)]
        OrdersColl[(Orders Collection - Read-only)]
        ActivitiesColl[(Activities Collection - Read-only)]
        CampaignsColl[(Campaigns Collection - Read-only)]
        SnapshotColl[(churn_prediction_snapshots - Isolated History)]
    end

    subgraph MLEngine [ChurnIQ Python FastAPI Engine :8000]
        FastAPIApp[FastAPI REST Application]
        BatchPredict[POST /predict/batch]
        SinglePredict[POST /predict/live-customer]
        XGBModel[XGBoost Pipeline 2b2147fd4057]
        SHAPEngine[TreeExplainer SHAP Engine]
        Recommender[Retention Action Generator]
    end

    DemoToggleUI -->|mode=demo| PortfolioProxy
    PortfolioProxy --> DemoStore
    DemoStore -.->|Zero DB Mutation| DataStorage
    PortfolioProxy --> BatchPredict

    EffectivenessUI --> EffectivenessProxy
    RiskMovementModalUI --> RiskMovementProxy
    RiskMovementProxy --> SnapshotColl

    HealthUI --> HealthProxy
    ImpactUI --> ImpactProxy
    Customer360UI --> C360Proxy
    RetentionUI --> RetentionProxy
    PortfolioUI --> PortfolioProxy
    AdminUI --> SingleProxy
    CampaignsUI --> CampaignAPI
```

---

## 3. Core Subsystems

### A. E-Commerce Backend (Node.js / Express :4000)
- **Storefront & Admin REST Gateway**: Serves product catalog, manages carts/orders, handles JWT sessions with refresh cookie rotation, and records point-in-time activities (`page_view`, `product_view`, `cart_add`, `wishlist_toggle`, `order_placed`).
- **Feature Extraction (`src/churn/features.js`)**: Computes 21 point-in-time features strictly using historical events up to the cutoff timestamp.
- **Bulk Extraction Engine**: Executes batched `$in: userIds` queries to extract features for the entire customer portfolio in $O(1)$ database query roundtrips.
- **Demo / Simulation Engine (`src/churn/demoData.js`)**: In-memory synthetic persona manager providing 12 calibrated customer feature dictionaries that naturally score across all 4 risk tiers (`Low`, `Medium`, `High`, `Very High`) through the production XGBoost model without mutating MongoDB records.
- **Model Health & MLOps Engine (`GET /api/churn/model-health`)**: Performs real-time metadata verification, latency probes across microservices, 21-feature quality analysis, Population Stability Index (PSI) drift tracking, and prediction distribution calibration.
- **Retention Effectiveness Engine (`GET /api/churn/campaign-effectiveness` & `GET /api/churn/risk-movement/:userId`)**: Tracks observational risk changes across targeted campaign cohorts, manages `churn_prediction_snapshots`, and powers Before vs. After risk trajectory comparisons.
- **Business Impact Analytics Engine (`GET /api/churn/business-impact`)**: Aggregates continuous probabilities and historical spend to quantify revenue at risk ($\sum \text{spend}_i \times P(\text{churn}_i)$) across risk tiers and ranks top at-risk customer value.
- **Customer 360° Intelligence Engine (`GET /api/churn/customer-360/:userId`)**: Synthesizes read-only customer profiles, chronological journey milestones, 21-feature telemetry, historical orders, activity logs, and targeted campaign context.
- **Portfolio Summary Proxy (`GET /api/churn/portfolio-summary`)**: Aggregates continuous probabilities, 4-tier risk distributions, systemic SHAP drivers, and priority retention action clusters.
- **Retention Opportunity Engine (`GET /api/churn/retention-opportunities`)**: Maps customer risk signals and recommendation items into 7 action clusters (Cart Abandonment, Inactivity, Wishlist, etc.).
- **Campaign Management & Lifecycle API (`/api/churn/campaigns`)**: Handles creation, validation against MongoDB users, retrieval, and status transitions (`PLANNED` $\rightarrow$ `SENT` $\rightarrow$ `COMPLETED` / `CANCELLED`). Blocks synthetic demo IDs.

### B. Machine Learning Engine (Python / FastAPI :8000)
- **Active Model Pipeline**: High-throughput microservice loading serialized XGBoost pipeline (`artifacts/2b2147fd4057`).
- **Batch Inference (`POST /predict/batch`)**: Vectorized matrix scoring over customer feature DataFrames with parallel TreeExplainer SHAP evaluations and deterministic retention heuristics.
- **Single-Customer Scoring (`POST /predict/live-customer`)**: Point-in-time feature resolution and inference for individual customer drill-downs.

### C. Admin Dashboard (React 18 / TailwindCSS)
- **Mode Toggle**: Seamlessly switches between `🟢 Live Production Data` and `🧪 Demo Simulation Mode` with 4-tier risk visualization.
- **Top-Level Navigation (Exact 5 Tabs)**:
  1. `📊 Churn Risk Analytics`: Portfolio-wide risk metrics, interactive risk distribution meter, top aggregated SHAP drivers, fast customer lookup, and Live/Demo mode toggle.
  2. `🎯 Retention & Campaign History`: Unified hub featuring Section A (Retention Action clusters, targeting workspace, message preview, and staging modal) and Section B (Campaign History ledger, status filtering, and lifecycle state transitions).
  3. `👥 Customer Accounts & Activity`: Registered storefront accounts and live behavioral event stream with 360° and instant scoring triggers.
  4. `🩺 Model Health`: Active model status (`2b2147fd4057`), infrastructure health probes, 21-feature quality analysis, Population Stability Index (PSI) drift monitor, prediction calibration histogram, and operational alerts.
  5. `📈 Results`: Real longitudinal Before vs. After results engine comparing preserved campaign baseline snapshots against live MongoDB customer telemetry scored via active XGBoost, complete with percentage point risk change calculations, risk tier transitions, and mandatory observational non-causal disclaimer.
- **Customer 360° Intelligence Modal (`Customer360Modal`)**: Comprehensive CRM profile, chronological journey milestones, 21-feature telemetry, order history, activity stream, and campaign context.
- **Interactive Drill-Down**: Instant modal launch (`ChurnPredictionModal`, `RiskMovementModal`) for customer-level investigation across all views.

---

## 4. Security & Isolation Model

1. **Proxy Architecture**: The React client NEVER communicates directly with the Python FastAPI port 8000. All inference, results, impact, 360, monitoring, and campaign calls route through authenticated Express proxies.
2. **Role-Based Access Control**: Only authenticated users with `role: "admin"` can access analytics, scoring, customer 360, model monitoring, and campaign management.
3. **Database Isolation**: Customer accounts (`users`), `orders`, and `activities` collections are strictly read-only during analytics, 360, and monitoring workflows. Campaigns are stored in an isolated `campaigns` collection, and longitudinal snapshots are written exclusively to `churn_prediction_snapshots`. Demo personas reside in memory and are never written to production MongoDB collections.
4. **Zero Synthetic Leakage**: Live predictions extract data directly from MongoDB documents through authenticated service calls, never from synthetic CSV caches.
5. **Simulation Mode**: Staged campaigns and templates are simulation-only; no customer-facing emails, SMS, or coupons are dispatched. Demo customer accounts (`DEMO-*`) are strictly blocked from campaign persistence.




