/**
 * LumaWear Retention Strategy Email Templates
 * 
 * Maps each of the 7 existing retention strategies to tailored, personalized email copy.
 * Reuses existing strategy-selection logic and customer feature definitions.
 * Optimized for high inbox deliverability, spam filter compliance, and responsive HTML rendering.
 */

/**
 * Resolves the public store URL consistently.
 * Prioritizes FRONTEND_URL or STORE_URL, replaces localhost with production fallback,
 * and ensures a complete https:// scheme without trailing slashes.
 */
export function getPublicStoreUrl(overrideUrl) {
  const candidate = (overrideUrl && typeof overrideUrl === "string" && overrideUrl.trim())
    ? overrideUrl.trim()
    : (process.env.FRONTEND_URL || process.env.STORE_URL || process.env.CLIENT_ORIGIN || "https://luma-wear-ecommerce-seven.vercel.app");

  let url = String(candidate).trim();

  // If candidate is a localhost or .local address, prefer production FRONTEND_URL or production fallback
  if (url.includes("localhost") || url.includes(".local")) {
    if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost") && !process.env.FRONTEND_URL.includes(".local")) {
      url = process.env.FRONTEND_URL.trim();
    } else {
      url = "https://luma-wear-ecommerce-seven.vercel.app";
    }
  }

  // Ensure valid scheme
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // Remove trailing slashes
  return url.replace(/\/+$/, "");
}

/**
 * Renders a complete, responsive, spam-resilient HTML email layout.
 */
