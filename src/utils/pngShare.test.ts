import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanPhoneNumberForWhatsApp,
  buildWhatsAppShareUrl,
  formatDocumentShareSummary,
  formatWeChatShareText,
  createPngFilename,
} from './pngShare.ts';

test('cleanPhoneNumberForWhatsApp sanitizes phone formats correctly', () => {
  assert.equal(cleanPhoneNumberForWhatsApp('+8801841165902'), '8801841165902');
  assert.equal(cleanPhoneNumberForWhatsApp('01841-165902'), '8801841165902');
  assert.equal(cleanPhoneNumberForWhatsApp('+86 138 0013 8000'), '8613800138000');
  assert.equal(cleanPhoneNumberForWhatsApp(''), '');
  assert.equal(cleanPhoneNumberForWhatsApp(undefined), '');
});

test('buildWhatsAppShareUrl builds valid WhatsApp link with encoded text', () => {
  const urlWithoutPhone = buildWhatsAppShareUrl('Hello ZSB Aquatics');
  assert.ok(urlWithoutPhone.startsWith('https://api.whatsapp.com/send?text=Hello%20ZSB%20Aquatics'));

  const urlWithPhone = buildWhatsAppShareUrl('Packing Manifest Attached', '+8801841165902');
  assert.ok(urlWithPhone.startsWith('https://wa.me/8801841165902?text=Packing%20Manifest%20Attached'));
});

test('formatDocumentShareSummary formats exporter payment slip with RMB amount', () => {
  const summary = formatDocumentShareSummary('exporter_payment_slip', {
    shippingMark: 'ABC-GZ',
    packingDate: '2026-10-30',
    totalRmb: 18250.5,
    totalBdt: 301133,
  });

  assert.ok(summary.includes('Exporter Payment Slip (付款单)'));
  assert.ok(summary.includes('ABC-GZ'));
  assert.ok(summary.includes('¥18250.50'));
  assert.ok(summary.includes('.PNG'));
});

test('formatDocumentShareSummary formats packing manifest with cartons and weights', () => {
  const summary = formatDocumentShareSummary('packing', {
    invoiceNumber: 'PKG-2026-088',
    shippingMark: 'BD-CAN-01',
    flight: 'BG-366',
    packingDate: '2026-10-30',
    totalBox: 120,
    totalWeight: 1800.5,
  });

  assert.ok(summary.includes('Export Packing Manifest'));
  assert.ok(summary.includes('PKG-2026-088'));
  assert.ok(summary.includes('BD-CAN-01'));
  assert.ok(summary.includes('120 Boxes'));
  assert.ok(summary.includes('1800.50 KG'));
});

test('formatDocumentShareSummary formats purchase challan with supplier and amount', () => {
  const summary = formatDocumentShareSummary('purchase', {
    invoiceNumber: 'PUR-045',
    description: 'Coxs Bazar Crab Depot',
    date: '2026-10-30',
    totalQty: 650,
    billAmount: 520000,
  });

  assert.ok(summary.includes('Procurement Challan'));
  assert.ok(summary.includes('Coxs Bazar Crab Depot'));
  assert.ok(summary.includes('TK 520,000'));
});

test('formatWeChatShareText generates bilingual Chinese and English trade notes', () => {
  const wechatText = formatWeChatShareText('exporter_payment_slip', {
    shippingMark: 'GZ-KUNMING',
    packingDate: '2026-10-30',
    totalRmb: 25000,
  });

  assert.ok(wechatText.includes('出口结算付款单'));
  assert.ok(wechatText.includes('GZ-KUNMING'));
  assert.ok(wechatText.includes('¥25000.00 RMB'));
  assert.ok(wechatText.includes('.PNG'));
});

test('createPngFilename sanitizes base names and appends .png', () => {
  assert.equal(createPngFilename('ZSB_AQUATICS_PKG-001.pdf'), 'ZSB_AQUATICS_PKG-001.png');
  assert.equal(createPngFilename('Slip 2026/10/30 (ABC).png'), 'Slip_2026_10_30__ABC_.png');
});
