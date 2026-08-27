import React, { useState, useMemo } from "react";

export default function RiskCategoryCustomerModal({
  isOpen = true,
  onClose,
  riskTier,
  riskInfo,
  customers = [],
  onOpenChurnModal,
  onOpenCustomer360,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const tier = riskTier || "Low";

  // Filter customers matching this exact risk tier
  const tierCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];
    return customers.filter((c) => {
      const level = c.risk_level || c.riskLevel || "Low";
      return level.toLowerCase() === tier.toLowerCase();
    });
  }, [customers, tier]);

  // Apply optional search filter within the tier
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return tierCustomers;
    const q = searchQuery.toLowerCase().trim();
    return tierCustomers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const id = String(c.user_id || c.customerId || c._id || "").toLowerCase();
      return name.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [tierCustomers, searchQuery]);

  if (!isOpen) return null;

  const getTierBadgeStyle = (tierName) => {
    switch (tierName?.toLowerCase()) {
      case "very high":
        return {
          bg: "bg-rose-50 text-rose-800 border-rose-200",
          pill: "bg-rose-600 text-white",
          accent: "text-rose-600",
          border: "border-rose-300",
        };
      case "high":
        return {
          bg: "bg-orange-50 text-orange-800 border-orange-200",
          pill: "bg-orange-500 text-white",
          accent: "text-orange-600",
          border: "border-orange-300",
        };
      case "medium":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          pill: "bg-amber-500 text-white",
          accent: "text-amber-600",
          border: "border-amber-300",
        };
      case "low":
      default:
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          pill: "bg-emerald-600 text-white",
          accent: "text-emerald-600",
          border: "border-emerald-300",
        };
    }
  };

  const badgeStyle = getTierBadgeStyle(tier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#FAF8F5] border border-stone-300 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-[#F4EFEA] border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeStyle.pill}`}>
              {tier} Risk Cohort
            </span>
            <div>
              <h3 className="text-xl font-serif font-bold text-stone-900">
                {tier} Churn Risk Customers
              </h3>
              <p className="text-xs text-stone-600">
                {tierCustomers.length} customer{tierCustomers.length === 1 ? "" : "s"} identified from live MongoDB scoring ({riskInfo?.percentage ?? 0}% of customer base)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div className="p-4 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search by customer name, registered email, or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-900"
            />
            <span className="absolute left-3 top-2.5 text-stone-400 text-xs">🔍</span>
          </div>

          <span className="text-xs text-stone-500">
            Showing <strong>{filteredCustomers.length}</strong> of {tierCustomers.length} customer(s)
          </span>
        </div>

        {/* Customer List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-xl border border-stone-200">
              <span className="text-4xl block mb-2">👥</span>
              <h4 className="text-base font-semibold text-stone-800">
                {tierCustomers.length === 0
                  ? `No customers in ${tier} Risk category`
                  : "No matching customers found"}
              </h4>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                {tierCustomers.length === 0
                  ? `None of the registered customers currently meet the feature criteria for the ${tier} Risk tier.`
                  : "Try clearing your search query to see all customers in this risk cohort."}
              </p>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const uid = String(cust.user_id || cust.customerId || cust._id);
              const probPct = cust.churn_percentage ?? (Number(cust.churn_probability) * 100).toFixed(1);
              const metrics = cust.metrics || {};
              const topDriver = cust.top_driver;

              return (
                <div
                  key={uid}
                  className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-400 transition-all shadow-sm flex flex-col gap-4"
                >
                  {/* Top Row: Customer Identity & Churn Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-stone-900">{cust.name || "Customer"}</h4>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${badgeStyle.bg}`}>
                          {tier} Risk ({probPct}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-600 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-stone-800">
                          📧 {cust.email || "No email registered"}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-stone-500">ID: {uid}</span>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2">
                      {onOpenChurnModal && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChurnModal(uid);
                            onClose();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-stone-900 bg-[#FAF8F5] border border-stone-300 rounded-lg hover:bg-stone-100 transition shadow-sm flex items-center gap-1"
                        >
                          <span>⚡</span>
                          <span>Analyze Risk</span>
                        </button>
                      )}
                      {onOpenCustomer360 && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenCustomer360(uid);
                            onClose();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition shadow-sm flex items-center gap-1"
                        >
                          <span>👤</span>
                          <span>Customer 360</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Middle Row: Live Telemetry Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] p-3.5 rounded-xl border border-stone-200/80 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Spend</span>
                      <span className="text-sm font-bold text-stone-900">${metrics.total_spend ?? 0}</span>
                      <span className="text-[10px] text-stone-500 block">${metrics.spend_30d ?? 0} in 30d</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Order Activity</span>
                      <span className="text-sm font-bold text-stone-900">{metrics.order_count ?? 0} orders</span>
                      <span className="text-[10px] text-stone-500 block">{metrics.orders_30d ?? 0} in last 30d</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Last Order</span>
                      <span className="text-xs font-semibold text-stone-900 block truncate">
                        {metrics.days_since_last_order !== null && metrics.days_since_last_order !== undefined
                          ? `${metrics.days_since_last_order}d ago`
                          : "No orders"}
                      </span>
                      {metrics.last_order && (
                        <span className="text-[10px] text-stone-500 block">${metrics.last_order.total}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Last Activity</span>
                      <span className="text-xs font-semibold text-stone-900 block truncate">
                        {cust.last_activity
                          ? `${cust.last_activity.days_ago}d ago (${cust.last_activity.type})`
                          : "No recorded activity"}
                      </span>
                      <span className="text-[10px] text-stone-500 block">
                        {metrics.activity_event_count_30d ?? 0} events / 30d
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Top SHAP Driver & Recommended Retention Strategy */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
                    {topDriver ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-500 font-medium">Top Driver:</span>
                        <span className="font-semibold text-stone-800">{topDriver.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            topDriver.direction === "increases_churn"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {topDriver.direction === "increases_churn" ? "▲ Increases Risk" : "▼ Reduces Risk"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-stone-400 italic">No dominant SHAP driver</span>
                    )}

                    {cust.top_recommendation && (
                      <div className="text-stone-600 text-[11px] truncate max-w-md">
                        💡 <span className="italic">{cust.top_recommendation}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F4EFEA] border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-600">
            Authoritative data derived directly from MongoDB customer records &amp; XGBoost pipeline.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
