import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeExporterRowForShare,
  createExporterRowImageFilename,
  formatExporterRowWeChatText,
  generateExporterRowCardSvg,
  encodeExporterRowShareParam,
  decodeExporterRowShareParam,
  parseExporterWeChatDeepLinkFromSearch,
  buildExporterRowDeepLinkUrl,
  buildWeChatClientDeepLink,
  generateExporterRowQrCodeSvg,
  generateExporterRowQrCodeDataUrl,
  generateTemporaryPublicTransactionLink,
  verifyAndDecodeTemporaryTransactionLink,
  copyTemporaryTransactionLinkToClipboard,
  buildCopyTemporaryLinkToastConfirmation,
  DEFAULT_TEMP_LINK_TTL_MS,
} from './exporterWeChatShare.ts';

test('normalizeExporterRowForShare computes debit, credit, balance, and normalizes status', () => {
  const payload = normalizeExporterRowForShare(
    {
      id: 'row-1',
      invoiceNumber: 'PKG-101',
      shippingMark: 'AAD',
      date: '2026-03-31',
      flight: 'CZ-392',
      box: 25,
      weightKg: 625.5,
      description: 'AAD — PKG-101 · Flight CZ-392 (25 Box, 625.5 KG)',
      debitAmount: 15000,
      creditAmount: 5000,
      status: 'UNPAID',
    },
    {
      rowNumber: 1,
      companyName: 'ZSB AQUATICS',
    }
  );

  assert.equal(payload.rowNumber, 1);
  assert.equal(payload.shippingMark, 'AAD');
  assert.equal(payload.invoiceNumber, 'PKG-101');
  assert.equal(payload.debitAmount, 15000);
  assert.equal(payload.creditAmount, 5000);
  assert.equal(payload.balance, 10000);
  assert.equal(payload.status, 'UNPAID');
});

test('normalizeExporterRowForShare handles PAID status and fallback values when row is blank', () => {
  const payload = normalizeExporterRowForShare(
    {
      id: 'row-2',
      description: '',
      debitAmount: 8800,
      creditAmount: 8800,
      status: 'PAID',
    },
    {
      rowNumber: 2,
      fallbackMark: 'CHJ-22',
      fallbackDate: '2026-04-01',
      fallbackVoucher: 'EXP-PAY-002',
    }
  );

  assert.equal(payload.rowNumber, 2);
  assert.equal(payload.shippingMark, 'CHJ-22');
  assert.equal(payload.date, '2026-04-01');
  assert.equal(payload.invoiceNumber, 'EXP-PAY-002');
  assert.equal(payload.balance, 0);
  assert.equal(payload.status, 'PAID');
  assert.ok(payload.description.includes('CHJ-22'));
});

test('createExporterRowImageFilename generates safe deterministic PNG filename', () => {
  const payload = normalizeExporterRowForShare(
    {
      shippingMark: 'GZ / 88A',
      date: '2026-03-31',
      debitAmount: 1200,
      creditAmount: 200,
    },
    { rowNumber: 3 }
  );

  const filename = createExporterRowImageFilename(payload);
  assert.equal(filename, 'ZSB_Exporter_GZ_88A_SL3_2026-03-31.png');
});

test('formatExporterRowWeChatText produces bilingual English and Chinese summary with RMB figures and deep link', () => {
  const payload = normalizeExporterRowForShare(
    {
      invoiceNumber: 'PKG-205',
      shippingMark: 'AAD',
      date: '2026-03-31',
      flight: 'MU-203',
      box: 12,
      weightKg: 300,
      description: 'AAD — Export Shipment to Guangzhou',
      debitAmount: 9600,
      creditAmount: 3600,
      status: 'UNPAID',
    },
    { rowNumber: 1, companyName: 'ZSB AQUATICS' }
  );

  const text = formatExporterRowWeChatText(payload, 'http://localhost:3000');
  assert.ok(text.includes('ZSB AQUATICS'));
  assert.ok(text.includes('AAD'));
  assert.ok(text.includes('PKG-205'));
  assert.ok(text.includes('¥9,600.00'));
  assert.ok(text.includes('¥3,600.00'));
  assert.ok(text.includes('¥6,000.00'));
  assert.ok(text.includes('待结算 (UNPAID)'));
  assert.ok(text.includes('http://localhost:3000/?autostart=1&tab=exporter_payment_form&wechat_tx='));
});

test('generateExporterRowCardSvg produces valid SVG containing company header, financial fields, and embedded QR', () => {
  const payload = normalizeExporterRowForShare(
    {
      invoiceNumber: 'EXP-PAY-009',
      shippingMark: 'KM-99',
      date: '2026-03-31',
      description: 'Kunming Eel Fish Settlement',
      debitAmount: 20000,
      creditAmount: 20000,
      status: 'PAID',
    },
    { rowNumber: 4 }
  );

  const svg = generateExporterRowCardSvg(payload, 'http://localhost:3000');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('EXPORTER RECORD HISTORY SLIP'));
  assert.ok(svg.includes('KM-99'));
  assert.ok(svg.includes('PAID · 已付款'));
  assert.ok(svg.includes('¥20,000.00'));
  assert.ok(svg.includes('WECHAT VERIFIED QR SLIP'));
});

