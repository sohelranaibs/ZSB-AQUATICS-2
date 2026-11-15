import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionRecord,
} from '../types/index.ts';
import {
  buildPartnerTransactionLedger,
  buildTransactionLedgerCsv,
  filterPartnerTransactionLedger,
} from './transactionLedger.ts';

const sampleDeposits: PartnerDepositRecord[] = [
  {
    id: 'dep-2',
    date: '2026-10-12',
    partnerName: 'Md. Sohel Rana',
    amount: 400000,
    paymentMethod: 'Bank Transfer',
    referenceNo: 'DEP-002',
    notes: 'Second partner capital deposit',
    createdAt: '2026-10-12T11:00:00.000Z',
  },
  {
    id: 'dep-1',
    date: '2026-10-01',
    partnerName: 'Md. Mizanur Rahman',
    amount: 600000,
    paymentMethod: 'Cash Deposit',
    referenceNo: 'DEP-001',
    notes: 'Initial capital share',
    createdAt: '2026-10-01T09:00:00.000Z',
  },
];

const sampleWithdrawals: PartnerWithdrawalRecord[] = [
  {
    id: 'wdr-1',
    date: '2026-10-20',
    partnerName: 'Md. Mizanur Rahman',
    amount: 100000,
    paymentMethod: 'Cheque',
    referenceNo: 'CHQ-778',
    notes: 'Partial equity draw',
    createdAt: '2026-10-20T14:30:00.000Z',
  },
];

const sampleDistributions: ProfitDistributionRecord[] = [
  {
    id: 'pdist-1',
    targetYearMonth: '2026-10',
    payoutDate: '2026-11-02',
    calculatedNetProfit: 150000,
    distributedAmount: 50000,
    retainedAmount: 100000,
    paymentMethod: 'Bank Transfer',
    referenceNo: 'PROF-OCT-26',
    notes: 'Monthly equity payout',
    allocations: [
      { partnerName: 'Md. Mizanur Rahman', equityPercent: 55.56, payoutAmount: 27780 },
      { partnerName: 'Md. Sohel Rana', equityPercent: 44.44, payoutAmount: 22220 },
    ],
    createdAt: '2026-11-02T16:00:00.000Z',
  },
];

test('buildPartnerTransactionLedger orders deposits, withdrawals, and profit payouts chronologically with accurate running balances', () => {
  const result = buildPartnerTransactionLedger({
    partnerDeposits: sampleDeposits,
    partnerWithdrawals: sampleWithdrawals,
    profitDistributions: sampleDistributions,
  });

  assert.equal(result.entries.length, 4);
  assert.deepEqual(
    result.entries.map((e) => [e.auditSequence, e.sourceRecordId, e.date]),
    [
      [1, 'dep-1', '2026-10-01'],
      [2, 'dep-2', '2026-10-12'],
      [3, 'wdr-1', '2026-10-20'],
      [4, 'pdist-1', '2026-11-02'],
    ]
  );

  // Sequential running net balance: +600k -> +1,000k -> -100k (900k) -> -50k (850k)
  assert.deepEqual(
    result.entries.map((e) => e.runningNetBalance),
    [600000, 1000000, 900000, 850000]
  );

  // Running partner equity excludes profit distributions (deposits - withdrawals): 600k -> 1,000k -> 900k -> 900k
  assert.deepEqual(
    result.entries.map((e) => e.runningPartnerEquity),
    [600000, 1000000, 900000, 900000]
  );

  assert.equal(result.totals.totalCount, 4);
  assert.equal(result.totals.depositCount, 2);
  assert.equal(result.totals.withdrawalCount, 1);
  assert.equal(result.totals.profitPayoutCount, 1);
  assert.equal(result.totals.totalDeposits, 1000000);
  assert.equal(result.totals.totalWithdrawals, 100000);
  assert.equal(result.totals.totalProfitPayouts, 50000);
  assert.equal(result.totals.totalOutflows, 150000);
  assert.equal(result.totals.netPartnerEquity, 900000);
  assert.equal(result.totals.endingLedgerBalance, 850000);
});

