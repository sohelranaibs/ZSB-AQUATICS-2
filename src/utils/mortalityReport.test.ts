import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyMortalityReport,
  formatMonthLabel,
  formatMortalityReportFilename,
} from './mortalityReport.ts';
import { MortalityRecord, PurchaseRecord } from '../types/index.ts';

describe('mortalityReport utility', () => {
  it('formats month labels and clean filenames accurately', () => {
    assert.equal(formatMonthLabel('2026-10'), 'October 2026');
    assert.equal(formatMonthLabel('2026-09'), 'September 2026');
    assert.equal(
      formatMortalityReportFilename('2026-10', 'pdf'),
      'ZSB_AQUATICS_Mortality_Report_2026_10.pdf'
    );
    assert.equal(
      formatMortalityReportFilename('2026-10', 'png'),
      'ZSB_AQUATICS_Mortality_Report_2026_10.png'
    );
  });

  it('aggregates mortality events recorded in the specified month into a structured report', () => {
    const sampleMortalities: MortalityRecord[] = [
      {
        id: 'mort-1',
        species: 'F1',
        quantityKg: 5,
        date: '2026-10-14',
        cause: 'Tank Acclimation Stress',
        createdAt: '2026-10-14T10:00:00Z',
      },
      {
        id: 'mort-2',
        species: 'F2',
        quantityKg: 15,
        date: '2026-10-18',
        cause: 'Transit Damage & DOA',
        createdAt: '2026-10-18T10:00:00Z',
      },
      {
        id: 'mort-3',
        species: 'F1',
        quantityKg: 3.5,
        date: '2026-10-22',
        cause: 'Tank Acclimation Stress',
        createdAt: '2026-10-22T10:00:00Z',
      },
      {
        // Prior month event (September 2026) - should be excluded from October 2026 report
        id: 'mort-sep',
        species: 'KS/3',
        quantityKg: 8,
        date: '2026-09-20',
        cause: 'Handling Loss',
        createdAt: '2026-09-20T10:00:00Z',
      },
    ];

    const samplePurchases: PurchaseRecord[] = [
      {
        id: 'pur-1',
        invoiceNumber: 'INV-1',
        date: '2026-10-01',
        description: 'Supplier',
        contactNumber: '',
        items: [
          {
            id: 'i1',
            item: 'F1',
            quantity: 100,
            rate: 1000,
            totalAmount: 100000,
            previousAmount: 0,
            paidAmount: 100000,
            balance: 0,
          },
          {
            id: 'i2',
            item: 'F2',
            quantity: 50,
            rate: 800,
            totalAmount: 40000,
            previousAmount: 0,
            paidAmount: 40000,
            balance: 0,
          },
        ],
        totalQty: 150,
        totalAmount: 140000,
        previousAmount: 0,
        paidAmount: 140000,
        balance: 0,
        createdAt: '2026-10-01T10:00:00Z',
      },
    ];

    const report = buildMonthlyMortalityReport(sampleMortalities, samplePurchases, '2026-10');

    assert.equal(report.targetMonth, '2026-10');
    assert.equal(report.monthLabel, 'October 2026');
    assert.equal(report.totalIncidents, 3);
    assert.equal(report.totalLossKg, 23.5); // 5 + 15 + 3.5 = 23.5 KG
    assert.equal(report.averageLossPerIncidentKg, 7.83); // 23.5 / 3 = 7.83 KG
    assert.equal(report.primarySpecies, 'F2'); // 15 KG > 8.5 KG
    assert.equal(report.primaryCause, 'Transit Damage & DOA'); // 15 KG > 8.5 KG

    // Species breakdown check
    assert.equal(report.speciesBreakdown.length, 2);
    assert.equal(report.speciesBreakdown[0].species, 'F2');
    assert.equal(report.speciesBreakdown[0].totalLossKg, 15);
    assert.equal(report.speciesBreakdown[0].estimatedLossBDT, 12000); // 15 * 800

    assert.equal(report.speciesBreakdown[1].species, 'F1');
    assert.equal(report.speciesBreakdown[1].totalLossKg, 8.5);
    assert.equal(report.speciesBreakdown[1].estimatedLossBDT, 8500); // 8.5 * 1000

    assert.equal(report.estimatedTotalLossBDT, 20500); // 12000 + 8500
  });

  it('handles months with zero mortality records gracefully', () => {
    const report = buildMonthlyMortalityReport([], [], '2026-11');
    assert.equal(report.totalIncidents, 0);
    assert.equal(report.totalLossKg, 0);
    assert.equal(report.primarySpecies, 'None');
    assert.equal(report.primaryCause, 'None');
    assert.equal(report.speciesBreakdown.length, 0);
    assert.equal(report.records.length, 0);
  });
});
