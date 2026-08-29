import { extractCustomerFeatures } from "./features.js";
import { validateCustomerEmail, sendRetentionEmail, getEmailConfigurationStatus } from "./emailService.js";
import { getStrategyEmailContent, getPublicStoreUrl } from "./retentionEmailTemplates.js";

/**
 * Default runtime configuration for Automatic Retention.
 * Configurable via environment variables or admin runtime updates.
 */
let runtimeConfig = {
  enabled: process.env.AUTOMATIC_RETENTION_ENABLED === "true",
  dryRun: process.env.AUTOMATIC_RETENTION_DRY_RUN !== "false", // Default: true for safety
  threshold: Number(process.env.AUTOMATIC_RETENTION_THRESHOLD) || 0.70,
  cooldownDays: Number(process.env.AUTOMATIC_RETENTION_COOLDOWN_DAYS) || 7,
  batchSize: Number(process.env.AUTOMATIC_RETENTION_BATCH_SIZE) || 50,
  cronSchedule: process.env.AUTOMATIC_RETENTION_CRON || "0 10 * * *",
  lastRunAt: null,
  lastRunStats: null,
};

export function getAutomaticRetentionConfig() {
  return { ...runtimeConfig };
}

export function updateAutomaticRetentionConfig(updates = {}) {
  if (typeof updates.enabled === "boolean") runtimeConfig.enabled = updates.enabled;
  if (typeof updates.dryRun === "boolean") runtimeConfig.dryRun = updates.dryRun;
  if (typeof updates.threshold === "number" && updates.threshold >= 0 && updates.threshold <= 1) {
    runtimeConfig.threshold = updates.threshold;
  }
  if (typeof updates.cooldownDays === "number" && updates.cooldownDays >= 1) {
    runtimeConfig.cooldownDays = updates.cooldownDays;
  }
  if (typeof updates.batchSize === "number" && updates.batchSize >= 1) {
    runtimeConfig.batchSize = updates.batchSize;
  }
  return getAutomaticRetentionConfig();
}

/**
 * Validates whether a customer is eligible for automatic retention outreach.
 * 
 * Rules:
 * 1. Customer must exist and not be an admin.
 * 2. Customer must have a valid email format.
 * 3. Customer must have a valid churn prediction probability.
 * 4. Churn probability must meet or exceed the threshold (default: >= 0.70).
 * 5. Customer must not have opted out of marketing (marketingOptOut !== true).
 */
export function isEligibleForAutomaticRetention(customer, prediction, context = {}) {
  const threshold = typeof context.threshold === "number" ? context.threshold : runtimeConfig.threshold;

  if (!customer) {
    return { eligible: false, skipReason: "invalid_customer" };
  }

  // 1. Role check
  if (customer.role === "admin") {
    return { eligible: false, skipReason: "non_customer" };
  }

  // 2. Email check
  const email = (customer.email || "").trim();
  const validation = validateCustomerEmail(email);
  if (!validation.valid) {
    return { eligible: false, skipReason: "invalid_email" };
  }

  // 3. Marketing preference check
  if (customer.marketingOptOut === true || customer.isOptedOut === true) {
    return { eligible: false, skipReason: "marketing_opt_out" };
  }

  // 4. Prediction validity check
  if (!prediction || typeof prediction.churn_probability !== "number" || isNaN(prediction.churn_probability)) {
    return { eligible: false, skipReason: "invalid_prediction" };
  }

  const churnProbability = Number(prediction.churn_probability);

  // 5. Churn threshold check
  if (churnProbability < threshold) {
    return { eligible: false, skipReason: "below_threshold", churnProbability };
  }

  return {
    eligible: true,
    skipReason: null,
    churnProbability,
    riskTier: prediction.risk_level || "High",
  };
}

/**
 * Selects the optimal retention strategy based on customer behavioral features & prediction.
 * Uses existing 7 retention strategies from retentionEmailTemplates.js without altering ML logic.
 */
