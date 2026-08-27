import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function Customer360Modal({ userId, onClose, onOpenChurnModal, onStageCampaign }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "journey" | "telemetry" | "orders" | "activities" | "retention"

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    setLoading(true);
    setError("");

    api(`/churn/customer-360/${userId}`)
      .then((res) => {
        if (isMounted) {
          if (res?.success) {
            setData(res);
          } else {
            setError(res?.message || "Failed to load Customer 360 profile.");
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Network error loading Customer 360 intelligence.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (!userId) return null;

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

  const profile = data?.profile || {};
  const risk = data?.risk || {};
  const metrics = data?.businessMetrics || {};
  const journey = data?.journey || [];
  const telemetry = data?.telemetry || { engagement: [], purchasing: [], customerProfile: [] };
  const orders = data?.orders || [];
  const activities = data?.activities || [];
  const retention = data?.retentionContext || { applicableClusters: [], targetedCampaigns: [] };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-stone-300 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-5 bg-[#F4EFEA] border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-serif font-bold text-xl shadow-sm shrink-0">
              {profile.name?.charAt(0) || "👤"}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-serif font-bold text-stone-900">{profile.name || "Customer Profile"}</h3>
                {risk.riskLevel && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRiskBadgeStyles(risk.riskLevel)}`}>
                    {risk.riskLevel} Risk
                  </span>
                )}
                <span className="text-[11px] font-mono text-stone-500 bg-stone-200/70 px-2 py-0.5 rounded">
                  {profile.userId || userId}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                {profile.email} • Registered {profile.accountCreated ? new Date(profile.accountCreated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"} ({profile.tenureDays || 0} days tenure)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onOpenChurnModal && (
              <button
                type="button"
                onClick={() => onOpenChurnModal(userId)}
                className="px-3.5 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors shadow-sm flex items-center gap-1.5"
                title="Open SHAP waterfall prediction modal"
              >
                <span>⚡</span>
                <span>Analyze Risk</span>
              </button>
            )}

            {onStageCampaign && (
              <button
                type="button"
                onClick={() =>
                  onStageCampaign({
                    customerId: profile.userId || userId,
                    userId: profile.userId || userId,
                    name: profile.name,
                    email: profile.email,
                    churnProbability: risk.churnProbability,
                    riskLevel: risk.riskLevel,
                    topDriver: risk.topSHAPDrivers?.[0]?.label || "Behavioral Patterns",
                    strategy: retention.applicableClusters?.[0] || null,
                  })
                }
                className="px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                title="Stage retention campaign for this customer"
              >
                <span>🎯</span>
                <span>Stage Campaign</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-200 transition-colors ml-1"
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-white border-b border-stone-200 flex items-center gap-1 overflow-x-auto">
          {[
            { id: "overview", label: "Overview & Risk", icon: "📊" },
            { id: "journey", label: "Customer Journey", icon: "🧭", count: journey.length },
            { id: "telemetry", label: "21-Feature Telemetry", icon: "🔬" },
            { id: "orders", label: "Order History", icon: "🛍️", count: orders.length },
            { id: "activities", label: "Activity Log", icon: "⚡", count: activities.length },
            { id: "retention", label: "Retention Context", icon: "🎯", count: retention.applicableClusters?.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded-full font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-stone-600 font-medium">Assembling 360° customer profile and live telemetry...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & RISK SCORECARD */}
              {activeTab === "overview" && (
                <div className="space-y-6 animate-fade-in">
                  {/* Business Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
                      <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                        Lifetime Spend
                      </span>
                      <span className="text-2xl font-serif font-bold text-stone-900">
                        {formatCurrency(metrics.totalSpend)}
                      </span>
                      <span className="text-[11px] text-stone-500 mt-1 block">
                        Across {metrics.orderCount} order{metrics.orderCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
                      <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block mb-1">
                        Revenue at Risk
                      </span>
                      <span className="text-2xl font-serif font-bold text-rose-900">
                        {formatCurrency(metrics.estimatedRevenueAtRisk)}
                      </span>
                      <span className="text-[11px] text-rose-700/80 mt-1 block">
                        Spend × Churn Probability
                      </span>
                    </div>

                    <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
                      <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                        Average Order Value
                      </span>
                      <span className="text-2xl font-serif font-bold text-stone-900">
                        {formatCurrency(metrics.averageOrderValue)}
                      </span>
                      <span className="text-[11px] text-stone-500 mt-1 block">Per completed transaction</span>
                    </div>

                    <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
                      <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                        90-Day Churn Risk
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-serif font-bold text-stone-900">
                          {risk.churnPercentage ?? ((risk.churnProbability || 0) * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs font-semibold text-stone-600">({risk.riskLevel})</span>
                      </div>
                      <span className="text-[11px] text-stone-500 mt-1 block truncate" title={risk.churnTimeline}>
                        {risk.churnTimeline}
                      </span>
                    </div>
                  </div>

                  {/* SHAP Feature Drivers Section */}
                  <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif font-bold text-sm text-stone-900">Top Statistical Churn Drivers (SHAP)</h4>
                      <span className="text-[11px] text-stone-500">TreeExplainer Game-Theoretic Attribution</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(risk.topSHAPDrivers || []).map((driver, idx) => (
                        <div key={idx} className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-xs text-stone-900">{driver.label}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                driver.direction === "increases_churn"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {driver.direction === "increases_churn" ? "+ Increases Risk" : "– Protects Customer"}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600 mb-2">{driver.description}</p>
                          <div className="text-[10px] font-mono text-stone-500 border-t border-stone-200/80 pt-1.5">
                            SHAP Value: {driver.shap_value > 0 ? "+" : ""}{driver.shap_value?.toFixed(4)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Action Box */}
                  <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-start gap-3 shadow-sm">
                    <span className="text-xl shrink-0 mt-0.5">💡</span>
                    <div>
                      <h5 className="font-bold text-xs text-purple-950 uppercase tracking-wide">
                        Prescribed Retention Playbook
                      </h5>
                      <p className="text-xs text-purple-900 mt-0.5">
                        {retention.primaryRecommendedAction}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CUSTOMER JOURNEY TIMELINE */}
              {activeTab === "journey" && (
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6 animate-fade-in">
                  <div>
                    <h4 className="font-serif font-bold text-base text-stone-900">Chronological Customer Journey</h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Milestones assembled strictly from actual MongoDB registration, order, and behavioral event records.
                    </p>
                  </div>

                  <div className="relative border-l-2 border-stone-200 ml-4 space-y-6 py-2">
                    {journey.map((item, idx) => (
                      <div key={idx} className="relative pl-6">
                        <div className="absolute -left-3.5 top-0.5 w-7 h-7 bg-white border-2 border-stone-300 rounded-full flex items-center justify-center text-xs shadow-sm">
                          {item.icon || "•"}
                        </div>
                        <div className="p-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-serif font-bold text-xs text-stone-900">{item.title}</span>
                            <span className="text-[10px] text-stone-500 font-mono">
                              {item.timestamp ? new Date(item.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: 21-FEATURE BEHAVIORAL MATRIX */}
              {activeTab === "telemetry" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h4 className="font-serif font-bold text-base text-stone-900">21-Feature Point-in-Time Telemetry</h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Canonical behavioral inputs evaluated by the XGBoost pipeline (`2b2147fd4057`).
                    </p>
                  </div>

                  {/* Engagement Category */}
                  <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                    <h5 className="font-serif font-bold text-xs text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
                      1. Engagement & Storefront Activity Signals
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {telemetry.engagement.map((item) => (
                        <div key={item.key} className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl">
                          <span className="text-[11px] font-semibold text-stone-500 block">{item.label}</span>
                          <span className="text-sm font-bold text-stone-900 font-mono mt-0.5 block">{item.formattedValue}</span>
                          <p className="text-[10px] text-stone-500 mt-1 line-clamp-2">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Purchasing Category */}
                  <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                    <h5 className="font-serif font-bold text-xs text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
                      2. Transactional & Purchasing Telemetry
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {telemetry.purchasing.map((item) => (
                        <div key={item.key} className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl">
                          <span className="text-[11px] font-semibold text-stone-500 block">{item.label}</span>
                          <span className="text-sm font-bold text-stone-900 font-mono mt-0.5 block">{item.formattedValue}</span>
                          <p className="text-[10px] text-stone-500 mt-1 line-clamp-2">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Profile Category */}
                  <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                    <h5 className="font-serif font-bold text-xs text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
                      3. Customer Profile & Affinity
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {telemetry.customerProfile.map((item) => (
                        <div key={item.key} className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl">
                          <span className="text-[11px] font-semibold text-stone-500 block">{item.label}</span>
                          <span className="text-sm font-bold text-stone-900 font-mono mt-0.5 block">{item.formattedValue}</span>
                          <p className="text-[10px] text-stone-500 mt-1 line-clamp-2">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ORDER HISTORY */}
              {activeTab === "orders" && (
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4 animate-fade-in">
                  <div>
                    <h4 className="font-serif font-bold text-base text-stone-900">Historical Order Ledger ({orders.length})</h4>
                    <p className="text-xs text-stone-600 mt-0.5">Read-only transactional history from MongoDB orders collection.</p>
                  </div>

                  {orders.length === 0 ? (
                    <div className="py-10 text-center text-stone-500 text-xs">
                      <span className="text-3xl block mb-2">🛍️</span>
                      <p className="font-semibold text-stone-700">No Orders Found</p>
                      <p>This customer has not completed any purchases yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-stone-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                            <th className="py-3 px-4">Order ID</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Items</th>
                            <th className="py-3 px-4">Discount</th>
                            <th className="py-3 px-4">Total</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {orders.map((o) => (
                            <tr key={o.orderId} className="hover:bg-stone-50">
                              <td className="py-3 px-4 font-mono font-medium text-stone-900">{o.orderId}</td>
                              <td className="py-3 px-4 text-stone-600">
                                {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-stone-800">{o.itemsCount} item{o.itemsCount !== 1 ? "s" : ""}</span>
                                {o.items?.length > 0 && (
                                  <span className="text-[10px] text-stone-500 block truncate max-w-[160px]">
                                    {o.items.map((it) => it.name).join(", ")}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono text-stone-600">${(o.discount || 0).toFixed(2)}</td>
                              <td className="py-3 px-4 font-mono font-bold text-stone-900">${(o.total || 0).toFixed(2)}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                                  {o.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: ACTIVITY LOG */}
              {activeTab === "activities" && (
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4 animate-fade-in">
                  <div>
                    <h4 className="font-serif font-bold text-base text-stone-900">Recent Behavioral Activity Stream ({activities.length})</h4>
                    <p className="text-xs text-stone-600 mt-0.5">Latest recorded point-in-time interactions across the storefront.</p>
                  </div>

                  {activities.length === 0 ? (
                    <div className="py-10 text-center text-stone-500 text-xs">
                      <span className="text-3xl block mb-2">⚡</span>
                      <p className="font-semibold text-stone-700">No Recorded Activity</p>
                      <p>No storefront interactions logged for this customer.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-stone-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                            <th className="py-3 px-4">Event Type</th>
                            <th className="py-3 px-4">Route</th>
                            <th className="py-3 px-4">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {activities.map((act) => (
                            <tr key={act.activityId} className="hover:bg-stone-50">
                              <td className="py-3 px-4">
                                <span className="font-semibold text-stone-900 capitalize">
                                  {act.type.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-stone-600">{act.route || "/"}</td>
                              <td className="py-3 px-4 text-stone-500 text-[11px]">
                                {act.createdAt ? new Date(act.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: RETENTION CONTEXT */}
              {activeTab === "retention" && (
                <div className="space-y-5 animate-fade-in">
                  {/* Applicable Retention Action Clusters */}
                  <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                    <h4 className="font-serif font-bold text-sm text-stone-900">Applicable Retention Clusters</h4>
                    {retention.applicableClusters.length === 0 ? (
                      <p className="text-xs text-stone-500">No specific retention intervention clusters triggered.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {retention.applicableClusters.map((cluster, i) => (
                          <div key={i} className="p-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl space-y-2 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-serif font-bold text-xs text-stone-900">{cluster.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    cluster.priority === "High"
                                      ? "bg-rose-100 text-rose-800 border-rose-200"
                                      : "bg-amber-100 text-amber-800 border-amber-200"
                                  }`}
                                >
                                  {cluster.priority}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600">{cluster.description}</p>
                              <p className="text-xs font-semibold text-stone-800 border-t border-stone-200 pt-1.5">
                                Action: {cluster.recommendedAction}
                              </p>
                            </div>
                            {onStageCampaign && (
                              <div className="pt-2 border-t border-stone-200/60 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onStageCampaign({
                                      customerId: profile.userId || userId,
                                      userId: profile.userId || userId,
                                      name: profile.name,
                                      email: profile.email,
                                      churnProbability: risk.churnProbability,
                                      riskLevel: risk.riskLevel,
                                      topDriver: risk.topSHAPDrivers?.[0]?.label || "Behavioral Patterns",
                                      strategy: cluster,
                                    })
                                  }
                                  className="px-2.5 py-1 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800 transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  <span>🚀</span>
                                  <span>Stage Strategy</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Targeted Campaign History */}
                  <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                    <h4 className="font-serif font-bold text-sm text-stone-900">Campaign Staging History ({retention.targetedCampaigns.length})</h4>
                    {retention.targetedCampaigns.length === 0 ? (
                      <p className="text-xs text-stone-500">This customer has not been targeted in any staged retention campaigns yet.</p>
                    ) : (
                      <div className="overflow-x-auto border border-stone-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#FAF8F5] border-b border-stone-200 text-stone-600 uppercase tracking-wider font-semibold text-[11px]">
                              <th className="py-2.5 px-3">Campaign Name</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Priority</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {retention.targetedCampaigns.map((c) => (
                              <tr key={c.campaignId} className="hover:bg-stone-50">
                                <td className="py-2.5 px-3 font-semibold text-stone-900">{c.name}</td>
                                <td className="py-2.5 px-3 text-stone-700 capitalize">{c.campaignType.replace(/_/g, " ")}</td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-800">
                                    {c.priority}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-stone-600">
                                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "N/A"}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                    {c.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F4EFEA] border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>Read-only Customer 360 intelligence view</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors shadow-sm"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}
