import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

export default function BusinessImpactView({ onOpenChurnModal, onOpenCustomer360, onStageCampaign }) {
  const { api } = useAuth();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Table controls
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("risk_value_desc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchBusinessImpact = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const url = isDemoMode ? "/churn/business-impact?mode=demo" : "/churn/business-impact";
      const res = await api(url);
      if (res?.success) {
        setData(res);
      } else {
        throw new Error(res?.message || "Failed to load business impact metrics.");
      }
    } catch (err) {
      setError(err.message || "Business impact analytics service is temporarily offline.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBusinessImpact();
  }, [isDemoMode]);

  // Filtered & Sorted Customers
  const filteredCustomers = useMemo(() => {
    if (!data?.topValueAtRiskCustomers) return [];
    let list = [...data.topValueAtRiskCustomers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          String(c.userId || c.customerId || "").includes(q)
      );
    }

    if (tierFilter !== "ALL") {
      list = list.filter((c) => c.riskLevel?.toUpperCase() === tierFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "risk_value_desc") return (b.revenueAtRisk ?? 0) - (a.revenueAtRisk ?? 0);
      if (sortBy === "risk_value_asc") return (a.revenueAtRisk ?? 0) - (b.revenueAtRisk ?? 0);
      if (sortBy === "spend_desc") return (b.historicalSpend ?? 0) - (a.historicalSpend ?? 0);
      if (sortBy === "prob_desc") return (b.churnProbability ?? 0) - (a.churnProbability ?? 0);
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });

    return list;
  }, [data?.topValueAtRiskCustomers, searchQuery, tierFilter, sortBy]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      val || 0
    );
  };

  const getRiskBadgeStyles = (tier) => {
    switch (tier) {
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

  const summary = data?.summary || {
    totalCustomerValue: 0,
    estimatedRevenueAtRisk: 0,
    revenueAtRiskPercentage: 0,
    highRiskCustomerCount: 0,
    highRiskRevenueExposed: 0,
    highRiskRevenueAtRisk: 0,
    averageRevenuePerAtRiskCustomer: 0,
    averageChurnProbability: 0,
    totalCustomers: 0,
    scoredCustomers: 0,
  };

  const tiers = data?.tierBreakdown || {
    low: { customerCount: 0, percentageOfCustomers: 0, totalHistoricalSpend: 0, revenueAtRisk: 0, percentageOfRevenueAtRisk: 0, label: "Low Risk (< 25%)" },
    medium: { customerCount: 0, percentageOfCustomers: 0, totalHistoricalSpend: 0, revenueAtRisk: 0, percentageOfRevenueAtRisk: 0, label: "Medium Risk (25-50%)" },
    high: { customerCount: 0, percentageOfCustomers: 0, totalHistoricalSpend: 0, revenueAtRisk: 0, percentageOfRevenueAtRisk: 0, label: "High Risk (50-75%)" },
    very_high: { customerCount: 0, percentageOfCustomers: 0, totalHistoricalSpend: 0, revenueAtRisk: 0, percentageOfRevenueAtRisk: 0, label: "Very High Risk (> 75%)" },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h2 className="font-serif font-bold text-xl text-stone-900">Business Impact Analytics</h2>
              <p className="text-xs text-stone-600 mt-0.5">
                Quantify customer value exposed to churn and prioritize high-value retention opportunities.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Demo Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-stone-300">
            <button
              type="button"
              onClick={() => setIsDemoMode(false)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                !isDemoMode ? "bg-stone-900 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              🟢 Live
            </button>
            <button
              type="button"
              onClick={() => setIsDemoMode(true)}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                isDemoMode ? "bg-purple-900 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <span>🧪</span>
              <span>Demo</span>
            </button>
          </div>

          <button
            onClick={() => fetchBusinessImpact(true)}
            disabled={loading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-[#FAF8F5] border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors shadow-sm disabled:opacity-50"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            <span>{isRefreshing ? "Calculating..." : "Recompute Impact"}</span>
          </button>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 text-xs flex items-start gap-3 shadow-sm">
          <span className="text-xl">🧪</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[11px]">DEMO SIMULATION MODE</span>
              <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-950 font-mono text-[10px] font-bold">Model 2b2147fd4057</span>
            </div>
            <p className="mt-1 leading-relaxed text-[11px] opacity-90">
              Demo Mode uses synthetic customer profiles processed through the same production feature contract and active XGBoost model. No real customer data is modified.
            </p>
          </div>
        </div>
      )}

      {/* Analytical Estimate Disclaimer Banner */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <span className="text-amber-700 text-lg shrink-0 mt-0.5">ℹ️</span>
        <div>
          <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
            Analytical Estimate Methodology
          </h4>
          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
            {data?.disclaimer ||
              "Estimated Revenue at Risk is calculated from historical customer spend multiplied by predicted churn probability. It is an analytical exposure estimate and does not represent a forecast of guaranteed revenue loss."}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => fetchBusinessImpact()} className="underline font-semibold hover:text-rose-900">
            Retry Calculation
          </button>
        </div>
      )}

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Total Customer Value
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-serif font-bold text-stone-900">
              {formatCurrency(summary.totalCustomerValue)}
            </span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Across {summary.scoredCustomers} active accounts
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block mb-1">
            Estimated Revenue at Risk
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-serif font-bold text-rose-900">
              {formatCurrency(summary.estimatedRevenueAtRisk)}
            </span>
          </div>
          <span className="text-[11px] text-rose-700/80 mt-1 block font-medium">
            {summary.revenueAtRiskPercentage}% of portfolio value
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider block mb-1">
            High-Risk Customers
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif font-bold text-orange-900">
              {summary.highRiskCustomerCount}
            </span>
            <span className="text-xs text-orange-600 font-medium">
              / {summary.scoredCustomers}
            </span>
          </div>
          <span className="text-[11px] text-orange-700/80 mt-1 block">
            {summary.scoredCustomers > 0
              ? `${((summary.highRiskCustomerCount / summary.scoredCustomers) * 100).toFixed(0)}% in High + Very High tiers`
              : "0%"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Avg Spend / At-Risk Customer
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-serif font-bold text-stone-900">
              {formatCurrency(summary.averageRevenuePerAtRiskCustomer)}
            </span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Historical value per high-risk user
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Portfolio Mean Risk
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-serif font-bold text-stone-900">
              {(summary.averageChurnProbability * 100).toFixed(1)}%
            </span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Continuous probability average
          </span>
        </div>
      </div>

      {/* Risk Tier Revenue Segmentation Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif font-bold text-base text-stone-900">Revenue Exposure by Churn Risk Tier</h3>
            <p className="text-xs text-stone-600 mt-0.5">
              Breakdown of total historical customer spend versus estimated revenue at risk across risk brackets.
            </p>
          </div>
        </div>

        {/* Visual Stacked Bar */}
        <div className="h-3.5 w-full bg-stone-100 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${tiers.low.percentageOfRevenueAtRisk || 0}%` }}
            className="bg-emerald-500 h-full transition-all"
            title={`Low Risk: ${tiers.low.percentageOfRevenueAtRisk}%`}
          />
          <div
            style={{ width: `${tiers.medium.percentageOfRevenueAtRisk || 0}%` }}
            className="bg-amber-500 h-full transition-all"
            title={`Medium Risk: ${tiers.medium.percentageOfRevenueAtRisk}%`}
          />
          <div
            style={{ width: `${tiers.high.percentageOfRevenueAtRisk || 0}%` }}
            className="bg-orange-500 h-full transition-all"
            title={`High Risk: ${tiers.high.percentageOfRevenueAtRisk}%`}
          />
          <div
            style={{ width: `${tiers.very_high.percentageOfRevenueAtRisk || 0}%` }}
            className="bg-rose-500 h-full transition-all"
            title={`Very High Risk: ${tiers.very_high.percentageOfRevenueAtRisk}%`}
          />
        </div>

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif font-bold text-sm text-emerald-950">Low Risk (&lt; 25%)</span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                {tiers.low.customerCount} customers
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Historical Spend:</span>
                <span className="font-semibold text-stone-900">{formatCurrency(tiers.low.totalHistoricalSpend)}</span>
              </div>
              <div className="flex justify-between text-emerald-900 font-bold">
                <span>Revenue at Risk:</span>
                <span>{formatCurrency(tiers.low.revenueAtRisk)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif font-bold text-sm text-amber-950">Medium Risk (25–50%)</span>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                {tiers.medium.customerCount} customers
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Historical Spend:</span>
                <span className="font-semibold text-stone-900">{formatCurrency(tiers.medium.totalHistoricalSpend)}</span>
              </div>
              <div className="flex justify-between text-amber-900 font-bold">
                <span>Revenue at Risk:</span>
                <span>{formatCurrency(tiers.medium.revenueAtRisk)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif font-bold text-sm text-orange-950">High Risk (50–75%)</span>
              <span className="text-[11px] font-bold text-orange-800 bg-orange-100/80 px-2 py-0.5 rounded-full">
                {tiers.high.customerCount} customers
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Historical Spend:</span>
                <span className="font-semibold text-stone-900">{formatCurrency(tiers.high.totalHistoricalSpend)}</span>
              </div>
              <div className="flex justify-between text-orange-900 font-bold">
                <span>Revenue at Risk:</span>
                <span>{formatCurrency(tiers.high.revenueAtRisk)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-serif font-bold text-sm text-rose-950">Very High Risk (&gt; 75%)</span>
              <span className="text-[11px] font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-full">
                {tiers.very_high.customerCount} customers
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Historical Spend:</span>
                <span className="font-semibold text-stone-900">{formatCurrency(tiers.very_high.totalHistoricalSpend)}</span>
              </div>
              <div className="flex justify-between text-rose-900 font-bold">
                <span>Revenue at Risk:</span>
                <span>{formatCurrency(tiers.very_high.revenueAtRisk)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Value-at-Risk Customers Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-900">Highest Value-at-Risk Customers</h3>
            <p className="text-xs text-stone-600 mt-0.5">
              Ranked by individual estimated revenue exposure (Historical Customer Spend × Predicted Churn Probability).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search by name, email, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />

            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="VERY HIGH">Very High Risk (&gt;75%)</option>
              <option value="HIGH">High Risk (50-75%)</option>
              <option value="MEDIUM">Medium Risk (25-50%)</option>
              <option value="LOW">Low Risk (&lt;25%)</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="risk_value_desc">Revenue at Risk (High → Low)</option>
              <option value="risk_value_asc">Revenue at Risk (Low → High)</option>
              <option value="spend_desc">Historical Spend (High → Low)</option>
              <option value="prob_desc">Churn Probability (High → Low)</option>
              <option value="name_asc">Customer Name (A → Z)</option>
            </select>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="py-12 text-center text-stone-500 text-xs">
            <span className="text-3xl block mb-2">🔍</span>
            <p className="font-semibold text-stone-700">No customers match this filter</p>
            <p>Try resetting filters or searching with another keyword.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Historical Spend</th>
                  <th className="py-3.5 px-4">Churn Risk</th>
                  <th className="py-3.5 px-4">Revenue at Risk</th>
                  <th className="py-3.5 px-4">Primary Churn Driver</th>
                  <th className="py-3.5 px-4 text-right">CRM Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {paginatedCustomers.map((cust) => {
                  const uid = cust.userId || cust.customerId;
                  return (
                    <tr key={uid} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {cust.name?.charAt(0) || "C"}
                          </div>
                          <div className="truncate max-w-[180px]">
                            <span className="font-semibold text-stone-900 block truncate">{cust.name}</span>
                            <span className="text-stone-500 text-[11px] block truncate">{cust.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-stone-900 text-xs">
                          {formatCurrency(cust.historicalSpend)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-stone-900">
                            {cust.churnPercentage ? `${cust.churnPercentage}%` : `${((cust.churnProbability || 0) * 100).toFixed(1)}%`}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRiskBadgeStyles(
                              cust.riskLevel
                            )}`}
                          >
                            {cust.riskLevel}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-rose-900 text-xs bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          {formatCurrency(cust.revenueAtRisk)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-stone-800 block text-xs">{cust.topDriver}</span>
                        {cust.topDriverDetail && (
                          <span className="text-[10px] text-stone-500 font-mono">
                            SHAP: {cust.topDriverDetail.shap_value > 0 ? "+" : ""}{cust.topDriverDetail.shap_value?.toFixed(3)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenCustomer360 && onOpenCustomer360(uid)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors"
                            title="Open Customer 360 profile"
                          >
                            👤 360°
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenChurnModal && onOpenChurnModal(uid)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors"
                            title="Analyze ML Churn Risk"
                          >
                            ⚡ Risk
                          </button>
                          {onStageCampaign && (
                            <button
                              type="button"
                              onClick={() => onStageCampaign(cust)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                              title="Stage Retention Campaign"
                            >
                              🎯 Stage
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 text-xs text-stone-600">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCustomers.length)} of {filteredCustomers.length} customers
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 border border-stone-300 rounded-lg bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-stone-900">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1 border border-stone-300 rounded-lg bg-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
