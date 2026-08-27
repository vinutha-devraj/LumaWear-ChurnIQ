import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import CampaignPreviewModal from "./CampaignPreviewModal";
import EmailPreviewModal from "./EmailPreviewModal";

export default function RetentionAndCampaignsView({ onOpenChurnModal, onOpenCustomer360 }) {
  const { api } = useAuth();

  // Internal tab state: "actions" | "history"
  const [activeSection, setActiveSection] = useState("actions");

  // ==========================================
  // SECTION A: RETENTION ACTIONS STATE
  // ==========================================
  const [actionData, setActionData] = useState(null);
  const [actionLoading, setActionLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [serviceStatus, setServiceStatus] = useState("online");
  const [activeClusterType, setActiveClusterType] = useState("cart_abandonment");

  // Customer selection & filtering in cluster workspace
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("prob_desc");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Staging Modal & Notification
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // ==========================================
  // SECTION B: CAMPAIGN HISTORY STATE
  // ==========================================
  const [campaigns, setCampaigns] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [selectedCampaignForEmailPreview, setSelectedCampaignForEmailPreview] = useState(null);

  // Fetch retention action opportunities
  const fetchOpportunities = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const res = await api("/churn/retention-opportunities");
      if (res?.success) {
        setActionData(res);
        setServiceStatus("online");
        if (res.clusters && res.clusters.length > 0) {
          const firstNonEmpty = res.clusters.find((c) => c.customerCount > 0);
          if (firstNonEmpty) {
            setActiveClusterType(firstNonEmpty.type);
          } else {
            setActiveClusterType(res.clusters[0].type);
          }
        }
      } else {
        setActionError(res?.message || "Failed to load retention opportunities.");
        if (res?.service_status) setServiceStatus(res.service_status);
      }
    } catch (err) {
      setActionError(err.message || "Network error loading retention intelligence.");
      setServiceStatus("offline");
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch campaign history
  const fetchCampaigns = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const res = await api(`/churn/campaigns${query}`);
      if (res?.success) {
        setCampaigns(res.campaigns || []);
      } else {
        setHistoryError(res?.message || "Failed to load campaign history.");
      }
    } catch (err) {
      setHistoryError(err.message || "Network error loading campaigns.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    if (activeSection === "history") {
      fetchCampaigns();
    }
  }, [activeSection, statusFilter]);

  // Clear customer selection when switching active cluster
  useEffect(() => {
    setSelectedCustomerIds(new Set());
    setPage(1);
  }, [activeClusterType]);

  const activeCluster = useMemo(() => {
    if (!actionData?.clusters) return null;
    return actionData.clusters.find((c) => c.type === activeClusterType) || actionData.clusters[0];
  }, [actionData, activeClusterType]);

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

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  const toggleSelectCustomer = (id) => {
    const newSet = new Set(selectedCustomerIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedCustomerIds(newSet);
  };

  const selectAllFiltered = () => {
    const newSet = new Set(selectedCustomerIds);
    filteredCustomers.forEach((c) => newSet.add(c.customerId || c.userId));
    setSelectedCustomerIds(newSet);
  };

  const clearSelection = () => {
    setSelectedCustomerIds(new Set());
  };

  const getSelectedCustomerObjects = () => {
    if (!activeCluster?.customers) return [];
    return activeCluster.customers.filter((c) => selectedCustomerIds.has(c.customerId || c.userId));
  };

  const handleCampaignCreated = (newCampaign) => {
    setSuccessMessage(`Campaign "${newCampaign.name}" staged successfully! Opening email preview...`);
    setIsPreviewOpen(false);
    clearSelection();
    // Refresh both actions and history
    fetchOpportunities();
    fetchCampaigns();
    // Seamlessly open Email Preview modal for review and dispatch
    setSelectedCampaignForEmailPreview(newCampaign);
    setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  };

  const handleStatusTransition = async (campaignId, targetStatus) => {
    setActionLoadingId(campaignId);
    setHistoryError("");
    try {
      const res = await api(`/churn/campaigns/${campaignId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res?.success && res.campaign) {
        setCampaigns((prev) =>
          prev.map((c) => (c.campaignId === campaignId ? { ...c, status: res.campaign.status } : c))
        );
      } else {
        setHistoryError(res?.message || `Failed to transition campaign to ${targetStatus}.`);
      }
    } catch (err) {
      setHistoryError(err.message || "Network error updating campaign status.");
    } finally {
      setActionLoadingId(null);
      setConfirmDialog(null);
    }
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

  const getPriorityBadgeStyles = (priority) => {
    switch (priority) {
      case "High":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case "PLANNED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "SENT":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "CANCELLED":
      default:
        return "bg-stone-200 text-stone-700 border-stone-300";
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "N/A";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Unified Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-sand shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-charcoal">Retention &amp; Campaign History</h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              ML-Driven Action Engine
            </span>
          </div>
          <p className="text-xs text-charcoal/70 mt-1">
            Target high-risk customer clusters with personalized retention offers and track lifecycle execution.
          </p>
        </div>

        {/* Section Navigation Switcher */}
        <div className="flex items-center gap-1 bg-[#FAF8F5] p-1.5 rounded-xl border border-sand">
          <button
            type="button"
            onClick={() => setActiveSection("actions")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === "actions"
                ? "bg-charcoal text-white shadow-sm"
                : "text-charcoal/70 hover:text-charcoal hover:bg-sand/30"
            }`}
          >
            <span>🎯</span>
            <span>Retention Actions</span>
            {actionData?.summary?.totalOpportunities > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeSection === "actions" ? "bg-white/20 text-white" : "bg-sand text-charcoal"
                }`}
              >
                {actionData.summary.totalOpportunities}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === "history"
                ? "bg-charcoal text-white shadow-sm"
                : "text-charcoal/70 hover:text-charcoal hover:bg-sand/30"
            }`}
          >
            <span>📜</span>
            <span>Campaign History</span>
            {campaigns.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeSection === "history" ? "bg-white/20 text-white" : "bg-sand text-charcoal"
                }`}
              >
                {campaigns.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Global Toast Success Message */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection("history")}
            className="text-xs font-bold underline hover:text-emerald-950"
          >
            View in History →
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION A: RETENTION ACTIONS                                             */}
      {/* ========================================================================= */}
      {activeSection === "actions" && (
        <div className="space-y-6">
          {actionError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={fetchOpportunities}
                className="underline font-semibold hover:text-rose-900"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {actionLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin text-3xl">🔄</div>
              <p className="text-xs text-charcoal/60 font-medium">
                Clustering live customer representations across 5 behavioral retention playbooks...
              </p>
            </div>
          ) : (
            <>
              {/* Cluster Selection Cards (5 Retention Clusters) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {(actionData?.clusters || []).map((cluster) => {
                  const isActive = cluster.type === activeClusterType;
                  return (
                    <button
                      key={cluster.type}
                      type="button"
                      onClick={() => setActiveClusterType(cluster.type)}
                      className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isActive
                          ? "border-charcoal bg-white shadow-md ring-2 ring-charcoal/20"
                          : "border-sand bg-white/70 hover:bg-white hover:border-charcoal/40 shadow-sm"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl">{cluster.icon || "🎯"}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadgeStyles(
                              cluster.priority
                            )}`}
                          >
                            {cluster.priority}
                          </span>
                        </div>
                        <h3 className="font-bold text-xs text-charcoal">{cluster.title}</h3>
                        <p className="text-[11px] text-charcoal/70 mt-1 line-clamp-2">{cluster.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-sand/50 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-charcoal">
                          {cluster.customerCount} {cluster.customerCount === 1 ? "target" : "targets"}
                        </span>
                        <span className="text-xs text-charcoal/40">{isActive ? "●" : "○"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Cluster Details & Targeting Workspace */}
              {activeCluster && (
                <div className="bg-white rounded-2xl border border-sand shadow-sm overflow-hidden space-y-6 p-6">
                  {/* Cluster Strategy Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-sand">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xl">{activeCluster.icon}</span>
                        <h3 className="text-lg font-bold text-charcoal">{activeCluster.title} Workspace</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPriorityBadgeStyles(
                            activeCluster.priority
                          )}`}
                        >
                          {activeCluster.priority} Priority
                        </span>
                      </div>
                      <p className="text-xs text-charcoal/70">{activeCluster.recommendedAction}</p>
                    </div>

                    {/* Staging Button */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        disabled={selectedCustomerIds.size === 0}
                        className="px-4 py-2 bg-charcoal text-white rounded-xl text-xs font-bold hover:bg-ink transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <span>🚀</span>
                        <span>Stage Campaign ({selectedCustomerIds.size} Selected)</span>
                      </button>
                    </div>
                  </div>

                  {/* Suggested Copy / Offer Box */}
                  <div className="p-4 bg-cream/40 border border-sand rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-charcoal uppercase tracking-wider text-[10px]">
                        Recommended Message Strategy:
                      </span>
                      <p className="text-charcoal/80 italic">&ldquo;{activeCluster.suggestedMessage}&rdquo;</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[11px] text-charcoal/60 block">Expected Conversion Lift</span>
                      <span className="font-bold text-emerald-800 text-xs">
                        +{activeCluster.expectedConversionRate}%
                      </span>
                    </div>
                  </div>

                  {/* Customer Search & Filter Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        placeholder="Search name, email, or customer ID..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        className="px-3 py-1.5 text-xs bg-cream/30 border border-sand rounded-xl text-charcoal focus-ring w-64"
                      />

                      <select
                        value={riskFilter}
                        onChange={(e) => {
                          setRiskFilter(e.target.value);
                          setPage(1);
                        }}
                        className="px-3 py-1.5 text-xs bg-white border border-sand rounded-xl text-charcoal focus-ring"
                      >
                        <option value="ALL">All Risk Tiers</option>
                        <option value="VERY HIGH">Very High Risk (&ge; 75%)</option>
                        <option value="HIGH">High Risk (50–75%)</option>
                        <option value="MEDIUM">Medium Risk (25–50%)</option>
                        <option value="LOW">Low Risk (&lt; 25%)</option>
                      </select>

                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-white border border-sand rounded-xl text-charcoal focus-ring"
                      >
                        <option value="prob_desc">Probability: High → Low</option>
                        <option value="prob_asc">Probability: Low → High</option>
                        <option value="name_asc">Name: A → Z</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="px-3 py-1.5 bg-[#FAF8F5] border border-sand rounded-xl text-xs font-semibold text-charcoal hover:bg-sand/40 transition-colors"
                      >
                        Select All ({filteredCustomers.length})
                      </button>
                      {selectedCustomerIds.size > 0 && (
                        <button
                          type="button"
                          onClick={clearSelection}
                          className="px-3 py-1.5 bg-[#FAF8F5] border border-sand rounded-xl text-xs font-semibold text-charcoal/70 hover:text-charcoal transition-colors"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer Target Table */}
                  <div className="overflow-x-auto border border-sand rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#FAF8F5] border-b border-sand text-charcoal/70 font-bold uppercase text-[10px]">
                          <th className="py-3 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredCustomers.length > 0 &&
                                filteredCustomers.every((c) => selectedCustomerIds.has(c.customerId || c.userId))
                              }
                              onChange={(e) => {
                                if (e.target.checked) selectAllFiltered();
                                else clearSelection();
                              }}
                              className="rounded border-sand text-charcoal focus:ring-charcoal"
                            />
                          </th>
                          <th className="py-3 px-3">Customer</th>
                          <th className="py-3 px-3">Predicted Risk</th>
                          <th className="py-3 px-3">Primary Churn Driver</th>
                          <th className="py-3 px-3">Last Activity</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand/40">
                        {paginatedCustomers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-charcoal/50 text-xs">
                              No customer profiles match the selected filters in this retention cluster.
                            </td>
                          </tr>
                        ) : (
                          paginatedCustomers.map((cust) => {
                            const cid = cust.customerId || cust.userId;
                            const isSelected = selectedCustomerIds.has(cid);
                            const prob = cust.churnProbability ?? 0;

                            return (
                              <tr
                                key={cid}
                                className={`transition-colors ${
                                  isSelected ? "bg-amber-50/40" : "hover:bg-cream/20"
                                }`}
                              >
                                <td className="py-3 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectCustomer(cid)}
                                    className="rounded border-sand text-charcoal focus:ring-charcoal"
                                  />
                                </td>
                                <td className="py-3 px-3">
                                  <span className="font-semibold text-charcoal block">{cust.name}</span>
                                  <span className="text-[10px] text-charcoal/70 font-mono block">
                                    {cust.email || "No email registered"}
                                  </span>
                                  <span
                                    className={`text-[9px] font-semibold block mt-0.5 ${
                                      cust.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)
                                        ? "text-emerald-700"
                                        : "text-rose-600"
                                    }`}
                                  >
                                    {cust.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)
                                      ? "✓ Valid email"
                                      : "⚠️ Invalid / Missing email"}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadgeStyles(
                                        cust.riskLevel
                                      )}`}
                                    >
                                      {cust.riskLevel}
                                    </span>
                                    <span className="font-mono font-semibold text-charcoal">
                                      {(prob * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-charcoal/80 text-[11px]">
                                  {cust.topDriver || "Activity Frequency"}
                                </td>
                                <td className="py-3 px-3 text-charcoal/70 text-[11px]">
                                  {cust.lastActivityDate
                                    ? new Date(cust.lastActivityDate).toLocaleDateString()
                                    : "Recent"}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCustomerIds(new Set([cid]));
                                        setIsPreviewOpen(true);
                                      }}
                                      className="px-2 py-1 bg-amber-100/70 border border-amber-300 rounded-lg text-[10px] font-bold text-amber-900 hover:bg-amber-200 transition flex items-center gap-1"
                                      title={`Stage & preview retention email for ${cust.name}`}
                                    >
                                      <span>✉️</span>
                                      <span>Stage & Email</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onOpenCustomer360?.(cid)}
                                      className="px-2 py-1 bg-cream border border-sand rounded-lg text-[10px] font-medium text-charcoal hover:border-charcoal/40 transition"
                                      title="Open Customer 360 profile"
                                    >
                                      👤 360°
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenChurnModal?.(cid) ||
                                        onOpenChurnModal?.({ id: cid, name: cust.name, email: cust.email })
                                      }
                                      className="px-2 py-1 bg-charcoal text-white rounded-lg text-[10px] font-medium hover:bg-ink transition"
                                      title="Analyze ML Churn Risk"
                                    >
                                      ⚡ Score
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-sand text-xs text-charcoal/70">
                      <span>
                        Showing {(page - 1) * pageSize + 1} to{" "}
                        {Math.min(page * pageSize, filteredCustomers.length)} of {filteredCustomers.length} targets
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1 bg-[#FAF8F5] border border-sand rounded-lg disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <span className="font-semibold text-charcoal">
                          Page {page} of {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-3 py-1 bg-[#FAF8F5] border border-sand rounded-lg disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: CAMPAIGN HISTORY                                              */}
      {/* ========================================================================= */}
      {activeSection === "history" && (
        <div className="space-y-6">
          {historyError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{historyError}</span>
              </div>
              <button
                type="button"
                onClick={fetchCampaigns}
                className="underline font-semibold hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* History Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-sand shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-charcoal uppercase tracking-wider">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF8F5] border border-sand rounded-xl text-charcoal focus-ring"
              >
                <option value="ALL">All Statuses ({campaigns.length})</option>
                <option value="PLANNED">Planned</option>
                <option value="SENT">Sent</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <button
              type="button"
              onClick={fetchCampaigns}
              disabled={historyLoading}
              className="px-3 py-1.5 text-xs font-semibold text-charcoal bg-[#FAF8F5] border border-sand rounded-xl hover:bg-sand/30 transition shadow-sm"
            >
              🔄 Refresh Campaigns
            </button>
          </div>

          {/* Campaigns Table */}
          <div className="bg-white rounded-2xl border border-sand shadow-sm overflow-hidden">
            {historyLoading ? (
              <div className="py-16 text-center space-y-3">
                <div className="inline-block animate-spin text-3xl">🔄</div>
                <p className="text-xs text-charcoal/60 font-medium">Loading campaign records from MongoDB...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <p className="text-charcoal/60 text-xs">No campaign records found matching the criteria.</p>
                <button
                  type="button"
                  onClick={() => setActiveSection("actions")}
                  className="text-xs font-bold text-charcoal underline hover:text-ink"
                >
                  Stage a new campaign from Retention Actions →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-sand/50">
                {campaigns.map((c) => (
                  <div
                    key={c.campaignId || c._id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition hover:bg-cream/20"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-charcoal">{c.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadgeStyles(
                            c.priority
                          )}`}
                        >
                          {c.priority}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeStyles(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-charcoal/60 font-mono flex-wrap">
                        <span>ID: {c.campaignId}</span>
                        <span>•</span>
                        <span>Type: {String(c.campaignType || "").replace(/_/g, " ")}</span>
                        <span>•</span>
                        <span>{c.customerCount || c.targetCustomerIds?.length || 0} Targets</span>
                        <span>•</span>
                        <span>Created: {formatDate(c.createdAt)}</span>
                      </div>
                      {c.suggestedMessage && (
                        <p className="text-xs text-charcoal/70 italic mt-1">&ldquo;{c.suggestedMessage}&rdquo;</p>
                      )}
                    </div>

                    {/* Campaign Lifecycle Action Controls */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedCampaignForEmailPreview(c)}
                        className="px-3 py-1.5 bg-[#FAF8F5] text-stone-800 border border-stone-300 rounded-xl text-xs font-semibold hover:bg-stone-100 transition shadow-sm flex items-center gap-1.5"
                        title="Preview personalized strategy emails"
                      >
                        <span>📧</span>
                        <span>Email Preview</span>
                      </button>

                      {c.status === "PLANNED" && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoadingId === c.campaignId}
                            onClick={() => handleStatusTransition(c.campaignId, "SENT")}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                          >
                            🚀 Send Campaign
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === c.campaignId}
                            onClick={() => handleStatusTransition(c.campaignId, "CANCELLED")}
                            className="px-3 py-1.5 bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-semibold hover:bg-stone-200 transition disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {c.status === "SENT" && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoadingId === c.campaignId}
                            onClick={() => handleStatusTransition(c.campaignId, "COMPLETED")}
                            className="px-3 py-1.5 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition shadow-sm disabled:opacity-50"
                          >
                            ✓ Mark Completed
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === c.campaignId}
                            onClick={() => handleStatusTransition(c.campaignId, "CANCELLED")}
                            className="px-3 py-1.5 bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-semibold hover:bg-stone-200 transition disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {(c.status === "COMPLETED" || c.status === "CANCELLED") && (
                        <span className="text-xs text-charcoal/50 font-mono italic">
                          Lifecycle Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campaign Staging Preview Modal */}
      {isPreviewOpen && activeCluster && (
        <CampaignPreviewModal
          isOpen={isPreviewOpen}
          activeCluster={activeCluster}
          selectedCustomers={getSelectedCustomerObjects()}
          onClose={() => setIsPreviewOpen(false)}
          onCampaignCreated={handleCampaignCreated}
        />
      )}

      {/* Email Preview & Dry-Run Dispatch Modal */}
      {selectedCampaignForEmailPreview && (
        <EmailPreviewModal
          isOpen={Boolean(selectedCampaignForEmailPreview)}
          campaign={selectedCampaignForEmailPreview}
          onClose={() => setSelectedCampaignForEmailPreview(null)}
          onDispatched={() => {
            fetchCampaigns();
            setSuccessMessage("Retention emails dispatched in dry-run mode. Campaign status updated.");
          }}
        />
      )}
    </div>
  );
}
