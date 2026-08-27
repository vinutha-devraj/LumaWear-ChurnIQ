import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function CampaignHistory({ onSelectClusterTab }) {
  const { api } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { campaign, targetStatus, title, message }

  const fetchCampaigns = async () => {
    setLoading(true);
    setError("");
    try {
      const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      const res = await api(`/churn/campaigns${query}`);
      if (res.success) {
        setCampaigns(res.campaigns || []);
      } else {
        setError(res.message || "Failed to load campaign history.");
      }
    } catch (err) {
      setError(err.message || "Network error loading campaigns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter]);

  const handleStatusTransition = async (campaignId, targetStatus) => {
    setActionLoadingId(campaignId);
    setError("");
    try {
      const res = await api(`/churn/campaigns/${campaignId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.success && res.campaign) {
        setCampaigns((prev) =>
          prev.map((c) => (c.campaignId === campaignId ? { ...c, status: res.campaign.status } : c))
        );
      } else {
        setError(res.message || `Failed to transition campaign to ${targetStatus}.`);
      }
    } catch (err) {
      setError(err.message || "Network error updating campaign status.");
    } finally {
      setActionLoadingId(null);
      setConfirmDialog(null);
    }
  };

  const getStatusBadge = (status) => {
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

  const formatCampaignType = (type) => {
    return String(type || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDate = (isoString) => {
    if (!isoString) return "N/A";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📜</span>
            <h3 className="font-serif font-bold text-lg text-stone-900">Campaign History & Lifecycle</h3>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Track planned retention campaigns, state transitions (Planned → Sent → Completed), and target audience cohorts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {["ALL", "PLANNED", "SENT", "COMPLETED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === st
                  ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                  : "bg-white text-stone-700 border-stone-300 hover:bg-stone-100"
              }`}
            >
              {st === "ALL" ? "All Statuses" : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}

          <button
            onClick={fetchCampaigns}
            disabled={loading}
            className="p-1.5 text-stone-600 hover:text-stone-900 border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors ml-1"
            title="Refresh campaigns"
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchCampaigns}
            className="underline font-semibold hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-stone-300 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h4 className="font-serif font-bold text-base text-stone-900">{confirmDialog.title}</h4>
            <p className="text-xs text-stone-600">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 border border-stone-300 rounded-xl hover:bg-stone-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStatusTransition(confirmDialog.campaign.campaignId, confirmDialog.targetStatus)}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-sm ${
                  confirmDialog.targetStatus === "CANCELLED"
                    ? "bg-rose-700 hover:bg-rose-800"
                    : "bg-stone-900 hover:bg-stone-800"
                }`}
              >
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200 shadow-sm text-center">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-stone-600 font-medium">Loading campaign records...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200 shadow-sm text-center">
          <span className="text-4xl block mb-3">📭</span>
          <h4 className="font-serif font-bold text-base text-stone-900 mb-1">No Campaigns Found</h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto mb-5">
            {statusFilter !== "ALL"
              ? `No campaigns with status '${statusFilter}' exist.`
              : "No retention campaigns have been staged yet. Go to the Retention Action Center to create a campaign."}
          </p>
          {onSelectClusterTab && (
            <button
              onClick={onSelectClusterTab}
              className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors shadow-sm"
            >
              Go to Retention Action Center →
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3.5 px-4">Campaign & ID</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Target Audience</th>
                  <th className="py-3.5 px-4">Created By</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {campaigns.map((camp) => {
                  const isLoading = actionLoadingId === camp.campaignId;
                  return (
                    <tr key={camp.campaignId} className="hover:bg-stone-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-stone-900 block text-xs">{camp.name}</span>
                        <span className="font-mono text-[10px] text-stone-500">{camp.campaignId}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-stone-800">{formatCampaignType(camp.campaignType)}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadge(
                            camp.priority
                          )}`}
                        >
                          {camp.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-stone-900">{camp.customerCount} customer{camp.customerCount !== 1 ? "s" : ""}</span>
                        {camp.targetCustomers && camp.targetCustomers.length > 0 && (
                          <span className="text-[10px] text-stone-500 block truncate max-w-[140px]">
                            {camp.targetCustomers.map((c) => c.name?.split(" ")[0]).join(", ")}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-stone-800 block">{camp.createdBy?.name || "Admin"}</span>
                        <span className="text-stone-500 text-[10px] block truncate max-w-[120px]">
                          {camp.createdBy?.email || "admin@lumawear.local"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-stone-600">
                        {formatDate(camp.createdAt)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                            camp.status
                          )}`}
                        >
                          {camp.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isLoading ? (
                          <span className="text-[11px] text-stone-500">Updating...</span>
                        ) : camp.status === "PLANNED" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  campaign: camp,
                                  targetStatus: "SENT",
                                  title: "Mark Campaign as SENT (Simulation)",
                                  message: `Are you sure you want to mark '${camp.name}' as SENT? In simulation mode, no live messages will be sent.`,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                            >
                              Mark Sent
                            </button>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  campaign: camp,
                                  targetStatus: "CANCELLED",
                                  title: "Cancel Campaign",
                                  message: `Are you sure you want to cancel '${camp.name}'? This will transition the campaign to CANCELLED.`,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold text-stone-600 bg-stone-100 border border-stone-300 rounded-lg hover:bg-stone-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : camp.status === "SENT" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  campaign: camp,
                                  targetStatus: "COMPLETED",
                                  title: "Complete Campaign",
                                  message: `Are you sure you want to mark '${camp.name}' as COMPLETED?`,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  campaign: camp,
                                  targetStatus: "CANCELLED",
                                  title: "Cancel Campaign",
                                  message: `Are you sure you want to cancel '${camp.name}'?`,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold text-stone-600 bg-stone-100 border border-stone-300 rounded-lg hover:bg-stone-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-400 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
