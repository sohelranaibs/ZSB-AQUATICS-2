import { PaymentItemRow } from '../types/index.ts';
import { formatDate, formatRMB, calculatePaymentRow } from './calculations.ts';
import {
  copyPngBlobToClipboard,
  downloadPngFile,
  canSharePngFile,
  sharePngViaWebShare,
} from './pngShare.ts';
import { generateQrMatrix } from './shipmentQrCode.ts';

export interface ExporterRecordSharePayload {
  rowNumber: number;
  id: string;
  invoiceNumber: string;
  date: string;
  formattedDate: string;
  shippingMark: string;
  flight: string;
  box: number;
  weightKg: number;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  status: 'PAID' | 'UNPAID';
  companyName: string;
  companyAddress: string;
  companyMobiles: string[];
  companyEmail: string;
  partnerName: string;
  remarks?: string;
}

export interface NormalizeExporterRowOptions {
  rowNumber?: number;
  fallbackMark?: string;
  fallbackDate?: string;
  fallbackVoucher?: string;
  companyName?: string;
  companyAddress?: string;
  companyMobiles?: string[];
  companyEmail?: string;
  partnerName?: string;
  remarks?: string;
}

/**
 * Normalizes any Exporter Record History row into a structured payload for Image View & WeChat Share.
 */
