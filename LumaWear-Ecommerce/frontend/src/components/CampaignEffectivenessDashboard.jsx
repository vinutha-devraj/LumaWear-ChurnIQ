import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import ExperimentSimulator from "./ExperimentSimulator";
import RetentionROISimulator from "./RetentionROISimulator";
import RiskMovementModal from "./RiskMovementModal";

export default function CampaignEffectivenessDashboard({ onOpenChurnModal, onOpenCustomer360 }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab controls
  const [activeTab, setActiveTab] = useState("campaigns"); // "campaigns" | "ab_simulator" | "roi_calculator"
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  // Selected customer for RiskMovementModal
  const [selectedCustomerForMovement, setSelectedCustomerForMovement] = useState(null);

  const fetchEffectiveness = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await api("/churn/campaign-effectiveness");
      if (res?.success) {
        setData(res);
      } else {
        throw new Error(res?.message || "Failed to load campaign effectiveness analytics.");
      }
    } catch (err) {
      setError(err.message || "Campaign effectiveness service is temporarily unavailable.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEffectiveness();
  }, []);

  const summary = data?.summary || {
    totalCampaigns: 0,
    totalCustomersTargeted: 0,
    totalCustomersWithReducedRisk: 0,
    averageRiskReduction: 0,
    bestPerformingCampaign: null,
  };

  const campaigns = data?.campaigns || [];
  const disclaimer =
    data?.disclaimer ||
    "Risk movement metrics represent observational changes in XGBoost model predictions across time intervals. They do not establish causality without randomized treatment/control A/B holdout testing.";

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (typeFilter !== "ALL" && c.campaignType !== typeFilter) return false;
      if (priorityFilter !== "ALL" && c.priority !== priorityFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name?.toLowerCase().includes(q);
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif font-bold text-xl text-stone-900">Retention Effectiveness & Experiments</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                  Phase 12
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Observational campaign performance, customer risk transitions, A/B experiment simulation, and financial ROI modeling.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchEffectiveness(true)}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-[#FAF8F5] border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors shadow-sm disabled:opacity-50"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            <span>{isRefreshing ? "Analyzing..." : "Refresh Analytics"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => fetchEffectiveness()} className="underline font-semibold hover:text-rose-900">
            Retry Analytics
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "campaigns"
              ? "bg-stone-900 text-white shadow-sm"
              : "bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"
          }`}
        >
          <span>📊</span>
          <span>Campaign Effectiveness</span>
          <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
            {campaigns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ab_simulator")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "ab_simulator"
              ? "bg-stone-900 text-white shadow-sm"
              : "bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"
          }`}
        >
          <span>🧪</span>
          <span>A/B Experiment Simulator</span>
          <span className="bg-purple-200 text-purple-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">Sim</span>
        </button>

        <button
          onClick={() => setActiveTab("roi_calculator")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            activeTab === "roi_calculator"
              ? "bg-stone-900 text-white shadow-sm"
              : "bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"
          }`}
        >
          <span>💰</span>
          <span>ROI Scenario Calculator</span>
          <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">Calc</span>
        </button>
      </div>

      {/* ─── TAB 1: CAMPAIGN EFFECTIVENESS & RISK MOVEMENT ───────────────── */}
      {activeTab === "campaigns" && (
        <div className="space-y-6 animate-fade-in">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Total Campaigns Staged
              </span>
              <span className="text-2xl font-serif font-bold text-stone-900 block">{summary.totalCampaigns}</span>
              <span className="text-[11px] text-stone-500 mt-1 block">
                {summary.totalCustomersTargeted} distinct customers
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Customers With Reduced Risk
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-bold text-emerald-900">
                  {summary.totalCustomersWithReducedRisk}
                </span>
                <span className="text-xs text-emerald-700 font-medium">
                  (
                  {summary.totalCustomersTargeted > 0
                    ? ((summary.totalCustomersWithReducedRisk / summary.totalCustomersTargeted) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
              </div>
              <span className="text-[11px] text-stone-500 mt-1 block">Observed risk decrease</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Average Risk Reduction
              </span>
              <span className="text-2xl font-serif font-bold text-stone-900 block">
                {summary.averageRiskReduction > 0
                  ? `-${(summary.averageRiskReduction * 100).toFixed(1)} pp`
                  : `${(summary.averageRiskReduction * 100).toFixed(1)} pp`}
              </span>
              <span className="text-[11px] text-stone-500 mt-1 block">Baseline vs. latest live</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                Top Performing Campaign
              </span>
              <span className="text-sm font-bold text-stone-900 block truncate">
                {summary.bestPerformingCampaign?.name || "None Evaluated"}
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                {summary.bestPerformingCampaign
                  ? `${summary.bestPerformingCampaign.effectiveReductionPercentage}% reduction rate`
                  : "No data"}
              </span>
            </div>
          </div>

          {/* Observational Disclaimer Box */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
            <span className="text-base shrink-0 mt-0.5">ℹ️</span>
            <div>
              <span className="font-bold uppercase tracking-wider block text-[11px]">Analytical Framework Notice</span>
              <p className="mt-0.5 leading-relaxed text-[11px] opacity-90">{disclaimer}</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
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
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <option value="ALL">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
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
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 w-full sm:w-56"
              />
            </div>
          </div>

          {/* Campaign Comparison Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
              <span className="font-serif font-bold text-sm text-stone-900">Campaign Performance & Risk Trajectories</span>
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
                  const isDeltaPositive = c.averageRiskChange > 0.01;

                  return (
                    <div key={c.campaignId} className="transition-colors hover:bg-stone-50/50">
                      <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5 max-w-md">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif font-bold text-base text-stone-900">{c.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(c.priority)}`}>
                              {c.priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(c.status)}`}>
                              {c.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-stone-500 font-mono">
                            <span>ID: {c.campaignId}</span>
                            <span>•</span>
                            <span>{c.targetCustomerCount} targets ({c.highRiskTargetCount} High/V.High)</span>
                          </div>
                        </div>

                        {/* Performance Metrics */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl">
                            <span className="text-[10px] font-semibold text-stone-500 uppercase block">Baseline Prob</span>
                            <span className="font-mono font-bold text-xs text-stone-900 mt-0.5 block">
                              {(c.averageBaselineChurnProbability * 100).toFixed(1)}%
                            </span>
                          </div>

                          <div className="p-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl">
                            <span className="text-[10px] font-semibold text-stone-500 uppercase block">Latest Prob</span>
                            <span className="font-mono font-bold text-xs text-stone-900 mt-0.5 block">
                              {(c.averageLatestChurnProbability * 100).toFixed(1)}%
                            </span>
                          </div>

                          <div
                            className={`p-2.5 rounded-xl border ${
                              isDeltaPositive
                                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                                : "bg-stone-100 border-stone-200 text-stone-800"
                            }`}
                          >
                            <span className="text-[10px] font-semibold uppercase block opacity-75">Risk Delta</span>
                            <span className="font-mono font-bold text-xs mt-0.5 block">
                              {c.averageRiskChange > 0
                                ? `-${(c.averageRiskChange * 100).toFixed(1)} pp`
                                : `+${(Math.abs(c.averageRiskChange) * 100).toFixed(1)} pp`}
                            </span>
                          </div>
                        </div>

                        {/* Outcomes & Expand Button */}
                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs">
                            <span className="font-bold text-emerald-800 block">
                              {c.customersWithReducedRisk} Reduced
                            </span>
                            <span className="text-[10px] text-stone-500 block">
                              {c.customersWithUnchangedRisk} Unchanged • {c.customersWithIncreasedRisk} Increased
                            </span>
                          </div>

                          <button
                            onClick={() => setExpandedCampaignId(isExpanded ? null : c.campaignId)}
                            className="px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors shadow-sm"
                          >
                            {isExpanded ? "Hide Targets ▲" : "View Targets ▼"}
                          </button>
                        </div>
                      </div>

                      {/* Accordion: Target Customer Drill-down */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-1 bg-[#FAF8F5] border-t border-stone-200 space-y-3">
                          <div className="flex items-center justify-between text-xs text-stone-600 font-semibold uppercase tracking-wider pt-2">
                            <span>Target Customer Cohort ({c.customerDeltas?.length || 0})</span>
                            <span>Longitudinal Movement Analysis</span>
                          </div>

                          <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold text-[11px]">
                                  <th className="py-2.5 px-3">Customer</th>
                                  <th className="py-2.5 px-3">Baseline Risk</th>
                                  <th className="py-2.5 px-3">Latest Risk</th>
                                  <th className="py-2.5 px-3">Probability Delta</th>
                                  <th className="py-2.5 px-3">Trajectory</th>
                                  <th className="py-2.5 px-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {(c.customerDeltas || []).map((cust) => (
                                  <tr key={cust.userId} className="hover:bg-stone-50">
                                    <td className="py-2.5 px-3">
                                      <span className="font-semibold text-stone-900 block">{cust.name}</span>
                                      <span className="text-[10px] text-stone-400 font-mono">{cust.email || cust.userId}</span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-stone-700">
                                      {(cust.baselineProbability * 100).toFixed(1)}% ({cust.baselineRiskLevel})
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                                      {(cust.latestProbability * 100).toFixed(1)}% ({cust.latestRiskLevel})
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                          cust.delta > 0.01
                                            ? "bg-emerald-100 text-emerald-800"
                                            : cust.delta < -0.01
                                            ? "bg-rose-100 text-rose-800"
                                            : "bg-stone-100 text-stone-700"
                                        }`}
                                      >
                                        {cust.delta > 0 ? `-${(cust.delta * 100).toFixed(1)} pp` : `+${(Math.abs(cust.delta) * 100).toFixed(1)} pp`}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          cust.status === "Reduced"
                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                            : cust.status === "Increased"
                                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                                            : "bg-stone-100 text-stone-700"
                                        }`}
                                      >
                                        {cust.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        onClick={() => setSelectedCustomerForMovement(cust.userId)}
                                        className="px-2.5 py-1 bg-stone-900 text-white rounded-lg text-[11px] font-semibold hover:bg-stone-800 transition-colors shadow-sm"
                                      >
                                        📈 Risk Movement
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: A/B EXPERIMENT SIMULATOR ────────────────────────────── */}
      {activeTab === "ab_simulator" && <ExperimentSimulator />}

      {/* ─── TAB 3: ROI SCENARIO CALCULATOR ─────────────────────────────── */}
      {activeTab === "roi_calculator" && <RetentionROISimulator />}

      {/* Risk Movement Modal */}
      {selectedCustomerForMovement && (
        <RiskMovementModal
          userId={selectedCustomerForMovement}
          onClose={() => setSelectedCustomerForMovement(null)}
          onOpenChurnModal={onOpenChurnModal}
          onOpenCustomer360={onOpenCustomer360}
        />
      )}
    </div>
  );
}
