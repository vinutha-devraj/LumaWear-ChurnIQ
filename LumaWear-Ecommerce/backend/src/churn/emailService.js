import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { getStrategyEmailContent, getPublicStoreUrl } from "./retentionEmailTemplates.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates basic email formatting.
 */
export function validateCustomerEmail(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "missing" };
  }
  const clean = email.trim();
  if (!clean) {
    return { valid: false, reason: "missing" };
  }
  if (!EMAIL_REGEX.test(clean)) {
    return { valid: false, reason: "invalid_format" };
  }
  return { valid: true, reason: null };
}

/**
 * Performs a comprehensive audit across all registered customers.
 */
export function auditCustomerEmails(customers = []) {
  const emailCounts = new Map();
  for (const c of customers) {
    const email = (c.email || "").trim().toLowerCase();
    if (email) {
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
  }

  let validFormat = 0;
  let invalidFormat = 0;
  let missingEmail = 0;
  let duplicateEmails = 0;

  const auditedCustomers = customers.map((c) => {
    const userId = String(c._id || c.id || c.userId);
    const email = (c.email || "").trim();
    const validation = validateCustomerEmail(email);
    const isCustomer = (c.role || "customer") === "customer";
    const occurrences = email ? emailCounts.get(email.toLowerCase()) || 0 : 0;
    const isDuplicate = occurrences > 1;

    if (validation.reason === "missing") missingEmail++;
    else if (validation.reason === "invalid_format") invalidFormat++;
    else if (validation.valid) validFormat++;

    if (isDuplicate) duplicateEmails++;

    return {
      userId,
      name: c.name || "Unknown Customer",
      email,
      role: c.role || "customer",
      isCustomer,
      hasEmail: Boolean(email),
      isValidFormat: validation.valid,
      validationReason: validation.reason,
      isDuplicate,
    };
  });

  return {
    totalCustomers: customers.length,
    validFormat,
    invalidFormat,
    missingEmail,
    duplicateEmails,
    customers: auditedCustomers,
  };
}

/**
 * Returns safe status information about the current email configuration.
 * Never exposes passwords or sensitive credentials.
 */
export function getEmailConfigurationStatus() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.SMTP_EMAIL || "";
  const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || "";
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || (user.includes("@gmail.com") ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || (host === "smtp.gmail.com" ? 465 : 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const rawProvider = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  const isSmtpConfigured = Boolean(user && pass);
  
  // If explicitly set to "smtp" or if credentials are fully configured
  const provider = rawProvider === "smtp" || (rawProvider !== "dry-run" && isSmtpConfigured) ? "smtp" : "dry-run";
  const mode = provider === "smtp" ? "live" : "dry-run";
  const emailFrom = process.env.MAIL_FROM || process.env.EMAIL_FROM || (user ? `LumaWear <${user}>` : "LumaWear Concierge <concierge@lumawear.com>");
  const replyTo = process.env.MAIL_REPLY_TO || process.env.EMAIL_REPLY_TO || user || emailFrom;
  const storeUrl = getPublicStoreUrl();

  return {
    mode,
    provider,
    smtpConfigured: isSmtpConfigured,
    smtpHost: host ? "configured" : "not configured",
    smtpHostName: host || (user.includes("@gmail.com") ? "smtp.gmail.com" : "none"),
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: user ? "configured" : "not configured",
    smtpUserEmail: user ? `${user.slice(0, 3)}***@${user.split("@")[1] || ""}` : "not configured",
    smtpPassword: pass ? "configured" : "not configured",
    emailFrom,
    replyTo,
    storeUrl,
  };
}

/**
 * Tests the live SMTP connection.
 */
export async function verifySmtpConnection() {
  const status = getEmailConfigurationStatus();
  if (!status.smtpConfigured) {
    return {
      connected: false,
      error: "SMTP credentials not configured in backend/.env (add SMTP_USER and SMTP_PASSWORD)",
      status,
    };
  }

  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.SMTP_EMAIL || "";
  const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || "";
  const host = status.smtpHostName;
  const port = status.smtpPort;
  const secure = status.smtpSecure;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });

    await transporter.verify();
    return {
      connected: true,
      host,
      port,
      user: status.smtpUserEmail,
      status,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      host,
      port,
      status,
    };
  }
}

/**
 * Generates personalized email previews for a staged campaign and its target customers.
 */
