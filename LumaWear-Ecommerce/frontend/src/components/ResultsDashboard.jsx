import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import RiskMovementModal from "./RiskMovementModal";
import EmailPreviewModal from "./EmailPreviewModal";

export default function ResultsDashboard({ onOpenChurnModal, onOpenCustomer360 }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshWarning, setRefreshWarning] = useState("");
  const [selectedCampaignForEmailPreview, setSelectedCampaignForEmailPreview] = useState(null);

  const isFetchingRef = useRef(false);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  // Customer longitudinal risk movement modal
  const [selectedCustomerForMovement, setSelectedCustomerForMovement] = useState(null);

  const fetchResults = async (manual = false, silent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (manual) {
      setIsRefreshing(true);
      setRefreshWarning("");
    } else if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const res = await api("/churn/results", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (res?.success) {
        setData(res);
        setLastUpdated(new Date());
        setRefreshWarning("");
        setError("");
      } else {
        throw new Error(res?.message || "Failed to load real campaign results.");
      }
    } catch (err) {
      console.warn("Results API fetch issue:", err);
      if (!data && !silent) {
        setError(err.message || "Results analytics service is temporarily offline.");
      } else if (data) {
        setRefreshWarning("Unable to refresh — showing last successful data");
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Initial Load
    fetchResults(false, false);

    // Automatic Live Poll every 10 seconds
    const intervalId = setInterval(() => {
      if (isMounted) {
        fetchResults(false, true);
      }
    }, 10000);

    // Refresh when user returns/focuses the window or tab
    const handleWindowFocus = () => {
      if (isMounted) {
        fetchResults(false, true);
      }
    };
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  const summary = data?.summary || {
    totalCampaigns: 0,
    totalCustomersTargeted: 0,
    customersWithReducedRisk: 0,
    customersWithIncreasedRisk: 0,
    customersWithUnchangedRisk: 0,
    averageRiskChange: 0,
    bestPerformingCampaign: null,
  };

  const campaigns = data?.campaigns || [];
  const disclaimer =
    data?.disclaimer ||
    "Results show observed changes in customer behavior and predicted churn risk between the campaign baseline and the latest available customer state. A reduction in predicted churn risk does not by itself prove that the campaign caused the improvement.";

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (typeFilter !== "ALL" && c.campaignType !== typeFilter && c.type !== typeFilter) return false;
      if (priorityFilter !== "ALL" && c.priority !== priorityFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.name || c.campaignName)?.toLowerCase().includes(q);
        const matchId = c.campaignId?.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }
      return true;
    });
  }, [campaigns, typeFilter, priorityFilter, statusFilter, searchQuery]);

  const getPriorityBadge = (p) => {
    switch (p) {
      case "High":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "SENT":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "PLANNED":
      default:
        return "bg-purple-100 text-purple-800 border-purple-200";
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case "Very High":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "High":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-xl text-stone-900">Campaign Outcomes & Risk Trajectories</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ● Live (10s)
                </span>
                {lastUpdated && (
                  <span className="text-[11px] font-mono text-stone-500 bg-[#FAF8F5] px-2 py-0.5 rounded border border-stone-200">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
                {refreshWarning && (
                  <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>{refreshWarning}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Real-time observational intelligence evaluating baseline snapshots against current live MongoDB orders & activities scored via XGBoost (2b2147fd4057).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchResults(true, false)}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-[#FAF8F5] border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors shadow-sm disabled:opacity-50"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            <span>{isRefreshing ? "Calculating..." : "Refresh Results"}</span>
          </button>
        </div>
      </div>

      {/* Mandatory Non-Causal Disclaimer Notice */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 flex items-start gap-3 shadow-sm">
        <span className="text-lg shrink-0 mt-0.5">ℹ️</span>
        <div>
          <span className="font-bold uppercase tracking-wider block text-[11px] text-amber-900">
            Observational Framework Disclaimer
          </span>
          <p className="mt-0.5 leading-relaxed text-[11px] opacity-95">{disclaimer}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => fetchResults()} className="underline font-semibold hover:text-rose-900">
            Retry Results
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="inline-block animate-spin text-3xl">🔄</div>
          <p className="text-xs text-stone-500 font-medium">
            Fetching latest MongoDB customer telemetry and generating live XGBoost predictions...
          </p>
        </div>
      ) : (
        <>
          {/* Executive KPI Summary Cards (6 Summary Metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Card 1: Campaigns Analyzed */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Campaigns Analyzed
              </span>
              <span className="text-2xl font-serif font-bold text-stone-900 block">{summary.totalCampaigns}</span>
              <span className="text-[10px] text-stone-500 mt-1 block">Real staged campaigns</span>
            </div>

            {/* Card 2: Customers Analyzed */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Customers Analyzed
              </span>
              <span className="text-2xl font-serif font-bold text-stone-900 block">
                {summary.totalCustomersTargeted}
              </span>
              <span className="text-[10px] text-stone-500 mt-1 block">Targeted customer cohort</span>
            </div>

            {/* Card 3: Customers With Reduced Risk */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block mb-1">
                Reduced Risk
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-serif font-bold text-emerald-900">
                  {summary.customersWithReducedRisk}
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">
                  (
                  {summary.totalCustomersTargeted > 0
                    ? ((summary.customersWithReducedRisk / summary.totalCustomersTargeted) * 100).toFixed(0)
                    : 0}
                  %)
                </span>
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">Observed risk decrease</span>
            </div>

            {/* Card 4: Customers With Increased Risk */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider block mb-1">
                Increased Risk
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-serif font-bold text-rose-900">
                  {summary.customersWithIncreasedRisk}
                </span>
                <span className="text-[11px] text-rose-700 font-medium">
                  (
                  {summary.totalCustomersTargeted > 0
                    ? ((summary.customersWithIncreasedRisk / summary.totalCustomersTargeted) * 100).toFixed(0)
                    : 0}
                  %)
                </span>
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">Observed risk increase</span>
            </div>

            {/* Card 5: Customers With Unchanged Risk */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Unchanged Risk
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-serif font-bold text-stone-900">
                  {summary.customersWithUnchangedRisk}
                </span>
                <span className="text-[11px] text-stone-600 font-medium">
                  (
                  {summary.totalCustomersTargeted > 0
                    ? ((summary.customersWithUnchangedRisk / summary.totalCustomersTargeted) * 100).toFixed(0)
                    : 0}
                  %)
                </span>
              </div>
              <span className="text-[10px] text-stone-500 mt-1 block">Stable risk profile (±1 pp)</span>
            </div>

            {/* Card 6: Average Risk Change */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Average Risk Change
              </span>
              <span
                className={`text-2xl font-serif font-bold block ${
                  summary.averageRiskChange > 0 ? "text-emerald-900" : "text-stone-900"
                }`}
              >
                {summary.averageRiskChange > 0
                  ? `-${(summary.averageRiskChange * 100).toFixed(1)} pp`
                  : `${(summary.averageRiskChange * 100).toFixed(1)} pp`}
              </span>
              <span className="text-[10px] text-stone-500 mt-1 block">Baseline vs. latest live</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus-ring"
              >
                <option value="ALL">All Campaign Types</option>
                <option value="cart_abandonment">Cart Abandonment</option>
                <option value="inactivity_reengagement">Inactivity Re-engagement</option>
                <option value="wishlist_followup">Wishlist Follow-up</option>
                <option value="product_recommendation">Product Recommendation</option>
                <option value="vip_retention">VIP Retention</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus-ring"
              >
                <option value="ALL">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="SENT">Sent</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus-ring w-full sm:w-56"
              />
            </div>
          </div>

          {/* Campaign Comparison Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
              <span className="font-serif font-bold text-sm text-stone-900">
                Campaign Outcomes &amp; Risk Trajectories
              </span>
              <span className="text-xs font-mono text-stone-500">{filteredCampaigns.length} campaigns matched</span>
            </div>

            {filteredCampaigns.length === 0 ? (
              <div className="py-16 text-center text-stone-500 text-xs">
                No campaigns match the selected filters or no campaigns have been staged yet.
              </div>
            ) : (
              <div className="divide-y divide-stone-200">
                {filteredCampaigns.map((c) => {
                  const isExpanded = expandedCampaignId === c.campaignId;
                  const deltaPp = Number(((c.averageRiskChange || 0) * 100).toFixed(1));
                  const isDeltaPositive = c.averageRiskChange > 0.01;
                  const customers = c.customers || c.customerDeltas || [];

                  return (
                    <div key={c.campaignId} className="transition-colors hover:bg-stone-50/40">
                      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5 max-w-md">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-base text-stone-900">
                              {c.name || c.campaignName}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200"
                            >
                              🎯 {c.strategyName || (c.campaignType || c.type || "").replace(/_/g, " ").replace(/\b\w/g, (w) => w.toUpperCase())}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(
                                c.priority
                              )}`}
                            >
                              {c.priority}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(
                                c.status
                              )}`}
                            >
                              {c.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-stone-500 font-mono">
                            <span>ID: {c.campaignId}</span>
                            <span>•</span>
                            <span>{c.targetCustomerCount || c.targetCount || customers.length} targets</span>
                            <span>•</span>
                            <span>
                              {c.createdAt
                                ? new Date(c.createdAt).toLocaleDateString()
                                : "Recent"}
                            </span>
                          </div>
                        </div>

                        {/* Performance Metrics */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="p-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl">
                            <span className="text-[10px] font-semibold text-stone-500 uppercase block">
                              Before Avg Risk
                            </span>
                            <span className="font-mono font-bold text-xs text-stone-900 mt-0.5 block">
                              {((c.averageBaselineChurnProbability ?? c.beforeAverageRisk ?? 0) * 100).toFixed(1)}%
                            </span>
                          </div>

                          <div className="p-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl">
                            <span className="text-[10px] font-semibold text-stone-500 uppercase block">
                              Latest Avg Risk
                            </span>
                            <span className="font-mono font-bold text-xs text-stone-900 mt-0.5 block">
                              {((c.averageLatestChurnProbability ?? c.latestAverageRisk ?? 0) * 100).toFixed(1)}%
                            </span>
                          </div>

                          <div
                            className={`p-2.5 rounded-xl border ${
                              isDeltaPositive
                                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                                : "bg-stone-100 border-stone-200 text-stone-800"
                            }`}
                          >
                            <span className="text-[10px] font-semibold uppercase block opacity-75">
                              Avg Risk Change
                            </span>
                            <span className="font-mono font-bold text-xs mt-0.5 block">
                              {deltaPp > 0 ? `-${deltaPp} pp` : `+${Math.abs(deltaPp)} pp`}
                            </span>
                          </div>
                        </div>

                        {/* Outcomes & Expand Button */}
                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs">
                            <span className="font-bold text-emerald-800 block">
                              {c.customersWithReducedRisk || 0} Reduced
                            </span>
                            <span className="text-[10px] text-stone-500 block">
                              {c.customersWithUnchangedRisk || 0} Unchanged • {c.customersWithIncreasedRisk || 0} Increased
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedCampaignForEmailPreview(c)}
                            className="px-3 py-1.5 bg-[#FAF8F5] border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors shadow-sm flex items-center gap-1.5"
                            title="Preview personalized strategy emails"
                          >
                            <span>📧</span>
                            <span>Email Preview</span>
                          </button>

                          <button
                            onClick={() => setExpandedCampaignId(isExpanded ? null : c.campaignId)}
                            className="px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors shadow-sm"
                          >
                            {isExpanded ? "Hide Targets ▲" : "View Targets ▼"}
                          </button>
                        </div>
                      </div>

                      {/* Accordion: Target Customer Before-vs-After Drill-Down */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 bg-[#FAF8F5] border-t border-stone-200 space-y-4">
                          <div className="flex items-center justify-between text-xs text-stone-600 font-semibold uppercase tracking-wider pt-2">
                            <span>Individual Target Customers ({customers.length})</span>
                            <span>Real Before vs. After Analysis</span>
                          </div>

                          <div className="grid gap-3">
                            {customers.map((cust) => {
                              const before = cust.before || {
                                churnProbability: cust.baselineProbability ?? 0,
                                riskLevel: cust.baselineRiskLevel || "Medium",
                                orderCount: 0,
                                totalSpend: 0,
                                daysSinceLastOrder: null,
                                daysSinceLastActivity: null,
                              };

                              const latest = cust.after || cust.latest || {
                                churnProbability: cust.latestProbability ?? 0,
                                riskLevel: cust.latestRiskLevel || "Medium",
                                orderCount: 0,
                                totalSpend: 0,
                                daysSinceLastOrder: null,
                                daysSinceLastActivity: null,
                              };

                              const change = cust.change || {
                                probabilityChange: cust.delta ?? 0,
                                percentagePoints: cust.percentagePoints ?? Number(((cust.delta ?? 0) * 100).toFixed(1)),
                                riskTierTransition: cust.riskTransition || `${before.riskLevel} → ${latest.riskLevel}`,
                                status: cust.status || "Unchanged",
                                orderDelta: (latest.orderCount ?? 0) - (before.orderCount ?? 0),
                                spendDelta: Number(((latest.totalSpend ?? 0) - (before.totalSpend ?? 0)).toFixed(2)),
                              };

                              const isCustReduced = change.status === "Reduced";
                              const isCustIncreased = change.status === "Increased";

                              return (
                                <div
                                  key={cust.userId}
                                  className="p-4 bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                                >
                                  {/* Customer Identity */}
                                  <div className="space-y-1 min-w-[200px]">
                                    <span className="font-bold text-sm text-stone-900 block">{cust.name}</span>
                                    <span className="text-[11px] text-stone-500 font-mono block">
                                      {cust.email || cust.userId}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 mt-1">
                                      <span>🎯</span>
                                      <span>{cust.strategyName || c.strategyName || (c.campaignType || "").replace(/_/g, " ").replace(/\b\w/g, (w) => w.toUpperCase())}</span>
                                    </span>
                                  </div>

                                  {/* BEFORE CAMPAIGN */}
                                  <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl space-y-1.5 min-w-[200px]">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                                      Before Campaign
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-sm text-stone-900">
                                        {((before.churnProbability ?? 0) * 100).toFixed(1)}%
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(
                                          before.riskLevel || before.riskTier
                                        )}`}
                                      >
                                        {before.riskLevel || before.riskTier}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-stone-600 space-y-0.5">
                                      <div>Spend: ₹{Number(before.totalSpend || 0).toLocaleString()} • Orders: {before.orderCount || 0}</div>
                                      <div>
                                        Last Order:{" "}
                                        {before.daysSinceLastOrder !== null
                                          ? `${before.daysSinceLastOrder}d ago`
                                          : "None"}{" "}
                                        • Last Act:{" "}
                                        {before.daysSinceLastActivity !== null
                                          ? `${before.daysSinceLastActivity}d ago`
                                          : "None"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* LATEST STATE */}
                                  <div className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl space-y-1.5 min-w-[200px]">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                                      Latest State
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-sm text-stone-900">
                                        {((latest.churnProbability ?? 0) * 100).toFixed(1)}%
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(
                                          latest.riskLevel || latest.riskTier
                                        )}`}
                                      >
                                        {latest.riskLevel || latest.riskTier}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-stone-600 space-y-0.5">
                                      <div>Spend: ₹{Number(latest.totalSpend || 0).toLocaleString()} • Orders: {latest.orderCount || 0}</div>
                                      <div>
                                        Last Order:{" "}
                                        {latest.daysSinceLastOrder !== null
                                          ? `${latest.daysSinceLastOrder}d ago`
                                          : "None"}{" "}
                                        • Last Act:{" "}
                                        {latest.daysSinceLastActivity !== null
                                          ? `${latest.daysSinceLastActivity}d ago`
                                          : "None"}
                                      </div>
                                    </div>
                                  </div>

                                  {/* OBSERVED CHANGE */}
                                  <div
                                    className={`p-3 rounded-xl border space-y-1 min-w-[220px] ${
                                      isCustReduced
                                        ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                                        : isCustIncreased
                                        ? "bg-rose-50/60 border-rose-200 text-rose-950"
                                        : "bg-stone-100/60 border-stone-200 text-stone-800"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                                        Observed Change
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isCustReduced
                                            ? "bg-emerald-100 text-emerald-800"
                                            : isCustIncreased
                                            ? "bg-rose-100 text-rose-800"
                                            : "bg-stone-200 text-stone-700"
                                        }`}
                                      >
                                        {change.status}
                                      </span>
                                    </div>

                                    <div className="font-semibold text-xs mt-1">
                                      {change.percentagePoints > 0
                                        ? `Risk decreased by ${change.percentagePoints} percentage points`
                                        : change.percentagePoints < 0
                                        ? `Risk increased by ${Math.abs(change.percentagePoints)} percentage points`
                                        : "Stable risk profile"}
                                    </div>

                                    <div className="text-[11px] font-mono opacity-80">
                                      {change.riskTierTransition || change.riskTransition}
                                    </div>

                                    <div className="text-[10px] opacity-75 pt-1 border-t border-current/10">
                                      Orders: {change.orderDelta > 0 ? `+${change.orderDelta}` : change.orderDelta || 0} • Spend:{" "}
                                      {change.spendDelta > 0
                                        ? `+₹${Number(change.spendDelta).toLocaleString()}`
                                        : `₹${Number(change.spendDelta || 0).toLocaleString()}`}
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCustomerForMovement(cust.userId)}
                                      className="px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors shadow-sm flex items-center gap-1.5"
                                      title="Open longitudinal risk movement timeline & SHAP"
                                    >
                                      <span>📈</span>
                                      <span>Risk Movement</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Risk Movement Modal */}
      {selectedCustomerForMovement && (
        <RiskMovementModal
          userId={selectedCustomerForMovement}
          onClose={() => setSelectedCustomerForMovement(null)}
          onOpenChurnModal={onOpenChurnModal}
          onOpenCustomer360={onOpenCustomer360}
        />
      )}

      {/* Email Preview & Dry-Run Dispatch Modal */}
      {selectedCampaignForEmailPreview && (
        <EmailPreviewModal
          isOpen={Boolean(selectedCampaignForEmailPreview)}
          campaign={selectedCampaignForEmailPreview}
          onClose={() => setSelectedCampaignForEmailPreview(null)}
          onDispatched={() => {
            fetchResults(true, false);
          }}
        />
      )}
    </div>
  );
}
