import React, { useState, useMemo } from "react";

export default function RetentionROISimulator() {
  const [targetCustomers, setTargetCustomers] = useState(250);
  const [interventionCost, setInterventionCost] = useState(5.0); // $
  const [recoveryRate, setRecoveryRate] = useState(18.0); // %
  const [averageOrderValue, setAverageOrderValue] = useState(220); // $

  const scenario = useMemo(() => {
    const n = Math.max(1, Number(targetCustomers) || 1);
    const cost = Math.max(0, Number(interventionCost) || 0);
    const rate = (Number(recoveryRate) || 0) / 100;
    const aov = Math.max(0, Number(averageOrderValue) || 0);

    const campaignCost = Number((n * cost).toFixed(2));
    const estimatedRecoveredCustomers = Math.round(n * rate);
    const estimatedRecoveredRevenue = Number((estimatedRecoveredCustomers * aov).toFixed(2));
    const netReturn = Number((estimatedRecoveredRevenue - campaignCost).toFixed(2));

    const estimatedROI =
      campaignCost > 0
        ? Number((((estimatedRecoveredRevenue - campaignCost) / campaignCost) * 100).toFixed(1))
        : 0;

    return {
      n,
      campaignCost,
      estimatedRecoveredCustomers,
      estimatedRecoveredRevenue,
      netReturn,
      estimatedROI,
    };
  }, [targetCustomers, interventionCost, recoveryRate, averageOrderValue]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-lg text-stone-900">Financial ROI Scenario Calculator</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Scenario Estimate
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-0.5">
            Estimate expected revenue recovery, intervention costs, and financial return on investment for retention campaigns.
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-600">Target Cohort Size</span>
            <span className="font-mono font-bold text-stone-900">{targetCustomers} accounts</span>
          </div>
          <input
            type="range"
            min="10"
            max="2000"
            step="10"
            value={targetCustomers}
            onChange={(e) => setTargetCustomers(Number(e.target.value))}
            className="w-full accent-stone-900"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-600">Cost / Customer ($)</span>
            <span className="font-mono font-bold text-stone-900">${interventionCost}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="30"
            step="0.5"
            value={interventionCost}
            onChange={(e) => setInterventionCost(Number(e.target.value))}
            className="w-full accent-stone-900"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-600">Expected Recovery Rate (%)</span>
            <span className="font-mono font-bold text-stone-900">{recoveryRate}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={recoveryRate}
            onChange={(e) => setRecoveryRate(Number(e.target.value))}
            className="w-full accent-stone-900"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-600">Average Order Value ($)</span>
            <span className="font-mono font-bold text-stone-900">${averageOrderValue}</span>
          </div>
          <input
            type="range"
            min="30"
            max="600"
            step="10"
            value={averageOrderValue}
            onChange={(e) => setAverageOrderValue(Number(e.target.value))}
            className="w-full accent-stone-900"
          />
        </div>
      </div>

      {/* Scenario Financial Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Campaign Budget</span>
          <span className="text-2xl font-serif font-bold text-stone-900 mt-1 block">
            ${scenario.campaignCost.toLocaleString()}
          </span>
          <span className="text-[10px] text-stone-500 mt-1 block">
            ${interventionCost} × {scenario.n} customers
          </span>
        </div>

        <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Recovered Customers</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-serif font-bold text-stone-900">
              {scenario.estimatedRecoveredCustomers}
            </span>
            <span className="text-xs text-stone-500 font-mono">({recoveryRate}%)</span>
          </div>
          <span className="text-[10px] text-stone-500 mt-1 block">
            Retained active buyers
          </span>
        </div>

        <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Recovered Revenue</span>
          <span className="text-2xl font-serif font-bold text-stone-900 mt-1 block">
            ${scenario.estimatedRecoveredRevenue.toLocaleString()}
          </span>
          <span className="text-[10px] text-stone-500 mt-1 block">
            {scenario.estimatedRecoveredCustomers} × ${averageOrderValue} AOV
          </span>
        </div>

        <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Projected ROI</span>
          <span className="text-2xl font-serif font-bold text-emerald-950 mt-1 block">
            {scenario.estimatedROI > 0 ? `+${scenario.estimatedROI}%` : `${scenario.estimatedROI}%`}
          </span>
          <span className="text-[10px] text-emerald-700 mt-1 block">
            Net Value: ${scenario.netReturn.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
