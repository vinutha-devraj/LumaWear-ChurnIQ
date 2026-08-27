import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

export default function ModelHealthDashboard() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab controls for sub-views
  const [activeSection, setActiveSection] = useState("overview"); // "overview" | "drift" | "quality" | "infra"
  const [driftCategoryFilter, setDriftCategoryFilter] = useState("ALL");
  const [qualitySearchQuery, setQualitySearchQuery] = useState("");

  const fetchModelHealth = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await api("/churn/model-health");
      if (res?.success) {
        setData(res);
      } else {
        throw new Error(res?.message || "Failed to load ML model health diagnostics.");
      }
    } catch (err) {
      setError(err.message || "Model health monitoring service is temporarily offline.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchModelHealth();
  }, []);

  const model = data?.model || {
    activeModelId: "2b2147fd4057",
    algorithm: "XGBoost Classifier + TreeSHAP",
    datasetName: "LumaWear E-Commerce (7,912 training snapshots)",
    trainingRows: 7912,
    rawFeatureCount: 21,
    transformedFeatureCount: 29,
    cvRocAuc: 0.837,
    cvRocAucStd: 0.0108,
    trainRocAuc: 0.9736,
    churnRate: 30.62,
    artifactIntegrity: { pipeline: true, shapExplainer: true, schema: true, featureOrder: true, metadata: true },
  };

  const infra = data?.infrastructure || {
    express: { status: "HEALTHY", latencyMs: 1 },
    fastapi: { status: "HEALTHY", latencyMs: 14 },
    mongodb: { status: "HEALTHY", latencyMs: 2 },
  };

  const latency = data?.latency || {
    featureExtractionLatencyMs: 0,
    batchInferenceLatencyMs: 0,
    totalAnalyticsLatencyMs: 0,
    latencyAssessment: "Optimal",
  };

  const pred = data?.predictionHealth || {
    totalPredictions: 0,
    successfulPredictions: 0,
    failedPredictions: 0,
    successRate: 100,
    averageProbability: 0,
    medianProbability: 0,
    riskTiers: { low: 0, medium: 0, high: 0, veryHigh: 0 },
    distributionHistogram: [],
  };

  const quality = data?.dataQuality || {
    customersScanned: 0,
    customersScored: 0,
    sparseCustomerCount: 0,
    zeroOrderCustomerCount: 0,
    zeroActivityCustomerCount: 0,
    featureQuality: [],
  };

  const drift = data?.drift || {
    summary: { stableFeatureCount: 21, warningFeatureCount: 0, driftedFeatureCount: 0, totalFeaturesEvaluated: 21 },
    features: [],
    disclaimer: "",
  };

  const alerts = data?.alerts || [];

  // Filtered Drift Features
  const filteredDriftFeatures = useMemo(() => {
    if (!drift.features) return [];
    if (driftCategoryFilter === "ALL") return drift.features;
    return drift.features.filter((f) => f.category?.toUpperCase() === driftCategoryFilter);
  }, [drift.features, driftCategoryFilter]);

  // Filtered Data Quality Features
  const filteredQualityFeatures = useMemo(() => {
    if (!quality.featureQuality) return [];
    if (!qualitySearchQuery.trim()) return quality.featureQuality;
    const q = qualitySearchQuery.toLowerCase().trim();
    return quality.featureQuality.filter(
      (f) => f.feature?.toLowerCase().includes(q) || f.label?.toLowerCase().includes(q)
    );
  }, [quality.featureQuality, qualitySearchQuery]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "HEALTHY":
      case "Stable":
      case "Optimal":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Warning":
      case "DEGRADED":
      case "Acceptable":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "OFFLINE":
      case "Drift Detected":
      case "Elevated Missing":
      default:
        return "bg-rose-100 text-rose-800 border-rose-200";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🩺</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-xl text-stone-900">ML Model Health & Monitoring</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Model: {model.activeModelId}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Real-time MLOps diagnostics: population stability (PSI), feature quality, prediction distributions, and infrastructure latency probes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchModelHealth(true)}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-[#FAF8F5] border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors shadow-sm disabled:opacity-50"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            <span>{isRefreshing ? "Probing..." : "Refresh Telemetry"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => fetchModelHealth()} className="underline font-semibold hover:text-rose-900">
            Retry Diagnostics
          </button>
        </div>
      )}

      {/* Live Alerts Banner */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs shadow-sm ${
                alert.type === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : alert.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : alert.type === "info"
                  ? "bg-blue-50 border-blue-200 text-blue-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              <span className="text-base shrink-0">
                {alert.type === "error" ? "🚨" : alert.type === "warning" ? "⚠️" : alert.type === "info" ? "ℹ️" : "✅"}
              </span>
              <div>
                <span className="font-bold block">{alert.title}</span>
                <span className="text-[11px] opacity-90 leading-tight block mt-0.5">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
        {[
          { id: "overview", label: "Model Status & Overview", icon: "📊" },
          { id: "drift", label: "Data Drift & PSI Monitor", icon: "📈", count: drift.summary?.driftedFeatureCount },
          { id: "quality", label: "21-Feature Data Quality", icon: "🔬", count: quality.featureQuality?.length },
          { id: "infra", label: "Infrastructure & Latency", icon: "⚡" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeSection === tab.id
                ? "bg-stone-900 text-white shadow-sm"
                : "bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── SECTION 1: OVERVIEW & MODEL STATUS ─────────────────────────── */}
      {activeSection === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Executive Model Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Active Architecture
              </span>
              <span className="text-xl font-serif font-bold text-stone-900 block">{model.algorithm}</span>
              <span className="text-[11px] text-stone-500 mt-1 block">Artifact: {model.activeModelId}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                5-Fold CV ROC-AUC
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-serif font-bold text-emerald-900">{model.cvRocAuc}</span>
                <span className="text-xs text-emerald-700 font-mono">±{model.cvRocAucStd}</span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 block">Train ROC-AUC: {model.trainRocAuc}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Feature Schema Contract
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-bold text-stone-900">{model.rawFeatureCount}</span>
                <span className="text-xs text-stone-600 font-medium">Raw / {model.transformedFeatureCount} Post-OHE</span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 block">20 Numeric • 1 Categorical</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Training Reference Cohort
              </span>
              <span className="text-2xl font-serif font-bold text-stone-900">{model.trainingRows.toLocaleString()}</span>
              <span className="text-[11px] text-stone-500 mt-1 block">Baseline Churn: {model.churnRate}%</span>
            </div>
          </div>

          {/* Infrastructure Health Quick-Grid */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-serif font-bold text-base text-stone-900">Microservice Latency & Availability Probes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌐</span>
                  <div>
                    <span className="font-semibold text-xs text-stone-900 block">Express Gateway (:4000)</span>
                    <span className="text-[11px] text-stone-500">JWT Auth & REST Proxy</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(infra.express.status)}`}>
                    {infra.express.status}
                  </span>
                  <span className="text-[11px] font-mono text-stone-600 block mt-1">{infra.express.latencyMs}ms</span>
                </div>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <span className="font-semibold text-xs text-stone-900 block">FastAPI Inference (:8000)</span>
                    <span className="text-[11px] text-stone-500">XGBoost & TreeSHAP Engine</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(infra.fastapi.status)}`}>
                    {infra.fastapi.status}
                  </span>
                  <span className="text-[11px] font-mono text-stone-600 block mt-1">{infra.fastapi.latencyMs}ms</span>
                </div>
              </div>

              <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🍃</span>
                  <div>
                    <span className="font-semibold text-xs text-stone-900 block">MongoDB Store (:27017)</span>
                    <span className="text-[11px] text-stone-500">Read-Only Telemetry Store</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(infra.mongodb.status)}`}>
                    {infra.mongodb.status}
                  </span>
                  <span className="text-[11px] font-mono text-stone-600 block mt-1">{infra.mongodb.latencyMs}ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Prediction Health & Probability Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">Live Prediction Health & Calibration</h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Portfolio-wide probability distribution across {pred.successfulPredictions} scored customer records.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-stone-600">
                <span>Mean: {(pred.averageProbability * 100).toFixed(1)}%</span>
                <span>•</span>
                <span>Median: {(pred.medianProbability * 100).toFixed(1)}%</span>
                <span>•</span>
                <span className="font-bold text-emerald-800">Success Rate: {pred.successRate}%</span>
              </div>
            </div>

            {/* 10-Bucket Probability Histogram */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                <span>Probability Histogram (0.0 to 1.0)</span>
                <span>Live Portfolio Concentration</span>
              </div>
              <div className="grid grid-cols-10 gap-1.5 h-20 items-end bg-[#FAF8F5] p-3 rounded-xl border border-stone-200">
                {pred.distributionHistogram.map((bucket, idx) => {
                  const maxCount = Math.max(...pred.distributionHistogram.map((b) => b.count), 1);
                  const heightPct = Math.max(8, (bucket.count / maxCount) * 100);
                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t transition-all ${
                          idx < 3
                            ? "bg-emerald-500 group-hover:bg-emerald-600"
                            : idx < 5
                            ? "bg-amber-500 group-hover:bg-amber-600"
                            : idx < 7
                            ? "bg-orange-500 group-hover:bg-orange-600"
                            : "bg-rose-500 group-hover:bg-rose-600"
                        }`}
                      />
                      <span className="text-[9px] font-mono text-stone-500 mt-1">{bucket.range.split("–")[0]}</span>

                      {/* Tooltip */}
                      <div className="absolute -top-8 hidden group-hover:flex px-2 py-1 bg-stone-900 text-white text-[10px] rounded shadow-lg whitespace-nowrap z-10 font-mono">
                        {bucket.range}: {bucket.count} ({bucket.percentage}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 2: DATA DRIFT & PSI MONITOR ─────────────────────────── */}
      {activeSection === "drift" && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-lg text-stone-900">Population Stability Index (PSI) Drift Monitor</h3>
                <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-bold">
                  21 Features Evaluated
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Comparing live MongoDB feature distributions against the 7,912-row training reference baseline.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={driftCategoryFilter}
                onChange={(e) => setDriftCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <option value="ALL">All Feature Categories</option>
                <option value="ENGAGEMENT">Engagement Signals</option>
                <option value="PURCHASING">Purchasing Telemetry</option>
                <option value="PROFILE">Customer Profile</option>
              </select>
            </div>
          </div>

          {/* Drift Disclaimer Box */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
            <span className="text-base shrink-0 mt-0.5">ℹ️</span>
            <div>
              <span className="font-bold uppercase tracking-wider block text-[11px]">Monitoring Signal Interpretation</span>
              <p className="mt-0.5 leading-relaxed">
                {drift.disclaimer ||
                  "Drift indicates that the distribution of incoming customer data has changed relative to the reference distribution. It does not by itself prove that model performance has degraded."}
              </p>
            </div>
          </div>

          {/* Drift Summary Cards */}
          <div className="grid grid-cols-3 gap-3.5">
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Stable Features</span>
                <span className="text-2xl font-serif font-bold text-emerald-950">{drift.summary.stableFeatureCount}</span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">PSI &lt; 0.10</span>
              </div>
              <span className="text-3xl">🛡️</span>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Warning Shift</span>
                <span className="text-2xl font-serif font-bold text-amber-950">{drift.summary.warningFeatureCount}</span>
                <span className="text-[10px] text-amber-700 block mt-0.5">0.10 &le; PSI &lt; 0.25</span>
              </div>
              <span className="text-3xl">⚠️</span>
            </div>

            <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Drift Detected</span>
                <span className="text-2xl font-serif font-bold text-rose-950">{drift.summary.driftedFeatureCount}</span>
                <span className="text-[10px] text-rose-700 block mt-0.5">PSI &ge; 0.25</span>
              </div>
              <span className="text-3xl">🚨</span>
            </div>
          </div>

          {/* Drift Features Table */}
          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Feature</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Training Baseline</th>
                  <th className="py-3 px-4">Live Mean</th>
                  <th className="py-3 px-4">Drift Score (PSI)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredDriftFeatures.map((f) => (
                  <tr key={f.feature} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-stone-900 block">{f.label}</span>
                      <span className="font-mono text-[10px] text-stone-400 block">{f.feature}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 capitalize">
                        {f.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-700">
                      {f.referenceMean !== null ? `${f.referenceMean} ± ${f.referenceStd}` : "Categorical"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {f.currentMean !== null ? f.currentMean : "Categorical"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                        {f.driftScore?.toFixed(4)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-600 text-[11px]">{f.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SECTION 3: 21-FEATURE DATA QUALITY & COMPLETENESS ─────────── */}
      {activeSection === "quality" && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">21-Feature Telemetry Completeness</h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Evaluates missingness, outliers, and numerical ranges across {quality.customersScanned} active accounts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search features..."
                value={qualitySearchQuery}
                onChange={(e) => setQualitySearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
              <span className="text-[11px] font-bold text-stone-500 uppercase block mb-1">Sparse Customer Profiles</span>
              <span className="text-2xl font-serif font-bold text-stone-900">{quality.sparseCustomerCount}</span>
              <span className="text-[10px] text-stone-500 block mt-0.5">0 orders & &le; 1 event</span>
            </div>
            <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
              <span className="text-[11px] font-bold text-stone-500 uppercase block mb-1">Zero-Order Accounts</span>
              <span className="text-2xl font-serif font-bold text-stone-900">{quality.zeroOrderCustomerCount}</span>
              <span className="text-[10px] text-stone-500 block mt-0.5">Prospect accounts</span>
            </div>
            <div className="p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
              <span className="text-[11px] font-bold text-stone-500 uppercase block mb-1">Zero-Activity Accounts</span>
              <span className="text-2xl font-serif font-bold text-stone-900">{quality.zeroActivityCustomerCount}</span>
              <span className="text-[10px] text-stone-500 block mt-0.5">Dormant registrations</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Feature</th>
                  <th className="py-3 px-4">Missing %</th>
                  <th className="py-3 px-4">Min</th>
                  <th className="py-3 px-4">Median</th>
                  <th className="py-3 px-4">Mean</th>
                  <th className="py-3 px-4">Max</th>
                  <th className="py-3 px-4">Quality Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredQualityFeatures.map((f) => (
                  <tr key={f.feature} className="hover:bg-stone-50">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-stone-900 block">{f.label}</span>
                      <span className="font-mono text-[10px] text-stone-400 block">{f.feature}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">{f.missingPercentage}%</td>
                    <td className="py-3 px-4 font-mono text-stone-700">{f.min !== null ? f.min : "—"}</td>
                    <td className="py-3 px-4 font-mono text-stone-700">{f.median !== null ? f.median : "—"}</td>
                    <td className="py-3 px-4 font-mono text-stone-700">{f.mean !== null ? f.mean : "—"}</td>
                    <td className="py-3 px-4 font-mono text-stone-700">{f.max !== null ? f.max : "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SECTION 4: INFRASTRUCTURE & LATENCY ─────────────────────────── */}
      {activeSection === "infra" && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6 animate-fade-in">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-900">Infrastructure Latency & Health Probes</h3>
            <p className="text-xs text-stone-600 mt-0.5">
              Probe diagnostics for dual-service architecture (Express :4000 gateway and FastAPI :8000 inference).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-[#FAF8F5] border border-stone-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-stone-900">Feature Extraction Latency</span>
                <span className="text-xl">🍃</span>
              </div>
              <div className="text-3xl font-serif font-bold text-stone-900">{latency.featureExtractionLatencyMs}ms</div>
              <p className="text-[11px] text-stone-600">
                Bulk MongoDB aggregation for {quality.customersScanned} users using $in: userIds indexing.
              </p>
            </div>

            <div className="p-5 bg-[#FAF8F5] border border-stone-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-stone-900">Batch Inference Latency</span>
                <span className="text-xl">⚡</span>
              </div>
              <div className="text-3xl font-serif font-bold text-stone-900">{latency.batchInferenceLatencyMs}ms</div>
              <p className="text-[11px] text-stone-600">
                Vectorized C-level matrix scoring via FastAPI POST /predict/batch.
              </p>
            </div>

            <div className="p-5 bg-[#FAF8F5] border border-stone-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-bold text-sm text-stone-900">Total Analytics Roundtrip</span>
                <span className="text-xl">⏱️</span>
              </div>
              <div className="text-3xl font-serif font-bold text-emerald-900">{latency.totalAnalyticsLatencyMs}ms</div>
              <p className="text-[11px] text-emerald-800 font-semibold">
                Status: {latency.latencyAssessment}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