export function selectRetentionStrategy(customer, features = {}, prediction = {}) {
  const churnProbability = Number(prediction.churn_probability) || 0;
  const cartActions30d = Number(features.cart_actions_30d) || 0;
  const orders30d = Number(features.orders_30d) || 0;
  const daysSinceActivity = features.days_since_last_activity;
  const daysSinceLogin = features.days_since_last_login;
  const totalSpend = Number(features.total_spend) || 0;
  const wishlistActions30d = Number(features.wishlist_actions_30d) || 0;
  const productViews30d = Number(features.product_views_30d) || 0;
  const tenureDays = features.tenure_days;
  const orderCount = Number(features.order_count) || 0;
  const preferredCategory = features.preferred_order_category;

  // A. VIP Retention (High-value spenders at elevated risk)
  if (totalSpend >= 400 && (churnProbability >= 0.45 || prediction.risk_level === "High" || prediction.risk_level === "Very High")) {
    return {
      strategy: "vip_retention",
      triggerReason: "vip_high_spend_at_risk",
    };
  }

  // B. Cart Abandonment (Active cart items in 30d with 0 orders)
  if (cartActions30d > 0 && orders30d === 0) {
    return {
      strategy: "cart_abandonment",
      triggerReason: "cart_items_unpurchased_30d",
    };
  }

  // C. Inactivity Re-engagement (14+ days no activity/login)
  if ((daysSinceActivity !== null && daysSinceActivity >= 14) || (daysSinceLogin !== null && daysSinceLogin >= 14)) {
    return {
      strategy: "inactivity_reengagement",
      triggerReason: "storefront_inactivity_exceeds_14d",
    };
  }

  // D. Wishlist Follow-up
  if (wishlistActions30d > 0 && orders30d === 0) {
    return {
      strategy: "wishlist_followup",
      triggerReason: "wishlist_items_without_orders",
    };
  }

  // E. Product Recommendation (5+ product views without order)
  if (productViews30d >= 5 && orders30d === 0) {
    return {
      strategy: "product_recommendation",
      triggerReason: "high_catalog_interest_zero_orders",
    };
  }

  // F. New Customer Onboarding (tenure <= 14d with <= 1 order)
  if (tenureDays !== null && tenureDays <= 14 && orderCount <= 1) {
    return {
      strategy: "new_customer_onboarding",
      triggerReason: "new_account_activation",
    };
  }

  // G. Category-Based Promotion
  if (preferredCategory && !["none", "nan", "null", ""].includes(String(preferredCategory).toLowerCase())) {
    return {
      strategy: "category_promotion",
      triggerReason: "category_affinity_engagement",
    };
  }

  // Default fallback: High Risk Inactivity Re-engagement
  return {
    strategy: "inactivity_reengagement",
    triggerReason: "high_risk_churn_fallback",
  };
}

/**
 * Checks server-side database records to ensure a customer is not currently in a cooldown period
 * from a previous automatic retention outreach or recent manual campaign outreach.
 */
