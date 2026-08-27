process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/lumawear";

import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = "mongodb://127.0.0.1:27017/lumawear";
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "change-this-development-secret";

console.log("=================================================================");
console.log(" VERIFYING EMAIL PREVIEW ENDPOINT (GET & POST)");
console.log("=================================================================");

if (mongoose.connection.readyState === 0) {
  await mongoose.connect(MONGODB_URI);
}

const { app, User, Campaign } = await import("./src/server.js");

let server;
let baseUrl;

await new Promise((resolve) => {
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
});

const adminUser = await User.findOne({ role: "admin" }).lean();
assert.ok(adminUser, "Admin user must exist");
const adminToken = jwt.sign(
  { sub: String(adminUser._id), role: "admin", type: "access" },
  JWT_ACCESS_SECRET,
  { expiresIn: "1h" }
);

// 1. Fetch one existing campaign from MongoDB
const existingCampaign = await Campaign.findOne().lean();
assert.ok(existingCampaign, "At least one campaign must exist in MongoDB");
console.log(`Found existing campaign: ${existingCampaign.campaignId} (${existingCampaign.name})`);

// 2. Test GET /api/churn/campaigns/:campaignId/email-preview
console.log(`\nTesting GET ${baseUrl}/api/churn/campaigns/${existingCampaign.campaignId}/email-preview ...`);
const getRes = await fetch(`${baseUrl}/api/churn/campaigns/${existingCampaign.campaignId}/email-preview`, {
  method: "GET",
  headers: { Authorization: `Bearer ${adminToken}` },
});

console.log(`GET Status: ${getRes.status}`);
assert.equal(getRes.status, 200, "GET email-preview must return 200");
const getData = await getRes.json();
console.log(`GET Response:`, JSON.stringify({
  success: getData.success,
  campaignId: getData.campaignId,
  strategy: getData.strategy,
  recipientCount: getData.recipientCount,
  validRecipientCount: getData.validRecipientCount,
  sampleRecipient: getData.recipients?.[0] ? {
    customerId: getData.recipients[0].customerId,
    customerName: getData.recipients[0].customerName,
    email: getData.recipients[0].email,
    subject: getData.recipients[0].subject,
  } : null,
}, null, 2));

// 3. Test POST /api/churn/campaigns/:campaignId/email-preview
console.log(`\nTesting POST ${baseUrl}/api/churn/campaigns/${existingCampaign.campaignId}/email-preview ...`);
const postRes = await fetch(`${baseUrl}/api/churn/campaigns/${existingCampaign.campaignId}/email-preview`, {
  method: "POST",
  headers: { Authorization: `Bearer ${adminToken}` },
});

console.log(`POST Status: ${postRes.status}`);
assert.equal(postRes.status, 200, "POST email-preview must return 200");
const postData = await postRes.json();
assert.equal(postData.success, true);

// 4. Test nonexistent campaign ID returns 404
console.log(`\nTesting GET /api/churn/campaigns/NONEXISTENT-CAMPAIGN-123/email-preview ...`);
const notFoundRes = await fetch(`${baseUrl}/api/churn/campaigns/NONEXISTENT-CAMPAIGN-123/email-preview`, {
  method: "GET",
  headers: { Authorization: `Bearer ${adminToken}` },
});
console.log(`Nonexistent status: ${notFoundRes.status}`);
assert.equal(notFoundRes.status, 404, "Nonexistent campaign must return 404");
const notFoundData = await notFoundRes.json();
assert.equal(notFoundData.success, false);
console.log(`Nonexistent response:`, notFoundData);

// 5. Test unauthenticated request returns 401
console.log(`\nTesting GET without auth token ...`);
const unauthRes = await fetch(`${baseUrl}/api/churn/campaigns/${existingCampaign.campaignId}/email-preview`);
console.log(`Unauthenticated status: ${unauthRes.status}`);
assert.equal(unauthRes.status, 401, "Unauthenticated request must return 401");

await new Promise((resolve) => server.close(resolve));
await mongoose.disconnect();
console.log(`\n🎉 ALL EMAIL PREVIEW ENDPOINT VERIFICATIONS PASSED!`);
