import test from 'node:test';
import assert from 'node:assert/strict';
import { PackingRecord } from '../types/index.ts';
import {
  matchesPackingShipperOrExporter,
  filterPackingRecordsByShipperOrExporter,
} from './packingFilters.ts';

const samplePackings: PackingRecord[] = [
  {
    id: 'pkg-f-1',
    serialNumber: 1,
    invoiceNumber: 'PKG-2026-1001',
    shippingMark: 'ZSB-HK',
    flight: 'CZ CAN',
    destination: 'GUANGZHOU',
    shipper: 'DHAKA MARINE',
    documentsHolder: 'SHISHIR MAMA',
    packingDate: '2026-10-01',
    fromDate: '2026-10-01',
    toDate: '2026-10-01',
    items: [],
    totalBox: 5,
    totalWeight: 80,
    totalAmount: 8000,
    rmbRate: 17,
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 'pkg-f-2',
    serialNumber: 2,
    invoiceNumber: 'PKG-2026-1002',
    shippingMark: 'RAKIB TRADERS',
    flight: 'YG KMG',
    destination: 'KUNMING',
    shipper: 'BANGLA TRADE',
    documentsHolder: 'RAKIB TRADERS',
    packingDate: '2026-10-02',
    fromDate: '2026-10-02',
    toDate: '2026-10-02',
    items: [],
    totalBox: 3,
    totalWeight: 48,
    totalAmount: 4800,
    rmbRate: 17,
    createdAt: '2026-10-02T08:00:00Z',
  },
  {
    id: 'pkg-f-3',
    serialNumber: 3,
    invoiceNumber: 'PKG-2026-1003',
    shippingMark: 'WCM EXPORT',
    flight: 'NKG',
    destination: 'NANJING',
    shipper: 'ROYAL SEAFOOD',
    documentsHolder: 'ANJUM',
    packingDate: '2026-10-03',
    fromDate: '2026-10-03',
    toDate: '2026-10-03',
    items: [],
    totalBox: 8,
    totalWeight: 128,
    totalAmount: 12800,
    rmbRate: 17,
    createdAt: '2026-10-03T08:00:00Z',
  },
];

test('matchesPackingShipperOrExporter matches by Shipper, Exporter (Shipping Mark), and Documents Holder case-insensitively', () => {
  // Blank query returns all rows
  assert.equal(filterPackingRecordsByShipperOrExporter(samplePackings, '').length, 3);
  assert.equal(filterPackingRecordsByShipperOrExporter(samplePackings, '   ').length, 3);

  // Match by Shipper name
  const byShipper = filterPackingRecordsByShipperOrExporter(samplePackings, 'bangla');
  assert.deepEqual(
    byShipper.map((p) => ({ id: p.id, sno: p.serialNumber })),
    [{ id: 'pkg-f-2', sno: 2 }]
  );

  // Match by Exporter / Shipping Mark
  const byExporter = filterPackingRecordsByShipperOrExporter(samplePackings, 'wcm export');
  assert.deepEqual(
    byExporter.map((p) => ({ id: p.id, sno: p.serialNumber })),
    [{ id: 'pkg-f-3', sno: 3 }]
  );

  // Match by Documents Holder
  const byHolder = filterPackingRecordsByShipperOrExporter(samplePackings, 'shishir');
  assert.deepEqual(
    byHolder.map((p) => ({ id: p.id, sno: p.serialNumber })),
    [{ id: 'pkg-f-1', sno: 1 }]
  );

  // Multi-token match combining Shipper + Exporter terms
  assert.equal(matchesPackingShipperOrExporter(samplePackings[2], 'royal wcm'), true);
  assert.equal(matchesPackingShipperOrExporter(samplePackings[0], 'royal wcm'), false);

  // Does not falsely match non-Shipper/Exporter fields like destination or flight
  assert.equal(filterPackingRecordsByShipperOrExporter(samplePackings, 'GUANGZHOU').length, 0);
  assert.equal(filterPackingRecordsByShipperOrExporter(samplePackings, 'YG KMG').length, 0);
});
