import { executeAutomaticRetentionBatch, getAutomaticRetentionConfig } from "./automaticRetentionService.js";

let intervalHandle = null;
let isRunning = false;
let modelsRef = {};

/**
 * Initializes and starts the background automatic retention scheduler.
 */
export function initAutomaticRetentionScheduler(models = {}) {
  modelsRef = models;
  const config = getAutomaticRetentionConfig();

  // If already running interval, clear it
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  // Check every 60 minutes or on server startup if enabled
  const checkIntervalMs = 60 * 60 * 1000;

  intervalHandle = setInterval(async () => {
    const currentConfig = getAutomaticRetentionConfig();
    if (currentConfig.enabled && !isRunning) {
      await runScheduledEvaluation();
    }
  }, checkIntervalMs);

  console.log(`[AUTOMATIC RETENTION SCHEDULER] Initialized. Status: ${config.enabled ? "ENABLED" : "DISABLED"} | Mode: ${config.dryRun ? "DRY-RUN" : "LIVE"} | Threshold: ${config.threshold} | Cooldown: ${config.cooldownDays}d`);

  return {
    active: Boolean(intervalHandle),
    config,
  };
}

/**
 * Executes a scheduled automatic evaluation with concurrency guards.
 */
export async function runScheduledEvaluation() {
  if (isRunning) {
    console.log("[AUTOMATIC RETENTION SCHEDULER] Skipping run — previous evaluation is still in progress.");
    return { skipped: true, reason: "concurrent_run_blocked" };
  }

  isRunning = true;
  console.log("[AUTOMATIC RETENTION SCHEDULER] Starting scheduled automatic retention evaluation...");

  try {
    const result = await executeAutomaticRetentionBatch({
      isDryRun: null, // Use runtime configuration
      forceTrigger: false,
      triggeredBy: "scheduler",
      models: modelsRef,
    });
    console.log(`[AUTOMATIC RETENTION SCHEDULER] Completed evaluation: Evaluated=${result.evaluatedCount}, Eligible=${result.eligibleCount}, Sent=${result.sentCount}, Skipped=${result.skippedCount}, Failed=${result.failedCount}`);
    return result;
  } catch (err) {
    console.error("[AUTOMATIC RETENTION SCHEDULER] Error during scheduled evaluation:", err.message);
    return { error: err.message };
  } finally {
    isRunning = false;
  }
}

/**
 * Triggers an on-demand evaluation (used by admin dashboard or automated tests).
 */
export async function triggerOnDemandEvaluation({ isDryRun = null, force = true, triggeredBy = "admin" } = {}) {
  if (isRunning) {
    throw new Error("An automatic retention evaluation is currently running. Please wait for it to finish.");
  }

  isRunning = true;
  try {
    const result = await executeAutomaticRetentionBatch({
      isDryRun,
      forceTrigger: force,
      triggeredBy,
      models: modelsRef,
    });
    return result;
  } finally {
    isRunning = false;
  }
}

/**
 * Stops the scheduler background timer.
 */
export function stopAutomaticRetentionScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  isRunning = false;
}
