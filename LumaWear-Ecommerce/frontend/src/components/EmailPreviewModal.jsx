import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function EmailPreviewModal({
  isOpen = true,
  onClose,
  campaign,
  onDispatched,
}) {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState("");
  const [activeRecipientIndex, setActiveRecipientIndex] = useState(0);
  const [viewMode, setViewMode] = useState("html"); // 'html' | 'text'
  const [dispatching, setDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const campaignId = campaign?.campaignId || campaign?._id;

  useEffect(() => {
    if (!campaignId) return;

    let isMounted = true;
    setLoading(true);
    setError("");
    setDispatchSuccess(null);

    api(`/churn/campaigns/${campaignId}/email-preview`)
      .then((res) => {
        if (isMounted) {
          if (res.success) {
            setPreviewData(res);
          } else {
            setError(res.message || "Failed to load email preview.");
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Error loading email preview.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [campaignId, api]);

  if (!isOpen || !campaign) return null;

  const recipients = previewData?.recipients || [];
  const activeRecipient = recipients[activeRecipientIndex] || recipients[0];
  const isLiveMode = previewData?.emailConfig?.mode === "live" || previewData?.emailConfig?.smtpConfigured === true;

  const handleDispatch = async () => {
    setDispatching(true);
    setError("");
    try {
      const res = await api(`/churn/campaigns/${campaignId}/send-emails`, {
        method: "POST",
      });

      if (res?.success) {
        setDispatchSuccess(res);
        if (onDispatched) {
          onDispatched(res);
        }
      } else {
        setError(res?.message || "Failed to execute email dispatch.");
      }
    } catch (err) {
      setError(err.message || "Network error during email dispatch.");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-[#FAF8F5] border border-stone-300 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#F4EFEA] border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📧</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-serif font-bold text-stone-900">
                  Retention Strategy Email Preview
                </h3>
                {isLiveMode ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    🚀 Live SMTP Mode Active
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    ⚡ Dry-Run Mode Active
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600">
                Campaign: <strong>{campaign.name}</strong> • Strategy:{" "}
                <span className="font-mono text-[11px]">{campaign.campaignType || campaign.strategy}</span>
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

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span>Email failed to send: {error}</span>
            </div>
          )}

          {dispatchSuccess && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                dispatchSuccess.mode === "live"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : "bg-amber-50 border-amber-200 text-amber-950"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>{dispatchSuccess.mode === "live" ? "🚀" : "⚡"}</span>
                <span>
                  {dispatchSuccess.mode === "live"
                    ? "Email sent successfully."
                    : "Dry-run completed — no real email was sent."}
                </span>
              </div>
              <p className={dispatchSuccess.mode === "live" ? "text-emerald-800" : "text-amber-800"}>
                {dispatchSuccess.mode === "live"
                  ? `Real email delivered via SMTP to ${
                      dispatchSuccess.results?.map((r) => r.email).filter(Boolean).join(", ") || "target customer"
                    }. Outbound marketing telemetry recorded to MongoDB.`
                  : `Dispatched ${dispatchSuccess.dispatchedCount} message(s) in simulated dry-run mode. Outbound marketing telemetry recorded to MongoDB.`}
              </p>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-2">
              <div className="inline-block animate-spin text-2xl">🔄</div>
              <p className="text-xs text-stone-500">Generating personalized strategy copy for target customer(s)...</p>
            </div>
          ) : recipients.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500">
              No recipient email data available for this campaign.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Target Audience & Email Validity Audit Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-white border border-stone-200 rounded-xl text-xs shadow-sm">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-stone-500">Total Targeted:</span>
                  <span className="block text-base font-bold text-stone-900">{recipients.length}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Valid Emails:</span>
                  <span className="block text-base font-bold text-emerald-800">{previewData?.validRecipientCount || 0}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-rose-700">Invalid / Missing:</span>
                  <span className="block text-base font-bold text-rose-800">
                    {recipients.length - (previewData?.validRecipientCount || 0)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-blue-700">Receiving Email:</span>
                  <span className="block text-base font-bold text-blue-800">{previewData?.validRecipientCount || 0}</span>
                </div>
              </div>

              {/* Recipient Selector (if multiple customers) */}
              {recipients.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[11px] font-bold uppercase text-stone-500 shrink-0">Recipients:</span>
                  {recipients.map((r, idx) => (
                    <button
                      key={r.customerId}
                      onClick={() => setActiveRecipientIndex(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                        activeRecipientIndex === idx
                          ? "bg-stone-900 text-white shadow-sm"
                          : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {r.customerName} ({r.email})
                    </button>
                  ))}
                </div>
              )}

              {/* Recipient Meta Bar */}
              {activeRecipient && (
                <div className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-1.5 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-800">
                      To: {activeRecipient.customerName} &lt;{activeRecipient.email || "No email"}&gt;
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeRecipient.emailValid
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {activeRecipient.emailValid ? "Valid Email" : "Invalid / Missing Email"}
                    </span>
                  </div>
                  <div className="text-stone-600">
                    <span className="font-semibold text-stone-900">Subject: </span>
                    <span>{activeRecipient.subject}</span>
                  </div>
                </div>
              )}

              {/* View Switcher */}
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Message Preview</span>
                <div className="flex items-center gap-1 bg-stone-200 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("html")}
                    className={`px-2.5 py-0.5 rounded-md font-semibold transition ${
                      viewMode === "html" ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    HTML Render
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("text")}
                    className={`px-2.5 py-0.5 rounded-md font-semibold transition ${
                      viewMode === "text" ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    Plain Text
                  </button>
                </div>
              </div>

              {/* Explicit Confirmation Checkbox for Batch Sending (Requirement 9) */}
              {recipients.length > 1 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950">
                  <input
                    type="checkbox"
                    id="confirmBatchSend"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className="rounded border-amber-400 text-stone-900 focus:ring-stone-900 cursor-pointer"
                  />
                  <label htmlFor="confirmBatchSend" className="font-semibold cursor-pointer select-none">
                    I explicitly confirm sending retention emails to all {previewData?.validRecipientCount || 0} valid real customers.
                  </label>
                </div>
              )}

              {/* Preview Container */}
              {activeRecipient && (
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-inner">
                  {viewMode === "html" ? (
                    <div
                      className="p-4 overflow-y-auto max-h-72 text-sm"
                      dangerouslySetInnerHTML={{ __html: activeRecipient.htmlBody }}
                    />
                  ) : (
                    <pre className="p-4 overflow-y-auto max-h-72 text-xs font-mono text-stone-800 whitespace-pre-wrap leading-relaxed">
                      {activeRecipient.textBody}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F4EFEA] border-t border-stone-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-100 transition shadow-sm"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDispatch}
              disabled={
                loading ||
                dispatching ||
                (previewData?.validRecipientCount || 0) === 0 ||
                (recipients.length > 1 && !isConfirmed)
              }
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                isLiveMode
                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                  : "bg-stone-900 text-white hover:bg-black"
              }`}
            >
              <span>{dispatching ? "🔄" : isLiveMode ? "🚀" : "⚡"}</span>
              <span>
                {dispatching
                  ? "Dispatching..."
                  : isLiveMode
                  ? `Send Retention Emails (${previewData?.validRecipientCount || 0})`
                  : `Execute Retention Emails (Dry Run • ${previewData?.validRecipientCount || 0})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
