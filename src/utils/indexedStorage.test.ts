import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIndexKey,
  tokenizeText,
  buildDatasetIndices,
  queryIndexedRecords,
} from './indexedStorage.ts';
import { PurchaseRecord, PackingRecord } from '../types/index.ts';

test('normalizeIndexKey converts null/undefined and strings to uppercase trimmed format', () => {
  assert.equal(normalizeIndexKey('  inv-2026-101 '), 'INV-2026-101');
  assert.equal(normalizeIndexKey(null), '');
  assert.equal(normalizeIndexKey(undefined), '');
});

test('tokenizeText extracts clean tokens from text', () => {
  assert.deepEqual(tokenizeText('Fish Supply Ltd! INV-001'), ['fish', 'supply', 'ltd', 'inv-001']);
  assert.deepEqual(tokenizeText(''), []);
  assert.deepEqual(tokenizeText(null), []);
});

test('buildDatasetIndices constructs recordMap, invoiceMap, dateIndex, and inverted token index', () => {
  const samplePurchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'INV-1001',
      date: '2026-10-25',
      description: 'ALAM FISH TRADERS',
      contactNumber: '01711223344',
      items: [],
      totalQty: 150,
      totalAmount: 45000,
      previousAmount: 0,
      paidAmount: 45000,
      balance: 0,
      createdAt: '2026-10-25T10:00:00Z',
    },
    {
      id: 'pur-2',
      invoiceNumber: 'INV-1002',
      date: '2026-10-26',
      description: 'SUMON ENTERPRISE',
      contactNumber: '01899887766',
      items: [],
      totalQty: 200,
      totalAmount: 60000,
      previousAmount: 5000,
      paidAmount: 20000,
      balance: 45000,
      createdAt: '2026-10-26T10:00:00Z',
    },
  ];

  const indices = buildDatasetIndices(samplePurchases, {
    getInvoice: (p) => p.invoiceNumber,
    getDate: (p) => p.date,
    getParty: (p) => p.description,
    getSearchableText: (p) => `${p.invoiceNumber} ${p.description} ${p.contactNumber}`,
  });

  assert.equal(indices.recordMap.size, 2);
  assert.ok(indices.invoiceMap.has('INV-1001'));
  assert.ok(indices.invoiceMap.has('INV-1002'));
  assert.ok(indices.partyIndex.has('ALAM FISH TRADERS'));
  assert.ok(indices.tokenInvertedIndex.has('alam'));
  assert.ok(indices.tokenInvertedIndex.has('sumon'));
});

test('queryIndexedRecords performs fast tokenized multi-field search and party filtering', () => {
  const samplePackings: PackingRecord[] = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-501',
      shippingMark: 'ZSB-HK',
      flight: 'BG-078',
      destination: 'HONG KONG',
      shipper: 'ZSB AQUATICS',
      packingDate: '2026-10-28',
      fromDate: '2026-10-28',
      toDate: '2026-10-28',
      items: [],
      totalBox: 10,
      totalWeight: 250,
      totalAmount: 12500,
      createdAt: '2026-10-28T08:00:00Z',
    },
    {
      id: 'pkg-2',
      invoiceNumber: 'PKG-502',
      shippingMark: 'ZSB-CN',
      flight: 'CZ-392',
      destination: 'GUANGZHOU',
      shipper: 'ZSB EXPORT',
      packingDate: '2026-10-29',
      fromDate: '2026-10-29',
      toDate: '2026-10-29',
      items: [],
      totalBox: 15,
      totalWeight: 380,
      totalAmount: 19000,
      createdAt: '2026-10-29T08:00:00Z',
    },
  ];

  const indices = buildDatasetIndices(samplePackings, {
    getInvoice: (p) => p.invoiceNumber,
    getDate: (p) => p.packingDate,
    getParty: (p) => p.shippingMark,
    getSearchableText: (p) =>
      `${p.invoiceNumber} ${p.shippingMark} ${p.flight} ${p.destination} ${p.shipper}`,
  });

  // Query 1: Search token 'hong'
  const searchHong = queryIndexedRecords(samplePackings, indices, {
    searchTerm: 'hong',
  });
  assert.equal(searchHong.length, 1);
  assert.equal(searchHong[0].id, 'pkg-1');

  // Query 2: Filter by party 'ZSB-CN'
  const filterCn = queryIndexedRecords(samplePackings, indices, {
    partyFilter: 'ZSB-CN',
  });
  assert.equal(filterCn.length, 1);
  assert.equal(filterCn[0].id, 'pkg-2');

  // Query 3: Date range
  const dateRangeResults = queryIndexedRecords(samplePackings, indices, {
    startDate: '2026-10-29',
    endDate: '2026-10-29',
  });
  assert.equal(dateRangeResults.length, 1);
  assert.equal(dateRangeResults[0].id, 'pkg-2');
});
