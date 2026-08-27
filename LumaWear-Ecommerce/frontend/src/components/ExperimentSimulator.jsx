import React, { useState, useMemo } from "react";

export default function ExperimentSimulator() {
  const [treatmentSize, setTreatmentSize] = useState(500);
  const [controlSize, setControlSize] = useState(500);
  const [controlConversionRate, setControlConversionRate] = useState(4.5); // %
  const [treatmentConversionRate, setTreatmentConversionRate] = useState(9.2); // %
  const [averageOrderValue, setAverageOrderValue] = useState(185); // $
  const [costPerCustomer, setCostPerCustomer] = useState(3.5); // $

  const results = useMemo(() => {
    const nT = Math.max(1, Number(treatmentSize) || 1);
    const nC = Math.max(1, Number(controlSize) || 1);
    const crC = (Number(controlConversionRate) || 0) / 100;
    const crT = (Number(treatmentConversionRate) || 0) / 100;
    const aov = Math.max(0, Number(averageOrderValue) || 0);
    const costPerCust = Math.max(0, Number(costPerCustomer) || 0);

    const treatmentConversions = Math.round(nT * crT);
    const controlConversions = Math.round(nC * crC);

    // Expected control conversions if applied to treatment group size
    const expectedBaselineConversions = Math.round(nT * crC);
    const incrementalConversions = Math.max(0, treatmentConversions - expectedBaselineConversions);
    const incrementalConversionRate = Number(((crT - crC) * 100).toFixed(2));

    const totalCampaignCost = Number((nT * costPerCust).toFixed(2));
    const estimatedIncrementalRevenue = Number((incrementalConversions * aov).toFixed(2));
    const netProfit = Number((estimatedIncrementalRevenue - totalCampaignCost).toFixed(2));

    const estimatedROI =
      totalCampaignCost > 0
        ? Number((((estimatedIncrementalRevenue - totalCampaignCost) / totalCampaignCost) * 100).toFixed(1))
        : 0;

    return {
      nT,
      nC,
      treatmentConversions,
      controlConversions,
      incrementalConversions,
      incrementalConversionRate,
      totalCampaignCost,
      estimatedIncrementalRevenue,
      netProfit,
      estimatedROI,
    };
  }, [treatmentSize, controlSize, controlConversionRate, treatmentConversionRate, averageOrderValue, costPerCustomer]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-lg text-stone-900">A/B Retention Experiment Simulator</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full border border-purple-200">
              Simulation Framework
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-0.5">
            Model randomized treatment vs. control holdout groups to calculate causal incremental lift and experimental ROI.
          </p>
        </div>
      </div>

      {/* Simulator Disclaimer Box */}
      <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl text-xs text-purple-950 flex items-start gap-3">
        <span className="text-base shrink-0">🧪</span>
        <div>
          <span className="font-bold uppercase tracking-wider block text-[11px]">Experimental Design Methodology</span>
          <p className="mt-0.5 leading-relaxed text-[11px] opacity-90">
            A/B holdout testing isolates the true causal effect of a retention campaign from natural customer self-recovery.
            This simulator projects business impact based on configurable hypothesis parameters.
          </p>
        </div>
      </div>

      {/* Input Sliders & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="space-y-4 p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
          <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block">Cohort Sizing</span>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600">Treatment Group Size (N)</span>
              <span className="font-mono font-bold text-stone-900">{treatmentSize}</span>
            </div>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              value={treatmentSize}
              onChange={(e) => setTreatmentSize(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600">Control Holdout Size (N)</span>
              <span className="font-mono font-bold text-stone-900">{controlSize}</span>
            </div>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              value={controlSize}
              onChange={(e) => setControlSize(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>
        </div>

        <div className="space-y-4 p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
          <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block">Conversion Lift Rates</span>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600">Control Conversion Rate (%)</span>
              <span className="font-mono font-bold text-stone-900">{controlConversionRate}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="20"
              step="0.1"
              value={controlConversionRate}
              onChange={(e) => setControlConversionRate(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600">Treatment Conversion Rate (%)</span>
              <span className="font-mono font-bold text-stone-900">{treatmentConversionRate}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="35"
              step="0.1"
              value={treatmentConversionRate}
              onChange={(e) => setTreatmentConversionRate(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>
        </div>

        <div className="space-y-4 p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
          <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block">Financial Economics</span>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600">Average Order Value ($)</span>
              <span className="font-mono font-bold text-stone-900">${averageOrderValue}</span>
            </div>
            <input
              type="range"
              min="20"
              max="800"
              step="5"
              value={averageOrderValue}
              onChange={(e) => setAverageOrderValue(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600">Cost per Targeted Customer ($)</span>
              <span className="font-mono font-bold text-stone-900">${costPerCustomer}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="25"
              step="0.1"
              value={costPerCustomer}
              onChange={(e) => setCostPerCustomer(Number(e.target.value))}
              className="w-full accent-stone-900"
            />
          </div>
        </div>
      </div>

      {/* Experimental Results Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Incremental Lift</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-serif font-bold text-purple-900">
              +{results.incrementalConversionRate}%
            </span>
            <span className="text-xs text-purple-700 font-mono">({results.incrementalConversions} orders)</span>
          </div>
          <span className="text-[10px] text-stone-500 mt-1 block">
            {results.treatmentConversions} Treatment vs. {Math.round(results.nT * (controlConversionRate / 100))} Baseline
          </span>
        </div>

        <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Incremental Revenue</span>
          <span className="text-2xl font-serif font-bold text-stone-900 mt-1 block">
            ${results.estimatedIncrementalRevenue.toLocaleString()}
          </span>
          <span className="text-[10px] text-stone-500 mt-1 block">
            From {results.incrementalConversions} incremental conversions
          </span>
        </div>

        <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Campaign Cost</span>
          <span className="text-2xl font-serif font-bold text-stone-900 mt-1 block">
            ${results.totalCampaignCost.toLocaleString()}
          </span>
          <span className="text-[10px] text-stone-500 mt-1 block">
            ${costPerCustomer} × {results.nT} customers
          </span>
        </div>

        <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Estimated ROI</span>
          <span className="text-2xl font-serif font-bold text-emerald-950 mt-1 block">
            {results.estimatedROI > 0 ? `+${results.estimatedROI}%` : `${results.estimatedROI}%`}
          </span>
          <span className="text-[10px] text-emerald-700 mt-1 block">
            Net Profit: ${results.netProfit.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
