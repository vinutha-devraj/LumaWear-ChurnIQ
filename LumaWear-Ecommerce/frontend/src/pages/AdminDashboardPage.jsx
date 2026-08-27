import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import ChurnPredictionModal from "../components/ChurnPredictionModal";
import RetentionAndCampaignsView from "../components/RetentionAndCampaignsView";
import ModelHealthDashboard from "../components/ModelHealthDashboard";
import ResultsDashboard from "../components/ResultsDashboard";
import Customer360Modal from "../components/Customer360Modal";
import CampaignPreviewModal from "../components/CampaignPreviewModal";
import RiskCategoryCustomerModal from "../components/RiskCategoryCustomerModal";

export default function AdminDashboardPage() {
  const { api } = useAuth();

  // Navigation tab state: Exactly 5 tabs
  // "analytics" | "retention_campaigns" | "store_data" | "model_health" | "results"
  const [activeTab, setActiveTab] = useState("analytics");

  // Basic admin state
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [adminError, setAdminError] = useState("");

  // Portfolio Churn Analytics state
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick lookup & modal drill-down states
  const [selectedUserForChurn, setSelectedUserForChurn] = useState(null);
  const [selectedUserFor360, setSelectedUserFor360] = useState(null);
  const [selectedRiskTierForModal, setSelectedRiskTierForModal] = useState(null);
  const [stagedCampaignTarget, setStagedCampaignTarget] = useState(null);
  const [manualUserId, setManualUserId] = useState("");
  const [selectedRiskTierFilter, setSelectedRiskTierFilter] = useState("all");

  // Fetch basic admin data
  useEffect(() => {
    Promise.all([api("/admin/users"), api("/admin/activity?limit=25")])
      .then(([{ users: accounts }, { activities: recentActivity }]) => {
        setUsers(accounts || []);
        setActivities(recentActivity || []);
      })
      .catch((err) => setAdminError(err.message || "Failed to load admin account roster."));
  }, []);

  // Fetch Portfolio Churn Analytics
  const fetchPortfolioData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setPortfolioLoading(true);
    setPortfolioError("");

    try {
      const url = isDemoMode ? "/churn/portfolio-summary?mode=demo" : "/churn/portfolio-summary";
      const data = await api(url);
      if (data?.success) {
        setPortfolioData(data);
      } else {
        throw new Error(data?.message || "Failed to load portfolio analytics.");
      }
    } catch (err) {
      setPortfolioError(err.message || "Churn prediction service is temporarily unavailable.");
    } finally {
      setPortfolioLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, [isDemoMode]);

  // Quick Churn Risk Lookup Form
  const handleManualSearch = (e) => {
    e.preventDefault();
    const query = manualUserId.trim();
    if (!query) return;

    const match = users.find(
      (u) =>
        u.id?.toLowerCase() === query.toLowerCase() ||
        u.email?.toLowerCase() === query.toLowerCase() ||
        u._id?.toString()?.toLowerCase() === query.toLowerCase()
    );

    if (match) {
      setSelectedUserForChurn(match);
    } else {
      setSelectedUserForChurn({ id: query, name: `Customer ${query}`, email: query });
    }
  };

  const handleOpenChurnModalForUserId = (userId) => {
    const match = users.find(
      (u) =>
        u.id?.toLowerCase() === String(userId)?.toLowerCase() ||
        u._id?.toString()?.toLowerCase() === String(userId)?.toLowerCase() ||
        u.email?.toLowerCase() === String(userId)?.toLowerCase()
    );
    if (match) {
      setSelectedUserForChurn(match);
    } else {
      setSelectedUserForChurn({ id: String(userId), name: `Customer ${userId}`, email: "" });
    }
  };

  const summary = portfolioData?.summary || {
    total_customers: 0,
    scored_customers: 0,
    failed_customers: 0,
    average_churn_probability: 0,
    high_risk_count: 0,
    high_risk_percentage: 0,
  };

  const riskDist = portfolioData?.risk_distribution || {
    low: { count: 0, percentage: 0, color: "emerald", label: "Low Risk (< 25%)" },
    medium: { count: 0, percentage: 0, color: "amber", label: "Medium Risk (25-50%)" },
    high: { count: 0, percentage: 0, color: "orange", label: "High Risk (50-75%)" },
    very_high: { count: 0, percentage: 0, color: "rose", label: "Very High Risk (> 75%)" },
  };

  const topDrivers = portfolioData?.top_drivers || [];
  const maxDriverShap = Math.max(...topDrivers.map((d) => d.average_absolute_shap || 0), 0.001);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Top Header & Fast Lookup */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sand pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-charcoal">Admin Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-white px-3 py-1 text-xs font-medium text-charcoal shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live MongoDB + XGBoost (2b2147fd4057)
            </span>
          </div>
          <p className="mt-1 text-sm text-charcoal/70">
            Portfolio-wide customer churn intelligence, targeted retention campaigns, and observed longitudinal results.
          </p>
        </div>

        {/* Action Controls & Fast Lookup */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fetchPortfolioData(true)}
            disabled={portfolioLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sand bg-white px-3 py-1.5 text-xs font-medium text-charcoal shadow-sm transition hover:bg-sand/30 disabled:opacity-50"
            title="Recompute portfolio analytics from live MongoDB records"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            <span>{isRefreshing ? "Refreshing..." : "Refresh Portfolio"}</span>
          </button>

          <form onSubmit={handleManualSearch} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter Customer ID or Email..."
              value={manualUserId}
              onChange={(e) => setManualUserId(e.target.value)}
              className="w-56 rounded-lg border border-sand bg-white px-3 py-1.5 text-xs text-charcoal shadow-sm focus-ring"
            />
            <button
              type="submit"
              className="rounded-lg border border-charcoal bg-charcoal px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-ink"
            >
              🔍 Inspect
            </button>
          </form>
        </div>
      </div>

      {/* Global Database Errors if any */}
      {adminError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <strong>Database Notice:</strong> {adminError}
        </div>
      )}

      {/* ─── EXACT 5 TOP-LEVEL NAVIGATION TABS ────────────────────────────── */}
      <div className="mt-6 flex items-center gap-2 border-b border-sand pb-3 overflow-x-auto">
        {/* Tab 1: 📊 Churn Risk Analytics */}
        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "analytics"
              ? "bg-charcoal text-white shadow-sm"
              : "bg-white text-charcoal/70 border border-sand hover:bg-sand/30"
          }`}
        >
          <span>📊</span>
          <span>Churn Risk Analytics</span>
        </button>

        {/* Tab 2: 🎯 Retention & Campaign History (Merged) */}
        <button
          type="button"
          onClick={() => setActiveTab("retention_campaigns")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "retention_campaigns"
              ? "bg-charcoal text-white shadow-sm"
              : "bg-white text-charcoal/70 border border-sand hover:bg-sand/30"
          }`}
        >
          <span>🎯</span>
          <span>Retention &amp; Campaign History</span>
        </button>

        {/* Tab 3: 👥 Customer Accounts & Activity */}
        <button
          type="button"
          onClick={() => setActiveTab("store_data")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "store_data"
              ? "bg-charcoal text-white shadow-sm"
              : "bg-white text-charcoal/70 border border-sand hover:bg-sand/30"
          }`}
        >
          <span>👥</span>
          <span>Customer Accounts &amp; Activity</span>
        </button>

        {/* Tab 4: 🩺 Model Health */}
        <button
          type="button"
          onClick={() => setActiveTab("model_health")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "model_health"
              ? "bg-charcoal text-white shadow-sm"
              : "bg-white text-charcoal/70 border border-sand hover:bg-sand/30"
          }`}
        >
          <span>🩺</span>
          <span>Model Health</span>
          <span className="bg-purple-400/20 text-purple-900 text-[10px] px-1.5 py-0.5 rounded-md font-bold">MLOps</span>
        </button>

        {/* Tab 5: 📈 Results */}
        <button
          type="button"
          onClick={() => setActiveTab("results")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "results"
              ? "bg-charcoal text-white shadow-sm"
              : "bg-white text-charcoal/70 border border-sand hover:bg-sand/30"
          }`}
        >
          <span>📈</span>
          <span>Results</span>
          <span className="bg-emerald-400/20 text-emerald-900 text-[10px] px-1.5 py-0.5 rounded-md font-bold">Phase 14</span>
        </button>
      </div>

      {/* ─── TAB 1: CHURN RISK ANALYTICS ────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <>
          {/* Demo Mode Switch & Disclaimer Banner */}
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-sand shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-charcoal">Portfolio Churn Risk Overview</h2>
                  {isDemoMode && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                      🧪 Demo Mode
                    </span>
                  )}
                </div>
                {portfolioData?.generated_at && (
                  <span className="text-xs text-charcoal/60 mt-0.5 block">
                    Evaluated {new Date(portfolioData.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-stone-300">
                  <button
                    type="button"
                    onClick={() => setIsDemoMode(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      !isDemoMode ? "bg-stone-900 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    🟢 Live Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDemoMode(true)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isDemoMode ? "bg-purple-900 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <span>🧪</span>
                    <span>Demo Mode</span>
                    <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">4 Tiers</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => fetchPortfolioData(true)}
                  disabled={portfolioLoading || isRefreshing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-[#FAF8F5] border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors shadow-sm disabled:opacity-50"
                >
                  <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
                  <span>{isRefreshing ? "Scoring..." : "Refresh"}</span>
                </button>
              </div>
            </div>

            {/* Demo Mode Banner */}
            {isDemoMode && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 text-xs flex items-start gap-3 shadow-sm animate-fade-in">
                <span className="text-xl shrink-0 mt-0.5">🧪</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold uppercase tracking-wider text-[11px]">DEMO SIMULATION MODE ACTIVE</span>
                    <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-950 font-mono text-[10px] font-bold">
                      Active Model: 2b2147fd4057
                    </span>
                  </div>
                  <p className="mt-1 leading-relaxed text-[11px] opacity-90">
                    Demo Mode uses synthetic customer profiles processed through the same production feature contract and active XGBoost model. No real customer data is modified.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Portfolio Churn Risk Summary Cards */}
          <div className="mt-6">
            {portfolioLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl2 border border-sand bg-white/70 p-5 shadow-sm"></div>
                ))}
              </div>
            ) : portfolioError ? (
              <div className="rounded-xl2 border border-amber-200 bg-amber-50/80 p-5 text-amber-900 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">⚠️ Portfolio Analytics Service Offline</h3>
                    <p className="mt-1 text-xs text-amber-800">{portfolioError}</p>
                    <p className="mt-2 text-xs text-amber-700">
                      Ensure the FastAPI ChurnIQ engine is active on <code>http://127.0.0.1:8000</code>.
                    </p>
                  </div>
                  <button
                    onClick={() => fetchPortfolioData(true)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm hover:bg-amber-100/50"
                  >
                    Retry Analysis
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Total Customers */}
                <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm transition hover:shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-charcoal/60">Total Customers</span>
                    <span className="text-lg">👥</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-charcoal">{summary.total_customers}</span>
                    <span className="text-xs text-charcoal/60">accounts</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-sand/50 pt-2 text-[11px] text-charcoal/70">
                    <span>{summary.scored_customers} analyzed</span>
                    {summary.failed_customers > 0 ? (
                      <span className="font-medium text-rose-600">{summary.failed_customers} failed</span>
                    ) : (
                      <span className="text-emerald-700">100% scored</span>
                    )}
                  </div>
                </div>

                {/* Card 2: Average Churn Probability */}
                <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm transition hover:shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-charcoal/60">Average Churn Probability</span>
                    <span className="text-lg">📊</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-charcoal">
                      {(summary.average_churn_probability * 100).toFixed(1)}%
                    </span>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        summary.average_churn_probability >= 0.5
                          ? "bg-rose-100 text-rose-800"
                          : summary.average_churn_probability >= 0.25
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {summary.average_churn_probability >= 0.5
                        ? "Elevated"
                        : summary.average_churn_probability >= 0.25
                        ? "Moderate"
                        : "Healthy"}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-sand/50 pt-2 text-[11px] text-charcoal/70">
                    Portfolio mean across continuous probabilities
                  </div>
                </div>

                {/* Card 3: High-Risk Customers */}
                <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm transition hover:shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-charcoal/60">High-Risk Customers</span>
                    <span className="text-lg">🚨</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-rose-600">{summary.high_risk_count}</span>
                    <span className="text-xs text-charcoal/60">requiring action</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-sand/50 pt-2 text-[11px] text-charcoal/70">
                    <span>{riskDist.very_high.count} Very High</span>
                    <span>•</span>
                    <span>{riskDist.high.count} High</span>
                  </div>
                </div>

                {/* Card 4: High-Risk Portfolio Share */}
                <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm transition hover:shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-charcoal/60">High-Risk Share</span>
                    <span className="text-lg">🎯</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-charcoal">{summary.high_risk_percentage}%</span>
                    <span className="text-xs text-charcoal/60">of customer base</span>
                  </div>
                  <div className="mt-3 border-t border-sand/50 pt-2 text-[11px] text-charcoal/70">
                    Combined &ge; 50% churn risk tier
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Portfolio Risk Distribution & Top Churn Drivers */}
          {!portfolioError && portfolioData && (
            <div className="mt-6 grid gap-6 lg:grid-cols-12">
              {/* Portfolio Risk Distribution (5 Cols) */}
              <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm lg:col-span-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-charcoal">Portfolio Risk Distribution</h3>
                      <p className="text-xs text-charcoal/70">4-Tier probability distribution across customer base</p>
                    </div>
                  </div>

                  {/* Stacked Proportional Distribution Bar */}
                  <div className="mt-5 h-5 w-full overflow-hidden rounded-full border border-sand bg-sand/30 flex">
                    <div
                      style={{ width: `${Math.max(riskDist.low.percentage, riskDist.low.count ? 4 : 0)}%` }}
                      className="bg-emerald-500 transition-all duration-500 hover:brightness-110"
                      title={`Low Risk: ${riskDist.low.count} (${riskDist.low.percentage}%)`}
                    ></div>
                    <div
                      style={{ width: `${Math.max(riskDist.medium.percentage, riskDist.medium.count ? 4 : 0)}%` }}
                      className="bg-amber-500 transition-all duration-500 hover:brightness-110"
                      title={`Medium Risk: ${riskDist.medium.count} (${riskDist.medium.percentage}%)`}
                    ></div>
                    <div
                      style={{ width: `${Math.max(riskDist.high.percentage, riskDist.high.count ? 4 : 0)}%` }}
                      className="bg-orange-500 transition-all duration-500 hover:brightness-110"
                      title={`High Risk: ${riskDist.high.count} (${riskDist.high.percentage}%)`}
                    ></div>
                    <div
                      style={{ width: `${Math.max(riskDist.very_high.percentage, riskDist.very_high.count ? 4 : 0)}%` }}
                      className="bg-rose-600 transition-all duration-500 hover:brightness-110"
                      title={`Very High Risk: ${riskDist.very_high.count} (${riskDist.very_high.percentage}%)`}
                    ></div>
                  </div>

                  {/* Risk Tier Tiles (Clickable Customer Cohorts) */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {/* Low Risk */}
                    <button
                      type="button"
                      onClick={() => setSelectedRiskTierForModal("Low")}
                      className="rounded-xl border border-sand/70 bg-cream/30 p-3.5 text-left transition-all hover:bg-emerald-50/70 hover:border-emerald-300 hover:shadow-sm cursor-pointer group"
                      title="Click to view Low Risk customers"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-800">Low Risk</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-emerald-900">{riskDist.low.count}</span>
                        <span className="text-xs text-emerald-700">({riskDist.low.percentage}%)</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-700/80">
                        <span>P &lt; 25% • Stable</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View →</span>
                      </div>
                    </button>

                    {/* Medium Risk */}
                    <button
                      type="button"
                      onClick={() => setSelectedRiskTierForModal("Medium")}
                      className="rounded-xl border border-sand/70 bg-cream/30 p-3.5 text-left transition-all hover:bg-amber-50/70 hover:border-amber-300 hover:shadow-sm cursor-pointer group"
                      title="Click to view Medium Risk customers"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-800">Medium Risk</span>
                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-amber-900">{riskDist.medium.count}</span>
                        <span className="text-xs text-amber-700">({riskDist.medium.percentage}%)</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-amber-700/80">
                        <span>25% &le; P &lt; 50% • Monitor</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View →</span>
                      </div>
                    </button>

                    {/* High Risk */}
                    <button
                      type="button"
                      onClick={() => setSelectedRiskTierForModal("High")}
                      className="rounded-xl border border-sand/70 bg-cream/30 p-3.5 text-left transition-all hover:bg-orange-50/70 hover:border-orange-300 hover:shadow-sm cursor-pointer group"
                      title="Click to view High Risk customers"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-orange-800">High Risk</span>
                        <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-orange-900">{riskDist.high.count}</span>
                        <span className="text-xs text-orange-700">({riskDist.high.percentage}%)</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-orange-700/80">
                        <span>50% &le; P &lt; 75% • Action needed</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View →</span>
                      </div>
                    </button>

                    {/* Very High Risk */}
                    <button
                      type="button"
                      onClick={() => setSelectedRiskTierForModal("Very High")}
                      className="rounded-xl border border-sand/70 bg-cream/30 p-3.5 text-left transition-all hover:bg-rose-50/70 hover:border-rose-300 hover:shadow-sm cursor-pointer group"
                      title="Click to view Very High Risk customers"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-rose-800">Very High Risk</span>
                        <span className="h-2 w-2 rounded-full bg-rose-600"></span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-rose-900">{riskDist.very_high.count}</span>
                        <span className="text-xs text-rose-700">({riskDist.very_high.percentage}%)</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-rose-700/80">
                        <span>P &ge; 75% • Critical</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold">View →</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-sand/50 text-[11px] text-charcoal/60">
                  Target high-risk cohorts through the Retention &amp; Campaign History tab.
                </div>
              </div>

              {/* Top Churn Drivers Across Customers (7 Cols) */}
              <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm lg:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-charcoal">Top Churn Drivers Across Customers</h3>
                      <p className="text-xs text-charcoal/70">
                        Aggregated SHAP attribution values across scored customer base
                      </p>
                    </div>
                    <span className="rounded bg-sand/40 px-2 py-0.5 text-[11px] font-medium text-charcoal/70">
                      SHAP Explainability
                    </span>
                  </div>

                  {topDrivers.length === 0 ? (
                    <p className="mt-6 text-center text-xs text-charcoal/50">No SHAP attribution signals available.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {topDrivers.map((driver, index) => {
                        const pct = Math.min(100, Math.round((driver.average_absolute_shap / maxDriverShap) * 100));
                        const isIncreases = driver.primary_direction === "increases_churn";

                        return (
                          <div
                            key={driver.feature}
                            className="group rounded-lg border border-sand/50 bg-cream/20 p-2.5 transition hover:bg-cream/50"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sand/60 text-[10px] font-bold text-charcoal">
                                  {index + 1}
                                </span>
                                <span className="font-semibold text-charcoal">{driver.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    isIncreases ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {isIncreases ? "Increases Risk" : "Reduces Risk"}
                                </span>
                                <span className="text-charcoal/60">
                                  {driver.customers_affected} customers
                                </span>
                              </div>
                            </div>

                            {/* Impact Bar */}
                            <div className="mt-2 flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand/40">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isIncreases ? "bg-rose-500" : "bg-emerald-500"
                                  }`}
                                ></div>
                              </div>
                              <span className="font-mono text-[11px] font-medium text-charcoal/70">
                                |SHAP| {driver.average_absolute_shap.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Non-causal disclaimer label */}
                <div className="mt-4 border-t border-sand/50 pt-3 text-[11px] text-charcoal/60 italic">
                  ℹ️ {portfolioData.disclaimer || "Aggregated model explanation — reflects statistical feature importance across customer representations, not causal evidence."}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── TAB 2: RETENTION & CAMPAIGN HISTORY (Phase 14 Merged Component) ── */}
      {activeTab === "retention_campaigns" && (
        <div className="mt-6">
          <RetentionAndCampaignsView
            onOpenChurnModal={handleOpenChurnModalForUserId}
            onOpenCustomer360={(uid) => setSelectedUserFor360(uid)}
          />
        </div>
      )}

      {/* ─── TAB 3: REGISTERED CUSTOMERS & RAW SITE ACTIVITY ─────────────────── */}
      {activeTab === "store_data" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Users Roster */}
          <div className="overflow-x-auto rounded-xl2 border border-sand bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-charcoal">All Registered Accounts ({users.length})</h2>
              <span className="rounded bg-sand/40 px-2 py-0.5 text-xs font-medium text-charcoal/70">
                Mongoose Users Collection
              </span>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-sand text-charcoal/70 text-xs font-medium uppercase">
                <tr>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Registered</th>
                  <th className="pb-2 text-right">Inference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand/50">
                {users.slice(0, 10).map((account) => (
                  <tr key={account.id} className="transition hover:bg-cream/40">
                    <td className="py-2.5">
                      <div className="font-medium text-charcoal text-xs">{account.name}</div>
                      <div className="text-[11px] text-charcoal/60">{account.email}</div>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          account.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {account.role}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-charcoal/70">
                      {new Date(account.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUserFor360(account.id || account._id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-sand bg-cream px-2 py-0.5 text-xs font-medium text-charcoal transition hover:border-charcoal/40 hover:bg-sand focus-ring"
                          title="Open Customer 360 profile"
                        >
                          <span>👤</span>
                          <span>360°</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedUserForChurn(account)}
                          className="inline-flex items-center gap-1 rounded-lg border border-sand bg-cream px-2 py-0.5 text-xs font-medium text-charcoal transition hover:border-charcoal/40 hover:bg-sand focus-ring"
                          title="Score Churn Probability"
                        >
                          <span>⚡</span>
                          <span>Score</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length > 10 && (
              <div className="mt-3 text-center text-xs text-charcoal/50">
                Showing first 10 accounts of {users.length} total.
              </div>
            )}
          </div>

          {/* Recent Site Activity */}
          <div className="overflow-x-auto rounded-xl2 border border-sand bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-charcoal">Recent Behavioral Stream ({activities.length})</h2>
              <span className="rounded bg-sand/40 px-2 py-0.5 text-xs font-medium text-charcoal/70">
                Live Activities Collection
              </span>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-sand text-charcoal/70 text-xs font-medium uppercase">
                <tr>
                  <th className="pb-2">Event</th>
                  <th className="pb-2">User</th>
                  <th className="pb-2">Route</th>
                  <th className="pb-2 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand/50">
                {activities.slice(0, 10).map((activity) => (
                  <tr key={activity.id} className="transition hover:bg-cream/40">
                    <td className="py-2.5">
                      <span className="inline-block rounded bg-cream px-2 py-0.5 text-[10px] font-semibold text-charcoal capitalize">
                        {activity.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-charcoal/80">
                      {activity.user?.email || "Anonymous"}
                    </td>
                    <td className="py-2.5 text-xs text-charcoal/60 font-mono text-[11px]">
                      {activity.route || "—"}
                    </td>
                    <td className="py-2.5 text-right text-xs text-charcoal/60">
                      {new Date(activity.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activities.length > 10 && (
              <div className="mt-3 text-center text-xs text-charcoal/50">
                Showing latest 10 events of {activities.length} recorded.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: MODEL HEALTH (Phase 11 Dashboard) ───────────────────────── */}
      {activeTab === "model_health" && (
        <div className="mt-6">
          <ModelHealthDashboard />
        </div>
      )}

      {/* ─── TAB 5: RESULTS (Phase 14 Real Before vs. After Dashboard) ───────── */}
      {activeTab === "results" && (
        <div className="mt-6">
          <ResultsDashboard
            onOpenChurnModal={handleOpenChurnModalForUserId}
            onOpenCustomer360={(uid) => setSelectedUserFor360(uid)}
          />
        </div>
      )}

      {/* ─── MODAL DRILL-DOWN: CHURN PREDICTION MODAL ───────────────────────── */}
      {selectedUserForChurn && (
        <ChurnPredictionModal
          user={selectedUserForChurn}
          onClose={() => setSelectedUserForChurn(null)}
          api={api}
        />
      )}

      {/* ─── MODAL DRILL-DOWN: CUSTOMER 360° INTELLIGENCE MODAL ─────────────── */}
      {selectedUserFor360 && (
        <Customer360Modal
          userId={selectedUserFor360}
          onClose={() => setSelectedUserFor360(null)}
          onOpenChurnModal={(uid) => {
            setSelectedUserFor360(null);
            handleOpenChurnModalForUserId(uid);
          }}
          onStageCampaign={(cust) => {
            setSelectedUserFor360(null);
            setStagedCampaignTarget(cust);
          }}
        />
      )}

      {/* ─── MODAL DRILL-DOWN: CAMPAIGN STAGING PREVIEW MODAL ───────────────── */}
      {stagedCampaignTarget && (
        <CampaignPreviewModal
          isOpen={Boolean(stagedCampaignTarget)}
          activeCluster={
            stagedCampaignTarget.strategy || {
              type: "vip_retention",
              title: `Targeted Campaign for ${stagedCampaignTarget.name || "Customer"}`,
              priority:
                stagedCampaignTarget.riskLevel === "Very High" || stagedCampaignTarget.riskLevel === "High"
                  ? "High"
                  : "Medium",
              suggestedMessage: `Hi ${stagedCampaignTarget.name?.split(" ")[0] || "there"}, we appreciate your loyalty with LumaWear. Here is an exclusive offer tailored for you.`,
            }
          }
          selectedCustomers={[stagedCampaignTarget]}
          onClose={() => setStagedCampaignTarget(null)}
          onCampaignCreated={() => {
            setStagedCampaignTarget(null);
            setActiveTab("retention_campaigns");
          }}
        />
      )}

      {/* ─── MODAL DRILL-DOWN: RISK CATEGORY CUSTOMER LIST MODAL ───────────── */}
      {selectedRiskTierForModal && (
        <RiskCategoryCustomerModal
          isOpen={Boolean(selectedRiskTierForModal)}
          onClose={() => setSelectedRiskTierForModal(null)}
          riskTier={selectedRiskTierForModal}
          riskInfo={
            selectedRiskTierForModal === "Very High"
              ? riskDist.very_high
              : selectedRiskTierForModal === "High"
              ? riskDist.high
              : selectedRiskTierForModal === "Medium"
              ? riskDist.medium
              : riskDist.low
          }
          customers={portfolioData?.customers || []}
          onOpenChurnModal={handleOpenChurnModalForUserId}
          onOpenCustomer360={(uid) => setSelectedUserFor360(uid)}
        />
      )}
    </section>
  );
}
