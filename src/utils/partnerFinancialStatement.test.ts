import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPartnerFinancialStatementData,
  formatFinancialStatementFilename,
} from './partnerFinancialStatement.ts';
import { initialCompanyProfile } from '../context/initialData.ts';
import type {
  BalanceIncomeRecord,
  OtherCostRecord,
  PackingRecord,
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionRecord,
  PurchaseRecord,
} from '../types/index.ts';

describe('partnerFinancialStatement utilities', () => {
  it('formats deterministic financial statement PDF filenames', () => {
    assert.equal(
      formatFinancialStatementFilename('2026-11-15'),
      'ZSB_AQUATICS_FINANCIAL_STATEMENT_2026-11-15.pdf'
    );
  });

  it('builds structured financial statement data with deposits, equity distribution, and recent withdrawals', () => {
    const companyProfile = {
      ...initialCompanyProfile,
      partners: ['Md. Mizanur Rahman', 'Md. Sohel Rana', 'Tariqul Islam', 'Rafiqul Islam'],
    };

    const partnerDeposits: PartnerDepositRecord[] = [
      {
        id: 'pdep-1',
        date: '2026-10-01',
        partnerName: 'Md. Mizanur Rahman',
        amount: 600000,
        paymentMethod: 'Bank Transfer',
        referenceNo: 'DEP-001',
        notes: 'Initial capital',
        createdAt: '2026-10-01T09:00:00Z',
      },
      {
        id: 'pdep-2',
        date: '2026-11-05',
        partnerName: 'Md. Sohel Rana',
        amount: 400000,
        paymentMethod: 'Cash Deposit',
        createdAt: '2026-11-05T10:00:00Z',
      },
      {
        id: 'pdep-3',
        date: '2026-11-10',
        partnerName: 'Tariqul Islam',
        amount: 200000,
        createdAt: '2026-11-10T11:00:00Z',
      },
    ];

    const partnerWithdrawals: PartnerWithdrawalRecord[] = [
      {
        id: 'pwdr-1',
        date: '2026-10-20',
        partnerName: 'Md. Mizanur Rahman',
        amount: 100000,
        paymentMethod: 'Bank Transfer',
        referenceNo: 'WDR-001',
        notes: 'Owner draw',
        createdAt: '2026-10-20T12:00:00Z',
      },
      {
        id: 'pwdr-2',
        date: '2026-11-12',
        partnerName: 'Md. Sohel Rana',
        amount: 50000,
        paymentMethod: 'Cash Withdrawal',
        referenceNo: 'WDR-002',
        createdAt: '2026-11-12T15:00:00Z',
      },
    ];

    const balanceIncomes: BalanceIncomeRecord[] = [
      {
        id: 'inc-1',
        date: '2026-11-08',
        source: 'Export Rebate',
        amount: 150000,
        description: 'Rebate credit',
        createdAt: '2026-11-08T10:00:00Z',
      },
    ];

    const otherCosts: OtherCostRecord[] = [
      {
        id: 'cost-1',
        date: '2026-11-09',
        category: 'Air Freight & Cargo',
        amount: 50000,
        description: 'Cargo fee',
        createdAt: '2026-11-09T10:00:00Z',
      },
    ];

    const profitDistributions: ProfitDistributionRecord[] = [];
    const purchases: PurchaseRecord[] = [];
    const packings: PackingRecord[] = [];

    const statement = buildPartnerFinancialStatementData({
      companyProfile,
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions,
      balanceIncomes,
      purchases,
      packings,
      otherCosts,
      referenceDate: '2026-11-15',
    });

    assert.equal(statement.statementRef, 'FS-20261115');
    assert.equal(statement.filename, 'ZSB_AQUATICS_FINANCIAL_STATEMENT_2026-11-15.pdf');
    assert.equal(statement.summary.totalPartnerDeposits, 1200000);
    assert.equal(statement.summary.totalPartnerWithdrawals, 150000);
    assert.equal(statement.summary.netPartnerCapital, 1050000);
    assert.equal(statement.summary.totalIncomeAdded, 150000);
    assert.equal(statement.summary.totalCostingDeducted, 50000);
    assert.equal(statement.summary.totalBalance, 1150000);
    assert.equal(statement.summary.partnerCount, 4);
    assert.equal(statement.summary.fundedPartnerCount, 3);

    // Deposits sorted newest first
    assert.deepEqual(
      statement.currentDeposits.map((d) => d.id),
      ['pdep-3', 'pdep-2', 'pdep-1']
    );
    assert.equal(statement.currentDeposits[0].paymentMethod, 'Bank Transfer');
    assert.equal(statement.currentDeposits[0].referenceNo, '—');

    // Withdrawals sorted newest first
    assert.deepEqual(
      statement.recentWithdrawals.map((w) => w.id),
      ['pwdr-2', 'pwdr-1']
    );

    // Equity distribution totals 100% across the 3 funded partners; 4th partner has 0%
    const totalPct = statement.equityDistribution.reduce((s, p) => s + p.equityPercent, 0);
    assert.ok(Math.abs(totalPct - 100) < 0.05);
    const rafiq = statement.equityDistribution.find((p) => p.partnerName === 'Rafiqul Islam');
    assert.ok(rafiq);
    assert.equal(rafiq.equityPercent, 0);
    assert.equal(rafiq.netContribution, 0);
  });

  it('respects recentWithdrawalsLimit while preserving total withdrawal summary counts', () => {
    const withdrawals: PartnerWithdrawalRecord[] = [
      { id: 'w1', date: '2026-11-01', partnerName: 'Md. Mizanur Rahman', amount: 10000, createdAt: '2026-11-01T10:00:00Z' },
      { id: 'w2', date: '2026-11-05', partnerName: 'Md. Mizanur Rahman', amount: 20000, createdAt: '2026-11-05T10:00:00Z' },
      { id: 'w3', date: '2026-11-10', partnerName: 'Md. Sohel Rana', amount: 30000, createdAt: '2026-11-10T10:00:00Z' },
    ];

    const statement = buildPartnerFinancialStatementData({
      companyProfile: initialCompanyProfile,
      partnerDeposits: [],
      partnerWithdrawals: withdrawals,
      profitDistributions: [],
      balanceIncomes: [],
      purchases: [],
      packings: [],
      otherCosts: [],
      referenceDate: '2026-11-15',
      recentWithdrawalsLimit: 2,
    });

    assert.equal(statement.summary.withdrawalCount, 3);
    assert.equal(statement.summary.recentWithdrawalCount, 2);
    assert.equal(statement.summary.totalPartnerWithdrawals, 60000);
    assert.deepEqual(statement.recentWithdrawals.map((w) => w.id), ['w3', 'w2']);
  });
});
