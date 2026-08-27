import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { formatFeatureLabel, getFeatureDescription } from "../config/featureLabels";

export default function RiskMovementModal({ userId, onClose, onOpenChurnModal, onOpenCustomer360 }) {
  const { api } = useAuth();
  const [movement, setMovement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    api(`/churn/risk-movement/${userId}`)
      .then((data) => {
        if (isMounted) {
          if (data?.success) setMovement(data);
          else setError(data?.message || "Failed to load risk movement analysis.");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Failed to load risk movement details.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (!userId) return null;

  const getRiskBadge = (level) => {
    switch (level) {
      case "Low":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "High":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Very High":
      default:
        return "bg-rose-100 text-rose-800 border-rose-200";
    }
  };

  const earliest = movement?.earliestRisk || { churnProbability: 0.5, riskLevel: "Medium", topDriver: "30-Day Activity Events" };
  const latest = movement?.latestRisk || { churnProbability: 0.5, riskLevel: "Medium", topDriver: "30-Day Activity Events" };
  const delta = movement?.probabilityChange ?? 0;
  const isReduced = delta > 0.01;
  const isIncreased = delta < -0.01;

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-200 flex items-start justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center text-xl font-serif font-bold shadow-sm">
              📈
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  {movement?.user?.name || "Customer Risk Movement"}
                </h3>
                <span className="text-xs font-mono bg-stone-200 text-stone-700 px-2 py-0.5 rounded-md">
                  {movement?.user?.email || userId}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Before-vs-After observational risk trajectory and SHAP feature comparison.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl font-bold p-1 rounded-lg hover:bg-stone-200/50 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block animate-spin text-3xl">🔄</div>
              <p className="text-xs text-stone-500 font-medium">Synthesizing longitudinal risk snapshots...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
              ⚠️ {error}
            </div>
          ) : (
            <>
              {/* Disclaimer */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                <span className="text-base shrink-0">ℹ️</span>
                <p className="text-[11px] leading-relaxed">
                  {movement?.disclaimer ||
                    "Risk movement is an observed change in model prediction and does not by itself establish that a campaign caused the improvement."}
                </p>
              </div>

              {/* Before vs After Side-by-Side Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* BEFORE Card */}
                <div className="p-5 bg-[#FAF8F5] border border-stone-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      Baseline (Before)
                    </span>
                    <span className="text-xs font-mono text-stone-400">
                      {earliest.capturedAt ? new Date(earliest.capturedAt).toLocaleDateString() : "Baseline"}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-stone-900">
                      {(earliest.churnProbability * 100).toFixed(1)}%
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(earliest.riskLevel)}`}>
                      {earliest.riskLevel}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-stone-200">
                    <span className="text-[10px] font-semibold text-stone-500 block uppercase">Primary Risk Driver</span>
                    <span className="text-xs font-medium text-stone-800 block mt-0.5">
                      {formatFeatureLabel(earliest.topDriver || "30-Day Activity Events")}
                    </span>
                  </div>
                </div>

                {/* AFTER Card */}
                <div className="p-5 bg-white border-2 border-stone-900 rounded-2xl space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-900 uppercase tracking-wider">
                      Current (After)
                    </span>
                    <span className="text-xs font-mono text-emerald-800 font-semibold">
                      Latest Live
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif font-bold text-stone-900">
                      {(latest.churnProbability * 100).toFixed(1)}%
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(latest.riskLevel)}`}>
                      {latest.riskLevel}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-stone-200">
                    <span className="text-[10px] font-semibold text-stone-500 block uppercase">Current SHAP Driver</span>
                    <span className="text-xs font-medium text-stone-800 block mt-0.5">
                      {formatFeatureLabel(latest.topDriver || "30-Day Activity Events")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trajectory Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isReduced
                    ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                    : isIncreased
                    ? "bg-rose-50 border-rose-200 text-rose-950"
                    : "bg-stone-100 border-stone-300 text-stone-800"
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">
                    Observed Trajectory
                  </span>
                  <span className="text-sm font-bold block mt-0.5">
                    {movement?.riskTierTransition || `${earliest.riskLevel} → ${latest.riskLevel}`}
                  </span>
                  <span className="text-xs opacity-90 block mt-0.5">
                    {movement?.interpretation}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-serif font-bold block">
                    {delta > 0 ? `-${(delta * 100).toFixed(1)} pp` : `+${(Math.abs(delta) * 100).toFixed(1)} pp`}
                  </span>
                  <span className="text-[10px] font-mono opacity-80 uppercase">Probability Delta</span>
                </div>
              </div>

              {/* Snapshot Timeline */}
              {movement?.timeline && movement.timeline.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-serif font-bold text-xs text-stone-900 uppercase tracking-wider">
                    Chronological Prediction Snapshots
                  </h4>
                  <div className="space-y-2">
                    {movement.timeline.map((snap, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#FAF8F5] border border-stone-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-mono font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-stone-900 block">{snap.source}</span>
                            <span className="text-[10px] text-stone-500 font-mono">
                              {snap.capturedAt ? new Date(snap.capturedAt).toLocaleString() : "Point-in-time"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-stone-900">
                            {(snap.churnProbability * 100).toFixed(1)}%
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(snap.riskLevel)}`}>
                            {snap.riskLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onOpenCustomer360 && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCustomer360(userId);
                }}
                className="px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors shadow-sm"
              >
                👤 Customer 360°
              </button>
            )}
            {onOpenChurnModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenChurnModal(userId);
                }}
                className="px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition-colors shadow-sm"
              >
                ⚡ Live SHAP Attribution
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 rounded-xl text-xs font-semibold text-stone-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
