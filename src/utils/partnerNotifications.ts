import type { PartnerAlertEventType } from '../types/index.ts';

export interface PartnerEmailRecipient {
  partnerName: string;
  email: string;
}

export interface ResolvedPartnerEmailEntry {
  partnerKey: string;
  partnerName: string;
  email: string;
  source: 'profile' | 'team_member' | 'missing';
}

export interface PartnerAlertEmailPayload {
  eventType: PartnerAlertEventType;
  companyName: string;
  currency: string;
  triggeredBy?: string;
  recipients: PartnerEmailRecipient[];
  withdrawal?: {
    id: string;
    date: string;
    partnerName: string;
    amount: number;
    paymentMethod?: string;
    referenceNo?: string;
    notes?: string;
    updatedTotalBalance: number;
    partnerShares: Array<{
      partnerName: string;
      equityPercent: number;
      netCapital: number;
    }>;
  };
  profitDistribution?: {
    id: string;
    targetYearMonth: string;
    payoutDate: string;
    calculatedNetProfit: number;
    distributedAmount: number;
    retainedAmount: number;
    paymentMethod?: string;
    referenceNo?: string;
    notes?: string;
    updatedTotalBalance: number;
    allocations: Array<{
      partnerName: string;
      equityPercent: number;
      payoutAmount: number;
    }>;
  };
}

export interface PartnerEmailContent {
  subject: string;
  html: string;
  text: string;
  summaryLine: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(email?: string | null): boolean {
  const clean = (email || '').trim();
  return EMAIL_PATTERN.test(clean);
}

export function validatePartnerEmailAddress(rawEmail: string): {
  valid: boolean;
  cleanEmail: string;
  error?: string;
} {
  const cleanEmail = (rawEmail || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { valid: true, cleanEmail: '' };
  }
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return {
      valid: false,
      cleanEmail,
      error: 'Please enter a valid email address (e.g. partner@zsbaquatics.com).',
    };
  }
  return { valid: true, cleanEmail };
}

export function setPartnerEmailInMap(
  currentMap: Record<string, string> | undefined,
  partnerName: string,
  email: string
): Record<string, string> {
  const next = { ...(currentMap || {}) };
  const key = (partnerName || '').trim().toLowerCase();
  if (!key) return next;
  const clean = (email || '').trim().toLowerCase();
  if (!clean) {
    delete next[key];
  } else {
    next[key] = clean;
  }
  return next;
}

export function resolvePartnerEmailDirectory(
  partnerDirectory: string[],
  partnerEmails?: Record<string, string>,
  teamMembers?: Array<{ displayName: string; email: string; status?: string }>
): ResolvedPartnerEmailEntry[] {
  const explicitMap = partnerEmails || {};
  const memberEmailByName = new Map<string, string>();

  for (const member of teamMembers || []) {
    if (member.status === 'suspended') continue;
    const key = (member.displayName || '').trim().toLowerCase();
    const email = (member.email || '').trim().toLowerCase();
    if (key && isValidEmailAddress(email) && !memberEmailByName.has(key)) {
      memberEmailByName.set(key, email);
    }
  }

  return (partnerDirectory || []).map((rawName) => {
    const partnerName = (rawName || '').trim();
    const partnerKey = partnerName.toLowerCase();

    const explicitRaw = explicitMap[partnerKey] ?? explicitMap[partnerName];
    if (isValidEmailAddress(explicitRaw)) {
      return {
        partnerKey,
        partnerName,
        email: explicitRaw.trim().toLowerCase(),
        source: 'profile',
      };
    }

    const teamEmail = memberEmailByName.get(partnerKey);
    if (teamEmail && isValidEmailAddress(teamEmail)) {
      return {
        partnerKey,
        partnerName,
        email: teamEmail,
        source: 'team_member',
      };
    }

    return {
      partnerKey,
      partnerName,
      email: '',
      source: 'missing',
    };
  });
}

