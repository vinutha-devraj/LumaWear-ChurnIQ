/**
 * components/ChurnPredictionModal.jsx
 * Interactive modal presenting live churn risk scoring, 4-tier risk classification,
 * SHAP explainability drivers, tailored retention recommendations, and raw behavioral signals.
 */

import { useEffect, useState } from "react";
import { getFeatureDisplay } from "../config/featureLabels";

export default function ChurnPredictionModal({ user, onClose, api }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [predictionData, setPredictionData] = useState(null);

  const fetchPrediction = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    try {
      const data = await api(`/churn/predict/${user.id}`);
      if (data?.prediction) {
        setPredictionData(data.prediction);
      } else {
        throw new Error("No prediction payload returned");
      }
    } catch (err) {
      setError(err.message || "Failed to load live churn prediction.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, [user?.id]);

  if (!user) return null;

  const riskLevel = predictionData?.risk_level || "Low";
  const churnPct = predictionData?.churn_percentage ?? 0;
  const churnProb = predictionData?.churn_probability ?? 0;
  const timeline = predictionData?.churn_timeline || "Low near-term churn risk";
  const willChurn = predictionData?.churn_prediction === 1;
  const shapFeatures = predictionData?.top_shap_features || [];
  const recommendations = predictionData?.recommendations || [];
  const customerInput = predictionData?.customer_input || {};

  // Risk tier color styling
  const riskStyles = {
    Low: {
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
      pill: "bg-emerald-100 text-emerald-800",
      bar: "bg-emerald-500",
      badge: "border-emerald-300 text-emerald-700 bg-emerald-50/50",
    },
    Medium: {
      bg: "bg-amber-50 text-amber-800 border-amber-200",
      pill: "bg-amber-100 text-amber-800",
      bar: "bg-amber-500",
      badge: "border-amber-300 text-amber-700 bg-amber-50/50",
    },
    High: {
      bg: "bg-orange-50 text-orange-800 border-orange-200",
      pill: "bg-orange-100 text-orange-800",
      bar: "bg-orange-500",
      badge: "border-orange-300 text-orange-700 bg-orange-50/50",
    },
    "Very High": {
      bg: "bg-rose-50 text-rose-800 border-rose-200",
      pill: "bg-rose-100 text-rose-800",
      bar: "bg-rose-600",
      badge: "border-rose-300 text-rose-700 bg-rose-50/50",
    },
  }[riskLevel] || {
    bg: "bg-gray-50 text-gray-800 border-gray-200",
    pill: "bg-gray-100 text-gray-800",
    bar: "bg-gray-500",
    badge: "border-gray-300 text-gray-700 bg-gray-50",
  };

  const priorityStyles = {
    High: "bg-rose-100 text-rose-800 border-rose-200",
    Medium: "bg-amber-100 text-amber-800 border-amber-200",
    Low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const maxShap = Math.max(...shapFeatures.map((s) => Math.abs(s.shap_value || 0)), 0.001);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl2 border border-sand bg-cream shadow-soft overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-sand bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="text-xl font-semibold text-charcoal">Customer Churn Risk Analysis</h2>
            </div>
            <p className="mt-0.5 text-xs text-charcoal/60">
              Live AI-powered churn assessment for <span className="font-medium text-charcoal">{user.name || user.email}</span> (ID: <code className="text-xs">{user.id}</code>)
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-sand bg-cream text-charcoal/70 transition hover:bg-sand hover:text-charcoal"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-charcoal border-t-transparent"></div>
                <span className="text-sm font-medium text-charcoal/80">
                  Extracting live MongoDB features & running inference...
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="h-28 animate-pulse rounded-xl2 bg-sand/40"></div>
                <div className="h-28 animate-pulse rounded-xl2 bg-sand/40"></div>
                <div className="h-28 animate-pulse rounded-xl2 bg-sand/40"></div>
              </div>
              <div className="h-44 animate-pulse rounded-xl2 bg-sand/30"></div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="rounded-xl2 border border-rose-200 bg-rose-50 p-5 text-rose-800">
              <div className="flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Unable to Score Customer</h3>
                  <p className="mt-1 text-xs text-rose-700">{error}</p>
                  <button
                    onClick={fetchPrediction}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 shadow-sm transition hover:bg-rose-100"
                  >
                    🔄 Retry Analysis
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Successful Prediction Display */}
          {!loading && !error && predictionData && (
            <>
              {/* Top Overview Grid */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Churn Risk Score Card */}
                <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wider text-charcoal/60">
                    Churn Probability
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-charcoal">{churnPct}%</span>
                    <span className="text-xs text-charcoal/50">({churnProb.toFixed(4)})</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-medium text-charcoal/60">
                      <span>Low</span>
                      <span>Med</span>
                      <span>High</span>
                      <span>Crit</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-sand/50">
                      <div
                        className={`h-full transition-all duration-500 ${riskStyles.bar}`}
                        style={{ width: `${Math.min(100, Math.max(5, churnPct))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Risk Level Card */}
                <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wider text-charcoal/60">
                    Risk Classification
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${riskStyles.pill}`}>
                      {riskLevel} Risk
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-charcoal/70">{timeline}</p>
                </div>

                {/* Churn Prediction Status */}
                <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wider text-charcoal/60">
                    Predicted Outcome
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        willChurn
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <span>{willChurn ? "🔴" : "🟢"}</span>
                      {predictionData.churn_label || (willChurn ? "Will Churn" : "Will Not Churn")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-charcoal/60">
                    90-Day customer retention horizon
                  </p>
                </div>
              </div>

              {/* SHAP Feature Explanations Section */}
              <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-charcoal">
                    Key Drivers Behind This Prediction (SHAP)
                  </h3>
                  <span className="rounded bg-sand/40 px-2 py-0.5 text-[11px] font-medium text-charcoal/70">
                    Top Contributing Signals
                  </span>
                </div>
                <p className="mt-1 text-xs text-charcoal/60">
                  Explains which customer behaviors increase risk or protect retention for this individual account.
                </p>

                <div className="mt-4 space-y-3">
                  {shapFeatures.map((item, idx) => {
                    const display = getFeatureDisplay(item.feature);
                    const isIncreases = item.direction === "increases_churn";
                    const impactPct = Math.min(100, Math.max(8, (Math.abs(item.shap_value) / maxShap) * 100));

                    return (
                      <div key={idx} className="rounded-lg border border-sand/70 bg-cream/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-medium text-xs text-charcoal">{display.label}</span>
                            <span className="ml-2 font-mono text-[11px] text-charcoal/50">
                              ({item.feature})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                                isIncreases
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isIncreases ? "↑ Increases Churn Risk" : "↓ Reduces Churn Risk"}
                            </span>
                            <span className="font-mono text-xs font-semibold text-charcoal">
                              {item.shap_value > 0 ? "+" : ""}
                              {item.shap_value.toFixed(4)}
                            </span>
                          </div>
                        </div>

                        {/* Impact Bar */}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sand/60">
                          <div
                            className={`h-full rounded-full ${
                              isIncreases ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${impactPct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Personalized Retention Recommendations */}
              <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-charcoal">
                  Recommended Retention Actions
                </h3>
                <p className="mt-1 text-xs text-charcoal/60">
                  Actionable retention steps automatically generated from live customer behavioral signals.
                </p>

                <div className="mt-4 space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-sand/80 bg-cream/20 p-3.5"
                    >
                      <span
                        className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          priorityStyles[rec.priority] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {rec.priority} Priority
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-charcoal leading-relaxed">
                          {rec.recommendation}
                        </p>
                        {rec.driven_by && (
                          <span className="mt-1 inline-block text-[11px] text-charcoal/50">
                            Triggered by: <code className="font-mono">{rec.driven_by}</code>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Behavioral Signals Summary */}
              <div className="rounded-xl2 border border-sand bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-charcoal">
                  Live Customer Signals (MongoDB Point-in-Time Features)
                </h3>
                <p className="mt-1 text-xs text-charcoal/60">
                  Authoritative feature values extracted in real time from live customer records.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Account Tenure</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.tenure_days != null ? `${customerInput.tenure_days} days` : "—"}
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Days Since Last Login</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.days_since_last_login != null ? `${customerInput.days_since_last_login}d ago` : "—"}
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Days Since Last Activity</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.days_since_last_activity != null ? `${customerInput.days_since_last_activity}d ago` : "—"}
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">30-Day Activity Events</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.activity_event_count_30d ?? 0} events
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">30-Day Page Views</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.page_views_30d ?? 0} views
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">30-Day Cart Actions</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.cart_actions_30d ?? 0} actions
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">30-Day Wishlist Actions</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.wishlist_actions_30d ?? 0} actions
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Lifetime Spend</span>
                    <p className="text-sm font-semibold text-charcoal">
                      ${Number(customerInput.total_spend || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Lifetime Orders</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.order_count ?? 0} orders
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Average Order Value</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.average_order_value != null ? `$${Number(customerInput.average_order_value).toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Preferred Category</span>
                    <p className="text-sm font-semibold text-charcoal capitalize">
                      {customerInput.preferred_order_category || "None"}
                    </p>
                  </div>
                  <div className="rounded border border-sand/60 bg-cream/40 p-2.5">
                    <span className="text-[11px] text-charcoal/60">Order Frequency</span>
                    <p className="text-sm font-semibold text-charcoal">
                      {customerInput.order_frequency != null ? `${Number(customerInput.order_frequency).toFixed(2)}/mo` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-sand bg-white px-6 py-3">
          <span className="text-[11px] text-charcoal/50">
            Model Artifact: <code className="font-mono">2b2147fd4057</code> (CV AUC: 0.837)
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-sand bg-cream px-4 py-1.5 text-xs font-medium text-charcoal transition hover:bg-sand"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
