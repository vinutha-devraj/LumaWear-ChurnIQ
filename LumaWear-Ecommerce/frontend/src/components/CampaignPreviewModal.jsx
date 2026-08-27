import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function CampaignPreviewModal({
  isOpen = true,
  open,
  onClose,
  activeCluster,
  cluster,
  selectedCustomers = [],
  customers = [],
  onCampaignCreated,
  onSuccess,
}) {
  const { api } = useAuth();
  const [campaignName, setCampaignName] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const effectiveCluster = activeCluster || cluster;
  const effectiveCustomers = selectedCustomers && selectedCustomers.length > 0 ? selectedCustomers : customers || [];
  const effectiveCallback = onCampaignCreated || onSuccess;
  const isVisible = isOpen !== false && open !== false;

  if (!isVisible || !effectiveCluster) return null;

  const defaultName = campaignName || `${effectiveCluster.title || "Retention"} Campaign`;
  const defaultMessage =
    customMessage ||
    effectiveCluster.suggestedMessage ||
    `Hi {name}, we noticed your recent activity and want to share an exclusive update with you.`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (effectiveCustomers.length === 0) {
      setError("Please select at least one customer to target.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const targetCustomerIds = effectiveCustomers.map((c) => c.customerId || c.userId || c._id);
      const customerProbabilities = {};
      const customerRiskLevels = {};
      const customerTopDrivers = {};

      effectiveCustomers.forEach((c) => {
        const cid = c.customerId || c.userId || c._id;
        customerProbabilities[cid] = c.churnProbability ?? 0;
        customerRiskLevels[cid] = c.riskLevel || "Medium";
        customerTopDrivers[cid] = c.topDriver || "";
      });

      const payload = {
        name: defaultName,
        campaignType: effectiveCluster.type,
        strategy: effectiveCluster.type,
        strategyName: effectiveCluster.title,
        priority: effectiveCluster.priority || "Medium",
        targetCustomerIds,
        suggestedMessage: defaultMessage,
        customerProbabilities,
        customerRiskLevels,
        customerTopDrivers,
      };

      const res = await api("/churn/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success && res.campaign) {
        if (effectiveCallback) {
          effectiveCallback(res.campaign);
        }
        onClose();
      } else {
        setError(res.message || "Failed to create campaign record.");
      }
    } catch (err) {
      setError(err.message || "Network error while creating campaign.");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-stone-300 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-[#F4EFEA] border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="text-xl font-serif font-bold text-stone-900">Campaign Preview</h3>
              <p className="text-xs text-stone-600">Simulate and stage targeted customer retention actions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Simulation Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3">
          <span className="text-amber-600 text-base mt-0.5">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              Simulation Mode — No Messages Will Be Sent
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Creating this campaign records the retention strategy, target audience, and message template for staging
              and governance. No emails, SMS, or coupons are dispatched to live customers.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Campaign Strategy Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 bg-white border border-stone-200 rounded-xl">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                Strategy Cluster
              </span>
              <p className="font-semibold text-stone-900 text-sm">{activeCluster.title}</p>
            </div>

            <div className="p-3.5 bg-white border border-stone-200 rounded-xl">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                Target Audience
              </span>
              <p className="font-semibold text-stone-900 text-sm">{selectedCustomers.length} Selected Customer{selectedCustomers.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="p-3.5 bg-white border border-stone-200 rounded-xl flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block mb-1">
                Urgency Priority
              </span>
              <div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getPriorityBadge(
                    activeCluster.priority
                  )}`}
                >
                  {activeCluster.priority} Priority
                </span>
              </div>
            </div>
          </div>

          {/* Campaign Name Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
              Campaign Name
            </label>
            <input
              type="text"
              value={defaultName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Q3 Abandoned Cart Win-Back Campaign"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
              required
            />
          </div>

          {/* Suggested Message Template */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
              Suggested Retention Message (Template Simulation)
            </label>
            <textarea
              rows={3}
              value={defaultMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 font-mono text-xs"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Use <code className="bg-stone-200 px-1 py-0.5 rounded text-stone-700">{"{name}"}</code> as dynamic recipient placeholder.
            </p>
          </div>

          {/* Selected Customer List Preview */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
              Recipient Cohort ({selectedCustomers.length})
            </label>
            <div className="bg-white border border-stone-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-stone-100">
              {selectedCustomers.map((cust) => (
                <div key={cust.customerId || cust.userId} className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-stone-50">
                  <div className="flex items-center gap-2.5 truncate mr-3">
                    <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {cust.name?.charAt(0) || "C"}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-stone-900 block truncate">{cust.name}</span>
                      <span className="text-stone-500 text-[11px] truncate block">{cust.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-stone-600">
                      {cust.churnPercentage ? `${cust.churnPercentage}%` : `${((cust.churnProbability || 0) * 100).toFixed(1)}%`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        cust.riskLevel === "Very High"
                          ? "bg-rose-100 text-rose-800"
                          : cust.riskLevel === "High"
                          ? "bg-orange-100 text-orange-800"
                          : cust.riskLevel === "Medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {cust.riskLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F4EFEA] border-t border-stone-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedCustomers.length === 0}
            className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Creating Campaign...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Create Campaign (PLANNED)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