test('buildPartnerTransactionLedger tie-breaks identical timestamps cleanly (deposit -> withdrawal -> payout)', () => {
  const sameTime = '2026-11-15T10:00:00.000Z';
  const result = buildPartnerTransactionLedger({
    partnerDeposits: [
      {
        id: 'd1',
        date: '2026-11-15',
        partnerName: 'Md. Mizanur Rahman',
        amount: 200000,
        createdAt: sameTime,
      },
    ],
    partnerWithdrawals: [
      {
        id: 'w1',
        date: '2026-11-15',
        partnerName: 'Md. Mizanur Rahman',
        amount: 50000,
        createdAt: sameTime,
      },
    ],
    profitDistributions: [
      {
        id: 'p1',
        targetYearMonth: '2026-11',
        payoutDate: '2026-11-15',
        calculatedNetProfit: 30000,
        distributedAmount: 30000,
        retainedAmount: 0,
        allocations: [{ partnerName: 'Md. Mizanur Rahman', equityPercent: 100, payoutAmount: 30000 }],
        createdAt: sameTime,
      },
    ],
  });

  assert.deepEqual(
    result.entries.map((e) => e.type),
    ['partner_deposit', 'partner_withdrawal', 'profit_distribution']
  );
  assert.deepEqual(
    result.entries.map((e) => e.runningNetBalance),
    [200000, 150000, 120000]
  );
});

test('filterPartnerTransactionLedger supports type, partner (including payout allocations), search, date range, and sort order', () => {
  const { entries } = buildPartnerTransactionLedger({
    partnerDeposits: sampleDeposits,
    partnerWithdrawals: sampleWithdrawals,
    profitDistributions: sampleDistributions,
  });

  // Partner filter matches deposits, withdrawals, AND profit payout rows allocating to that partner
  const sohelView = filterPartnerTransactionLedger(entries, {
    partnerFilter: 'Md. Sohel Rana',
  });
  assert.equal(sohelView.entries.length, 2);
  assert.deepEqual(
    sohelView.entries.map((e) => e.sourceRecordId),
    ['dep-2', 'pdist-1']
  );
  assert.equal(sohelView.filteredDeposits, 400000);
  assert.equal(sohelView.filteredOutflows, 50000);

  // Type filter + newest sort preserves original audit sequence & running balances
  const withdrawalsNewest = filterPartnerTransactionLedger(entries, {
    typeFilter: 'partner_withdrawal',
    sortOrder: 'newest',
  });
  assert.equal(withdrawalsNewest.entries.length, 1);
  assert.equal(withdrawalsNewest.entries[0].referenceNo, 'CHQ-778');
  assert.equal(withdrawalsNewest.entries[0].runningNetBalance, 900000);

  // Query filter by voucher/id
  const searchRes = filterPartnerTransactionLedger(entries, { query: 'PROF-OCT-26' });
  assert.equal(searchRes.entries.length, 1);
  assert.equal(searchRes.entries[0].type, 'profit_distribution');

  // Date range filter
  const dateRange = filterPartnerTransactionLedger(entries, {
    startDate: '2026-10-10',
    endDate: '2026-10-25',
  });
  assert.deepEqual(
    dateRange.entries.map((e) => e.sourceRecordId),
    ['dep-2', 'wdr-1']
  );
});

test('buildTransactionLedgerCsv produces properly escaped RFC-4180 CSV with payout allocation breakdown', () => {
  const { entries } = buildPartnerTransactionLedger({
    partnerDeposits: [
      {
        id: 'dep-csv',
        date: '2026-11-01',
        partnerName: 'Md. Mizanur Rahman',
        amount: 250000,
        paymentMethod: 'Bank Transfer',
        referenceNo: 'REF-1',
        notes: 'Deposit, Phase "1"',
        createdAt: '2026-11-01T08:00:00.000Z',
      },
    ],
    partnerWithdrawals: [],
    profitDistributions: sampleDistributions,
  });

  const csv = buildTransactionLedgerCsv(entries, 'TK');
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes('Audit Seq,Date,Recorded Timestamp,Transaction Type'));
  assert.ok(lines[1].includes('"Deposit, Phase ""1"""'));
  assert.ok(lines[2].includes('Md. Mizanur Rahman: TK 27780.00 (55.56%) | Md. Sohel Rana: TK 22220.00 (44.44%)'));
});
