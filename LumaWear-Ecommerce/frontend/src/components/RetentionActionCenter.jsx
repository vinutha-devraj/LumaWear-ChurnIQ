import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import CampaignPreviewModal from "./CampaignPreviewModal";

export default function RetentionActionCenter({ onOpenChurnModal, onOpenCustomer360, onNavigateToHistory }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [serviceStatus, setServiceStatus] = useState("online");
  const [activeClusterType, setActiveClusterType] = useState("cart_abandonment");

  // Workspace controls
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("prob_desc");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Campaign Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fetchOpportunities = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/churn/retention-opportunities");
      if (res.success) {
        setData(res);
        setServiceStatus("online");
        // Default to first non-empty cluster or first cluster
        if (res.clusters && res.clusters.length > 0) {
          const firstNonEmpty = res.clusters.find((c) => c.customerCount > 0);
          if (firstNonEmpty) {
            setActiveClusterType(firstNonEmpty.type);
          } else {
            setActiveClusterType(res.clusters[0].type);
          }
        }
      } else {
        setError(res.message || "Failed to load retention opportunities.");
        if (res.service_status) setServiceStatus(res.service_status);
      }
    } catch (err) {
      setError(err.message || "Network error loading retention intelligence.");
      setServiceStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  // Clear customer selection when switching active cluster
  useEffect(() => {
    setSelectedCustomerIds(new Set());
    setPage(1);
  }, [activeClusterType]);

  const activeCluster = useMemo(() => {
    if (!data?.clusters) return null;
    return data.clusters.find((c) => c.type === activeClusterType) || data.clusters[0];
  }, [data, activeClusterType]);

  // Filter and sort customers for active cluster
  const filteredCustomers = useMemo(() => {
    if (!activeCluster?.customers) return [];
    let list = [...activeCluster.customers];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          String(c.customerId || c.userId || "").includes(q)
      );
    }

    if (riskFilter !== "ALL") {
      list = list.filter((c) => c.riskLevel?.toUpperCase() === riskFilter);
    }

    if (sortBy === "prob_desc") {
      list.sort((a, b) => (b.churnProbability ?? 0) - (a.churnProbability ?? 0));
    } else if (sortBy === "prob_asc") {
      list.sort((a, b) => (a.churnProbability ?? 0) - (b.churnProbability ?? 0));
    } else if (sortBy === "name_asc") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return list;
  }, [activeCluster, searchQuery, riskFilter, sortBy]);

  // Paginated slice
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;

  // Customer Selection Handlers
  const handleToggleCustomer = (customerId) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(filteredCustomers.map((c) => c.customerId || c.userId));
    setSelectedCustomerIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedCustomerIds(new Set());
  };

  const selectedCustomerObjects = useMemo(() => {
    if (!activeCluster?.customers) return [];
    return activeCluster.customers.filter((c) => selectedCustomerIds.has(c.customerId || c.userId));
  }, [activeCluster, selectedCustomerIds]);

  const handleCampaignCreated = (createdCampaign) => {
    setSelectedCustomerIds(new Set());
    setSuccessMessage(
      `Campaign '${createdCampaign.name}' created successfully with status PLANNED for ${createdCampaign.customerCount} customer(s).`
    );
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "High":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
  };

  const getClusterIcon = (type) => {
    switch (type) {
      case "cart_abandonment":
        return "🛒";
      case "inactivity_reengagement":
        return "💤";
      case "wishlist_followup":
        return "❤️";
      case "product_recommendation":
        return "👀";
      case "new_customer_onboarding":
        return "🌱";
      case "vip_retention":
        return "👑";
      case "category_promotion":
        return "🏷️";
      default:
        return "🎯";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h2 className="font-serif font-bold text-xl text-stone-900">Retention Action Center</h2>
              <p className="text-xs text-stone-600 mt-0.5">
                Turn churn intelligence into targeted retention campaigns and action clusters.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            <span>🛡️</span>
            <span>SIMULATION MODE — NO MESSAGES SENT</span>
          </span>

          <button
            onClick={fetchOpportunities}
            disabled={loading}
            className="p-2 text-stone-600 hover:text-stone-900 border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors"
            title="Refresh opportunities"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-base">✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <div className="flex items-center gap-3">
            {onNavigateToHistory && (
              <button
                onClick={onNavigateToHistory}
                className="font-semibold underline text-emerald-800 hover:text-emerald-950"
              >
                View in Campaign History →
              </button>
            )}
            <button
              onClick={() => setSuccessMessage("")}
              className="text-emerald-600 hover:text-emerald-900 p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Offline Alert */}
      {serviceStatus !== "online" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-semibold">Churn Intelligence Service Unavailable</p>
              <p className="text-amber-800 mt-0.5">
                FastAPI Python engine on port 8000 is unreachable. Real-time opportunity clustering is paused, but
                staged Campaign History remains accessible.
              </p>
            </div>
          </div>
          <button
            onClick={fetchOpportunities}
            className="px-3 py-1.5 bg-amber-200/60 hover:bg-amber-200 text-amber-900 rounded-xl font-semibold border border-amber-300 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-stone-200 animate-pulse p-4" />
            ))}
          </div>
          <div className="h-44 bg-white rounded-2xl border border-stone-200 animate-pulse p-6" />
        </div>
      )}

      {/* Opportunity Summary Metrics */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
              Intervention Pool
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-stone-900">
                {data.summary.customersRequiringIntervention}
              </span>
              <span className="text-xs text-stone-500">
                / {data.summary.totalCustomers} total
              </span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              {data.summary.totalCustomers > 0
                ? `${((data.summary.customersRequiringIntervention / data.summary.totalCustomers) * 100).toFixed(0)}% need retention action`
                : "No customers"}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block mb-1">
              High Priority
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-rose-900">{data.summary.highPriority}</span>
              <span className="text-xs text-rose-600 font-medium">customers</span>
            </div>
            <span className="text-[11px] text-rose-700/80 mt-1 block">Cart & Inactive Churn</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block mb-1">
              Medium Priority
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-amber-900">{data.summary.mediumPriority}</span>
              <span className="text-xs text-amber-600 font-medium">customers</span>
            </div>
            <span className="text-[11px] text-amber-700/80 mt-1 block">Wishlist & Browse Follow-up</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block mb-1">
              Low Priority
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-emerald-900">{data.summary.lowPriority}</span>
              <span className="text-xs text-emerald-600 font-medium">customers</span>
            </div>
            <span className="text-[11px] text-emerald-700/80 mt-1 block">Category Affinity</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
              Active Action Clusters
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-stone-900">
                {data.clusters?.filter((c) => c.customerCount > 0).length || 0}
              </span>
              <span className="text-xs text-stone-500">/ 7 clusters</span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">Strategy categories</span>
          </div>
        </div>
      )}

      {/* Action Clusters Selector */}
      {data?.clusters && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-base text-stone-900">1. Select an Action Cluster</h3>
            <span className="text-xs text-stone-500">Click a strategy card to inspect and stage campaigns</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {data.clusters.map((cluster) => {
              const isSelected = cluster.type === activeClusterType;
              return (
                <button
                  key={cluster.type}
                  type="button"
                  onClick={() => setActiveClusterType(cluster.type)}
                  className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? "bg-[#F5EFEB] border-stone-800 shadow-md ring-2 ring-stone-900"
                      : "bg-white border-stone-200 hover:border-stone-400 hover:shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getClusterIcon(cluster.type)}</span>
                        <h4 className="font-serif font-bold text-sm text-stone-900 leading-tight">
                          {cluster.title}
                        </h4>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getPriorityBadge(
                          cluster.priority
                        )}`}
                      >
                        {cluster.priority}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-2 mb-3">
                      {cluster.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/80 text-xs">
                    <span className="font-bold text-stone-900">
                      {cluster.customerCount} customer{cluster.customerCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] text-stone-500 font-mono">
                      {cluster.percentage}% pool
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Campaign Workspace for Selected Cluster */}
      {activeCluster && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden space-y-4 p-6">
          {/* Active Cluster Strategy Summary Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{getClusterIcon(activeCluster.type)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-lg text-stone-900">
                      {activeCluster.title} Workspace
                    </h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPriorityBadge(
                        activeCluster.priority
                      )}`}
                    >
                      {activeCluster.priority} Priority
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1">
                    <strong className="text-stone-900">Recommended Action:</strong> {activeCluster.recommendedAction}
                  </p>
                </div>
              </div>
            </div>

            {/* Campaign Staging Action Bar */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-xs text-stone-500 block">Selected for Campaign</span>
                <span className="font-serif font-bold text-sm text-stone-900">
                  {selectedCustomerIds.size} of {filteredCustomers.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                disabled={selectedCustomerIds.size === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>⚡</span>
                <span>Preview Campaign ({selectedCustomerIds.size})</span>
              </button>
            </div>
          </div>

          {/* Filtering, Search & Bulk Select Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search customers by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={riskFilter}
                onChange={(e) => {
                  setRiskFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
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
                className="px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <option value="prob_desc">Highest Churn Risk</option>
                <option value="prob_asc">Lowest Churn Risk</option>
                <option value="name_asc">Customer Name A-Z</option>
              </select>

              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-2 text-xs font-semibold text-stone-700 bg-[#FAF8F5] border border-stone-300 rounded-xl hover:bg-stone-100"
              >
                Select All
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                disabled={selectedCustomerIds.size === 0}
                className="px-3 py-2 text-xs font-semibold text-stone-600 bg-[#FAF8F5] border border-stone-300 rounded-xl hover:bg-stone-100 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Customer Table */}
          {filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-stone-500 text-xs">
              <p className="font-semibold text-stone-700 mb-1">No customers match this filter</p>
              <p>Try clearing search queries or switching risk tier filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredCustomers.length > 0 &&
                          filteredCustomers.every((c) => selectedCustomerIds.has(c.customerId || c.userId))
                        }
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAll();
                          else handleClearSelection();
                        }}
                        className="rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                      />
                    </th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Churn Risk</th>
                    <th className="py-3 px-4">Primary Driver</th>
                    <th className="py-3 px-4">Recommended Retention Action</th>
                    <th className="py-3 px-4 text-right">Drill-Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {paginatedCustomers.map((cust) => {
                    const cid = cust.customerId || cust.userId;
                    const isSelected = selectedCustomerIds.has(cid);
                    return (
                      <tr
                        key={cid}
                        className={`transition-colors ${isSelected ? "bg-amber-50/50" : "hover:bg-stone-50"}`}
                      >
                        <td className="py-3.5 px-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleCustomer(cid)}
                            className="rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                          />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {cust.name?.charAt(0) || "C"}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-stone-900 block truncate">{cust.name}</span>
                              <span className="text-stone-500 text-[11px] block truncate">{cust.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-stone-900">
                              {cust.churnPercentage ? `${cust.churnPercentage}%` : `${((cust.churnProbability || 0) * 100).toFixed(1)}%`}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                cust.riskLevel === "Very High"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : cust.riskLevel === "High"
                                  ? "bg-orange-100 text-orange-800 border border-orange-200"
                                  : cust.riskLevel === "Medium"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {cust.riskLevel}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-stone-800 block">{cust.topDriver}</span>
                          {cust.topDriverDetail && (
                            <span className="text-[10px] text-stone-500 font-mono">
                              SHAP: {cust.topDriverDetail.shap_value > 0 ? "+" : ""}{cust.topDriverDetail.shap_value?.toFixed(3)}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-stone-700 text-xs truncate" title={cust.recommendedAction}>
                            {cust.recommendedAction}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onOpenCustomer360 && (
                              <button
                                type="button"
                                onClick={() => onOpenCustomer360(cid)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors"
                                title="Open Customer 360 profile"
                              >
                                👤 360°
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenChurnModal && onOpenChurnModal(cid)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors"
                              title="Analyze ML Churn Risk"
                            >
                              ⚡ Analyze
                            </button>
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
      )}

      {/* Campaign Preview Modal */}
      {isPreviewOpen && (
        <CampaignPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          activeCluster={activeCluster}
          selectedCustomers={selectedCustomerObjects}
          onCampaignCreated={handleCampaignCreated}
        />
      )}
    </div>
  );
}
