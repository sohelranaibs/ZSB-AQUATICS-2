import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInventoryStockItems,
  calculateLowStockSummary,
} from './inventoryStock.ts';
import { samplePurchases as initialPurchases } from '../context/initialData.ts';
import { MortalityRecord } from '../types/index.ts';

describe('inventoryStock utility with Mortality Stock Adjustments', () => {
  it('identifies items below and approaching the default 100 KG minimum inventory threshold without mortality', () => {
    // initialPurchases has: F1 (70 KG), FF1 (80 KG), F2 (110 KG), XXL (125 KG), KS/3 (200 KG)
    const summary = calculateLowStockSummary(initialPurchases, [], 100, 25);

    assert.equal(summary.minThresholdKg, 100);
    assert.equal(summary.approachingCeilingKg, 125);
    assert.equal(summary.totalTrackedItems, 5);

    // Total procurement = 70 + 80 + 110 + 125 + 200 + 95 = 680 KG
    assert.equal(summary.totalPurchasedKg, 680);
    assert.equal(summary.totalExportedKg, 0);
    assert.equal(summary.totalMortalityKg, 0);
    assert.equal(summary.totalAvailableStockKg, 680);
    assert.equal(summary.totalStockStatus, 'healthy');
    assert.equal(summary.totalShortfallOrBufferKg, 580);

    // Below/at 100 KG: F1 (70 KG) and FF1 (80 KG)
    assert.equal(summary.criticalLowCount, 2);
    // Approaching (100 < stock <= 125 KG): F2 (110 KG) and XXL (125 KG)
    assert.equal(summary.approachingLowCount, 2);
    // Flagged total = 4
    assert.equal(summary.flaggedCount, 4);
    // Healthy (> 125 KG): KS/3 (200 KG)
    assert.equal(summary.healthyCount, 1);
  });

  it('automatically deducts mortality losses to update stock adjustment levels and shifts alert status', () => {
    // F2 starts at 110 KG (approaching_low with min 100 KG and buffer 25%).
    // If we record a mortality of 15 KG for F2:
    // F2 stock becomes 110 - 15 = 95 KG, which drops F2 into critical_low (<= 100 KG)!
    // Also KS/3 starts at 295 KG (healthy). If we record a mortality of 180 KG for KS/3:
    // KS/3 stock becomes 295 - 180 = 115 KG, which drops KS/3 into approaching_low (<= 125 KG)!
    const mortalities: MortalityRecord[] = [
      {
        id: 'mort-1',
        species: 'F2',
        quantityKg: 15,
        date: '2026-10-14',
        cause: 'Transit Damage',
        createdAt: '2026-10-14T10:00:00.000Z',
      },
      {
        id: 'mort-2',
        species: 'KS/3',
        quantityKg: 180,
        date: '2026-10-15',
        cause: 'Tank Acclimation Stress',
        createdAt: '2026-10-15T10:00:00.000Z',
      },
    ];

    const items = calculateInventoryStockItems(initialPurchases, [], mortalities, 100, 25);
    const f2Item = items.find((i) => i.item === 'F2');
    assert.ok(f2Item);
    assert.equal(f2Item.purchasedKg, 110);
    assert.equal(f2Item.mortalityKg, 15);
    assert.equal(f2Item.currentStockKg, 95);
    assert.equal(f2Item.status, 'critical_low'); // Dropped from approaching to critical!

    const ksItem = items.find((i) => i.item === 'KS/3');
    assert.ok(ksItem);
    assert.equal(ksItem.purchasedKg, 295);
    assert.equal(ksItem.mortalityKg, 180);
    assert.equal(ksItem.currentStockKg, 115);
    assert.equal(ksItem.status, 'approaching_low'); // Dropped from healthy to approaching!

    const summary = calculateLowStockSummary(initialPurchases, [], mortalities, 100, 25);
    assert.equal(summary.totalMortalityKg, 195);
    assert.equal(summary.mortalityCount, 2);
    // Critical low now has F1 (70), FF1 (80), F2 (95) = 3 items!
    assert.equal(summary.criticalLowCount, 3);
    // Approaching low now has XXL (125), KS/3 (115) = 2 items!
    assert.equal(summary.approachingLowCount, 2);
    assert.equal(summary.healthyCount, 0);
  });

  it('accumulates multiple mortality records for the same species', () => {
    const mortalities: MortalityRecord[] = [
      {
        id: 'mort-a',
        species: 'F1',
        quantityKg: 5,
        date: '2026-10-10',
        cause: 'DOA',
        createdAt: '2026-10-10T10:00:00.000Z',
      },
      {
        id: 'mort-b',
        species: 'F1',
        quantityKg: 3.5,
        date: '2026-10-11',
        cause: 'Water Quality',
        createdAt: '2026-10-11T10:00:00.000Z',
      },
    ];

    const items = calculateInventoryStockItems(initialPurchases, [], mortalities, 100, 25);
    const f1Item = items.find((i) => i.item === 'F1');
    assert.ok(f1Item);
    assert.equal(f1Item.purchasedKg, 70);
    assert.equal(f1Item.mortalityKg, 8.5);
    assert.equal(f1Item.currentStockKg, 61.5);
  });

  it('handles empty purchase and mortality records gracefully', () => {
    const items = calculateInventoryStockItems([], [], [], 100, 25);
    assert.equal(items.length, 0);
    const summary = calculateLowStockSummary([], [], [], 100, 25);
    assert.equal(summary.flaggedCount, 0);
    assert.equal(summary.totalTrackedItems, 0);
    assert.equal(summary.totalMortalityKg, 0);
  });
});