test('encodeExporterRowShareParam and decodeExporterRowShareParam round-trip transaction details accurately', () => {
  const original = normalizeExporterRowForShare(
    {
      invoiceNumber: 'PKG-778',
      shippingMark: 'GZ-EEL-01',
      date: '2026-03-31',
      flight: 'CZ-308',
      box: 40,
      weightKg: 980.25,
      description: 'GZ-EEL-01 — 40 Boxes Live Eel Shipment',
      debitAmount: 42500.5,
      creditAmount: 12500.5,
      status: 'UNPAID',
    },
    { rowNumber: 7, companyName: 'ZSB AQUATICS' }
  );

  const encodedFull = encodeExporterRowShareParam(original);
  const decodedFull = decodeExporterRowShareParam(encodedFull);
  assert.ok(decodedFull);
  assert.equal(decodedFull.rowNumber, 7);
  assert.equal(decodedFull.invoiceNumber, 'PKG-778');
  assert.equal(decodedFull.shippingMark, 'GZ-EEL-01');
  assert.equal(decodedFull.date, '2026-03-31');
  assert.equal(decodedFull.flight, 'CZ-308');
  assert.equal(decodedFull.box, 40);
  assert.equal(decodedFull.weightKg, 980.25);
  assert.equal(decodedFull.debitAmount, 42500.5);
  assert.equal(decodedFull.creditAmount, 12500.5);
  assert.equal(decodedFull.balance, 30000);
  assert.equal(decodedFull.status, 'UNPAID');

  const encodedCompact = encodeExporterRowShareParam(original, { compact: true });
  const decodedCompact = decodeExporterRowShareParam(encodedCompact);
  assert.ok(decodedCompact);
  assert.equal(decodedCompact.rowNumber, 7);
  assert.equal(decodedCompact.invoiceNumber, 'PKG-778');
  assert.equal(decodedCompact.shippingMark, 'GZ-EEL-01');
  assert.equal(decodedCompact.balance, 30000);
});

test('buildExporterRowDeepLinkUrl, parseExporterWeChatDeepLinkFromSearch, and buildWeChatClientDeepLink work end-to-end', () => {
  const payload = normalizeExporterRowForShare(
    {
      invoiceNumber: 'EXP-PAY-301',
      shippingMark: 'AAD-99',
      date: '2026-03-31',
      debitAmount: 18000,
      creditAmount: 18000,
      status: 'PAID',
    },
    { rowNumber: 2 }
  );

  const deepLinkUrl = buildExporterRowDeepLinkUrl(
    payload,
    'http://localhost:3000',
    'exporter_payment_form'
  );
  assert.ok(deepLinkUrl.startsWith('http://localhost:3000/?autostart=1&tab=exporter_payment_form&wechat_tx='));

  const urlObj = new URL(deepLinkUrl);
  const parsedFromSearch = parseExporterWeChatDeepLinkFromSearch(urlObj.search);
  assert.ok(parsedFromSearch);
  assert.equal(parsedFromSearch.rowNumber, 2);
  assert.equal(parsedFromSearch.invoiceNumber, 'EXP-PAY-301');
  assert.equal(parsedFromSearch.shippingMark, 'AAD-99');
  assert.equal(parsedFromSearch.debitAmount, 18000);
  assert.equal(parsedFromSearch.creditAmount, 18000);
  assert.equal(parsedFromSearch.balance, 0);
  assert.equal(parsedFromSearch.status, 'PAID');

  const wechatUri = buildWeChatClientDeepLink(payload);
  assert.equal(wechatUri, 'weixin://dl/chat');
});

test('generateExporterRowQrCodeSvg and generateExporterRowQrCodeDataUrl produce valid SVG QR code', () => {
  const payload = normalizeExporterRowForShare(
    {
      invoiceNumber: 'EXP-QR-01',
      shippingMark: 'SH-88',
      date: '2026-03-31',
      debitAmount: 5000,
      creditAmount: 2000,
      status: 'UNPAID',
    },
    { rowNumber: 1 }
  );

  const qrSvg = generateExporterRowQrCodeSvg(payload, {
    baseUrl: 'http://localhost:3000',
    pixelSize: 220,
  });
  assert.ok(qrSvg.startsWith('<svg'));
  assert.ok(qrSvg.includes('viewBox="0 0'));
  assert.ok(qrSvg.includes('<rect'));

  const qrDataUrl = generateExporterRowQrCodeDataUrl(payload, 'http://localhost:3000');
  assert.ok(qrDataUrl.startsWith('data:image/svg+xml;charset=utf-8,'));
});

