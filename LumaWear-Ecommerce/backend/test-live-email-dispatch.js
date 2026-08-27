import assert from "node:assert/strict";
import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  getEmailConfigurationStatus,
  verifySmtpConnection,
  sendRetentionEmail,
  generateCampaignEmailPreviews,
} from "./src/churn/emailService.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
assert.ok(MONGODB_URI, "MONGODB_URI must be set in backend/.env");

console.log("=================================================================");
console.log(" DIAGNOSTIC & REAL EMAIL DISPATCH PIPELINE TEST");
console.log("=================================================================");

const emailStatus = getEmailConfigurationStatus();
console.log("\n1. Current Email Configuration Status:");
console.log(`   - SMTP Configured:     ${emailStatus.smtpConfigured ? "YES" : "NO"}`);
console.log(`   - SMTP Host:           ${emailStatus.smtpHost} (${emailStatus.smtpHostName})`);
console.log(`   - SMTP Port:           ${emailStatus.smtpPort}`);
console.log(`   - SMTP Secure (SSL):   ${emailStatus.smtpSecure}`);
console.log(`   - SMTP User:           ${emailStatus.smtpUser} (${emailStatus.smtpUserEmail})`);
console.log(`   - SMTP Password:       ${emailStatus.smtpPassword}`);
console.log(`   - Active Dispatch Mode:${emailStatus.mode.toUpperCase()}`);
console.log(`   - Sender Identity:     ${emailStatus.emailFrom}`);

if (mongoose.connection.readyState === 0) {
  await mongoose.connect(MONGODB_URI, { dbName: "lumawear" });
}

const { User, Campaign, Activity } = await import("./src/server.js");

// Fetch the targeted customer: Shirisha M P
const targetCustomer = await User.findOne({ email: "shirishamp.05@gmail.com" }).lean();
assert.ok(targetCustomer, "Customer 'Shirisha M P' (shirishamp.05@gmail.com) must exist in Atlas");
console.log(`\n2. Target Customer from Atlas:`);
console.log(`   - Name:  ${targetCustomer.name}`);
console.log(`   - Email: ${targetCustomer.email}`);
console.log(`   - ID:    ${targetCustomer._id}`);

// Generate personalized retention email preview
const mockCampaign = {
  campaignId: "DIAG-EMAIL-PREVIEW",
  name: "VIP Retention Strategy Campaign",
  campaignType: "vip_retention",
};

const preview = generateCampaignEmailPreviews(mockCampaign, [targetCustomer]);
assert.equal(preview.recipients.length, 1);
const recipientPreview = preview.recipients[0];
console.log(`\n3. Generated Strategy Copy:`);
console.log(`   - Subject:   "${recipientPreview.subject}"`);
console.log(`   - Recipient: ${recipientPreview.customerName} <${recipientPreview.email}>`);
console.log(`   - Valid:     ${recipientPreview.emailValid}`);

// 4. Test SMTP Verification
console.log(`\n4. Testing SMTP Transporter Connection Verification...`);
const smtpTest = await verifySmtpConnection();
if (smtpTest.connected) {
  console.log(`   ✅ SMTP Connection SUCCESSFUL to ${smtpTest.host}:${smtpTest.port} as ${smtpTest.user}`);
} else {
  console.log(`   ℹ️ SMTP Connection check result: ${smtpTest.error}`);
}

// 5. Test Email Dispatch (Live if credentials set, or verified error / dry-run)
console.log(`\n5. Testing Retention Email Dispatch Function...`);
const dispatchResult = await sendRetentionEmail({
  to: recipientPreview.email,
  recipientName: recipientPreview.customerName,
  subject: recipientPreview.subject,
  html: recipientPreview.htmlBody,
  text: recipientPreview.textBody,
  campaignId: mockCampaign.campaignId,
  strategy: mockCampaign.campaignType,
  customerId: String(targetCustomer._id),
});

console.log(`   Dispatch Result:`);
console.log(`   - Success:     ${dispatchResult.success}`);
console.log(`   - Mode:        ${dispatchResult.mode}`);
console.log(`   - Provider:    ${dispatchResult.provider}`);
if (dispatchResult.providerMessageId) {
  console.log(`   - Message ID:  ${dispatchResult.providerMessageId}`);
}
if (dispatchResult.error) {
  console.log(`   - Error:       ${dispatchResult.error}`);
}

await mongoose.disconnect();
console.log("\n=================================================================");
console.log("✅ EMAIL DISPATCH PIPELINE TEST COMPLETE (Zero DB Mutations)");
console.log("=================================================================");