export async function checkCustomerCooldown(customerId, context = {}, models = {}) {
  const { AutomaticRetentionLog, Activity, Campaign } = models;
  const cooldownDays = typeof context.cooldownDays === "number" ? context.cooldownDays : runtimeConfig.cooldownDays;
  const now = new Date();
  const cooldownWindowStart = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);

  const cidStr = String(customerId);

  // 1. Check AutomaticRetentionLog for recent sent or active cooldown
  if (AutomaticRetentionLog) {
    const query = AutomaticRetentionLog.findOne({
      customerId: cidStr,
      status: { $in: ["SENT", "DRY_RUN"] },
      $or: [
        { cooldownUntil: { $gt: now } },
        { sentAt: { $gte: cooldownWindowStart } },
        { createdAt: { $gte: cooldownWindowStart } },
      ],
    });
    const recentAutoLog = typeof query?.lean === "function" ? await query.lean() : await query;

    if (recentAutoLog) {
      return {
        inCooldown: true,
        reason: "cooldown_active",
        details: `Recent automatic retention sent at ${recentAutoLog.sentAt || recentAutoLog.createdAt}`,
        cooldownUntil: recentAutoLog.cooldownUntil,
      };
    }
  }

  // 2. Check Activity collection for recent retention_email_sent events
  if (Activity) {
    const query = Activity.findOne({
      $or: [{ userId: cidStr }, { "metadata.customerId": cidStr }, { "metadata.userId": cidStr }],
      type: "retention_email_sent",
      createdAt: { $gte: cooldownWindowStart },
    });
    const recentActivity = typeof query?.lean === "function" ? await query.lean() : await query;

    if (recentActivity) {
      return {
        inCooldown: true,
        reason: "already_contacted",
        details: `Recent retention email sent at ${recentActivity.createdAt}`,
        cooldownUntil: new Date(new Date(recentActivity.createdAt).getTime() + cooldownDays * 24 * 60 * 60 * 1000),
      };
    }
  }

  // 3. Check Campaign collection for recent completed/sent campaigns targeting this customer
  if (Campaign) {
    const query = Campaign.findOne({
      targetCustomerIds: cidStr,
      status: { $in: ["SENT", "COMPLETED"] },
      updatedAt: { $gte: cooldownWindowStart },
    });
    const recentCampaign = typeof query?.lean === "function" ? await query.lean() : await query;

    if (recentCampaign) {
      return {
        inCooldown: true,
        reason: "already_contacted",
        details: `Targeted in recent campaign ${recentCampaign.campaignId} on ${recentCampaign.updatedAt}`,
        cooldownUntil: new Date(new Date(recentCampaign.updatedAt).getTime() + cooldownDays * 24 * 60 * 60 * 1000),
      };
    }
  }

  return {
    inCooldown: false,
    reason: null,
  };
}

/**
 * Runs the full end-to-end automatic retention evaluation pipeline across all eligible customers.
 */