function renderEmailLayout({
  title,
  preheader,
  badgeText = "Personalized Concierge",
  firstName,
  paragraphs = [],
  callToAction = null, // { text, url, note, noteBg, noteColor }
  footerNote = "You received this message because you are a valued customer of LumaWear.",
  storeUrl,
}) {
  const safeStoreUrl = getPublicStoreUrl(storeUrl);

  let ctaHtml = "";
  if (callToAction) {
    const noteHtml = callToAction.note
      ? `<div style="background-color: ${callToAction.noteBg || '#fafaf9'}; border: 1px dashed #d6d3d1; padding: 14px 18px; border-radius: 12px; margin: 0 auto 18px auto; max-width: 440px; font-size: 13px; font-weight: 600; color: ${callToAction.noteColor || '#1c1917'}; text-align: center;">${callToAction.note}</div>`
      : "";

    ctaHtml = `
      <div style="margin: 24px 0 20px 0; text-align: center;">
        ${noteHtml}
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td align="center" style="border-radius: 9999px; background-color: #1c1917;">
              <a href="${callToAction.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1c1917; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 9999px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ${callToAction.text}
              </a>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #44403c;">${p}</p>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f5f5f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1c1917;">
  <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader || title}
  </div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; overflow: hidden; border-collapse: separate;">
    <tr>
      <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f5f5f4;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <h1 style="margin: 0; color: #0c0a09; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">LumaWear</h1>
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #78716c; font-weight: 600;">${badgeText}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 32px 24px 32px;">
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #1c1917;">Hi <strong>${firstName}</strong>,</p>
        ${paragraphsHtml}
        ${ctaHtml}
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px 28px 32px; background-color: #fafaf9; border-top: 1px solid #f5f5f4; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.5; color: #78716c;">${footerNote}</p>
        <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #a8a29e;">
          <a href="${safeStoreUrl}" target="_blank" rel="noopener noreferrer" style="color: #78716c; text-decoration: underline; margin-right: 12px;">Visit Store</a>
          <a href="${safeStoreUrl}/account" target="_blank" rel="noopener noreferrer" style="color: #78716c; text-decoration: underline;">Notification Preferences</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const STRATEGY_EMAIL_TEMPLATES = {
  cart_abandonment: {
    strategyId: "cart_abandonment",
    strategyName: "Cart Abandonment Recovery",
    triggerDescription: "Customers with active cart items in last 30 days but no completed orders.",
    requiredCustomerFields: ["name", "email"],
    getSubject: (customer) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      return `Hi ${firstName}, you left something stylish in your cart!`;
    },
    getTextBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return `Hi ${firstName},

We noticed you left some curated apparel pieces waiting in your cart.

Your selected items are reserved, and we would love to help you complete your order. As a special courtesy, enjoy complimentary priority shipping on this purchase.

Return to your cart: ${storeUrl}/cart

Warm regards,
The LumaWear Concierge Team

---
Preferences: You can manage notification settings at ${storeUrl}/account`;
    },
    getHtmlBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return renderEmailLayout({
        title: "Complete Your LumaWear Order",
        preheader: "Your reserved cart items are waiting with complimentary priority delivery.",
        badgeText: "Personalized Concierge",
        firstName,
        paragraphs: [
          "We noticed you left some curated apparel pieces waiting in your cart. Your selected items are reserved, and we'd love to help you complete your order.",
        ],
        callToAction: {
          note: "🎁 Courtesy Offer: Complimentary Priority Delivery",
          text: "Complete Your Order",
          url: `${storeUrl}/cart`,
        },
        footerNote: "You received this message because you have items waiting in your LumaWear cart.",
        storeUrl,
      });
    },
  },

  inactivity_reengagement: {
    strategyId: "inactivity_reengagement",
    strategyName: "Inactivity Re-engagement",
    triggerDescription: "Customers with no storefront activity or login recorded for 14+ days.",
    requiredCustomerFields: ["name", "email"],
    getSubject: (customer) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      return `We miss you at LumaWear, ${firstName}! Here's what's new.`;
    },
    getTextBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return `Hi ${firstName},

It's been a while since your last visit to LumaWear. We have just released our new seasonal collection featuring premium everyday essentials and updated silhouettes.

Explore the latest arrivals: ${storeUrl}/shop

We'd love to welcome you back.

Best regards,
The LumaWear Team

---
Preferences: You can manage notification settings at ${storeUrl}/account`;
    },
    getHtmlBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return renderEmailLayout({
        title: "Welcome Back to LumaWear",
        preheader: "Explore fresh seasonal silhouettes and tailored everyday essentials.",
        badgeText: "Welcome Back Feature",
        firstName,
        paragraphs: [
          "It has been a little while since your last visit. We've dropped fresh seasonal silhouettes, sustainable knits, and tailored essentials designed for effortless everyday wear.",
        ],
        callToAction: {
          text: "Explore What's New",
          url: `${storeUrl}/shop`,
        },
        footerNote: "LumaWear &bull; Minimalist Quality for Everyday Comfort",
        storeUrl,
      });
    },
  },

  wishlist_followup: {
    strategyId: "wishlist_followup",
    strategyName: "Wishlist Follow-up",
    triggerDescription: "Customers with active wishlist saves in the past 30 days without orders.",
    requiredCustomerFields: ["name", "email"],
    getSubject: (customer) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      return `Your wishlist favorites are waiting for you, ${firstName}!`;
    },
    getTextBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return `Hi ${firstName},

Some of your saved wishlist favorites are currently in high demand.

Take another look before sizes run out: ${storeUrl}/wishlist

Best regards,
LumaWear Concierge

---
Preferences: You can manage notification settings at ${storeUrl}/account`;
    },
    getHtmlBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return renderEmailLayout({
        title: "Your LumaWear Wishlist",
        preheader: "Items on your saved wishlist are in stock, but popular sizes move quickly.",
        badgeText: "Wishlist Alert",
        firstName,
        paragraphs: [
          "Items on your saved wishlist are currently in stock, but inventory in popular sizes moves quickly.",
        ],
        callToAction: {
          text: "View Your Wishlist",
          url: `${storeUrl}/wishlist`,
        },
        footerNote: "LumaWear Wishlist Notifications &bull; High Demand Alert",
        storeUrl,
      });
    },
  },

  product_recommendation: {
    strategyId: "product_recommendation",
    strategyName: "Product Recommendations",
    triggerDescription: "Customers who browsed 5+ catalog items without placing an order.",
    requiredCustomerFields: ["name", "email"],
    getSubject: (customer) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      return `Handpicked recommendations curated for you, ${firstName}`;
    },
    getTextBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return `Hi ${firstName},

Based on your recent browsing, we curated our top-rated essentials you might love.

Browse recommended items: ${storeUrl}/shop

Best regards,
LumaWear Styling

---
Preferences: You can manage notification settings at ${storeUrl}/account`;
    },
    getHtmlBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return renderEmailLayout({
        title: "Curated Styles for You",
        preheader: "Top matching pieces with effortless tailoring curated for your taste.",
        badgeText: "Curated Selection",
        firstName,
        paragraphs: [
          "Based on your recent taste and browsed styles, our stylists curated top matching pieces with effortless tailoring.",
        ],
        callToAction: {
          text: "See Curated Styles",
          url: `${storeUrl}/shop`,
        },
        footerNote: "LumaWear Personal Styling &bull; Thoughtfully Curated",
        storeUrl,
      });
    },
  },

  new_customer_onboarding: {
    strategyId: "new_customer_onboarding",
    strategyName: "New Customer Onboarding",
    triggerDescription: "Recently joined customers with tenure <= 14 days and <= 1 order.",
    requiredCustomerFields: ["name", "email"],
    getSubject: (customer) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      return `Welcome to the LumaWear family, ${firstName}!`;
    },
    getTextBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return `Hi ${firstName},

Welcome to LumaWear! We are delighted to have you with us.

As a welcome privilege, explore our curated bestsellers and complete your wardrobe essentials.

Start exploring: ${storeUrl}/shop

Best regards,
The LumaWear Founder Team

---
Preferences: You can manage notification settings at ${storeUrl}/account`;
    },
    getHtmlBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return renderEmailLayout({
        title: "Welcome to LumaWear",
        preheader: "Modern, high-quality garments made with durable natural textiles.",
        badgeText: "Welcome Member",
        firstName,
        paragraphs: [
          "Welcome to the LumaWear community. We design modern, high-quality garments made with durable natural textiles and ethical craftsmanship.",
        ],
        callToAction: {
          text: "Discover LumaWear Classics",
          url: `${storeUrl}/shop`,
        },
        footerNote: "LumaWear Onboarding Series &bull; Welcome to the Community",
        storeUrl,
      });
    },
  },

  vip_retention: {
    strategyId: "vip_retention",
    strategyName: "VIP Retention",
    triggerDescription: "High-value spenders ($400+ spend) exhibiting elevated or high churn probability.",
    requiredCustomerFields: ["name", "email"],
    getSubject: (customer) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      return `Exclusive VIP Privilege & Dedicated Support for ${firstName}`;
    },
    getTextBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return `Hi ${firstName},

As one of LumaWear's most valued VIP patrons, your experience is our utmost priority.

We would like to extend dedicated concierge assistance, complimentary garment alterations, and private preview access to our upcoming limited-edition collection.

VIP Benefit Code: LUMAVIP-CONCIERGE
Access your VIP benefits: ${storeUrl}/account

Warmest regards,
Executive Concierge, LumaWear

---
Preferences: You can manage notification settings at ${storeUrl}/account`;
    },
    getHtmlBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return renderEmailLayout({
        title: "Exclusive VIP Concierge Privilege",
        preheader: "Dedicated concierge assistance and early private access to upcoming capsules.",
        badgeText: "★ VIP Patron Concierge",
        firstName,
        paragraphs: [
          "As one of our most distinguished patrons, we want to ensure your wardrobe experience is seamless. You have unlocked dedicated concierge assistance and early private access to our upcoming seasonal capsule.",
        ],
        callToAction: {
          note: "VIP Benefit Code: LUMAVIP-CONCIERGE",
          noteBg: "#fef3c7",
          noteColor: "#78350f",
          text: "Access VIP Portal",
          url: `${storeUrl}/account`,
        },
        footerNote: "LumaWear VIP Patron Services &bull; Priority Executive Assistance",
        storeUrl,
      });
    },
  },

  category_promotion: {
    strategyId: "category_promotion",
    strategyName: "Category-Based Promotion",
    triggerDescription: "Customers with established purchase affinity for a specific apparel category.",
    requiredCustomerFields: ["name", "email"],
    getSubject: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const category = context.preferredCategory || "Apparel";
      return `New ${category} arrivals tailored to your style, ${firstName}`;
    },
    getTextBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const category = context.preferredCategory || "Apparel";
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return `Hi ${firstName},

We noticed your preference for LumaWear ${category}. Our latest drop includes brand-new pieces and updated colorways in your favorite category.

Shop the ${category} collection: ${storeUrl}/shop?category=${encodeURIComponent(category)}

Best regards,
The LumaWear Team

---
Preferences: You can manage notification settings at ${storeUrl}/account`;
    },
    getHtmlBody: (customer, context = {}) => {
      const firstName = (customer.name || "Valued Customer").split(" ")[0];
      const category = context.preferredCategory || "Apparel";
      const storeUrl = getPublicStoreUrl(context.storeUrl);
      return renderEmailLayout({
        title: `New ${category} Arrivals`,
        preheader: `Brand-new designs, breathable fabrics, and refined colorways in ${category}.`,
        badgeText: "Category Focus",
        firstName,
        paragraphs: [
          `Knowing your eye for <strong>${category}</strong>, we've just added brand-new designs, breathable fabrics, and refined colorways to that exact lineup.`,
        ],
        callToAction: {
          text: `Shop ${category} Collection`,
          url: `${storeUrl}/shop?category=${encodeURIComponent(category)}`,
        },
        footerNote: "LumaWear Style Preferences &bull; Tailored Recommendations",
        storeUrl,
      });
    },
  },
};

export function getStrategyEmailContent(strategyType, customer, context = {}) {
  const template = STRATEGY_EMAIL_TEMPLATES[strategyType] || STRATEGY_EMAIL_TEMPLATES.cart_abandonment;
  return {
    strategyId: template.strategyId,
    strategyName: template.strategyName,
    subject: template.getSubject(customer, context),
    text: template.getTextBody(customer, context),
    html: template.getHtmlBody(customer, context),
  };
}
