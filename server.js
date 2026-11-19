// server.ts
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// src/utils/partnerNotifications.ts
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmailAddress(email) {
  const clean = (email || "").trim();
  return EMAIL_PATTERN.test(clean);
}
function escapeNotificationHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatMoney(amount, currency) {
  const num = Number(amount) || 0;
  const formatted = Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${num < 0 ? "-" : ""}${currency || "TK"} ${formatted}`;
}
function validatePartnerAlertPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Missing email alert payload.", cleanRecipients: [] };
  }
  const p = payload;
  if (p.eventType !== "partner_withdrawal" && p.eventType !== "profit_distribution") {
    return {
      valid: false,
      error: 'eventType must be "partner_withdrawal" or "profit_distribution".',
      cleanRecipients: []
    };
  }
  const seenEmails = /* @__PURE__ */ new Set();
  const cleanRecipients = [];
  for (const rec of Array.isArray(p.recipients) ? p.recipients : []) {
    const email = typeof rec?.email === "string" ? rec.email.trim().toLowerCase() : "";
    const partnerName = typeof rec?.partnerName === "string" && rec.partnerName.trim() ? rec.partnerName.trim() : "Partner";
    if (!isValidEmailAddress(email) || seenEmails.has(email)) continue;
    seenEmails.add(email);
    cleanRecipients.push({ partnerName, email });
  }
  if (cleanRecipients.length === 0) {
    return {
      valid: false,
      error: "At least one valid partner email address is required.",
      cleanRecipients: []
    };
  }
  if (p.eventType === "partner_withdrawal") {
    if (!p.withdrawal || !p.withdrawal.partnerName || !(Number(p.withdrawal.amount) > 0)) {
      return {
        valid: false,
        error: "Valid partner withdrawal details (partnerName and positive amount) are required.",
        cleanRecipients
      };
    }
  } else {
    if (!p.profitDistribution || !p.profitDistribution.targetYearMonth || !(Number(p.profitDistribution.distributedAmount) > 0)) {
      return {
        valid: false,
        error: "Valid profit distribution details (targetYearMonth and positive distributedAmount) are required.",
        cleanRecipients
      };
    }
  }
  return { valid: true, cleanRecipients };
}
function buildPartnerAlertEmailContent(payload) {
  const companyName = (payload.companyName || "ZSB AQUATICS").trim() || "ZSB AQUATICS";
  const currency = (payload.currency || "TK").trim() || "TK";
  const triggeredBy = (payload.triggeredBy || "System Administrator").trim();
  if (payload.eventType === "partner_withdrawal" && payload.withdrawal) {
    const w = payload.withdrawal;
    const formattedAmount = formatMoney(w.amount, currency);
    const formattedBalance2 = formatMoney(w.updatedTotalBalance, currency);
    const subject2 = `${companyName} \u2014 Partner Withdrawal Alert: ${w.partnerName} (${formattedAmount})`;
    const summaryLine2 = `Withdrawal by ${w.partnerName}: ${formattedAmount} on ${w.date} (New Balance: ${formattedBalance2})`;
    const shareRowsHtml = (w.partnerShares || []).map(
      (s) => `
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${escapeNotificationHtml(s.partnerName)}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #0f172a;">${formatMoney(s.netCapital, currency)}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 700; color: #1d6ce0;">${Number(s.equityPercent).toFixed(2)}%</td>
          </tr>
        `
    ).join("");
    const html2 = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 620px; margin: 0 auto; border: 1px solid #cbd8e6; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #273e56; color: #ffffff; padding: 18px 24px;">
          <h2 style="margin: 0; color: #fbbf24; font-weight: 800; font-size: 18px;">${escapeNotificationHtml(companyName)}</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #e2e8f0;">Automated Treasury Alert \xB7 Partner Withdrawal Issued</p>
        </div>
        <div style="padding: 22px 24px;">
          <p style="margin: 0 0 14px; font-size: 14px;">A new <strong>Partner Withdrawal</strong> has been logged in the Total Balance ledger:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px; background: #f8fafc; border: 1px solid #cbd8e6;">
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Partner</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700;">${escapeNotificationHtml(w.partnerName)}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Withdrawal Date</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(w.date)}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Amount Deducted</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 800; color: #b91c1c;">&minus;${escapeNotificationHtml(formattedAmount)}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Disbursement Method</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(w.paymentMethod || "Bank Transfer")}</td></tr>
            ${w.referenceNo ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Voucher / Ref</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(w.referenceNo)}</td></tr>` : ""}
            ${w.notes ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Notes</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(w.notes)}</td></tr>` : ""}
            <tr><td style="padding: 8px 12px; color: #475569; font-weight: 700;">Updated Total Balance</td><td style="padding: 8px 12px; font-family: monospace; font-weight: 800; color: #0f172a;">${escapeNotificationHtml(formattedBalance2)}</td></tr>
          </table>
          ${shareRowsHtml ? `<p style="margin: 0 0 8px; font-size: 13px; font-weight: 700;">Updated Partner Capital &amp; Equity %:</p>
                 <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd8e6;">
                   <thead><tr style="background: #f1f5f9;"><th style="padding: 8px 10px; text-align: left;">Partner</th><th style="padding: 8px 10px; text-align: right;">Net Capital</th><th style="padding: 8px 10px; text-align: right;">Equity %</th></tr></thead>
                   <tbody>${shareRowsHtml}</tbody>
                 </table>` : ""}
          <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">Issued by: ${escapeNotificationHtml(triggeredBy)} \xB7 Reference ID: ${escapeNotificationHtml(w.id)}</p>
        </div>
      </div>
    `;
    const shareLines = (w.partnerShares || []).map((s) => `  - ${s.partnerName}: ${formatMoney(s.netCapital, currency)} (${Number(s.equityPercent).toFixed(2)}%)`).join("\n");
    const text2 = [
      `${companyName} \u2014 Partner Withdrawal Alert`,
      "",
      `Partner: ${w.partnerName}`,
      `Date: ${w.date}`,
      `Amount Deducted: -${formattedAmount}`,
      `Method: ${w.paymentMethod || "Bank Transfer"}`,
      w.referenceNo ? `Reference: ${w.referenceNo}` : "",
      w.notes ? `Notes: ${w.notes}` : "",
      `Updated Total Balance: ${formattedBalance2}`,
      "",
      shareLines ? `Updated Partner Equity:
${shareLines}` : "",
      "",
      `Issued by: ${triggeredBy} (ID: ${w.id})`
    ].filter(Boolean).join("\n");
    return { subject: subject2, html: html2, text: text2, summaryLine: summaryLine2 };
  }
  const d = payload.profitDistribution;
  const formattedPayout = formatMoney(d.distributedAmount, currency);
  const formattedNetProfit = formatMoney(d.calculatedNetProfit, currency);
  const formattedRetained = formatMoney(d.retainedAmount, currency);
  const formattedBalance = formatMoney(d.updatedTotalBalance, currency);
  const subject = `${companyName} \u2014 Profit Distribution Issued: ${d.targetYearMonth} (${formattedPayout})`;
  const summaryLine = `Profit payout (${d.targetYearMonth}): ${formattedPayout} across ${(d.allocations || []).filter((a) => a.payoutAmount > 0).length} partner(s) (New Balance: ${formattedBalance})`;
  const allocRowsHtml = (d.allocations || []).map(
    (a) => `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${escapeNotificationHtml(a.partnerName)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #1d6ce0;">${Number(a.equityPercent).toFixed(2)}%</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 700; color: #15803d;">${formatMoney(a.payoutAmount, currency)}</td>
        </tr>
      `
  ).join("");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 620px; margin: 0 auto; border: 1px solid #cbd8e6; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #273e56; color: #ffffff; padding: 18px 24px;">
        <h2 style="margin: 0; color: #fbbf24; font-weight: 800; font-size: 18px;">${escapeNotificationHtml(companyName)}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #e2e8f0;">Automated Treasury Alert \xB7 Profit Distribution Issued</p>
      </div>
      <div style="padding: 22px 24px;">
        <p style="margin: 0 0 14px; font-size: 14px;">A monthly <strong>Profit Distribution</strong> payout has been issued for <strong>${escapeNotificationHtml(d.targetYearMonth)}</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px; background: #f8fafc; border: 1px solid #cbd8e6;">
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Profit Month</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 700;">${escapeNotificationHtml(d.targetYearMonth)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Payout Issue Date</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(d.payoutDate)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Calculated Net Monthly Profit</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(formattedNetProfit)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Total Payout Distributed</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 800; color: #15803d;">${escapeNotificationHtml(formattedPayout)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Retained Profit</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(formattedRetained)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Disbursement Method</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(d.paymentMethod || "Bank Transfer")}</td></tr>
          ${d.referenceNo ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Voucher / Ref</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(d.referenceNo)}</td></tr>` : ""}
          ${d.notes ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Resolution Notes</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(d.notes)}</td></tr>` : ""}
          <tr><td style="padding: 8px 12px; color: #475569; font-weight: 700;">Updated Total Balance</td><td style="padding: 8px 12px; font-family: monospace; font-weight: 800; color: #0f172a;">${escapeNotificationHtml(formattedBalance)}</td></tr>
        </table>
        ${allocRowsHtml ? `<p style="margin: 0 0 8px; font-size: 13px; font-weight: 700;">Partner Payout Allocation:</p>
               <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd8e6;">
                 <thead><tr style="background: #f1f5f9;"><th style="padding: 8px 10px; text-align: left;">Partner</th><th style="padding: 8px 10px; text-align: right;">Equity %</th><th style="padding: 8px 10px; text-align: right;">Payout Amount</th></tr></thead>
                 <tbody>${allocRowsHtml}</tbody>
               </table>` : ""}
        <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">Issued by: ${escapeNotificationHtml(triggeredBy)} \xB7 Reference ID: ${escapeNotificationHtml(d.id)}</p>
      </div>
    </div>
  `;
  const allocLines = (d.allocations || []).map((a) => `  - ${a.partnerName} (${Number(a.equityPercent).toFixed(2)}%): ${formatMoney(a.payoutAmount, currency)}`).join("\n");
  const text = [
    `${companyName} \u2014 Profit Distribution Issued (${d.targetYearMonth})`,
    "",
    `Payout Date: ${d.payoutDate}`,
    `Calculated Net Profit: ${formattedNetProfit}`,
    `Total Payout Distributed: ${formattedPayout}`,
    `Retained Profit: ${formattedRetained}`,
    `Method: ${d.paymentMethod || "Bank Transfer"}`,
    d.referenceNo ? `Reference: ${d.referenceNo}` : "",
    d.notes ? `Notes: ${d.notes}` : "",
    `Updated Total Balance: ${formattedBalance}`,
    "",
    allocLines ? `Partner Allocation:
${allocLines}` : "",
    "",
    `Issued by: ${triggeredBy} (ID: ${d.id})`
  ].filter(Boolean).join("\n");
  return { subject, html, text, summaryLine };
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = parseInt(process.env.PORT || "3000", 10);
var HOST = "0.0.0.0";
app.set("trust proxy", 1);
app.use(express.json());
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/auth/send-reset-confirmation", async (req, res) => {
  const body = req.body || {};
  const recipientEmail = typeof body.email === "string" ? body.email.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "Administrator";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const confirmUrl = typeof body.confirmUrl === "string" ? body.confirmUrl.trim() : "";
  const expiresAtIso = typeof body.expiresAtIso === "string" ? body.expiresAtIso.trim() : "";
  if (!recipientEmail || !recipientEmail.includes("@") || !code) {
    res.status(400).json({
      ok: false,
      error: "Valid recipient email and confirmation code are required."
    });
    return;
  }
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM?.trim() || "ZSB AQUATICS Security <no-reply@zsbaquatics.com>";
  const messageId = `zsb-mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sentAt = (/* @__PURE__ */ new Date()).toISOString();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipientEmail],
          subject: "ZSB AQUATICS \u2014 Password Reset Email Confirmation",
          html: `
            <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 560px; margin: 0 auto; border: 1px solid #cbd8e6; border-radius: 12px; overflow: hidden;">
              <div style="background: #273e56; color: #ffffff; padding: 18px 24px;">
                <h2 style="margin: 0; color: #fbbf24; font-weight: 800;">ZSB AQUATICS</h2>
                <p style="margin: 4px 0 0; font-size: 13px; color: #e2e8f0;">Password Reset Email Confirmation</p>
              </div>
              <div style="padding: 24px;">
                <p style="margin: 0 0 12px;">Hello ${displayName},</p>
                <p style="margin: 0 0 16px;">We received a request to reset your ZSB AQUATICS account password. Use the confirmation code below to authorize the reset:</p>
                <div style="background: #f8fafc; border: 1px solid #cbd8e6; border-radius: 8px; padding: 14px; text-align: center; font-size: 26px; font-weight: 800; letter-spacing: 6px; font-family: monospace;">
                  ${code}
                </div>
                ${confirmUrl ? `<p style="margin: 16px 0 0; font-size: 13px;">Or confirm directly using this link: <a href="${confirmUrl}">${confirmUrl}</a></p>` : ""}
                ${expiresAtIso ? `<p style="margin: 14px 0 0; font-size: 12px; color: #64748b;">Code expires at: ${expiresAtIso}</p>` : ""}
              </div>
            </div>
          `
        })
      });
      if (response.ok) {
        const result = await response.json();
        res.status(200).json({
          ok: true,
          mode: "smtp_email",
          messageId: result.id || messageId,
          deliveredTo: recipientEmail,
          sentAt
        });
        return;
      }
    } catch (err) {
      console.error("External email dispatch failed; falling back to local confirmation dispatch:", err);
    }
  }
  res.status(200).json({
    ok: true,
    mode: "confirmation_inbox",
    messageId,
    deliveredTo: recipientEmail,
    sentAt
  });
});
app.post("/api/notifications/partner-alert", async (req, res) => {
  const validation = validatePartnerAlertPayload(req.body);
  if (!validation.valid) {
    res.status(400).json({
      ok: false,
      error: validation.error || "Invalid partner alert email payload."
    });
    return;
  }
  const payload = {
    ...req.body,
    recipients: validation.cleanRecipients
  };
  const { subject, html, text } = buildPartnerAlertEmailContent(payload);
  const recipientEmails = validation.cleanRecipients.map((r) => r.email);
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM?.trim() || "ZSB AQUATICS Security <no-reply@zsbaquatics.com>";
  const fallbackMessageId = `zsb-alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sentAt = (/* @__PURE__ */ new Date()).toISOString();
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipientEmails,
          subject,
          html,
          text
        })
      });
      if (response.ok) {
        const result = await response.json();
        res.status(200).json({
          ok: true,
          mode: "resend_email",
          provider: "resend",
          messageId: result.id || fallbackMessageId,
          deliveredTo: recipientEmails,
          subject,
          sentAt
        });
        return;
      }
      const errText = await response.text().catch(() => "");
      console.error(
        `Resend API returned HTTP ${response.status} for partner alert:`,
        errText
      );
      res.status(200).json({
        ok: true,
        mode: "resend_error_fallback",
        provider: "resend",
        errorDetail: `Resend API HTTP ${response.status}${errText ? `: ${errText.slice(0, 180)}` : ""}`,
        messageId: fallbackMessageId,
        deliveredTo: recipientEmails,
        subject,
        sentAt
      });
      return;
    } catch (err) {
      console.error("Resend partner alert dispatch failed:", err);
      res.status(200).json({
        ok: true,
        mode: "resend_error_fallback",
        provider: "resend",
        errorDetail: err instanceof Error ? err.message : "Network error calling Resend API",
        messageId: fallbackMessageId,
        deliveredTo: recipientEmails,
        subject,
        sentAt
      });
      return;
    }
  }
  res.status(200).json({
    ok: true,
    mode: "local_dispatch",
    provider: "resend_unconfigured",
    messageId: fallbackMessageId,
    deliveredTo: recipientEmails,
    subject,
    sentAt
  });
});
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.resolve(__dirname, "dist");
  const indexPath = path.resolve(distPath, "index.html");
  const httpServer = http.createServer(app);
  let servedByVite = false;
  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const isHmrDisabled = process.env.DISABLE_HMR === "true";
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
          port: PORT,
          ws: { server: httpServer },
          hmr: isHmrDisabled ? false : { server: httpServer }
        },
        appType: "spa"
      });
      app.use(vite.middlewares);
      servedByVite = true;
    } catch (viteErr) {
      if (!fs.existsSync(indexPath)) {
        throw viteErr;
      }
      console.warn("Vite dev server unavailable; falling back to static dist/ bundle.");
    }
  }
  if (!servedByVite && fs.existsSync(distPath)) {
    app.use(
      express.static(distPath, {
        maxAge: "1d",
        index: false
      })
    );
    app.get("*", (_req, res) => {
      res.sendFile(indexPath);
    });
  } else if (!servedByVite) {
    app.get("*", (_req, res) => {
      res.status(200).send(`
        <!doctype html>
        <html>
          <head><title>ZSB AQUATICS</title></head>
          <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
            <h2>ZSB AQUATICS - Business Control Center</h2>
            <p>Application is initializing. Please ensure "npm run build" has completed.</p>
          </body>
        </html>
      `);
    });
  }
  httpServer.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing HTTP server");
    httpServer.close(() => {
      console.log("HTTP server closed");
    });
  });
  process.on("SIGINT", () => {
    console.log("SIGINT signal received: closing HTTP server");
    httpServer.close(() => {
      console.log("HTTP server closed");
    });
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
var server_default = app;
export {
  server_default as default
};