test('generateTemporaryPublicTransactionLink creates signed 24h link and verifyAndDecodeTemporaryTransactionLink validates and rejects expired or tampered tokens', async () => {
  const payload = normalizeExporterRowForShare(
    {
      invoiceNumber: 'PKG-TEMP-88',
      shippingMark: 'GZ-TEMP-01',
      date: '2026-03-31',
      flight: 'CZ-399',
      box: 18,
      weightKg: 450,
      debitAmount: 25000,
      creditAmount: 10000,
      status: 'UNPAID',
    },
    { rowNumber: 3, companyName: 'ZSB AQUATICS' }
  );

  const fixedNow = 1775000000000;
  const generated = generateTemporaryPublicTransactionLink(payload, {
    baseUrl: 'http://localhost:3000',
    nowMs: fixedNow,
    ttlMs: DEFAULT_TEMP_LINK_TTL_MS,
    tab: 'exporter_payment_form',
  });

  assert.ok(
    generated.url.startsWith(
      'http://localhost:3000/?autostart=1&tab=exporter_payment_form&wechat_tmp_token=T1.'
    )
  );
  assert.equal(generated.expiresAt, fixedNow + DEFAULT_TEMP_LINK_TTL_MS);
  assert.equal(generated.signature.length, 16);

  // 1. Valid verification before expiration
  const verifiedValid = verifyAndDecodeTemporaryTransactionLink(generated.url, {
    nowMs: fixedNow + 60_000,
  });
  assert.equal(verifiedValid.valid, true);
  assert.equal(verifiedValid.expired, false);
  assert.equal(verifiedValid.tampered, false);
  assert.ok(verifiedValid.payload);
  assert.equal(verifiedValid.payload.rowNumber, 3);
  assert.equal(verifiedValid.payload.invoiceNumber, 'PKG-TEMP-88');
  assert.equal(verifiedValid.payload.shippingMark, 'GZ-TEMP-01');
  assert.equal(verifiedValid.payload.balance, 15000);

  // 2. URL search parsing via parseExporterWeChatDeepLinkFromSearch
  const parsedUrl = new URL(generated.url);
  const parsedFromSearch = parseExporterWeChatDeepLinkFromSearch(
    parsedUrl.search,
    {},
    fixedNow + 120_000
  );
  assert.ok(parsedFromSearch);
  assert.equal(parsedFromSearch.invoiceNumber, 'PKG-TEMP-88');
  assert.equal(parsedFromSearch.shippingMark, 'GZ-TEMP-01');

  // 3. Expired link rejection when nowMs > expiresAt
  const verifiedExpired = verifyAndDecodeTemporaryTransactionLink(
    generated.token,
    {
      nowMs: fixedNow + DEFAULT_TEMP_LINK_TTL_MS + 1000,
    }
  );
  assert.equal(verifiedExpired.valid, false);
  assert.equal(verifiedExpired.expired, true);
  assert.equal(verifiedExpired.tampered, false);
  assert.equal(verifiedExpired.payload, null);

  // parseExporterWeChatDeepLinkFromSearch also returns null when expired
  const expiredSearchParse = parseExporterWeChatDeepLinkFromSearch(
    parsedUrl.search,
    {},
    fixedNow + DEFAULT_TEMP_LINK_TTL_MS + 5000
  );
  assert.equal(expiredSearchParse, null);

  // 4. Tampered token rejection (altering expiration timestamp or signature)
  const tamperedToken = generated.token.replace(
    `T1.${generated.expiresAt}.`,
    `T1.${generated.expiresAt + 999999}.`
  );
  const verifiedTampered = verifyAndDecodeTemporaryTransactionLink(
    tamperedToken,
    { nowMs: fixedNow }
  );
  assert.equal(verifiedTampered.valid, false);
  assert.equal(verifiedTampered.tampered, true);
  assert.equal(verifiedTampered.payload, null);

  // 5. copyTemporaryTransactionLinkToClipboard works cleanly in non-DOM/Node environment
  const clipRes = await copyTemporaryTransactionLinkToClipboard(payload, {
    baseUrl: 'http://localhost:3000',
    nowMs: fixedNow,
  });
  assert.equal(clipRes.url, generated.url);
  assert.equal(clipRes.token, generated.token);

  // 6. buildCopyTemporaryLinkToastConfirmation returns structured toast feedback details
  const toastConfirm = buildCopyTemporaryLinkToastConfirmation(payload, clipRes);
  assert.ok(toastConfirm.title.includes('Link Copied to Clipboard'));
  assert.ok(toastConfirm.title.includes('GZ-TEMP-01'));
  assert.ok(toastConfirm.message.includes('URL copied to clipboard for Row #3'));
  assert.ok(toastConfirm.message.includes('PKG-TEMP-88'));
  assert.equal(toastConfirm.copiedUrl, generated.url);
  assert.equal(toastConfirm.rowNumber, 3);
  assert.equal(toastConfirm.shippingMark, 'GZ-TEMP-01');
  assert.equal(toastConfirm.invoiceNumber, 'PKG-TEMP-88');
});