export function collectValidPartnerRecipients(
  entries: ResolvedPartnerEmailEntry[]
): PartnerEmailRecipient[] {
  const seenEmails = new Set<string>();
  const recipients: PartnerEmailRecipient[] = [];

  for (const entry of entries || []) {
    const email = (entry.email || '').trim().toLowerCase();
    if (!isValidEmailAddress(email) || seenEmails.has(email)) continue;
    seenEmails.add(email);
    recipients.push({
      partnerName: entry.partnerName,
      email,
    });
  }

  return recipients;
}

export function escapeNotificationHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: number, currency: string): string {
  const num = Number(amount) || 0;
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${num < 0 ? '-' : ''}${currency || 'TK'} ${formatted}`;
}

export function validatePartnerAlertPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  cleanRecipients: PartnerEmailRecipient[];
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Missing email alert payload.', cleanRecipients: [] };
  }
  const p = payload as Partial<PartnerAlertEmailPayload>;
  if (p.eventType !== 'partner_withdrawal' && p.eventType !== 'profit_distribution') {
    return {
      valid: false,
      error: 'eventType must be "partner_withdrawal" or "profit_distribution".',
      cleanRecipients: [],
    };
  }

  const seenEmails = new Set<string>();
  const cleanRecipients: PartnerEmailRecipient[] = [];
  for (const rec of Array.isArray(p.recipients) ? p.recipients : []) {
    const email = typeof rec?.email === 'string' ? rec.email.trim().toLowerCase() : '';
    const partnerName =
      typeof rec?.partnerName === 'string' && rec.partnerName.trim()
        ? rec.partnerName.trim()
        : 'Partner';
    if (!isValidEmailAddress(email) || seenEmails.has(email)) continue;
    seenEmails.add(email);
    cleanRecipients.push({ partnerName, email });
  }

  if (cleanRecipients.length === 0) {
    return {
      valid: false,
      error: 'At least one valid partner email address is required.',
      cleanRecipients: [],
    };
  }

  if (p.eventType === 'partner_withdrawal') {
    if (!p.withdrawal || !p.withdrawal.partnerName || !(Number(p.withdrawal.amount) > 0)) {
      return {
        valid: false,
        error: 'Valid partner withdrawal details (partnerName and positive amount) are required.',
        cleanRecipients,
      };
    }
  } else {
    if (
      !p.profitDistribution ||
      !p.profitDistribution.targetYearMonth ||
      !(Number(p.profitDistribution.distributedAmount) > 0)
    ) {
      return {
        valid: false,
        error:
          'Valid profit distribution details (targetYearMonth and positive distributedAmount) are required.',
        cleanRecipients,
      };
    }
  }

  return { valid: true, cleanRecipients };
}

export function buildPartnerAlertEmailContent(
  payload: PartnerAlertEmailPayload
): PartnerEmailContent {
  const companyName = (payload.companyName || 'ZSB AQUATICS').trim() || 'ZSB AQUATICS';
  const currency = (payload.currency || 'TK').trim() || 'TK';
  const triggeredBy = (payload.triggeredBy || 'System Administrator').trim();

  if (payload.eventType === 'partner_withdrawal' && payload.withdrawal) {
    const w = payload.withdrawal;
    const formattedAmount = formatMoney(w.amount, currency);
    const formattedBalance = formatMoney(w.updatedTotalBalance, currency);
    const subject = `${companyName} — Partner Withdrawal Alert: ${w.partnerName} (${formattedAmount})`;
    const summaryLine = `Withdrawal by ${w.partnerName}: ${formattedAmount} on ${w.date} (New Balance: ${formattedBalance})`;

    const shareRowsHtml = (w.partnerShares || [])
      .map(
        (s) => `
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${escapeNotificationHtml(s.partnerName)}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #0f172a;">${formatMoney(s.netCapital, currency)}</td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 700; color: #1d6ce0;">${Number(s.equityPercent).toFixed(2)}%</td>
          </tr>
        `
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 620px; margin: 0 auto; border: 1px solid #cbd8e6; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #273e56; color: #ffffff; padding: 18px 24px;">
          <h2 style="margin: 0; color: #fbbf24; font-weight: 800; font-size: 18px;">${escapeNotificationHtml(companyName)}</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #e2e8f0;">Automated Treasury Alert · Partner Withdrawal Issued</p>
        </div>
        <div style="padding: 22px 24px;">
          <p style="margin: 0 0 14px; font-size: 14px;">A new <strong>Partner Withdrawal</strong> has been logged in the Total Balance ledger:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px; background: #f8fafc; border: 1px solid #cbd8e6;">
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Partner</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700;">${escapeNotificationHtml(w.partnerName)}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Withdrawal Date</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(w.date)}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Amount Deducted</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 800; color: #b91c1c;">&minus;${escapeNotificationHtml(formattedAmount)}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Disbursement Method</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(w.paymentMethod || 'Bank Transfer')}</td></tr>
            ${w.referenceNo ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Voucher / Ref</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(w.referenceNo)}</td></tr>` : ''}
            ${w.notes ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Notes</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(w.notes)}</td></tr>` : ''}
            <tr><td style="padding: 8px 12px; color: #475569; font-weight: 700;">Updated Total Balance</td><td style="padding: 8px 12px; font-family: monospace; font-weight: 800; color: #0f172a;">${escapeNotificationHtml(formattedBalance)}</td></tr>
          </table>
          ${
            shareRowsHtml
              ? `<p style="margin: 0 0 8px; font-size: 13px; font-weight: 700;">Updated Partner Capital &amp; Equity %:</p>
                 <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd8e6;">
                   <thead><tr style="background: #f1f5f9;"><th style="padding: 8px 10px; text-align: left;">Partner</th><th style="padding: 8px 10px; text-align: right;">Net Capital</th><th style="padding: 8px 10px; text-align: right;">Equity %</th></tr></thead>
                   <tbody>${shareRowsHtml}</tbody>
                 </table>`
              : ''
          }
          <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">Issued by: ${escapeNotificationHtml(triggeredBy)} · Reference ID: ${escapeNotificationHtml(w.id)}</p>
        </div>
      </div>
    `;

    const shareLines = (w.partnerShares || [])
      .map((s) => `  - ${s.partnerName}: ${formatMoney(s.netCapital, currency)} (${Number(s.equityPercent).toFixed(2)}%)`)
      .join('\n');

    const text = [
      `${companyName} — Partner Withdrawal Alert`,
      '',
      `Partner: ${w.partnerName}`,
      `Date: ${w.date}`,
      `Amount Deducted: -${formattedAmount}`,
      `Method: ${w.paymentMethod || 'Bank Transfer'}`,
      w.referenceNo ? `Reference: ${w.referenceNo}` : '',
      w.notes ? `Notes: ${w.notes}` : '',
      `Updated Total Balance: ${formattedBalance}`,
      '',
      shareLines ? `Updated Partner Equity:\n${shareLines}` : '',
      '',
      `Issued by: ${triggeredBy} (ID: ${w.id})`,
    ]
      .filter(Boolean)
      .join('\n');

    return { subject, html, text, summaryLine };
  }

  const d = payload.profitDistribution!;
  const formattedPayout = formatMoney(d.distributedAmount, currency);
  const formattedNetProfit = formatMoney(d.calculatedNetProfit, currency);
  const formattedRetained = formatMoney(d.retainedAmount, currency);
  const formattedBalance = formatMoney(d.updatedTotalBalance, currency);
  const subject = `${companyName} — Profit Distribution Issued: ${d.targetYearMonth} (${formattedPayout})`;
  const summaryLine = `Profit payout (${d.targetYearMonth}): ${formattedPayout} across ${(d.allocations || []).filter((a) => a.payoutAmount > 0).length} partner(s) (New Balance: ${formattedBalance})`;

  const allocRowsHtml = (d.allocations || [])
    .map(
      (a) => `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${escapeNotificationHtml(a.partnerName)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #1d6ce0;">${Number(a.equityPercent).toFixed(2)}%</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 700; color: #15803d;">${formatMoney(a.payoutAmount, currency)}</td>
        </tr>
      `
    )
    .join('');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 620px; margin: 0 auto; border: 1px solid #cbd8e6; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #273e56; color: #ffffff; padding: 18px 24px;">
        <h2 style="margin: 0; color: #fbbf24; font-weight: 800; font-size: 18px;">${escapeNotificationHtml(companyName)}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; color: #e2e8f0;">Automated Treasury Alert · Profit Distribution Issued</p>
      </div>
      <div style="padding: 22px 24px;">
        <p style="margin: 0 0 14px; font-size: 14px;">A monthly <strong>Profit Distribution</strong> payout has been issued for <strong>${escapeNotificationHtml(d.targetYearMonth)}</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px; background: #f8fafc; border: 1px solid #cbd8e6;">
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Profit Month</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 700;">${escapeNotificationHtml(d.targetYearMonth)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Payout Issue Date</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(d.payoutDate)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Calculated Net Monthly Profit</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(formattedNetProfit)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Total Payout Distributed</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 800; color: #15803d;">${escapeNotificationHtml(formattedPayout)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Retained Profit</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(formattedRetained)}</td></tr>
          <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Disbursement Method</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(d.paymentMethod || 'Bank Transfer')}</td></tr>
          ${d.referenceNo ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Voucher / Ref</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${escapeNotificationHtml(d.referenceNo)}</td></tr>` : ''}
          ${d.notes ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Resolution Notes</td><td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${escapeNotificationHtml(d.notes)}</td></tr>` : ''}
          <tr><td style="padding: 8px 12px; color: #475569; font-weight: 700;">Updated Total Balance</td><td style="padding: 8px 12px; font-family: monospace; font-weight: 800; color: #0f172a;">${escapeNotificationHtml(formattedBalance)}</td></tr>
        </table>
        ${
          allocRowsHtml
            ? `<p style="margin: 0 0 8px; font-size: 13px; font-weight: 700;">Partner Payout Allocation:</p>
               <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd8e6;">
                 <thead><tr style="background: #f1f5f9;"><th style="padding: 8px 10px; text-align: left;">Partner</th><th style="padding: 8px 10px; text-align: right;">Equity %</th><th style="padding: 8px 10px; text-align: right;">Payout Amount</th></tr></thead>
                 <tbody>${allocRowsHtml}</tbody>
               </table>`
            : ''
        }
        <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">Issued by: ${escapeNotificationHtml(triggeredBy)} · Reference ID: ${escapeNotificationHtml(d.id)}</p>
      </div>
    </div>
  `;

  const allocLines = (d.allocations || [])
    .map((a) => `  - ${a.partnerName} (${Number(a.equityPercent).toFixed(2)}%): ${formatMoney(a.payoutAmount, currency)}`)
    .join('\n');

  const text = [
    `${companyName} — Profit Distribution Issued (${d.targetYearMonth})`,
    '',
    `Payout Date: ${d.payoutDate}`,
    `Calculated Net Profit: ${formattedNetProfit}`,
    `Total Payout Distributed: ${formattedPayout}`,
    `Retained Profit: ${formattedRetained}`,
    `Method: ${d.paymentMethod || 'Bank Transfer'}`,
    d.referenceNo ? `Reference: ${d.referenceNo}` : '',
    d.notes ? `Notes: ${d.notes}` : '',
    `Updated Total Balance: ${formattedBalance}`,
    '',
    allocLines ? `Partner Allocation:\n${allocLines}` : '',
    '',
    `Issued by: ${triggeredBy} (ID: ${d.id})`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text, summaryLine };
}