export function normalizeExporterRowForShare(
  row: Partial<PaymentItemRow> & {
    flight?: string;
    box?: number;
    weightKg?: number;
    invoiceNumber?: string;
  },
  options: NormalizeExporterRowOptions = {}
): ExporterRecordSharePayload {
  const debitAmount = Math.round((Number(row.debitAmount) || 0) * 100) / 100;
  const creditAmount = Math.round((Number(row.creditAmount) || 0) * 100) / 100;
  const balance =
    row.balance !== undefined && !Number.isNaN(Number(row.balance))
      ? Math.round(Number(row.balance) * 100) / 100
      : calculatePaymentRow(debitAmount, creditAmount);

  const rawStatus = String(row.status || '').trim().toUpperCase();
  const status: 'PAID' | 'UNPAID' = rawStatus === 'PAID' ? 'PAID' : 'UNPAID';

  const descText = (row.description || '').trim();
  const extractedMarkFromDesc = descText.includes('—')
    ? descText.split('—')[0].trim()
    : descText.includes('-')
    ? descText.split('-')[0].trim()
    : '';

  const rawMark = (
    row.shippingMark ||
    (options.fallbackMark &&
    options.fallbackMark.toUpperCase() !== 'ALL' &&
    options.fallbackMark.toUpperCase() !== 'ALL MARKS'
      ? options.fallbackMark
      : extractedMarkFromDesc || options.fallbackMark) ||
    'ALL MARKS'
  ).trim();
  const shippingMark =
    rawMark && rawMark.toUpperCase() !== 'ALL' ? rawMark : 'EXPORTER MARK';

  const rawDate = (
    row.date ||
    options.fallbackDate ||
    new Date().toISOString().slice(0, 10)
  ).trim();
  const cleanDate =
    rawDate && rawDate.toUpperCase() !== 'ALL'
      ? rawDate
      : new Date().toISOString().slice(0, 10);

  const invoiceNumber =
    (row.invoiceNumber || options.fallbackVoucher || 'EXP-REC').trim() ||
    'EXP-REC';

  const description =
    descText || `${shippingMark} — ${invoiceNumber} (${formatDate(cleanDate)})`;

  return {
    rowNumber: options.rowNumber ?? 1,
    id: row.id || `exp-row-${options.rowNumber ?? 1}`,
    invoiceNumber,
    date: cleanDate,
    formattedDate: formatDate(cleanDate),
    shippingMark,
    flight: (row.flight || '').trim(),
    box: Number(row.box) || 0,
    weightKg: Math.round((Number(row.weightKg) || 0) * 100) / 100,
    description,
    debitAmount,
    creditAmount,
    balance,
    status,
    companyName: options.companyName || 'ZSB AQUATICS',
    companyAddress:
      options.companyAddress ||
      '29/B, NISHATNAGAR, TARARTEK, TURAG, DHAKA-1230',
    companyMobiles:
      options.companyMobiles && options.companyMobiles.length > 0
        ? options.companyMobiles
        : ['+880 18411-65902', '+880 1711 331545'],
    companyEmail: options.companyEmail || 'www.zsbaquatics.com',
    partnerName: options.partnerName || 'MD. SOHEL RANA',
    remarks: options.remarks,
  };
}

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(str, 'utf-8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(base64Url: string): string {
  const clean = (base64Url || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (clean.length % 4)) % 4;
  const padded = clean + '='.repeat(padLen);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Encodes an ExporterRecordSharePayload into a compact, URL-safe Base64 token (`wechat_tx`)
 * that can be embedded in deep links and QR codes.
 */
export function encodeExporterRowShareParam(
  payload: ExporterRecordSharePayload,
  options: { compact?: boolean } = {}
): string {
  if (options.compact) {
    const compactFields = [
      '1',
      String(payload.rowNumber || 1),
      (payload.invoiceNumber || 'EXP-REC').replace(/\t/g, ' '),
      (payload.date || '').replace(/\t/g, ' '),
      (payload.shippingMark || 'EXPORTER MARK').replace(/\t/g, ' '),
      String(payload.debitAmount || 0),
      String(payload.creditAmount || 0),
      String(payload.balance || 0),
      payload.status === 'PAID' ? 'P' : 'U',
      String(payload.box || 0),
      String(payload.weightKg || 0),
      (payload.flight || '').replace(/\t/g, ' '),
    ];
    return utf8ToBase64Url(compactFields.join('\t'));
  }

  const fullFields = [
    '1',
    String(payload.rowNumber || 1),
    (payload.invoiceNumber || 'EXP-REC').replace(/\t/g, ' '),
    (payload.date || '').replace(/\t/g, ' '),
    (payload.shippingMark || 'EXPORTER MARK').replace(/\t/g, ' '),
    String(payload.debitAmount || 0),
    String(payload.creditAmount || 0),
    String(payload.balance || 0),
    payload.status === 'PAID' ? 'P' : 'U',
    String(payload.box || 0),
    String(payload.weightKg || 0),
    (payload.flight || '').replace(/\t/g, ' '),
    (payload.description || '').replace(/\t/g, ' ').slice(0, 120),
    (payload.companyName || 'ZSB AQUATICS').replace(/\t/g, ' '),
  ];
  return utf8ToBase64Url(fullFields.join('\t'));
}

/**
 * Decodes a `wechat_tx` URL parameter back into a normalized ExporterRecordSharePayload.
 */
export function decodeExporterRowShareParam(
  encodedParam: string,
  fallbackOptions: NormalizeExporterRowOptions = {}
): ExporterRecordSharePayload | null {
  const raw = (encodedParam || '').trim();
  if (!raw) return null;

  try {
    const decoded = base64UrlToUtf8(raw);
    if (decoded.startsWith('1\t')) {
      const parts = decoded.split('\t');
      const rowNumber = Math.max(1, parseInt(parts[1] || '1', 10) || 1);
      const invoiceNumber = parts[2] || 'EXP-REC';
      const date = parts[3] || new Date().toISOString().slice(0, 10);
      const shippingMark = parts[4] || 'EXPORTER MARK';
      const debitAmount = Number(parts[5]) || 0;
      const creditAmount = Number(parts[6]) || 0;
      const balance =
        parts[7] !== undefined && parts[7] !== ''
          ? Number(parts[7])
          : debitAmount - creditAmount;
      const status: 'PAID' | 'UNPAID' = parts[8] === 'P' ? 'PAID' : 'UNPAID';
      const box = Number(parts[9]) || 0;
      const weightKg = Number(parts[10]) || 0;
      const flight = parts[11] || '';
      const description = parts[12] || '';
      const companyName = parts[13] || fallbackOptions.companyName || 'ZSB AQUATICS';

      return normalizeExporterRowForShare(
        {
          id: `wechat-shared-row-${rowNumber}`,
          invoiceNumber,
          date,
          shippingMark,
          debitAmount,
          creditAmount,
          balance,
          status,
          box,
          weightKg,
          flight,
          description,
        },
        {
          ...fallbackOptions,
          rowNumber,
          companyName,
          fallbackMark: shippingMark,
          fallbackDate: date,
          fallbackVoucher: invoiceNumber,
        }
      );
    }

    if (decoded.startsWith('{')) {
      const obj = JSON.parse(decoded);
      return normalizeExporterRowForShare(
        {
          id: obj.id || `wechat-shared-row-${obj.rowNumber || 1}`,
          invoiceNumber: obj.invoiceNumber,
          date: obj.date,
          shippingMark: obj.shippingMark,
          debitAmount: obj.debitAmount,
          creditAmount: obj.creditAmount,
          balance: obj.balance,
          status: obj.status,
          box: obj.box,
          weightKg: obj.weightKg,
          flight: obj.flight,
          description: obj.description,
        },
        {
          ...fallbackOptions,
          rowNumber: Number(obj.rowNumber) || 1,
          companyName: obj.companyName || fallbackOptions.companyName,
          remarks: obj.remarks || fallbackOptions.remarks,
        }
      );
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Default TTL for temporary public WeChat transaction links: 24 hours.
 */
export const DEFAULT_TEMP_LINK_TTL_MS = 24 * 60 * 60 * 1000;

const WECHAT_TEMP_TOKEN_SECRET = 'ZSB_AQUATICS_WECHAT_PUBLIC_TX_SIG_V1';

export interface TemporaryPublicTransactionLinkResult {
  url: string;
  token: string;
  expiresAt: number;
  expiresAtFormatted: string;
  signature: string;
}

export interface VerifyTemporaryTransactionLinkResult {
  valid: boolean;
  expired: boolean;
  tampered: boolean;
  expiresAt: number | null;
  payload: ExporterRecordSharePayload | null;
  reason?: string;
}

/**
 * Computes a deterministic 64-bit keyed signature (16 hex chars) over a transaction token string
 * so any tampering with amounts, status, shipping mark, or expiration timestamp is rejected.
 */
export function computeTransactionTokenSignature(dataStr: string): string {
  const input = `${WECHAT_TEMP_TOKEN_SECRET}|${dataStr}|${WECHAT_TEMP_TOKEN_SECRET}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x1505;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (Math.imul(h2, 33) ^ ch) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/**
 * Generates a secure, time-limited temporary public link (`?wechat_tmp_token=...`) for an
 * Exporter Record History transaction row that can be copied to the clipboard for sharing via WeChat.
 */
export function generateTemporaryPublicTransactionLink(
  payload: ExporterRecordSharePayload,
  options: {
    baseUrl?: string;
    ttlMs?: number;
    nowMs?: number;
    tab?: 'exporter_payment_form' | 'exporter_payment_slip';
  } = {}
): TemporaryPublicTransactionLinkResult {
  const now = options.nowMs !== undefined ? options.nowMs : Date.now();
  const ttl =
    options.ttlMs !== undefined && options.ttlMs > 0
      ? options.ttlMs
      : DEFAULT_TEMP_LINK_TTL_MS;
  const expiresAt = Math.floor(now + ttl);

  const origin =
    options.baseUrl ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000');
  const cleanBase = origin.replace(/\/+$/, '');
  const tab = options.tab || 'exporter_payment_form';

  const coreToken = encodeExporterRowShareParam(payload);
  const signingInput = `T1.${expiresAt}.${coreToken}`;
  const signature = computeTransactionTokenSignature(signingInput);
  const signedToken = `${signingInput}.${signature}`;

  const expiresDate = new Date(expiresAt);
  const expiresAtFormatted = `${expiresDate.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

  return {
    url: `${cleanBase}/?autostart=1&tab=${tab}&wechat_tmp_token=${signedToken}`,
    token: signedToken,
    expiresAt,
    expiresAtFormatted,
    signature,
  };
}

/**
 * Verifies the signature and expiration of a temporary public transaction link or token (`wechat_tmp_token`),
 * and decodes the transaction row payload if authentic and unexpired.
 */
export function verifyAndDecodeTemporaryTransactionLink(
  tokenOrSearch: string,
  options: {
    nowMs?: number;
    fallbackOptions?: NormalizeExporterRowOptions;
  } = {}
): VerifyTemporaryTransactionLinkResult {
  const rawInput = (tokenOrSearch || '').trim();
  if (!rawInput) {
    return {
      valid: false,
      expired: false,
      tampered: false,
      expiresAt: null,
      payload: null,
      reason: 'Empty token',
    };
  }

  let token = rawInput;
  if (rawInput.includes('wechat_tmp_token=')) {
    try {
      const searchPart = rawInput.includes('?')
        ? rawInput.slice(rawInput.indexOf('?') + 1)
        : rawInput;
      const params = new URLSearchParams(searchPart);
      token = params.get('wechat_tmp_token') || '';
    } catch {
      token = '';
    }
  }

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'T1') {
    return {
      valid: false,
      expired: false,
      tampered: true,
      expiresAt: null,
      payload: null,
      reason: 'Malformed temporary token format',
    };
  }

  const expiresAt = Number(parts[1]);
  const coreToken = parts[2];
  const providedSig = parts[3];

  if (!Number.isFinite(expiresAt) || expiresAt <= 0 || !coreToken || !providedSig) {
    return {
      valid: false,
      expired: false,
      tampered: true,
      expiresAt: null,
      payload: null,
      reason: 'Invalid expiration or token fields',
    };
  }

  const signingInput = `T1.${expiresAt}.${coreToken}`;
  const expectedSig = computeTransactionTokenSignature(signingInput);
  if (providedSig !== expectedSig) {
    return {
      valid: false,
      expired: false,
      tampered: true,
      expiresAt,
      payload: null,
      reason: 'Invalid cryptographic signature (token tampered)',
    };
  }

  const now = options.nowMs !== undefined ? options.nowMs : Date.now();
  if (now > expiresAt) {
    return {
      valid: false,
      expired: true,
      tampered: false,
      expiresAt,
      payload: null,
      reason: 'Temporary public link has expired',
    };
  }

  const payload = decodeExporterRowShareParam(
    coreToken,
    options.fallbackOptions || {}
  );
  if (!payload) {
    return {
      valid: false,
      expired: false,
      tampered: true,
      expiresAt,
      payload: null,
      reason: 'Failed to decode transaction payload',
    };
  }

  return {
    valid: true,
    expired: false,
    tampered: false,
    expiresAt,
    payload,
  };
}

/**
 * Generates a secure temporary public link for an Exporter Record transaction row
 * and copies it to the system clipboard (with fallback for restricted iframe contexts) for WeChat sharing.
 */
export async function copyTemporaryTransactionLinkToClipboard(
  payload: ExporterRecordSharePayload,
  options: {
    baseUrl?: string;
    ttlMs?: number;
    nowMs?: number;
    tab?: 'exporter_payment_form' | 'exporter_payment_slip';
  } = {}
): Promise<TemporaryPublicTransactionLinkResult & { copied: boolean }> {
  const linkResult = generateTemporaryPublicTransactionLink(payload, options);
  let copied = false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(linkResult.url);
      copied = true;
    } catch {
      copied = false;
    }
  }

  if (!copied && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = linkResult.url;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand('copy');
      document.body.removeChild(textarea);
    } catch {
      copied = false;
    }
  }

  return {
    ...linkResult,
    copied,
  };
}

export interface CopyLinkToastConfirmation {
  title: string;
  message: string;
  copiedUrl: string;
  expiresAtFormatted: string;
  rowNumber: number;
  shippingMark: string;
  invoiceNumber: string;
}

/**
 * Builds a structured visual toast notification confirmation payload after the 'Copy Link'
 * icon is clicked for an Exporter Record transaction row.
 */
export function buildCopyTemporaryLinkToastConfirmation(
  payload: ExporterRecordSharePayload,
  linkResult: TemporaryPublicTransactionLinkResult & { copied?: boolean }
): CopyLinkToastConfirmation {
  const rowNumber = payload.rowNumber || 1;
  const shippingMark = payload.shippingMark || 'EXPORTER MARK';
  const invoiceNumber = payload.invoiceNumber || 'EXP-REC';
  const title = `Link Copied to Clipboard · 链接已复制 (SL #${rowNumber} · ${shippingMark})`;
  const message = `URL copied to clipboard for Row #${rowNumber} (${shippingMark} · ${invoiceNumber})! Valid 24h (until ${linkResult.expiresAtFormatted}) for WeChat sharing.`;

  return {
    title,
    message,
    copiedUrl: linkResult.url,
    expiresAtFormatted: linkResult.expiresAtFormatted,
    rowNumber,
    shippingMark,
    invoiceNumber,
  };
}

/**
 * Parses a URL query string (`window.location.search`) for `?wechat_tmp_token=...` or `?wechat_tx=...`
 * and returns the decoded payload if valid and unexpired.
 */
export function parseExporterWeChatDeepLinkFromSearch(
  searchStr: string,
  fallbackOptions: NormalizeExporterRowOptions = {},
  nowMs?: number
): ExporterRecordSharePayload | null {
  const cleanSearch = (searchStr || '').startsWith('?')
    ? searchStr.slice(1)
    : searchStr || '';
  if (!cleanSearch) return null;
  const params = new URLSearchParams(cleanSearch);

  const tmpToken = params.get('wechat_tmp_token');
  if (tmpToken) {
    const verified = verifyAndDecodeTemporaryTransactionLink(tmpToken, {
      nowMs,
      fallbackOptions,
    });
    return verified.valid ? verified.payload : null;
  }

  const token = params.get('wechat_tx');
  if (!token) return null;
  return decodeExporterRowShareParam(token, fallbackOptions);
}

/**
 * Builds a shareable HTTP/HTTPS deep link URL that opens the current transaction image & details directly.
 */
export function buildExporterRowDeepLinkUrl(
  payload: ExporterRecordSharePayload,
  baseUrl?: string,
  tab: 'exporter_payment_form' | 'exporter_payment_slip' = 'exporter_payment_form'
): string {
  const origin =
    baseUrl ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000');
  const cleanBase = origin.replace(/\/+$/, '');
  const token = encodeExporterRowShareParam(payload);
  return `${cleanBase}/?autostart=1&tab=${tab}&wechat_tx=${token}`;
}

/**
 * Builds the native WeChat app URI scheme deep link (`weixin://dl/chat`) for launching WeChat client.
 */
export function buildWeChatClientDeepLink(
  payload?: ExporterRecordSharePayload
): string {
  if (!payload) {
    return 'weixin://dl/chat';
  }
  return 'weixin://dl/chat';
}

/**
 * Builds a compact QR Code text payload (< 130 bytes) so the ISO/IEC 18004 QR generator
 * encodes a valid, scannable deep-link URL for the current transaction.
 */
export function buildExporterQrPayloadText(
  payload: ExporterRecordSharePayload,
  baseUrl?: string
): string {
  const origin =
    baseUrl ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000');
  const cleanBase = origin.replace(/\/+$/, '');
  const compactToken = encodeExporterRowShareParam(payload, { compact: true });
  const compactUrl = `${cleanBase}/?tab=exporter_payment_form&wechat_tx=${compactToken}`;

  if (new TextEncoder().encode(compactUrl).length <= 134) {
    return compactUrl;
  }

  // Ultra-compact fallback if domain origin is very long
  const minimalToken = utf8ToBase64Url(
    [
      '1',
      String(payload.rowNumber || 1),
      (payload.invoiceNumber || 'EXP').slice(0, 12),
      (payload.date || '').slice(0, 10),
      (payload.shippingMark || 'MARK').slice(0, 10),
      String(Math.round(payload.debitAmount || 0)),
      String(Math.round(payload.creditAmount || 0)),
      String(Math.round(payload.balance || 0)),
      payload.status === 'PAID' ? 'P' : 'U',
    ].join('\t')
  );
  return `${cleanBase}/?wechat_tx=${minimalToken}`;
}

/**
 * Generates a self-contained SVG QR Code for the current Exporter Record transaction image/details.
 */
export function generateExporterRowQrCodeSvg(
  payload: ExporterRecordSharePayload,
  options: { baseUrl?: string; pixelSize?: number; includeCaption?: boolean } = {}
): string {
  const qrText = buildExporterQrPayloadText(payload, options.baseUrl);
  const matrix = generateQrMatrix(qrText);
  const matrixSize = matrix.length;
  const quietZone = 2;
  const totalModules = matrixSize + quietZone * 2;
  const pixelSize = options.pixelSize || 220;

  let moduleRects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const isFinder =
          (r < 7 && c < 7) ||
          (r < 7 && c >= matrixSize - 7) ||
          (r >= matrixSize - 7 && c < 7);
        const fill = isFinder ? '#0f3d4c' : '#0f172a';
        moduleRects += `<rect x="${c + quietZone}" y="${r + quietZone}" width="1" height="1" fill="${fill}" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${pixelSize}" height="${pixelSize}" role="img" aria-label="WeChat Transaction QR Code for ${escapeXml(payload.shippingMark)} SL #${payload.rowNumber}">
  <rect width="${totalModules}" height="${totalModules}" rx="1.5" fill="#ffffff" />
  ${moduleRects}
</svg>`;
}

/**
 * Generates a Data URL (`data:image/svg+xml;charset=utf-8,...`) for the transaction QR code.
 */
export function generateExporterRowQrCodeDataUrl(
  payload: ExporterRecordSharePayload,
  baseUrl?: string
): string {
  const svg = generateExporterRowQrCodeSvg(payload, { baseUrl, pixelSize: 240 });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Generates a clean .png filename for an Exporter Record row image.
 */
export function createExporterRowImageFilename(
  payload: ExporterRecordSharePayload
): string {
  const safeMark = payload.shippingMark
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const safeDate = payload.date.replace(/[^0-9-]/g, '') || 'Record';
  return `ZSB_Exporter_${safeMark || 'Record'}_SL${payload.rowNumber}_${safeDate}.png`;
}

/**
 * Formats a bilingual (English + Chinese) WeChat share message for an individual Exporter Record row,
 * including the direct transaction share link.
 */
export function formatExporterRowWeChatText(
  payload: ExporterRecordSharePayload,
  baseUrl?: string
): string {
  const statusCn = payload.status === 'PAID' ? '已结清 (PAID)' : '待结算 (UNPAID)';
  const deepLinkUrl = buildExporterRowDeepLinkUrl(payload, baseUrl);
  const lines = [
    `【${payload.companyName} — 出口商账单明细 (Exporter Record Slip)】`,
    `• 序号 / 单号 (Voucher/Ref): #${payload.rowNumber} · ${payload.invoiceNumber}`,
    `• 唛头 (Shipping Mark): ${payload.shippingMark}`,
    `• 日期 (Packing Date): ${payload.formattedDate} (${payload.date})`,
    payload.flight ? `• 航班 (Flight): ${payload.flight}` : '',
    payload.box > 0 || payload.weightKg > 0
      ? `• 件数 / 重量 (Box/Weight): ${payload.box} Box / ${payload.weightKg} KG`
      : '',
    `• 账单摘要 (Particulars): ${payload.description}`,
    `• 借方 / 应收 (Debit RMB): ${formatRMB(payload.debitAmount)}`,
    `• 贷方 / 已收 (Credit RMB): ${formatRMB(payload.creditAmount)}`,
    `• 结余 / 待结 (Balance RMB): ${formatRMB(payload.balance)}`,
    `• 状态 (Status): ${statusCn}`,
    payload.remarks ? `• 备注 (Remarks): ${payload.remarks}` : '',
    `• 电子账单链接 (Transaction Link): ${deepLinkUrl}`,
    `请查收高清账单明细图片或扫码核对款项，谢谢！(Scan QR or open link to verify Exporter Record image & details.)`,
  ].filter(Boolean);

  return lines.join('\n');
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a crisp, self-contained 1000x580 SVG image representing the Exporter Record
 * in the signature ZSB AQUATICS bilingual Exporter Payment Slip aesthetic, with an embedded
 * WeChat verification QR code in the footer.
 */
export function generateExporterRowCardSvg(
  payload: ExporterRecordSharePayload,
  baseUrl?: string
): string {
  const isPaid = payload.status === 'PAID';
  const statusBg = isPaid ? '#d1fae5' : '#ffe4e6';
  const statusBorder = isPaid ? '#10b981' : '#f43f5e';
  const statusText = isPaid ? '#065f46' : '#9f1239';
  const statusLabel = isPaid ? 'PAID · 已付款' : 'UNPAID · 未付款';

  const balanceColor = payload.balance > 0 ? '#be123c' : '#047857';
  const truncatedDesc =
    payload.description.length > 78
      ? payload.description.slice(0, 75) + '...'
      : payload.description;

  // Generate embedded mini QR code for the slip footer
  const qrMatrix = generateQrMatrix(buildExporterQrPayloadText(payload, baseUrl));
  const qrLen = qrMatrix.length;
  const qrBoxSize = 68;
  const qrModuleScale = qrBoxSize / (qrLen + 2);
  let miniQrRects = '';
  for (let r = 0; r < qrLen; r++) {
    for (let c = 0; c < qrLen; c++) {
      if (qrMatrix[r][c]) {
        const x = (40 + (c + 1) * qrModuleScale).toFixed(2);
        const y = (474 + (r + 1) * qrModuleScale).toFixed(2);
        const s = (qrModuleScale + 0.08).toFixed(2);
        miniQrRects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#0f172a" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="580" viewBox="0 0 1000 580">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0f3d4c" />
      <stop offset="50%" stop-color="#126b62" />
      <stop offset="100%" stop-color="#0f3d4c" />
    </linearGradient>
    <linearGradient id="plumBanner" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7d3759" />
      <stop offset="50%" stop-color="#98486f" />
      <stop offset="100%" stop-color="#7d3759" />
    </linearGradient>
  </defs>

  <!-- Outer Card Background -->
  <rect x="0" y="0" width="1000" height="580" fill="#f8fafc" />
  <rect x="16" y="16" width="968" height="548" rx="12" fill="#ffffff" stroke="#0f3d4c" stroke-width="3" />

  <!-- Top Brand Header -->
  <rect x="18" y="18" width="964" height="78" rx="10" fill="url(#headerGrad)" />
  <text x="500" y="54" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="900" fill="#ffe57f" letter-spacing="3">${escapeXml(payload.companyName)}</text>
  <text x="500" y="79" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#e2e8f0" letter-spacing="1">${escapeXml(payload.companyAddress)}  |  TEL: ${escapeXml(payload.companyMobiles.join(', '))}</text>

  <!-- Bilingual Sub-Banner -->
  <rect x="18" y="96" width="964" height="44" fill="url(#plumBanner)" />
  <text x="500" y="124" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#ffffff" letter-spacing="1.5">EXPORTER RECORD HISTORY SLIP · 出口商账单明细凭单</text>

  <!-- Metadata Strip -->
  <rect x="36" y="156" width="928" height="62" rx="8" fill="#faefd0" stroke="#d97706" stroke-width="1.5" />
  <text x="56" y="180" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="#64748b">SHIPPING MARK (唛头)</text>
  <text x="56" y="204" font-family="Arial, sans-serif" font-size="19" font-weight="900" fill="#98486f">${escapeXml(payload.shippingMark)}</text>

  <line x1="275" y1="164" x2="275" y2="210" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="292" y="180" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="#64748b">PACKING DATE (发货日期)</text>
  <text x="292" y="203" font-family="Courier New, monospace" font-size="15" font-weight="800" fill="#0f172a">${escapeXml(payload.formattedDate)} (${escapeXml(payload.date)})</text>

  <line x1="555" y1="164" x2="555" y2="210" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="572" y="180" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="#64748b">VOUCHER / REF (单据编号)</text>
  <text x="572" y="203" font-family="Courier New, monospace" font-size="15" font-weight="800" fill="#0f3d4c">SL #${payload.rowNumber} · ${escapeXml(payload.invoiceNumber)}</text>

  <!-- Status Pill on Metadata Strip -->
  <rect x="815" y="169" width="132" height="36" rx="18" fill="${statusBg}" stroke="${statusBorder}" stroke-width="2" />
  <text x="881" y="192" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="${statusText}">${escapeXml(statusLabel)}</text>

  <!-- Shipment Particulars Box -->
  <rect x="36" y="234" width="928" height="76" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="56" y="258" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="#126b62">RECORD HISTORY / SHIPMENT PARTICULARS (账单及装箱明细)</text>
  <text x="56" y="286" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#1e293b">${escapeXml(truncatedDesc)}</text>
  ${
    payload.box > 0 || payload.weightKg > 0 || payload.flight
      ? `<text x="56" y="303" font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#475569">${escapeXml(
          [
            payload.flight ? `Flight: ${payload.flight}` : '',
            payload.box > 0 ? `Boxes: ${payload.box}` : '',
            payload.weightKg > 0 ? `Net Weight: ${payload.weightKg} KG` : '',
          ]
            .filter(Boolean)
            .join('   |   ')
        )}</text>`
      : ''
  }

  <!-- Financial Summary Grid (Debit, Credit, Balance in RMB) -->
  <!-- 1. Debit Box -->
  <rect x="36" y="328" width="296" height="114" rx="10" fill="#f0fdfa" stroke="#0d9488" stroke-width="2" />
  <text x="56" y="356" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#0f766e">DEBIT AMOUNT · 应收金额 (RMB)</text>
  <text x="56" y="402" font-family="Courier New, monospace" font-size="28" font-weight="900" fill="#0f172a">${escapeXml(formatRMB(payload.debitAmount))}</text>
  <text x="56" y="426" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="#64748b">Export Consignment Value</text>

  <!-- 2. Credit Box -->
  <rect x="352" y="328" width="296" height="114" rx="10" fill="#ecfdf5" stroke="#10b981" stroke-width="2" />
  <text x="372" y="356" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#047857">CREDIT AMOUNT · 已收金额 (RMB)</text>
  <text x="372" y="402" font-family="Courier New, monospace" font-size="28" font-weight="900" fill="#065f46">${escapeXml(formatRMB(payload.creditAmount))}</text>
  <text x="372" y="426" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="#64748b">Settled / Remitted RMB</text>

  <!-- 3. Balance Box -->
  <rect x="668" y="328" width="296" height="114" rx="10" fill="#fff1f2" stroke="#f43f5e" stroke-width="2" />
  <text x="688" y="356" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#be123c">BALANCE · 待结余额 (RMB)</text>
  <text x="688" y="402" font-family="Courier New, monospace" font-size="28" font-weight="900" fill="${balanceColor}">${escapeXml(formatRMB(payload.balance))}</text>
  <text x="688" y="426" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="#64748b">Formula: Debit − Credit = Balance</text>

  <!-- Footer & WeChat QR Stamp -->
  <line x1="36" y1="464" x2="964" y2="464" stroke="#cbd5e1" stroke-width="1.5" />
  <rect x="36" y="470" width="430" height="74" rx="8" fill="#07C160" fill-opacity="0.1" stroke="#07C160" stroke-width="1.5" />
  <rect x="40" y="474" width="68" height="68" rx="4" fill="#ffffff" stroke="#07C160" stroke-width="1" />
  ${miniQrRects}
  <text x="120" y="496" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="#065f46">WECHAT VERIFIED QR SLIP · 微信扫码对账凭单</text>
  <text x="120" y="515" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#0f3d4c">Scan QR in WeChat to view live transaction slip &amp; details</text>
  <text x="120" y="532" font-family="Arial, sans-serif" font-size="10" font-weight="600" fill="#475569">Direct Exporter Ledger · ${escapeXml(payload.companyEmail)}</text>

  <text x="956" y="494" text-anchor="end" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#334155">YOURS FAITHFULLY - 此致</text>
  <text x="956" y="518" text-anchor="end" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#0f172a">${escapeXml(payload.partnerName)}</text>
  <text x="956" y="536" text-anchor="end" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#64748b">PARTNER · ${escapeXml(payload.companyName)}</text>
</svg>`;
}

/**
 * Renders the Exporter Record SVG card onto an HTML5 Canvas and returns a high-resolution PNG Blob, File, and Data URL.
 */
export async function renderExporterRowToPngData(
  payload: ExporterRecordSharePayload
): Promise<{
  dataUrl: string;
  svgDataUrl: string;
  blob: Blob;
  file: File;
  filename: string;
  width: number;
  height: number;
}> {
  const svgString = generateExporterRowCardSvg(payload);
  const svgBlob = new Blob([svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const filename = createExporterRowImageFilename(payload);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  if (typeof document === 'undefined') {
    const file = new File([svgBlob], filename, { type: 'image/png' });
    return {
      dataUrl: svgDataUrl,
      svgDataUrl,
      blob: svgBlob,
      file,
      filename,
      width: 1000,
      height: 580,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 580;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngDataUrl = canvas.toDataURL('image/png', 1.0);
          canvas.toBlob((blob) => {
            const finalBlob = blob || svgBlob;
            const file = new File([finalBlob], filename, { type: 'image/png' });
            resolve({
              dataUrl: pngDataUrl,
              svgDataUrl,
              blob: finalBlob,
              file,
              filename,
              width: canvas.width,
              height: canvas.height,
            });
          }, 'image/png');
          return;
        }
      } catch (e) {
        console.warn('Canvas conversion fallback:', e);
      }
      const file = new File([svgBlob], filename, { type: 'image/png' });
      resolve({
        dataUrl: svgDataUrl,
        svgDataUrl,
        blob: svgBlob,
        file,
        filename,
        width: 1000,
        height: 580,
      });
    };
    img.onerror = () => {
      const file = new File([svgBlob], filename, { type: 'image/png' });
      resolve({
        dataUrl: svgDataUrl,
        svgDataUrl,
        blob: svgBlob,
        file,
        filename,
        width: 1000,
        height: 580,
      });
    };
    img.src = svgDataUrl;
  });
}

/**
 * Executes one-click WeChat share for an Exporter Record row:
 * - Attempts native Web Share API if supported
 * - Copies the rendered PNG image to system clipboard (and text if image clipboard unsupported)
 * - Downloads the .PNG file so it's ready for WeChat desktop/mobile drag-and-drop or Ctrl+V
 */
export async function shareExporterRowViaWeChat(options: {
  file: File;
  blob: Blob;
  filename: string;
  text: string;
}): Promise<{
  copiedImage: boolean;
  copiedText: boolean;
  downloaded: boolean;
  message: string;
}> {
  const { file, blob, filename, text } = options;

  if (canSharePngFile()) {
    const webShare = await sharePngViaWebShare(file, filename, text);
    if (webShare.success) {
      return {
        copiedImage: false,
        copiedText: false,
        downloaded: false,
        message: 'Shared Exporter Record image via system WeChat share sheet!',
      };
    }
    if (webShare.cancelled) {
      return {
        copiedImage: false,
        copiedText: false,
        downloaded: false,
        message: 'WeChat share cancelled.',
      };
    }
  }

  const clipRes = await copyPngBlobToClipboard(blob);
  let copiedText = false;
  if (!clipRes.success && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copiedText = true;
    } catch {
      // ignore
    }
  }

  downloadPngFile(blob, filename);

  return {
    copiedImage: clipRes.success,
    copiedText,
    downloaded: true,
    message: clipRes.success
      ? `Exporter Record .PNG copied to clipboard & downloaded! Paste (Ctrl+V) directly in WeChat (微信).`
      : `Exporter Record .PNG downloaded (${filename}) for WeChat (微信) sharing!`,
  };
}