export function generateCampaignEmailPreviews(campaign, targetCustomers = [], context = {}) {
  const strategy = campaign.campaignType || campaign.strategy || "cart_abandonment";
  const storeUrl = getPublicStoreUrl(context.storeUrl);
  const resolvedContext = {
    ...context,
    storeUrl,
  };

  const previews = targetCustomers.map((cust) => {
    const email = (cust.email || "").trim();
    const validation = validateCustomerEmail(email);
    const personalized = getStrategyEmailContent(strategy, cust, {
      ...resolvedContext,
      preferredCategory: cust.topDriver?.includes("Category") ? cust.topDriver : resolvedContext.preferredCategory,
    });

    return {
      customerId: String(cust._id || cust.id || cust.userId),
      customerName: cust.name || "Customer",
      email,
      emailValid: validation.valid,
      validationReason: validation.reason,
      strategy,
      strategyName: personalized.strategyName,
      subject: personalized.subject,
      textBody: personalized.text,
      htmlBody: personalized.html,
    };
  });

  const configStatus = getEmailConfigurationStatus();

  return {
    campaignId: campaign.campaignId,
    campaignName: campaign.name,
    strategy,
    storeUrl,
    recipientCount: previews.length,
    validRecipientCount: previews.filter((p) => p.emailValid).length,
    recipients: previews,
    emailConfig: configStatus,
  };
}

/**
 * Sends a retention strategy email via the configured provider.
 * Supports SMTP (with Gmail / custom SMTP host) and Dry-Run modes.
 */
export async function sendRetentionEmail({
  to,
  recipientName,
  subject,
  html,
  text,
  campaignId,
  strategy,
  customerId,
}) {
  const config = getEmailConfigurationStatus();
  const emailFrom = config.emailFrom;
  const replyTo = config.replyTo;
  const storeUrl = config.storeUrl;
  const validation = validateCustomerEmail(to);

  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid email recipient '${to}' (${validation.reason})`,
      mode: config.mode,
      provider: config.provider,
    };
  }

  const timestamp = new Date().toISOString();

  // DRY-RUN MODE: Logging only, zero network dispatch
  if (config.mode === "dry-run" || config.provider === "dry-run") {
    const messageId = `dry-run-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    console.log(`[EMAIL DRY-RUN] Dispatching to ${recipientName} <${to}> | Subject: "${subject}" | Campaign: ${campaignId} | MessageID: ${messageId}`);
    
    return {
      success: true,
      mode: "dry-run",
      provider: "dry-run",
      providerMessageId: messageId,
      from: emailFrom,
      to,
      recipientName,
      subject,
      dispatchedAt: timestamp,
    };
  }

  // LIVE SMTP MODE
  if (config.provider === "smtp") {
    if (!config.smtpConfigured) {
      return {
        success: false,
        error: "Real email sending is not configured. Add SMTP_USER, SMTP_PASSWORD and required SMTP settings to backend/.env.",
        mode: "live",
        provider: "smtp",
      };
    }

    const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.SMTP_EMAIL;
    const pass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;
    const host = config.smtpHostName;
    const port = config.smtpPort;
    const secure = config.smtpSecure;

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });

      const messageRef = `${campaignId || "retention"}-${customerId || "cust"}-${Date.now()}@lumawear.com`;
      const unsubUrl = `${storeUrl}/account`;

      const info = await transporter.sendMail({
        from: emailFrom,
        to,
        replyTo,
        subject,
        text,
        html,
        headers: {
          "X-Entity-Ref-ID": messageRef,
          "List-Unsubscribe": `<mailto:${user}?subject=Unsubscribe>, <${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      console.log(`[EMAIL LIVE SMTP] Sent successfully to ${recipientName} <${to}> | Subject: "${subject}" | MessageID: ${info.messageId}`);

      return {
        success: true,
        mode: "live",
        provider: "smtp",
        providerMessageId: info.messageId,
        from: emailFrom,
        to,
        recipientName,
        subject,
        dispatchedAt: timestamp,
      };
    } catch (sendError) {
      console.error(`[EMAIL LIVE SMTP ERROR] Failed to send to ${to}:`, sendError.message);
      return {
        success: false,
        error: `SMTP transmission failed: ${sendError.message}`,
        mode: "live",
        provider: "smtp",
      };
    }
  }

  return {
    success: false,
    error: `Unknown email provider: '${config.provider}'`,
    mode: config.mode,
    provider: config.provider,
  };
}
