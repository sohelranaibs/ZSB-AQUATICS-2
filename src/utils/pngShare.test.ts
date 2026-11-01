import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDocumentShareSummary,
  formatWeChatShareText,
  createPngFilename,
} from './pngShare.ts';

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

test('formatWeChatShareText generates bilingual Chinese and English trade notes across document types', () => {
  const slipText = formatWeChatShareText('exporter_payment_slip', {
    shippingMark: 'GZ-KUNMING',
    packingDate: '2026-10-30',
    totalRmb: 25000,
  });
  assert.ok(slipText.includes('出口结算付款单'));
  assert.ok(slipText.includes('GZ-KUNMING'));
  assert.ok(slipText.includes('¥25000.00 RMB'));
  assert.ok(slipText.includes('.PNG'));

  const packingText = formatWeChatShareText('packing', {
    invoiceNumber: 'PKG-2026-088',
    shippingMark: 'BD-CAN-01',
    flight: 'BG-366',
    packingDate: '2026-10-30',
    totalBox: 120,
    totalWeight: 1800.5,
  });
  assert.ok(packingText.includes('空运装箱单'));
  assert.ok(packingText.includes('PKG-2026-088'));
  assert.ok(packingText.includes('120 Box / 1800.50 KG'));

  const awbText = formatWeChatShareText('air_way_bill', {
    shipper: 'ZSB AQUATICS',
    monthLabel: 'October 2026',
    totals: { totalBoxes: 90, totalRmb: 10800 },
  });
  assert.ok(awbText.includes('航班运费结算单'));
  assert.ok(awbText.includes('90 Box'));
  assert.ok(awbText.includes('¥10800.00 RMB'));

  const purchaseText = formatWeChatShareText('purchase', {
    invoiceNumber: 'PUR-045',
    description: 'Coxs Bazar Crab Depot',
    date: '2026-10-30',
    totalQty: 650,
    billAmount: 520000,
  });
  assert.ok(purchaseText.includes('采购入库结算单'));
  assert.ok(purchaseText.includes('Coxs Bazar Crab Depot'));
});

test('createPngFilename sanitizes base names and appends .png', () => {
  assert.equal(createPngFilename('ZSB_AQUATICS_PKG-001.pdf'), 'ZSB_AQUATICS_PKG-001.png');
  assert.equal(createPngFilename('Slip 2026/10/30 (ABC).png'), 'Slip_2026_10_30__ABC_.png');
});
