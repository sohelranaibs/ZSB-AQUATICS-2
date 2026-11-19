import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFlightProfitabilityAndFx,
  resolveHistoricalRmbRate,
  RmbFxRateLogEntry,
} from './flightProfitabilityFx.ts';
import {
  MortalityRecord,
  OtherCostRecord,
  PackingRecord,
  PurchaseRecord,
} from '../types/index.ts';

test('resolveHistoricalRmbRate selects latest entry on or before target date', () => {
  const history: RmbFxRateLogEntry[] = [
    { id: 'fx-1', date: '2026-11-01', rateBdtPerRmb: 16.4, createdAt: '2026-11-01T00:00:00Z' },
    { id: 'fx-2', date: '2026-11-10', rateBdtPerRmb: 16.9, createdAt: '2026-11-10T00:00:00Z' },
    { id: 'fx-3', date: '2026-11-18', rateBdtPerRmb: 17.2, createdAt: '2026-11-18T00:00:00Z' },
  ];

  assert.equal(resolveHistoricalRmbRate(history, '2026-11-12', 16.5), 16.9);
  assert.equal(resolveHistoricalRmbRate(history, '2026-11-18', 16.5), 17.2);
  assert.equal(resolveHistoricalRmbRate(history, '2026-10-20', 16.5), 16.5);
});

test('calculateFlightProfitabilityAndFx computes per-flight net margin, cost allocation, and FX gain/loss accurately', () => {
  const purchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'PUR-001',
      date: '2026-11-10',
      description: 'Supplier A',
      contactNumber: '',
      items: [],
      totalQty: 200,
      totalAmount: 200000, // 1000 TK/KG
      previousAmount: 0,
      paidAmount: 200000,
      balance: 0,
      createdAt: '2026-11-10T06:00:00Z',
    },
  ];

  const packings: PackingRecord[] = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-100',
      shippingMark: 'GZ-01',
      flight: 'CZ-392',
      destination: 'Guangzhou',
      shipper: 'Apex',
      packingDate: '2026-11-10',
      fromDate: '2026-11-10',
      toDate: '2026-11-10',
      items: [],
      totalBox: 10,
      totalWeight: 100, // 100 KG -> purchase cost = 100,000 TK
      totalAmount: 10000, // 10,000 RMB
      rmbRate: 16.5, // Booked: 165,000 TK
      totalAmountBDT: 165000,
      paymentDate: '2026-11-15', // Settled at 17.0 -> 170,000 TK (+5,000 FX gain)
      createdAt: '2026-11-10T10:00:00Z',
    },
  ];

  const otherCosts: OtherCostRecord[] = [
    {
      id: 'cost-1',
      date: '2026-11-10',
      category: 'AIR FREIGHT',
      amount: 15000,
      description: 'CZ-392 Cargo Fee',
      refInvoice: 'PKG-100',
      createdAt: '2026-11-10T12:00:00Z',
    },
  ];

  const mortalities: MortalityRecord[] = [
    {
      id: 'mort-1',
      species: 'FF1',
      quantityKg: 5, // 5 KG * 1000 TK/KG = 5,000 TK
      date: '2026-11-10',
      createdAt: '2026-11-10T09:00:00Z',
    },
  ];

  const fxHistory: RmbFxRateLogEntry[] = [
    { id: 'fx-1', date: '2026-11-10', rateBdtPerRmb: 16.5, createdAt: '2026-11-10T00:00:00Z' },
    { id: 'fx-2', date: '2026-11-15', rateBdtPerRmb: 17.0, createdAt: '2026-11-15T00:00:00Z' },
  ];

  const summary = calculateFlightProfitabilityAndFx({
    packings,
    purchases,
    otherCosts,
    mortalities,
    fxHistory,
    currentRmbRate: 17.0,
  });

  assert.equal(summary.totalFlights, 1);
  const row = summary.rows[0];
  assert.equal(row.flight, 'CZ-392');
  assert.equal(row.bookedRevenueBdt, 165000);
  assert.equal(row.settlementRevenueBdt, 170000);
  assert.equal(row.fxGainLossBdt, 5000);
  assert.equal(row.allocatedPurchaseCostBdt, 100000);
  assert.equal(row.allocatedMortalityLossBdt, 5000);
  assert.equal(row.allocatedOperatingCostBdt, 15000);
  assert.equal(row.totalCostBdt, 120000);
  assert.equal(row.netProfitBdt, 50000);
  assert.equal(summary.profitableFlightsCount, 1);
  assert.equal(summary.lossMakingFlightsCount, 0);
});
