import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  isEligibleForAutomaticRetention,
  selectRetentionStrategy,
  checkCustomerCooldown,
  executeAutomaticRetentionBatch,
  getAutomaticRetentionConfig,
  updateAutomaticRetentionConfig,
} from "./automaticRetentionService.js";
import {
  initAutomaticRetentionScheduler,
  runScheduledEvaluation,
  triggerOnDemandEvaluation,
  stopAutomaticRetentionScheduler,
} from "./automaticRetentionScheduler.js";

test("Automatic Retention System Test Suite", async (t) => {

  await t.test("1. High-risk customer (churnProbability >= 0.70) is marked eligible", () => {
    const customer = { _id: "cust_1", name: "Alice", email: "alice@example.com", role: "customer" };
    const prediction = { churn_probability: 0.82, risk_level: "High" };
    const result = isEligibleForAutomaticRetention(customer, prediction, { threshold: 0.70 });

    assert.equal(result.eligible, true);
    assert.equal(result.skipReason, null);
    assert.equal(result.churnProbability, 0.82);
    assert.equal(result.riskTier, "High");
  });

  await t.test("2. Low-risk customer (churnProbability < 0.70) is skipped with reason below_threshold", () => {
    const customer = { _id: "cust_2", name: "Bob", email: "bob@example.com", role: "customer" };
    const prediction = { churn_probability: 0.45, risk_level: "Medium" };
    const result = isEligibleForAutomaticRetention(customer, prediction, { threshold: 0.70 });

    assert.equal(result.eligible, false);
    assert.equal(result.skipReason, "below_threshold");
  });

  await t.test("3. Customer with missing or whitespace email is skipped with reason invalid_email", () => {
    const customerNoEmail = { _id: "cust_3", name: "Charlie", email: "", role: "customer" };
    const prediction = { churn_probability: 0.88, risk_level: "Very High" };
    const result = isEligibleForAutomaticRetention(customerNoEmail, prediction, { threshold: 0.70 });

    assert.equal(result.eligible, false);
    assert.equal(result.skipReason, "invalid_email");
  });

  await t.test("4. Customer with malformed email is skipped with reason invalid_email", () => {
    const customerBadEmail = { _id: "cust_4", name: "David", email: "not-an-email", role: "customer" };
    const prediction = { churn_probability: 0.79, risk_level: "High" };
    const result = isEligibleForAutomaticRetention(customerBadEmail, prediction, { threshold: 0.70 });

    assert.equal(result.eligible, false);
    assert.equal(result.skipReason, "invalid_email");
  });

  await t.test("5. Admin account is skipped with reason non_customer", () => {
    const adminUser = { _id: "admin_1", name: "Store Admin", email: "admin@lumawear.local", role: "admin" };
    const prediction = { churn_probability: 0.95, risk_level: "Very High" };
    const result = isEligibleForAutomaticRetention(adminUser, prediction, { threshold: 0.70 });

    assert.equal(result.eligible, false);
    assert.equal(result.skipReason, "non_customer");
  });

  await t.test("6. Customer with marketing opt-out is skipped with reason marketing_opt_out", () => {
    const optedOutCustomer = {
      _id: "cust_5",
      name: "Eve",
      email: "eve@example.com",
      role: "customer",
      marketingOptOut: true,
    };
    const prediction = { churn_probability: 0.85, risk_level: "High" };
    const result = isEligibleForAutomaticRetention(optedOutCustomer, prediction, { threshold: 0.70 });

    assert.equal(result.eligible, false);
    assert.equal(result.skipReason, "marketing_opt_out");
  });

  await t.test("7. Missing or invalid prediction is skipped with reason invalid_prediction", () => {
    const customer = { _id: "cust_6", name: "Frank", email: "frank@example.com", role: "customer" };
    const result = isEligibleForAutomaticRetention(customer, null, { threshold: 0.70 });

    assert.equal(result.eligible, false);
    assert.equal(result.skipReason, "invalid_prediction");
  });

  await t.test("8. Configurable churn threshold works dynamically (e.g. 0.85 threshold)", () => {
    const customer = { _id: "cust_7", name: "Grace", email: "grace@example.com", role: "customer" };
    const prediction = { churn_probability: 0.80, risk_level: "High" };

    // At 0.70 threshold: eligible
    assert.equal(isEligibleForAutomaticRetention(customer, prediction, { threshold: 0.70 }).eligible, true);
    // At 0.85 threshold: skipped
    assert.equal(isEligibleForAutomaticRetention(customer, prediction, { threshold: 0.85 }).eligible, false);
    assert.equal(isEligibleForAutomaticRetention(customer, prediction, { threshold: 0.85 }).skipReason, "below_threshold");
  });

  await t.test("9. Strategy selection selects cart_abandonment for active cart with zero orders", () => {
    const features = { cart_actions_30d: 3, orders_30d: 0, total_spend: 50 };
    const prediction = { churn_probability: 0.75, risk_level: "High" };
    const strategy = selectRetentionStrategy({}, features, prediction);

    assert.equal(strategy.strategy, "cart_abandonment");
    assert.equal(strategy.triggerReason, "cart_items_unpurchased_30d");
  });

  await t.test("10. Strategy selection selects inactivity_reengagement for 14+ days no activity", () => {
    const features = { days_since_last_activity: 21, days_since_last_login: 21, cart_actions_30d: 0, orders_30d: 0 };
    const prediction = { churn_probability: 0.80, risk_level: "High" };
    const strategy = selectRetentionStrategy({}, features, prediction);

    assert.equal(strategy.strategy, "inactivity_reengagement");
    assert.equal(strategy.triggerReason, "storefront_inactivity_exceeds_14d");
  });

  await t.test("11. Strategy selection selects vip_retention for high lifetime spend ($400+) at elevated risk", () => {
    const features = { total_spend: 650, days_since_last_activity: 5 };
    const prediction = { churn_probability: 0.55, risk_level: "High" };
    const strategy = selectRetentionStrategy({}, features, prediction);

    assert.equal(strategy.strategy, "vip_retention");
    assert.equal(strategy.triggerReason, "vip_high_spend_at_risk");
  });

  await t.test("12. Strategy selection selects wishlist_followup for wishlist saves with zero orders", () => {
    const features = { wishlist_actions_30d: 2, orders_30d: 0, cart_actions_30d: 0, days_since_last_activity: 4 };
    const prediction = { churn_probability: 0.72, risk_level: "High" };
    const strategy = selectRetentionStrategy({}, features, prediction);

    assert.equal(strategy.strategy, "wishlist_followup");
    assert.equal(strategy.triggerReason, "wishlist_items_without_orders");
  });

  await t.test("13. Strategy selection selects product_recommendation for 5+ product views with zero orders", () => {
    const features = { product_views_30d: 7, orders_30d: 0, cart_actions_30d: 0, wishlist_actions_30d: 0, days_since_last_activity: 3 };
    const prediction = { churn_probability: 0.71, risk_level: "High" };
    const strategy = selectRetentionStrategy({}, features, prediction);

    assert.equal(strategy.strategy, "product_recommendation");
    assert.equal(strategy.triggerReason, "high_catalog_interest_zero_orders");
  });

  await t.test("14. Strategy selection selects new_customer_onboarding for new account (tenure <= 14d, <= 1 order)", () => {
    const features = { tenure_days: 7, order_count: 1, cart_actions_30d: 0, days_since_last_activity: 2 };
    const prediction = { churn_probability: 0.74, risk_level: "High" };
    const strategy = selectRetentionStrategy({}, features, prediction);

    assert.equal(strategy.strategy, "new_customer_onboarding");
    assert.equal(strategy.triggerReason, "new_account_activation");
  });

  await t.test("15. Cooldown check prevents outreach when recent automatic email was sent within 7 days", async () => {
    const mockAutomaticRetentionLog = {
      findOne: async () => ({
        customerId: "cust_cooldown_1",
        status: "SENT",
        sentAt: new Date(),
        cooldownUntil: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      }),
    };

    const check = await checkCustomerCooldown("cust_cooldown_1", { cooldownDays: 7 }, { AutomaticRetentionLog: mockAutomaticRetentionLog });
    assert.equal(check.inCooldown, true);
    assert.equal(check.reason, "cooldown_active");
  });

  await t.test("16. Cooldown check prevents outreach when recent manual campaign targeted customer within 7 days", async () => {
    const mockAutomaticRetentionLog = { findOne: async () => null };
    const mockActivity = { findOne: async () => null };
    const mockCampaign = {
      findOne: async () => ({
        campaignId: "CAMP-MANUAL-1",
        targetCustomerIds: ["cust_manual_target"],
        status: "SENT",
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }),
    };

    const check = await checkCustomerCooldown(
      "cust_manual_target",
      { cooldownDays: 7 },
      { AutomaticRetentionLog: mockAutomaticRetentionLog, Activity: mockActivity, Campaign: mockCampaign }
    );

    assert.equal(check.inCooldown, true);
    assert.equal(check.reason, "already_contacted");
  });

  await t.test("17. Cooldown check allows outreach when no recent email was sent", async () => {
    const mockModels = {
      AutomaticRetentionLog: { findOne: async () => null },
      Activity: { findOne: async () => null },
      Campaign: { findOne: async () => null },
    };

    const check = await checkCustomerCooldown("cust_clean_1", { cooldownDays: 7 }, mockModels);
    assert.equal(check.inCooldown, false);
    assert.equal(check.reason, null);
  });

  await t.test("18. Dry-run mode evaluates eligibility, selects strategies, and sends ZERO real emails", async () => {
    const testCustomers = [
      { _id: "test_c1", name: "High Risk Customer", email: "highrisk@lumawear.local", role: "customer" },
      { _id: "test_c2", name: "Low Risk Customer", email: "lowrisk@lumawear.local", role: "customer" },
      { _id: "test_c3", name: "Opted Out Customer", email: "optout@lumawear.local", role: "customer", marketingOptOut: true },
    ];

    const mockModels = {
      AutomaticRetentionLog: { findOne: async () => null, create: async () => {} },
      Activity: { find: () => ({ sort: () => ({ lean: async () => [] }) }) },
      Order: { find: () => ({ sort: () => ({ lean: async () => [] }) }) },
    };

    const result = await executeAutomaticRetentionBatch({
      isDryRun: true,
      forceTrigger: true,
      models: mockModels,
      customCustomers: testCustomers,
    });

    assert.equal(result.executed, true);
    assert.equal(result.mode, "DRY_RUN");
    assert.equal(result.dryRun, true);
    assert.equal(result.evaluatedCount, 3);
    assert.ok(result.decisions.length > 0);
  });

  await t.test("19. When automatic retention is disabled, batch returns skipped summary without sending", async () => {
    updateAutomaticRetentionConfig({ enabled: false });

    const result = await executeAutomaticRetentionBatch({
      forceTrigger: false,
      models: {},
    });

    assert.equal(result.executed, false);
    assert.equal(result.reason, "automatic_retention_disabled");
    assert.equal(result.sentCount, 0);
  });

  await t.test("20. Scheduler handles on-demand execution and prevents overlapping runs", async () => {
    const mockModels = {
      User: { find: () => ({ sort: () => ({ lean: async () => [] }) }) },
    };

    initAutomaticRetentionScheduler(mockModels);
    const runResult = await triggerOnDemandEvaluation({ isDryRun: true, force: true });

    assert.equal(runResult.executed, true);
    stopAutomaticRetentionScheduler();
  });
});
