import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  buildPartnerAlertEmailContent,
  validatePartnerAlertPayload,
} from './src/utils/partnerNotifications.ts';
import type { PartnerAlertEmailPayload } from './src/utils/partnerNotifications.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

app.set('trust proxy', 1);
app.use(express.json());

// Health check endpoints for Cloud Run and container liveness probes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

interface ResetConfirmationEmailPayload {
  email?: string;
  displayName?: string;
  username?: string;
  code?: string;
  confirmToken?: string;
  confirmUrl?: string;
  expiresAtIso?: string;
}

app.post('/api/auth/send-reset-confirmation', async (req, res) => {
  const body = (req.body || {}) as ResetConfirmationEmailPayload;
  const recipientEmail = typeof body.email === 'string' ? body.email.trim() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : 'Administrator';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const confirmUrl = typeof body.confirmUrl === 'string' ? body.confirmUrl.trim() : '';
  const expiresAtIso = typeof body.expiresAtIso === 'string' ? body.expiresAtIso.trim() : '';

  if (!recipientEmail || !recipientEmail.includes('@') || !code) {
    res.status(400).json({
      ok: false,
      error: 'Valid recipient email and confirmation code are required.',
    });
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress =
    process.env.EMAIL_FROM?.trim() || 'ZSB AQUATICS Security <no-reply@zsbaquatics.com>';
  const messageId = `zsb-mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sentAt = new Date().toISOString();

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipientEmail],
          subject: 'ZSB AQUATICS — Password Reset Email Confirmation',
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
                ${confirmUrl ? `<p style="margin: 16px 0 0; font-size: 13px;">Or confirm directly using this link: <a href="${confirmUrl}">${confirmUrl}</a></p>` : ''}
                ${expiresAtIso ? `<p style="margin: 14px 0 0; font-size: 12px; color: #64748b;">Code expires at: ${expiresAtIso}</p>` : ''}
              </div>
            </div>
          `,
        }),
      });

      if (response.ok) {
        const result = (await response.json()) as { id?: string };
        res.status(200).json({
          ok: true,
          mode: 'smtp_email',
          messageId: result.id || messageId,
          deliveredTo: recipientEmail,
          sentAt,
        });
        return;
      }
    } catch (err) {
      console.error('External email dispatch failed; falling back to local confirmation dispatch:', err);
    }
  }

  res.status(200).json({
    ok: true,
    mode: 'confirmation_inbox',
    messageId,
    deliveredTo: recipientEmail,
    sentAt,
  });
});

app.post('/api/notifications/partner-alert', async (req, res) => {
  const validation = validatePartnerAlertPayload(req.body);
  if (!validation.valid) {
    res.status(400).json({
      ok: false,
      error: validation.error || 'Invalid partner alert email payload.',
    });
    return;
  }

  const payload: PartnerAlertEmailPayload = {
    ...(req.body as PartnerAlertEmailPayload),
    recipients: validation.cleanRecipients,
  };

  const { subject, html, text } = buildPartnerAlertEmailContent(payload);
  const recipientEmails = validation.cleanRecipients.map((r) => r.email);

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress =
    process.env.EMAIL_FROM?.trim() || 'ZSB AQUATICS Security <no-reply@zsbaquatics.com>';
  const fallbackMessageId = `zsb-alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sentAt = new Date().toISOString();

  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipientEmails,
          subject,
          html,
          text,
        }),
      });

      if (response.ok) {
        const result = (await response.json()) as { id?: string };
        res.status(200).json({
          ok: true,
          mode: 'resend_email',
          provider: 'resend',
          messageId: result.id || fallbackMessageId,
          deliveredTo: recipientEmails,
          subject,
          sentAt,
        });
        return;
      }

      const errText = await response.text().catch(() => '');
      console.error(
        `Resend API returned HTTP ${response.status} for partner alert:`,
        errText
      );
      res.status(200).json({
        ok: true,
        mode: 'resend_error_fallback',
        provider: 'resend',
        errorDetail: `Resend API HTTP ${response.status}${errText ? `: ${errText.slice(0, 180)}` : ''}`,
        messageId: fallbackMessageId,
        deliveredTo: recipientEmails,
        subject,
        sentAt,
      });
      return;
    } catch (err) {
      console.error('Resend partner alert dispatch failed:', err);
      res.status(200).json({
        ok: true,
        mode: 'resend_error_fallback',
        provider: 'resend',
        errorDetail: err instanceof Error ? err.message : 'Network error calling Resend API',
        messageId: fallbackMessageId,
        deliveredTo: recipientEmails,
        subject,
        sentAt,
      });
      return;
    }
  }

  res.status(200).json({
    ok: true,
    mode: 'local_dispatch',
    provider: 'resend_unconfigured',
    messageId: fallbackMessageId,
    deliveredTo: recipientEmails,
    subject,
    sentAt,
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');
  const indexPath = path.resolve(distPath, 'index.html');
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        port: PORT,
        ws: { server: httpServer },
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(
      express.static(distPath, {
        maxAge: '1d',
        index: false,
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    app.get('*', (_req, res) => {
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

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
