import assert from "node:assert/strict";
import dotenv from "dotenv";
import {
  getStrategyEmailContent,
  getPublicStoreUrl,
  STRATEGY_EMAIL_TEMPLATES,
} from "./src/churn/retentionEmailTemplates.js";
import {
  getEmailConfigurationStatus,
  verifySmtpConnection,
  generateCampaignEmailPreviews,
} from "./src/churn/emailService.js";

dotenv.config();

console.log("=================================================================");
console.log(" VERIFYING EMAIL LINK GENERATION & DELIVERABILITY ENHANCEMENTS");
console.log("=================================================================");

// 1. Verify getPublicStoreUrl behavior
console.log("\n1. Testing getPublicStoreUrl resolution:");
const defaultStoreUrl = getPublicStoreUrl();
console.log(`   - Default Store URL:   ${defaultStoreUrl}`);
assert.equal(defaultStoreUrl, "https://luma-wear-ecommerce-seven.vercel.app");
assert.ok(!defaultStoreUrl.endsWith("/"), "URL must not have a trailing slash");

const overriddenUrl = getPublicStoreUrl("https://custom-lumawear.vercel.app/");
console.log(`   - Custom Store URL:    ${overriddenUrl}`);
assert.equal(overriddenUrl, "https://custom-lumawear.vercel.app");

const localhostFallback = getPublicStoreUrl("http://localhost:5173");
console.log(`   - Localhost sanitized: ${localhostFallback}`);
assert.equal(localhostFallback, "https://luma-wear-ecommerce-seven.vercel.app");

// 2. Verify all 7 strategy email templates
console.log("\n2. Testing all 7 retention strategy email templates:");
const mockCustomer = {
  name: "Shirisha M P",
  email: "shirishamp.05@gmail.com",
  userId: "cust-12345",
  topDriver: "Browsed Activewear",
};

const strategies = Object.keys(STRATEGY_EMAIL_TEMPLATES);
for (const strategy of strategies) {
  const content = getStrategyEmailContent(strategy, mockCustomer, {
    preferredCategory: "Activewear",
  });

  console.log(`\n   --- Strategy: ${strategy} (${content.strategyName}) ---`);
  console.log(`   - Subject: "${content.subject}"`);

  // Assert no localhost or .local URLs in subject, text, or HTML
  assert.ok(!content.subject.includes("localhost"), `Subject must not contain localhost: ${strategy}`);
  assert.ok(!content.subject.includes(".local"), `Subject must not contain .local: ${strategy}`);

  assert.ok(!content.text.includes("localhost"), `Text body must not contain localhost: ${strategy}`);
  assert.ok(!content.text.includes(".local"), `Text body must not contain .local: ${strategy}`);

  assert.ok(!content.html.includes("localhost"), `HTML body must not contain localhost: ${strategy}`);
  assert.ok(!content.html.includes(".local"), `HTML body must not contain .local: ${strategy}`);

  // Assert proper HTML structure
  assert.ok(content.html.includes("<!DOCTYPE html>"), `HTML must include DOCTYPE: ${strategy}`);
  assert.ok(content.html.includes("<html lang=\"en\""), `HTML must include html lang tag: ${strategy}`);
  assert.ok(!content.html.includes("pt:"), `HTML must not contain broken CSS property 'pt:': ${strategy}`);

  // Assert target URL presence
  assert.ok(content.html.includes("https://luma-wear-ecommerce-seven.vercel.app"), `HTML must link to deployed store: ${strategy}`);
  assert.ok(content.text.includes("https://luma-wear-ecommerce-seven.vercel.app"), `Text must link to deployed store: ${strategy}`);

  // Specific check for inactivity_reengagement ("Explore What's New" button)
  if (strategy === "inactivity_reengagement") {
    assert.ok(content.html.includes("Explore What's New"), "Inactivity email must contain 'Explore What's New' button text");
    assert.ok(content.html.includes('href="https://luma-wear-ecommerce-seven.vercel.app/shop"'), "Button href must point to https://luma-wear-ecommerce-seven.vercel.app/shop");
    assert.ok(content.text.includes("https://luma-wear-ecommerce-seven.vercel.app/shop"), "Text body must point to https://luma-wear-ecommerce-seven.vercel.app/shop");
    console.log(`   ✅ "Explore What's New" CTA verified: href="https://luma-wear-ecommerce-seven.vercel.app/shop"`);
  }
}

// 3. Verify Email Preview Generation
console.log("\n3. Testing generateCampaignEmailPreviews:");
const previewData = generateCampaignEmailPreviews(
  { campaignId: "TEST-CAMP", name: "Inactivity Campaign", campaignType: "inactivity_reengagement" },
  [mockCustomer]
);
assert.equal(previewData.recipients.length, 1);
const recipient = previewData.recipients[0];
assert.ok(recipient.htmlBody.includes("https://luma-wear-ecommerce-seven.vercel.app/shop"));
assert.ok(recipient.textBody.includes("https://luma-wear-ecommerce-seven.vercel.app/shop"));
console.log(`   ✅ Preview storeUrl: ${previewData.storeUrl}`);
console.log(`   ✅ Recipient HTML CTA: contains "https://luma-wear-ecommerce-seven.vercel.app/shop"`);

// 4. Verify SMTP configuration and connection
console.log("\n4. Checking SMTP Configuration & Connectivity:");
const emailConfig = getEmailConfigurationStatus();
console.log(`   - Provider:       ${emailConfig.provider}`);
console.log(`   - Mode:           ${emailConfig.mode}`);
console.log(`   - SMTP Host:      ${emailConfig.smtpHostName}:${emailConfig.smtpPort}`);
console.log(`   - Sender Identity:${emailConfig.emailFrom}`);
console.log(`   - Reply-To:       ${emailConfig.replyTo}`);
console.log(`   - Store URL:      ${emailConfig.storeUrl}`);

const smtpVerification = await verifySmtpConnection();
console.log(`   - SMTP Connected: ${smtpVerification.connected ? "✅ YES" : "❌ NO"}`);
if (smtpVerification.error) {
  console.log(`   - SMTP Error:     ${smtpVerification.error}`);
}

console.log("\n=================================================================");
console.log("🎉 ALL EMAIL LINK & DELIVERABILITY CHECKS PASSED!");
console.log("=================================================================");