export async function executeAutomaticRetentionBatch({
  isDryRun = null,
  forceTrigger = false,
  triggeredBy = "scheduler",
  models = {},
  customCustomers = null,
  customPredictions = null,
} = {}) {
  const { User, Activity, Order, AutomaticRetentionLog, Campaign } = models;

  const effectiveDryRun = typeof isDryRun === "boolean" ? isDryRun : runtimeConfig.dryRun;
  const isEnabled = runtimeConfig.enabled || forceTrigger;
  const threshold = runtimeConfig.threshold;
  const cooldownDays = runtimeConfig.cooldownDays;
  const batchSize = runtimeConfig.batchSize;
  const now = new Date();

  // If system is disabled and not forced, safely return skipped summary
  if (!isEnabled) {
    const result = {
      executed: false,
      reason: "automatic_retention_disabled",
      evaluatedCount: 0,
      eligibleCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      dryRun: effectiveDryRun,
      decisions: [],
      timestamp: now.toISOString(),
    };
    runtimeConfig.lastRunAt = now;
    runtimeConfig.lastRunStats = result;
    return result;
  }

  // 1. Fetch non-admin customers
  let rawCustomers = [];
  if (Array.isArray(customCustomers)) {
    rawCustomers = customCustomers;
  } else if (User) {
    const foundUsers = await User.find({ role: { $ne: "admin" } }).sort({ createdAt: -1 }).lean();
    const userMap = new Map();
    for (const u of foundUsers || []) {
      const uid = String(u._id || u.id);
      if (!userMap.has(uid)) userMap.set(uid, u);
    }
    rawCustomers = Array.from(userMap.values());
  }

  if (rawCustomers.length === 0) {
    const emptyResult = {
      executed: true,
      mode: effectiveDryRun ? "DRY_RUN" : "LIVE",
      evaluatedCount: 0,
      eligibleCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      dryRun: effectiveDryRun,
      decisions: [],
      timestamp: now.toISOString(),
    };
    runtimeConfig.lastRunAt = now;
    runtimeConfig.lastRunStats = emptyResult;
    return emptyResult;
  }

  // 2. Fetch customer history for feature extraction
  const userIds = rawCustomers.map((c) => c._id || c.id || c.userId).filter(Boolean);
  const [allActivities, allOrders] = await Promise.all([
    Activity ? Activity.find({ userId: { $in: userIds } }).sort({ createdAt: 1 }).lean() : [],
    Order ? Order.find({ userId: { $in: userIds } }).sort({ createdAt: 1 }).lean() : [],
  ]);

  const activitiesByUser = new Map();
  const ordersByUser = new Map();
  for (const act of allActivities || []) {
    const uid = String(act.userId);
    if (!activitiesByUser.has(uid)) activitiesByUser.set(uid, []);
    activitiesByUser.get(uid).push(act);
  }
  for (const ord of allOrders || []) {
    const uid = String(ord.userId);
    if (!ordersByUser.has(uid)) ordersByUser.set(uid, []);
    ordersByUser.get(uid).push(ord);
  }

  // 3. Extract 21-feature contract
  const customerFeaturesList = [];
  const validCustomerMap = new Map();

  for (const user of rawCustomers) {
    const uid = String(user._id || user.id || user.userId);
    const uActivities = activitiesByUser.get(uid) || [];
    const uOrders = ordersByUser.get(uid) || [];
    validCustomerMap.set(uid, user);

    try {
      const features = extractCustomerFeatures({
        user,
        activities: uActivities,
        orders: uOrders,
        asOfDate: now,
      });
      customerFeaturesList.push(features);
    } catch {
      // Continue with extractable customers
    }
  }

  // 4. Score customers using FastAPI inference engine or direct predictor
  const churnServiceUrl = process.env.CHURN_SERVICE_URL || "http://127.0.0.1:8000";
  let predictionsMap = new Map();

  if (Array.isArray(customPredictions)) {
    for (const pred of customPredictions) {
      predictionsMap.set(String(pred.customer_id || pred.customerId), pred);
    }
  } else if (customerFeaturesList.length > 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${churnServiceUrl}/predict/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ customers: customerFeaturesList }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const batchData = await response.json();
        for (const pred of batchData.predictions || []) {
          predictionsMap.set(String(pred.customer_id), pred);
        }
      }
    } catch {
      // Fallback: heuristic scoring if FastAPI is unreachable during scheduled test
    }
  }

  // 5. Evaluate eligibility, cooldown, strategy, and execute in controlled batches
  const decisions = [];
  let evaluatedCount = 0;
  let eligibleCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const emailConfig = getEmailConfigurationStatus();
  const storeUrl = getPublicStoreUrl();

  for (let i = 0; i < rawCustomers.length; i += batchSize) {
    const batch = rawCustomers.slice(i, i + batchSize);

    for (const customer of batch) {
      evaluatedCount++;
      const cid = String(customer._id || customer.id || customer.userId);
      const email = (customer.email || "").trim();
      const name = customer.name || "Valued Customer";
      const features = customerFeaturesList.find((f) => String(f.user_id) === cid) || {};

      let prediction = predictionsMap.get(cid);
      if (!prediction) {
        // Safe baseline estimate if prediction engine timed out
        prediction = {
          customer_id: cid,
          churn_probability: features.days_since_last_activity >= 30 ? 0.75 : 0.20,
          risk_level: features.days_since_last_activity >= 30 ? "High" : "Low",
        };
      }

      // Check basic eligibility
      const eligibility = isEligibleForAutomaticRetention(customer, prediction, { threshold });

      if (!eligibility.eligible) {
        skippedCount++;
        const decisionLog = {
          customerId: cid,
          customerName: name,
          email,
          churnProbability: Number(prediction.churn_probability) || 0,
          riskTier: prediction.risk_level || "Low",
          decision: "skipped",
          skipReason: eligibility.skipReason,
          status: "SKIPPED",
          sentAt: null,
          cooldownUntil: null,
          triggerReason: null,
          campaignType: null,
          mode: effectiveDryRun ? "dry-run" : "live",
        };
        decisions.push(decisionLog);

        if (AutomaticRetentionLog) {
          try {
            await AutomaticRetentionLog.create({
              customerId: cid,
              userId: customer._id || null,
              email: email || "unknown@lumawear.com",
              campaignType: "none",
              triggerReason: eligibility.skipReason,
              churnProbability: Number(prediction.churn_probability) || 0,
              riskTier: prediction.risk_level || "Low",
              decision: "skipped",
              skipReason: eligibility.skipReason,
              featureSnapshot: features,
              status: "SKIPPED",
              mode: effectiveDryRun ? "dry-run" : "live",
            });
          } catch {}
        }
        continue;
      }

      // Check Cooldown & Duplicate Protection
      const cooldownCheck = await checkCustomerCooldown(cid, { cooldownDays }, { AutomaticRetentionLog, Activity, Campaign });
      if (cooldownCheck.inCooldown) {
        skippedCount++;
        const decisionLog = {
          customerId: cid,
          customerName: name,
          email,
          churnProbability: eligibility.churnProbability,
          riskTier: eligibility.riskTier,
          decision: "skipped",
          skipReason: cooldownCheck.reason,
          status: "SKIPPED",
          sentAt: null,
          cooldownUntil: cooldownCheck.cooldownUntil,
          triggerReason: cooldownCheck.details,
          campaignType: null,
          mode: effectiveDryRun ? "dry-run" : "live",
        };
        decisions.push(decisionLog);

        if (AutomaticRetentionLog) {
          try {
            await AutomaticRetentionLog.create({
              customerId: cid,
              userId: customer._id || null,
              email,
              campaignType: "none",
              triggerReason: cooldownCheck.reason,
              churnProbability: eligibility.churnProbability,
              riskTier: eligibility.riskTier,
              decision: "skipped",
              skipReason: cooldownCheck.reason,
              featureSnapshot: features,
              status: "SKIPPED",
              cooldownUntil: cooldownCheck.cooldownUntil,
              mode: effectiveDryRun ? "dry-run" : "live",
            });
          } catch {}
        }
        continue;
      }

      // Customer is eligible!
      eligibleCount++;

      // Select retention strategy
      const strategySelection = selectRetentionStrategy(customer, features, prediction);
      const strategy = strategySelection.strategy;
      const triggerReason = strategySelection.triggerReason;

      const emailContent = getStrategyEmailContent(strategy, customer, { storeUrl });
      const cooldownUntilDate = new Date(now.getTime() + cooldownDays * 24 * 60 * 60 * 1000);

      // DRY-RUN MODE: Log and record decision with zero actual email dispatch
      if (effectiveDryRun) {
        sentCount++;
        const decisionLog = {
          customerId: cid,
          customerName: name,
          email,
          churnProbability: eligibility.churnProbability,
          riskTier: eligibility.riskTier,
          decision: "dry-run",
          status: "DRY_RUN",
          campaignType: strategy,
          strategyName: emailContent.strategyName,
          subject: emailContent.subject,
          triggerReason,
          sentAt: now,
          cooldownUntil: cooldownUntilDate,
          mode: "dry-run",
        };
        decisions.push(decisionLog);

        if (AutomaticRetentionLog) {
          try {
            await AutomaticRetentionLog.create({
              customerId: cid,
              userId: customer._id || null,
              email,
              campaignType: strategy,
              triggerReason,
              churnProbability: eligibility.churnProbability,
              riskTier: eligibility.riskTier,
              decision: "eligible",
              skipReason: null,
              featureSnapshot: features,
              sentAt: now,
              status: "DRY_RUN",
              provider: "dry-run",
              mode: "dry-run",
              cooldownUntil: cooldownUntilDate,
              metadata: {
                isAutomatic: true,
                triggeredBy,
                subject: emailContent.subject,
                strategyName: emailContent.strategyName,
              },
            });
          } catch {}
        }
        continue;
      }

      // LIVE SEND MODE
      try {
        const sendResult = await sendRetentionEmail({
          to: email,
          recipientName: name,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          campaignId: `AUTO-${now.getFullYear()}${now.getMonth() + 1}`,
          strategy,
          customerId: cid,
        });

        if (sendResult.success) {
          sentCount++;
          const decisionLog = {
            customerId: cid,
            customerName: name,
            email,
            churnProbability: eligibility.churnProbability,
            riskTier: eligibility.riskTier,
            decision: "sent",
            status: "SENT",
            campaignType: strategy,
            strategyName: emailContent.strategyName,
            subject: emailContent.subject,
            triggerReason,
            providerMessageId: sendResult.providerMessageId,
            sentAt: now,
            cooldownUntil: cooldownUntilDate,
            mode: sendResult.mode || "live",
          };
          decisions.push(decisionLog);

          if (AutomaticRetentionLog) {
            await AutomaticRetentionLog.create({
              customerId: cid,
              userId: customer._id || null,
              email,
              campaignType: strategy,
              triggerReason,
              churnProbability: eligibility.churnProbability,
              riskTier: eligibility.riskTier,
              decision: "sent",
              skipReason: null,
              featureSnapshot: features,
              sentAt: now,
              status: "SENT",
              providerMessageId: sendResult.providerMessageId,
              provider: sendResult.provider,
              mode: sendResult.mode,
              cooldownUntil: cooldownUntilDate,
              metadata: {
                isAutomatic: true,
                triggeredBy,
                subject: emailContent.subject,
              },
            });
          }

          if (Activity && customer._id) {
            await Activity.create({
              userId: customer._id,
              type: "retention_email_sent",
              route: "/api/churn/automatic-retention",
              metadata: {
                isAutomatic: true,
                campaignType: strategy,
                strategy,
                recipientEmail: email,
                provider: sendResult.provider,
                providerMessageId: sendResult.providerMessageId,
                mode: sendResult.mode,
                subject: emailContent.subject,
                dispatchedAt: now.toISOString(),
                triggeredBy,
              },
            });
          }
        } else {
          failedCount++;
          const decisionLog = {
            customerId: cid,
            customerName: name,
            email,
            churnProbability: eligibility.churnProbability,
            riskTier: eligibility.riskTier,
            decision: "failed",
            status: "FAILED",
            error: sendResult.error || "Email delivery failed",
            campaignType: strategy,
            triggerReason,
            mode: sendResult.mode || "live",
          };
          decisions.push(decisionLog);

          if (AutomaticRetentionLog) {
            await AutomaticRetentionLog.create({
              customerId: cid,
              userId: customer._id || null,
              email,
              campaignType: strategy,
              triggerReason,
              churnProbability: eligibility.churnProbability,
              riskTier: eligibility.riskTier,
              decision: "failed",
              skipReason: "email_delivery_failed",
              error: sendResult.error,
              featureSnapshot: features,
              status: "FAILED",
              mode: sendResult.mode,
            });
          }
        }
      } catch (sendErr) {
        failedCount++;
        decisions.push({
          customerId: cid,
          customerName: name,
          email,
          churnProbability: eligibility.churnProbability,
          riskTier: eligibility.riskTier,
          decision: "failed",
          status: "FAILED",
          error: sendErr.message,
          campaignType: strategy,
          triggerReason,
        });
      }
    }
  }

  const finalResult = {
    executed: true,
    mode: effectiveDryRun ? "DRY_RUN" : "LIVE",
    dryRun: effectiveDryRun,
    evaluatedCount,
    eligibleCount,
    sentCount,
    skippedCount,
    failedCount,
    threshold,
    cooldownDays,
    decisions,
    timestamp: now.toISOString(),
  };

  runtimeConfig.lastRunAt = now;
  runtimeConfig.lastRunStats = finalResult;

  return finalResult;
}
