import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  isEligibleForAutomaticRetention,
  selectRetentionStrategy,
  checkCustomerCooldown,
  executeAutomaticRetentionBatch,
} from "./automaticRetentionService.js";
import { getStrategyEmailContent } from "./retentionEmailTemplates.js";

test("Controlled Read-Only / Dry-Run Automatic Retention Pipeline Test", async (t) => {
  const mockObjectId = new mongoose.Types.ObjectId();
  const mockCustomer = {
    _id: mockObjectId,
    customerId: String(mockObjectId),
    name: "Automatic Retention Test",
    email: "automatic-retention-test@example.com",
    role: "customer",
    marketingOptOut: false,
  };

  const mockFeatures = {
    user_id: String(mockObjectId),
    cart_actions_30d: 2,
    orders_30d: 0,
    days_since_last_activity: 10,
    days_since_last_login: 10,
    total_spend: 120,
    tenure_days: 45,
    order_count: 2,
  };

  const mockPrediction = {
    customer_id: String(mockObjectId),
    churn_probability: 0.82,
    risk_level: "High",
  };

  // STEP 1: Basic Eligibility Check
  await t.test("1. Basic eligibility evaluates to true for 82% churn risk customer", () => {
    const eligibility = isEligibleForAutomaticRetention(mockCustomer, mockPrediction, { threshold: 0.70 });
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.skipReason, null);
    assert.equal(eligibility.churnProbability, 0.82);
    assert.equal(eligibility.riskTier, "High");
  });

  // STEP 2: Strategy Selection
  let selectedStrategyResult;
  await t.test("2. Strategy selector selects an existing retention template", () => {
    selectedStrategyResult = selectRetentionStrategy(mockCustomer, mockFeatures, mockPrediction);
    assert.ok(selectedStrategyResult.strategy);
    assert.equal(selectedStrategyResult.strategy, "cart_abandonment");

    // Verify it produces valid email content from existing templates
    const emailContent = getStrategyEmailContent(selectedStrategyResult.strategy, mockCustomer, {
      storeUrl: "http://localhost:5173",
    });
    assert.ok(emailContent.subject);
    assert.ok(emailContent.html);
    assert.ok(emailContent.text);
    assert.equal(emailContent.strategyName, "Cart Abandonment Recovery");
  });

  // STEP 3: In-Memory / Mock Batch Pipeline Execution in DRY-RUN Mode
  let createdAuditLogs = [];
  const mockModels = {
    AutomaticRetentionLog: {
      findOne: async () => null, // First run: not in cooldown
      create: async (doc) => {
        createdAuditLogs.push(doc);
        return doc;
      },
    },
    Activity: {
      find: () => ({
        sort: () => ({
          lean: async () => [
            {
              userId: String(mockObjectId),
              type: "cart_add",
              createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              metadata: { productId: "PROD_1" },
            },
          ],
        }),
      }),
      findOne: async () => null,
      create: async () => {
        throw new Error("Activity.create must NOT be called in dry-run mode!");
      },
    },
    Order: {
      find: () => ({ sort: () => ({ lean: async () => [] }) }),
    },
    Campaign: {
      findOne: async () => null,
    },
  };

  await t.test("3. End-to-end dry-run batch evaluation executes with zero real email dispatch", async () => {
    const result = await executeAutomaticRetentionBatch({
      isDryRun: true,
      forceTrigger: true,
      triggeredBy: "dry_run_controlled_test",
      models: mockModels,
      customCustomers: [mockCustomer],
      customPredictions: [mockPrediction],
    });

    assert.equal(result.executed, true);
    assert.equal(result.mode, "DRY_RUN");
    assert.equal(result.dryRun, true);
    assert.equal(result.evaluatedCount, 1);
    assert.equal(result.eligibleCount, 1);
    assert.equal(result.sentCount, 1); // 1 simulated send
    assert.equal(result.skippedCount, 0);
    assert.equal(result.failedCount, 0);

    // Verify decision payload
    assert.equal(result.decisions.length, 1);
    const decision = result.decisions[0];
    assert.equal(decision.customerId, String(mockObjectId));
    assert.equal(decision.email, "automatic-retention-test@example.com");
    assert.equal(decision.churnProbability, 0.82);
    assert.equal(decision.decision, "dry-run");
    assert.equal(decision.status, "DRY_RUN");
    assert.equal(decision.mode, "dry-run");

    // Verify audit log document
    assert.equal(createdAuditLogs.length, 1);
    const auditLog = createdAuditLogs[0];
    assert.equal(auditLog.status, "DRY_RUN");
    assert.equal(auditLog.mode, "dry-run");
    assert.equal(auditLog.churnProbability, 0.82);
    assert.equal(auditLog.metadata?.isAutomatic, true);
    assert.equal(auditLog.metadata?.strategyName, "Cart Abandonment Recovery");
  });

  // STEP 4: Cooldown / Idempotency on Second Attempt
  await t.test("4. Second attempt for the same customer is blocked by active cooldown", async () => {
    const mockModelsWithActiveCooldown = {
      AutomaticRetentionLog: {
        findOne: async () => ({
          customerId: String(mockObjectId),
          status: "DRY_RUN",
          sentAt: new Date(),
          cooldownUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
        create: async () => {},
      },
      Activity: {
        find: () => ({ sort: () => ({ lean: async () => [] }) }),
        findOne: async () => null,
      },
      Order: {
        find: () => ({ sort: () => ({ lean: async () => [] }) }),
      },
      Campaign: {
        findOne: async () => null,
      },
    };

    // Verify direct cooldown check
    const cooldownCheck = await checkCustomerCooldown(
      String(mockObjectId),
      { cooldownDays: 7 },
      mockModelsWithActiveCooldown
    );
    assert.equal(cooldownCheck.inCooldown, true);
    assert.equal(cooldownCheck.reason, "cooldown_active");

    // Verify full batch run blocks second attempt
    const secondResult = await executeAutomaticRetentionBatch({
      isDryRun: true,
      forceTrigger: true,
      triggeredBy: "dry_run_controlled_test_repeat",
      models: mockModelsWithActiveCooldown,
      customCustomers: [mockCustomer],
      customPredictions: [mockPrediction],
    });

    assert.equal(secondResult.evaluatedCount, 1);
    assert.equal(secondResult.eligibleCount, 0);
    assert.equal(secondResult.sentCount, 0);
    assert.equal(secondResult.skippedCount, 1);
    assert.equal(secondResult.decisions[0].skipReason, "cooldown_active");
  });
});
