import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShipmentDetailUrl,
  parseShipmentDeepLink,
  findShipmentByDeepLink,
  generateQrMatrix,
  generateShipmentQrDataUrl,
} from './shipmentQrCode.ts';
import { PackingRecord } from '../types/index.ts';

describe('shipmentQrCode utility', () => {
  it('builds a valid shipment detail deep-link URL with encoded parameters', () => {
    const url = buildShipmentDetailUrl('http://localhost:3000/', {
      id: 'pkg-1',
      invoiceNumber: 'PKG-2026-9001',
      shippingMark: 'SMR',
      packingDate: '2026-10-20',
    });

    assert.equal(
      url,
      'http://localhost:3000/?tab=packing_db&shipment=PKG-2026-9001&mark=SMR&id=pkg-1&date=2026-10-20'
    );
  });

  it('parses URL search strings into shipment deep-link parameters', () => {
    const parsed = parseShipmentDeepLink(
      '?tab=packing_db&shipment=PKG-2026-9001&mark=SMR&id=pkg-1'
    );
    assert.equal(parsed.isShipmentLink, true);
    assert.equal(parsed.invoiceNumber, 'PKG-2026-9001');
    assert.equal(parsed.shippingMark, 'SMR');
    assert.equal(parsed.packingId, 'pkg-1');

    const emptyParsed = parseShipmentDeepLink('');
    assert.equal(emptyParsed.isShipmentLink, false);
    assert.equal(emptyParsed.invoiceNumber, '');
  });

  it('finds the matching shipment record by id, invoiceNumber, or shippingMark', () => {
    const samplePackings: PackingRecord[] = [
      {
        id: 'pkg-1',
        invoiceNumber: 'PKG-2026-9001',
        shippingMark: 'SMR',
        flight: 'CZ',
        destination: 'GUANGZHOU',
        shipper: 'ZSB AQUATICS',
        packingDate: '2026-10-20',
        fromDate: '2026-10-20',
        toDate: '2026-10-20',
        items: [],
        totalBox: 10,
        totalWeight: 160,
        totalAmount: 19200,
        createdAt: '2026-10-20T00:00:00Z',
      },
      {
        id: 'pkg-2',
        invoiceNumber: 'PKG-2026-9002',
        shippingMark: 'LXB-52',
        flight: 'MU KMG',
        destination: 'KUNMING',
        shipper: 'SAJID INT.',
        packingDate: '2026-10-22',
        fromDate: '2026-10-22',
        toDate: '2026-10-22',
        items: [],
        totalBox: 5,
        totalWeight: 75,
        totalAmount: 10500,
        createdAt: '2026-10-22T00:00:00Z',
      },
    ];

    const byInvoice = findShipmentByDeepLink(samplePackings, {
      invoiceNumber: 'pkg-2026-9002',
    });
    assert.equal(byInvoice?.id, 'pkg-2');

    const byId = findShipmentByDeepLink(samplePackings, {
      packingId: 'pkg-1',
    });
    assert.equal(byId?.invoiceNumber, 'PKG-2026-9001');

    const byMark = findShipmentByDeepLink(samplePackings, {
      shippingMark: 'lxb-52',
    });
    assert.equal(byMark?.invoiceNumber, 'PKG-2026-9002');
  });

  it('generates a deterministic square QR matrix with valid finder patterns', () => {
    const url = buildShipmentDetailUrl('http://localhost:3000', {
      invoiceNumber: 'PKG-2026-9001',
      shippingMark: 'SMR',
      packingDate: '2026-10-20',
    });
    const matrix1 = generateQrMatrix(url);
    const matrix2 = generateQrMatrix(url);

    assert.ok(matrix1.length >= 21);
    assert.equal(matrix1.length, matrix1[0].length);
    assert.deepEqual(matrix1, matrix2);

    // Top-left finder pattern outer corners and center (3,3) must be dark (true)
    assert.equal(matrix1[0][0], true);
    assert.equal(matrix1[0][6], true);
    assert.equal(matrix1[6][0], true);
    assert.equal(matrix1[6][6], true);
    assert.equal(matrix1[3][3], true);
    // Separator row/col at index 7 must be light (false)
    assert.equal(matrix1[7][0], false);
    assert.equal(matrix1[0][7], false);
  });

  it('generates shipment QR data url string asynchronously', async () => {
    const dataUrl = await generateShipmentQrDataUrl('PKG-2026-9001', 'SMR');
    assert.ok(typeof dataUrl === 'string');
    assert.ok(dataUrl.startsWith('data:image/'));
  });
});

