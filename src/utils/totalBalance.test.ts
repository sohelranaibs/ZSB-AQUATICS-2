import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregatePartnerShares,
  aggregateAllCostings,
  calculateTotalBalanceSummary,
  buildTotalBalanceLedgerEntries,
  filterBalanceLedgerEntries,
  buildPartnerDirectory,
  buildPartnerCapitalChartData,
  buildPartnerEquityRoster,
  buildMonthlyTotalBalanceTrend,
  getUnfundedRegisteredPartners,
  PARTNER_CAPITAL_CHART_COLORS,
  addPartnerToCompanyList,
  removePartnerFromCompanyList,
  validateAddPartnerName,
  validatePartnerDepositInput,
  validatePartnerWithdrawalInput,
  validateBalanceIncomeInput,
  validateBalanceCostInput,
  calculateMonthlyNetProfitForDistribution,
  calculateProfitDistributionAllocation,
  validateProfitDistributionInput,
} from './totalBalance.ts';
import type {
  BalanceIncomeRecord,
  OtherCostRecord,
  PackingRecord,
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionRecord,
  PurchaseRecord,
} from '../types/index.ts';

test('validatePartnerDepositInput enforces required date, partner name, and positive amount', () => {
  assert.equal(
    validatePartnerDepositInput({ date: '', partnerName: 'Md. Sohel Rana', amount: 1000 }).valid,
    false
  );
  assert.equal(
    validatePartnerDepositInput({ date: '2026-07-01', partnerName: '   ', amount: 1000 }).valid,
    false
  );
  assert.equal(
    validatePartnerDepositInput({ date: '2026-07-01', partnerName: 'Md. Sohel Rana', amount: 0 }).valid,
    false
  );
  assert.equal(
    validatePartnerDepositInput({ date: '2026-07-01', partnerName: 'Md. Sohel Rana', amount: -50 }).valid,
    false
  );
  const ok = validatePartnerDepositInput({
    date: '2026-07-01',
    partnerName: 'Md. Sohel Rana',
    amount: '250000.456',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.cleanAmount, 250000.46);
});

test('validateBalanceIncomeInput and validateBalanceCostInput enforce positive values', () => {
  assert.equal(
    validateBalanceIncomeInput({ date: '2026-07-02', source: 'Bonus', amount: 0 }).valid,
    false
  );
  assert.equal(
    validateBalanceIncomeInput({ date: '2026-07-02', source: 'Bonus', amount: 12000 }).valid,
    true
  );
  assert.equal(
    validateBalanceCostInput({ date: '2026-07-02', category: '', amount: 500 }).valid,
    false
  );
  assert.equal(
    validateBalanceCostInput({ date: '2026-07-02', category: 'Ice & Oxygen Cylinders', amount: 4500 }).valid,
    true
  );
});

test('aggregatePartnerShares sums deposits and computes accurate partner share percentages', () => {
  const deposits: PartnerDepositRecord[] = [
    {
      id: 'd1',
      date: '2026-07-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 600000,
      createdAt: '2026-07-01T08:00:00Z',
    },
    {
      id: 'd2',
      date: '2026-07-03',
      partnerName: 'Md. Sohel Rana',
      amount: 300000,
      createdAt: '2026-07-03T08:00:00Z',
    },
    {
      id: 'd3',
      date: '2026-07-05',
      partnerName: 'md. sohel rana',
      amount: 100000,
      createdAt: '2026-07-05T08:00:00Z',
    },
  ];

  const res = aggregatePartnerShares(deposits);
  assert.equal(res.totalPartnerDeposit, 1000000);
  assert.equal(res.partnerShares.length, 2);
  assert.equal(res.partnerShares[0].partnerName, 'Md. Mizanur Rahman');
  assert.equal(res.partnerShares[0].totalDeposited, 600000);
  assert.equal(res.partnerShares[0].sharePercent, 60);
  assert.equal(res.partnerShares[1].totalDeposited, 400000);
  assert.equal(res.partnerShares[1].depositCount, 2);
  assert.equal(res.partnerShares[1].sharePercent, 40);
  assert.equal(res.partnerShares[1].lastDepositDate, '2026-07-05');
});

test('calculateTotalBalanceSummary adds partner deposits and all income, and deducts all purchasing and operating costings', () => {
  const partnerDeposits: PartnerDepositRecord[] = [
    {
      id: 'dep-1',
      date: '2026-07-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 500000,
      createdAt: '2026-07-01T09:00:00Z',
    },
    {
      id: 'dep-2',
      date: '2026-07-01',
      partnerName: 'Md. Sohel Rana',
      amount: 500000,
      createdAt: '2026-07-01T10:00:00Z',
    },
  ];

  const purchases: PurchaseRecord[] = [
    {
      id: 'pur-1',
      invoiceNumber: 'INV-001',
      date: '2026-07-02',
      description: 'Satkhira Crab Depot',
      contactNumber: '01700',
      items: [],
      totalQty: 200,
      totalAmount: 300000,
      previousAmount: 0,
      paidAmount: 200000,
      balance: 100000,
      createdAt: '2026-07-02T10:00:00Z',
    },
  ];

  const otherCosts: OtherCostRecord[] = [
    {
      id: 'cost-1',
      date: '2026-07-03',
      category: 'Air Freight & Cargo',
      amount: 120000,
      description: 'DAC to CAN cargo',
      createdAt: '2026-07-03T10:00:00Z',
    },
    {
      id: 'cost-2',
      date: '2026-07-03',
      category: 'Boxes & Packing Materials',
      amount: 30000,
      description: 'Thermocol boxes',
      createdAt: '2026-07-03T11:00:00Z',
    },
  ];

  const packings: PackingRecord[] = [
    {
      id: 'pkg-1',
      invoiceNumber: 'PKG-001',
      shippingMark: 'CAN-01',
      flight: 'CZ-392',
      destination: 'Guangzhou',
      shipper: 'ZSB',
      packingDate: '2026-07-04',
      fromDate: '2026-07-04',
      toDate: '2026-07-04',
      items: [],
      totalBox: 10,
      totalWeight: 180,
      totalAmount: 20000, // RMB
      rmbRate: 16.5, // 330,000 BDT
      createdAt: '2026-07-04T10:00:00Z',
    },
  ];

  const balanceIncomes: BalanceIncomeRecord[] = [
    {
      id: 'inc-1',
      date: '2026-07-05',
      source: 'Export Settlement Bonus',
      amount: 50000,
      description: 'Rebate credited',
      createdAt: '2026-07-05T10:00:00Z',
    },
  ];

  const summary = calculateTotalBalanceSummary({
    partnerDeposits,
    balanceIncomes,
    purchases,
    packings,
    otherCosts,
  });

  // Partner Deposits = 1,000,000
  // Export Income = 20,000 * 16.5 = 330,000; Manual Income = 50,000 -> Total Income = 380,000
  // Purchasing Cost = 300,000; Other Costing = 150,000 -> Total Costing Deducted = 450,000
  // Total Balance = 1,000,000 + 380,000 - 450,000 = 930,000
  assert.equal(summary.totalPartnerDeposit, 1000000);
  assert.equal(summary.exportValueIncome, 330000);
  assert.equal(summary.manualIncome, 50000);
  assert.equal(summary.totalIncomeAdded, 380000);
  assert.equal(summary.totalPurchasingCost, 300000);
  assert.equal(summary.totalOtherCosting, 150000);
  assert.equal(summary.totalCostingDeducted, 450000);
  assert.equal(summary.totalBalance, 930000);
  assert.equal(summary.costingCategories.length, 3);
});

test('buildTotalBalanceLedgerEntries tracks chronological running balance accurately and handles deficits', () => {
  const partnerDeposits: PartnerDepositRecord[] = [
    {
      id: 'dep-1',
      date: '2026-07-01',
      partnerName: 'Md. Sohel Rana',
      amount: 100000,
      createdAt: '2026-07-01T08:00:00Z',
    },
  ];
  const otherCosts: OtherCostRecord[] = [
    {
      id: 'cost-1',
      date: '2026-07-02',
      category: 'Air Freight & Cargo',
      amount: 140000,
      description: 'Cargo fee',
      createdAt: '2026-07-02T08:00:00Z',
    },
  ];
  const balanceIncomes: BalanceIncomeRecord[] = [
    {
      id: 'inc-1',
      date: '2026-07-03',
      source: 'Buyer Advance',
      amount: 60000,
      description: 'Advance transfer',
      createdAt: '2026-07-03T08:00:00Z',
    },
  ];

  const chrono = buildTotalBalanceLedgerEntries({
    partnerDeposits,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
    order: 'chronological',
  });

  assert.equal(chrono.length, 3);
  assert.equal(chrono[0].runningBalance, 100000);
  assert.equal(chrono[1].runningBalance, -40000);
  assert.equal(chrono[2].runningBalance, 20000);

  const newestFirst = buildTotalBalanceLedgerEntries({
    partnerDeposits,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
    order: 'newest',
  });
  assert.equal(newestFirst[0].sourceRecordId, 'inc-1');
  assert.equal(newestFirst[0].runningBalance, 20000);
  assert.equal(newestFirst[1].runningBalance, -40000);

  const onlyCosts = filterBalanceLedgerEntries(newestFirst, { typeFilter: 'other_cost' });
  assert.equal(onlyCosts.length, 1);
  assert.equal(onlyCosts[0].debitAmount, 140000);

  const dir = buildPartnerDirectory(
    { managingPartner: 'Md. Mizanur Rahman', partner: 'Md. Sohel Rana' },
    partnerDeposits
  );
  assert.deepEqual(dir, ['Md. Mizanur Rahman', 'Md. Sohel Rana']);
});

test('aggregateAllCostings returns zeros cleanly when empty', () => {
  const empty = aggregateAllCostings({ purchases: [], otherCosts: [] });
  assert.equal(empty.totalPurchasingCost, 0);
  assert.equal(empty.totalOtherCosting, 0);
  assert.equal(empty.totalCostingDeducted, 0);
  assert.equal(empty.costingCategories.length, 0);
});

test('addPartnerToCompanyList supports 4+ partners with duplicate and blank validation', () => {
  const baseProfile = {
    managingPartner: 'Md. Mizanur Rahman',
    partner: 'Md. Sohel Rana',
    partners: ['Md. Mizanur Rahman', 'Md. Sohel Rana'],
  };

  assert.equal(validateAddPartnerName('   ', baseProfile.partners).valid, false);
  assert.equal(validateAddPartnerName('md. sohel rana', baseProfile.partners).valid, false);

  const check3 = validateAddPartnerName('Partner Three', baseProfile.partners);
  assert.equal(check3.valid, true);
  assert.equal(check3.cleanName, 'Partner Three');

  const with3 = addPartnerToCompanyList(baseProfile, 'Partner Three');
  const with4 = addPartnerToCompanyList({ ...baseProfile, partners: with3 }, 'Partner Four');
  assert.deepEqual(with4, [
    'Md. Mizanur Rahman',
    'Md. Sohel Rana',
    'Partner Three',
    'Partner Four',
  ]);

  const resolvedDir = buildPartnerDirectory({ ...baseProfile, partners: with4 }, []);
  assert.equal(resolvedDir.length, 4);

  // Primary signatory partners stay protected; custom partners can be removed cleanly
  const afterRemoveCustom = removePartnerFromCompanyList(
    { ...baseProfile, partners: with4 },
    'Partner Three'
  );
  assert.deepEqual(afterRemoveCustom, ['Md. Mizanur Rahman', 'Md. Sohel Rana', 'Partner Four']);

  const afterTryRemovePrimary = removePartnerFromCompanyList(
    { ...baseProfile, partners: afterRemoveCustom },
    'Md. Mizanur Rahman'
  );
  assert.equal(afterTryRemovePrimary.length, 3);
});

test('buildPartnerCapitalChartData transforms 4-partner deposits into chart percentages and detects unfunded partners', () => {
  const deposits: PartnerDepositRecord[] = [
    {
      id: 'd1',
      date: '2026-07-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 400000,
      createdAt: '2026-07-01T08:00:00Z',
    },
    {
      id: 'd2',
      date: '2026-07-02',
      partnerName: 'Md. Sohel Rana',
      amount: 300000,
      createdAt: '2026-07-02T08:00:00Z',
    },
    {
      id: 'd3',
      date: '2026-07-03',
      partnerName: 'Partner Three With Very Long Name',
      amount: 200000,
      createdAt: '2026-07-03T08:00:00Z',
    },
  ];

  const { partnerShares } = aggregatePartnerShares(deposits);
  const chartData = buildPartnerCapitalChartData(partnerShares);

  assert.equal(chartData.length, 3);
  assert.equal(chartData[0].partnerName, 'Md. Mizanur Rahman');
  assert.equal(chartData[0].color, PARTNER_CAPITAL_CHART_COLORS[0]);
  assert.equal(chartData[1].color, PARTNER_CAPITAL_CHART_COLORS[1]);
  assert.equal(chartData[2].color, PARTNER_CAPITAL_CHART_COLORS[2]);
  assert.equal(chartData[2].shortName.endsWith('…'), true);
  assert.equal(chartData[0].sharePercent, 44.44);
  assert.equal(chartData[1].sharePercent, 33.33);
  assert.equal(chartData[2].sharePercent, 22.22);

  const unfunded = getUnfundedRegisteredPartners(
    ['Md. Mizanur Rahman', 'Md. Sohel Rana', 'Partner Three With Very Long Name', 'Partner Four'],
    partnerShares
  );
  assert.deepEqual(unfunded, ['Partner Four']);

  // Adding 4th partner deposit (100,000) yields exact 40% / 30% / 20% / 10% = 100%
  const { partnerShares: fourShares } = aggregatePartnerShares([
    ...deposits,
    {
      id: 'd4',
      date: '2026-07-04',
      partnerName: 'Partner Four',
      amount: 100000,
      createdAt: '2026-07-04T08:00:00Z',
    },
  ]);
  const fourChart = buildPartnerCapitalChartData(fourShares);
  assert.equal(fourChart.length, 4);
  assert.deepEqual(
    fourChart.map((d) => d.sharePercent),
    [40, 30, 20, 10]
  );
  assert.equal(
    fourChart.reduce((acc, d) => acc + d.sharePercent, 0),
    100
  );

  assert.deepEqual(buildPartnerCapitalChartData([]), []);
});

test('buildMonthlyTotalBalanceTrend computes 12-month cumulative Total Balance growth with prior opening carry-forward', () => {
  const partnerDeposits: PartnerDepositRecord[] = [
    {
      id: 'dep-pre',
      date: '2025-10-15', // Before Dec 2025 – Nov 2026 window -> opening balance
      partnerName: 'Md. Mizanur Rahman',
      amount: 200000,
      createdAt: '2025-10-15T08:00:00Z',
    },
    {
      id: 'dep-feb',
      date: '2026-02-10',
      partnerName: 'Md. Sohel Rana',
      amount: 300000,
      createdAt: '2026-02-10T08:00:00Z',
    },
    {
      id: 'dep-aug',
      date: '2026-08-05',
      partnerName: 'Tariqul Islam',
      amount: 500000,
      createdAt: '2026-08-05T08:00:00Z',
    },
  ];

  const otherCosts: OtherCostRecord[] = [
    {
      id: 'cost-may',
      date: '2026-05-12',
      category: 'Air Freight & Cargo',
      amount: 150000,
      description: 'Cargo fee',
      createdAt: '2026-05-12T08:00:00Z',
    },
  ];

  const balanceIncomes: BalanceIncomeRecord[] = [
    {
      id: 'inc-nov',
      date: '2026-11-10',
      source: 'Export Settlement Bonus',
      amount: 120000,
      description: 'November settlement',
      createdAt: '2026-11-10T08:00:00Z',
    },
  ];

  const trend = buildMonthlyTotalBalanceTrend({
    partnerDeposits,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
    endYearMonth: '2026-11',
    monthsCount: 12,
  });

  const summary = calculateTotalBalanceSummary({
    partnerDeposits,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
  });

  assert.equal(trend.points.length, 12);
  assert.equal(trend.startYearMonth, '2025-12');
  assert.equal(trend.endYearMonth, '2026-11');
  assert.equal(trend.openingBalance, 200000);
  assert.equal(trend.hasAnyActivity, true);
  assert.equal(trend.activeMonthsCount, 4);

  // Dec 2025 & Jan 2026 carry opening 200k; Feb adds 300k -> 500k
  assert.equal(trend.points[0].endingTotalBalance, 200000);
  assert.equal(trend.points[2].yearMonth, '2026-02');
  assert.equal(trend.points[2].endingTotalBalance, 500000);

  // May deducts 150k -> 350k
  assert.equal(trend.points[5].yearMonth, '2026-05');
  assert.equal(trend.points[5].costingDeducted, 150000);
  assert.equal(trend.points[5].endingTotalBalance, 350000);

  // Aug adds 500k -> 850k; Nov adds 120k -> 970k
  assert.equal(trend.points[8].yearMonth, '2026-08');
  assert.equal(trend.points[8].endingTotalBalance, 850000);
  assert.equal(trend.points[11].yearMonth, '2026-11');
  assert.equal(trend.points[11].endingTotalBalance, 970000);

  assert.equal(trend.currentBalance, summary.totalBalance);
  assert.equal(trend.netPeriodChange, 770000);
  assert.equal(trend.growthPercent, 385);
  assert.equal(trend.peakBalance, 970000);
  assert.equal(trend.peakMonthLabel, 'November 2026');

  const empty = buildMonthlyTotalBalanceTrend({
    partnerDeposits: [],
    balanceIncomes: [],
    purchases: [],
    packings: [],
    otherCosts: [],
    endYearMonth: '2026-11',
  });
  assert.equal(empty.points.length, 12);
  assert.equal(empty.hasAnyActivity, false);
  assert.equal(empty.currentBalance, 0);
});

test('buildPartnerEquityRoster lists each partner with cumulative deposit, current equity percentage, and unfunded partners', () => {
  const deposits: PartnerDepositRecord[] = [
    {
      id: 'd1',
      date: '2026-07-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 500000,
      createdAt: '2026-07-01T08:00:00Z',
    },
    {
      id: 'd2',
      date: '2026-07-02',
      partnerName: 'Md. Sohel Rana',
      amount: 300000,
      createdAt: '2026-07-02T08:00:00Z',
    },
    {
      id: 'd3',
      date: '2026-07-04',
      partnerName: 'Partner Three',
      amount: 200000,
      createdAt: '2026-07-04T08:00:00Z',
    },
  ];

  const { partnerShares } = aggregatePartnerShares(deposits);
  const directory = [
    'Md. Mizanur Rahman',
    'Md. Sohel Rana',
    'Partner Three',
    'Partner Four',
  ];

  const roster = buildPartnerEquityRoster(directory, partnerShares);
  assert.equal(roster.partnerCount, 4);
  assert.equal(roster.fundedPartnerCount, 3);
  assert.equal(roster.totalCapitalDeposited, 1000000);
  assert.equal(roster.totalEquityPercent, 100);

  assert.equal(roster.items[0].partnerName, 'Md. Mizanur Rahman');
  assert.equal(roster.items[0].totalDeposited, 500000);
  assert.equal(roster.items[0].equityPercent, 50);
  assert.equal(roster.items[0].hasDeposited, true);
  assert.equal(roster.items[0].color, PARTNER_CAPITAL_CHART_COLORS[0]);

  assert.equal(roster.items[1].partnerName, 'Md. Sohel Rana');
  assert.equal(roster.items[1].equityPercent, 30);
  assert.equal(roster.items[2].partnerName, 'Partner Three');
  assert.equal(roster.items[2].equityPercent, 20);

  // Unfunded 4th registered partner still appears cleanly with 0 deposit and 0% equity
  assert.equal(roster.items[3].partnerName, 'Partner Four');
  assert.equal(roster.items[3].totalDeposited, 0);
  assert.equal(roster.items[3].equityPercent, 0);
  assert.equal(roster.items[3].hasDeposited, false);
  assert.equal(roster.items[3].color, '#94A3B8');

  // Zero deposits still lists all registered partners at 0% equity
  const zeroDepositRoster = buildPartnerEquityRoster(['Md. Mizanur Rahman', 'Md. Sohel Rana'], []);
  assert.equal(zeroDepositRoster.partnerCount, 2);
  assert.equal(zeroDepositRoster.fundedPartnerCount, 0);
  assert.equal(zeroDepositRoster.totalCapitalDeposited, 0);
  assert.deepEqual(
    zeroDepositRoster.items.map((i) => i.equityPercent),
    [0, 0]
  );

  // Completely empty inputs
  const empty = buildPartnerEquityRoster([], []);
  assert.equal(empty.items.length, 0);
  assert.equal(empty.partnerCount, 0);
});

test('validatePartnerWithdrawalInput validates required date, partner name, and positive withdrawal amount', () => {
  assert.equal(
    validatePartnerWithdrawalInput({ date: '', partnerName: 'Md. Mizanur Rahman', amount: 5000 }).valid,
    false
  );
  assert.equal(
    validatePartnerWithdrawalInput({ date: '2026-07-10', partnerName: '  ', amount: 5000 }).valid,
    false
  );
  assert.equal(
    validatePartnerWithdrawalInput({ date: '2026-07-10', partnerName: 'Md. Mizanur Rahman', amount: 0 }).valid,
    false
  );
  assert.equal(
    validatePartnerWithdrawalInput({ date: '2026-07-10', partnerName: 'Md. Mizanur Rahman', amount: -250 }).valid,
    false
  );
  const ok = validatePartnerWithdrawalInput({
    date: '2026-07-10',
    partnerName: 'Md. Mizanur Rahman',
    amount: '150000.345',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.cleanAmount, 150000.35);
});

test('aggregatePartnerShares deducts partner withdrawals, recalculates equity %, and clamps overdrawn equity at 0%', () => {
  const deposits: PartnerDepositRecord[] = [
    {
      id: 'd1',
      date: '2026-07-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 500000,
      createdAt: '2026-07-01T08:00:00Z',
    },
    {
      id: 'd2',
      date: '2026-07-01',
      partnerName: 'Md. Sohel Rana',
      amount: 300000,
      createdAt: '2026-07-01T09:00:00Z',
    },
    {
      id: 'd3',
      date: '2026-07-01',
      partnerName: 'Tariqul Islam',
      amount: 200000,
      createdAt: '2026-07-01T10:00:00Z',
    },
  ];

  // Partial withdrawal by Mizanur (300,000): Net capital = 700,000
  // Mizanur = 200k (28.57%), Sohel = 300k (42.86%), Tariqul = 200k (28.57%)
  const partialWithdrawals: PartnerWithdrawalRecord[] = [
    {
      id: 'w1',
      date: '2026-07-05',
      partnerName: 'Md. Mizanur Rahman',
      amount: 300000,
      createdAt: '2026-07-05T08:00:00Z',
    },
  ];

  const partialRes = aggregatePartnerShares(deposits, partialWithdrawals);
  assert.equal(partialRes.totalPartnerDeposit, 1000000);
  assert.equal(partialRes.totalPartnerWithdrawal, 300000);
  assert.equal(partialRes.netPartnerCapital, 700000);
  assert.equal(partialRes.partnerShares[0].partnerName, 'Md. Sohel Rana');
  assert.equal(partialRes.partnerShares[0].netContribution, 300000);
  assert.equal(partialRes.partnerShares[0].sharePercent, 42.86);

  const mizanurPartial = partialRes.partnerShares.find(
    (s) => s.partnerName === 'Md. Mizanur Rahman'
  );
  assert.ok(mizanurPartial);
  assert.equal(mizanurPartial.totalDeposited, 500000);
  assert.equal(mizanurPartial.totalWithdrawn, 300000);
  assert.equal(mizanurPartial.netContribution, 200000);
  assert.equal(mizanurPartial.withdrawalCount, 1);
  assert.equal(mizanurPartial.lastWithdrawalDate, '2026-07-05');
  assert.equal(mizanurPartial.sharePercent, 28.57);

  // Overdraw edge case: Tariqul withdraws 250,000 (50k more than deposit)
  // Equity clamps to 0% for Tariqul; positive pool = 200k + 300k = 500k (Sohel 60%, Mizanur 40%)
  const overdrawWithdrawals: PartnerWithdrawalRecord[] = [
    ...partialWithdrawals,
    {
      id: 'w2',
      date: '2026-07-06',
      partnerName: 'Tariqul Islam',
      amount: 250000,
      createdAt: '2026-07-06T08:00:00Z',
    },
  ];
  const overdrawRes = aggregatePartnerShares(deposits, overdrawWithdrawals);
  assert.equal(overdrawRes.netPartnerCapital, 450000);
  const tariqul = overdrawRes.partnerShares.find((s) => s.partnerName === 'Tariqul Islam');
  const sohel = overdrawRes.partnerShares.find((s) => s.partnerName === 'Md. Sohel Rana');
  const mizanur = overdrawRes.partnerShares.find((s) => s.partnerName === 'Md. Mizanur Rahman');
  assert.ok(tariqul && sohel && mizanur);
  assert.equal(tariqul.netContribution, -50000);
  assert.equal(tariqul.sharePercent, 0);
  assert.equal(sohel.sharePercent, 60);
  assert.equal(mizanur.sharePercent, 40);
});

test('partner withdrawals flow into calculateTotalBalanceSummary, ledger entries, equity roster, and 12-month trend', () => {
  const partnerDeposits: PartnerDepositRecord[] = [
    {
      id: 'dep-1',
      date: '2026-06-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 500000,
      createdAt: '2026-06-01T08:00:00Z',
    },
    {
      id: 'dep-2',
      date: '2026-06-01',
      partnerName: 'Md. Sohel Rana',
      amount: 500000,
      createdAt: '2026-06-01T09:00:00Z',
    },
  ];
  const partnerWithdrawals: PartnerWithdrawalRecord[] = [
    {
      id: 'wdr-1',
      date: '2026-07-10',
      partnerName: 'Md. Mizanur Rahman',
      amount: 200000,
      paymentMethod: 'Bank Transfer',
      referenceNo: 'CHQ-101',
      notes: 'Equity draw',
      createdAt: '2026-07-10T10:00:00Z',
    },
  ];
  const balanceIncomes: BalanceIncomeRecord[] = [
    {
      id: 'inc-1',
      date: '2026-07-15',
      source: 'Export Settlement Bonus',
      amount: 100000,
      description: 'Settlement',
      createdAt: '2026-07-15T10:00:00Z',
    },
  ];
  const otherCosts: OtherCostRecord[] = [
    {
      id: 'cost-1',
      date: '2026-07-20',
      category: 'Air Freight & Cargo',
      amount: 50000,
      description: 'Airway bill',
      createdAt: '2026-07-20T10:00:00Z',
    },
  ];

  const summary = calculateTotalBalanceSummary({
    partnerDeposits,
    partnerWithdrawals,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
  });

  // Net partner capital = 1,000,000 - 200,000 = 800,000; + 100,000 income - 50,000 cost = 850,000
  assert.equal(summary.totalPartnerDeposit, 1000000);
  assert.equal(summary.totalPartnerWithdrawal, 200000);
  assert.equal(summary.partnerWithdrawalCount, 1);
  assert.equal(summary.netPartnerCapital, 800000);
  assert.equal(summary.totalBalance, 850000);

  const ledger = buildTotalBalanceLedgerEntries({
    partnerDeposits,
    partnerWithdrawals,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
    order: 'chronological',
  });
  assert.equal(ledger.length, 5);
  assert.equal(ledger[2].id, 'wdr_wdr-1');
  assert.equal(ledger[2].type, 'partner_withdrawal');
  assert.equal(ledger[2].deletableType, 'partner_withdrawal');
  assert.equal(ledger[2].debitAmount, 200000);
  assert.equal(ledger[2].runningBalance, 800000);
  assert.equal(ledger[4].runningBalance, 850000);

  const filteredWithdrawals = filterBalanceLedgerEntries(ledger, {
    typeFilter: 'partner_withdrawal',
  });
  assert.equal(filteredWithdrawals.length, 1);
  assert.equal(filteredWithdrawals[0].title, 'Md. Mizanur Rahman');

  const dir = buildPartnerDirectory(
    { managingPartner: 'Md. Mizanur Rahman', partner: 'Md. Sohel Rana' },
    partnerDeposits,
    partnerWithdrawals
  );
  const roster = buildPartnerEquityRoster(dir, summary.partnerShares);
  assert.equal(roster.totalCapitalDeposited, 1000000);
  assert.equal(roster.totalCapitalWithdrawn, 200000);
  assert.equal(roster.totalNetPartnerCapital, 800000);
  assert.equal(roster.items[0].partnerName, 'Md. Sohel Rana');
  assert.equal(roster.items[0].equityPercent, 62.5);
  assert.equal(roster.items[1].partnerName, 'Md. Mizanur Rahman');
  assert.equal(roster.items[1].equityPercent, 37.5);

  const trend = buildMonthlyTotalBalanceTrend({
    partnerDeposits,
    partnerWithdrawals,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
    endYearMonth: '2026-07',
    monthsCount: 12,
  });
  assert.equal(trend.currentBalance, summary.totalBalance);
  const julyPoint = trend.points.find((p) => p.yearMonth === '2026-07');
  assert.ok(julyPoint);
  assert.equal(julyPoint.partnerWithdrawal, 200000);
  assert.equal(julyPoint.endingTotalBalance, 850000);
});

test('calculateMonthlyNetProfitForDistribution computes monthly revenue, cost, net profit, and remaining distributable pool', () => {
  const packings: PackingRecord[] = [
    {
      id: 'pkg-nov',
      invoiceNumber: 'INV-NOV',
      shippingMark: 'CAN-1',
      flight: 'CZ-392',
      destination: 'Guangzhou',
      shipper: 'ZSB',
      packingDate: '2026-11-05',
      fromDate: '2026-11-05',
      toDate: '2026-11-05',
      items: [],
      totalBox: 10,
      totalWeight: 200,
      totalAmount: 10000,
      rmbRate: 17, // 170,000 BDT
      createdAt: '2026-11-05T10:00:00Z',
    },
    {
      id: 'pkg-oct',
      invoiceNumber: 'INV-OCT',
      shippingMark: 'CAN-0',
      flight: 'CZ-391',
      destination: 'Guangzhou',
      shipper: 'ZSB',
      packingDate: '2026-10-20',
      fromDate: '2026-10-20',
      toDate: '2026-10-20',
      items: [],
      totalBox: 5,
      totalWeight: 100,
      totalAmount: 5000,
      rmbRate: 17, // Excluded from 2026-11
      createdAt: '2026-10-20T10:00:00Z',
    },
  ];
  const balanceIncomes: BalanceIncomeRecord[] = [
    {
      id: 'inc-nov',
      date: '2026-11-12',
      source: 'Settlement Bonus',
      amount: 80000,
      description: 'November bonus',
      createdAt: '2026-11-12T08:00:00Z',
    },
  ];
  const purchases: PurchaseRecord[] = [
    {
      id: 'pur-nov',
      invoiceNumber: 'PUR-NOV',
      date: '2026-11-03',
      description: 'Crab Supplier',
      contactNumber: '017',
      items: [],
      totalQty: 100,
      totalAmount: 100000,
      previousAmount: 0,
      paidAmount: 100000,
      balance: 0,
      createdAt: '2026-11-03T08:00:00Z',
    },
  ];
  const otherCosts: OtherCostRecord[] = [
    {
      id: 'cost-nov',
      date: '2026-11-08',
      category: 'Air Freight & Cargo',
      amount: 50000,
      description: 'Freight',
      createdAt: '2026-11-08T08:00:00Z',
    },
  ];
  const profitDistributions: ProfitDistributionRecord[] = [
    {
      id: 'pdist-1',
      targetYearMonth: '2026-11',
      payoutDate: '2026-11-15',
      calculatedNetProfit: 100000,
      distributedAmount: 40000,
      retainedAmount: 60000,
      allocations: [],
      createdAt: '2026-11-15T10:00:00Z',
    },
  ];

  const breakdown = calculateMonthlyNetProfitForDistribution({
    yearMonth: '2026-11',
    packings,
    balanceIncomes,
    purchases,
    otherCosts,
    profitDistributions,
  });

  // Income = 170,000 + 80,000 = 250,000; Cost = 100,000 + 50,000 = 150,000; Net = 100,000; Remaining = 60,000
  assert.equal(breakdown.exportRevenue, 170000);
  assert.equal(breakdown.directIncome, 80000);
  assert.equal(breakdown.totalMonthlyIncome, 250000);
  assert.equal(breakdown.purchasingCost, 100000);
  assert.equal(breakdown.operatingCost, 50000);
  assert.equal(breakdown.totalMonthlyCost, 150000);
  assert.equal(breakdown.netMonthlyProfit, 100000);
  assert.equal(breakdown.alreadyDistributedForMonth, 40000);
  assert.equal(breakdown.remainingDistributableProfit, 60000);
});

test('calculateProfitDistributionAllocation allocates proportionally by equity with exact cent reconciliation', () => {
  const deposits: PartnerDepositRecord[] = [
    {
      id: 'd1',
      date: '2026-07-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 400000,
      createdAt: '2026-07-01T08:00:00Z',
    },
    {
      id: 'd2',
      date: '2026-07-01',
      partnerName: 'Md. Sohel Rana',
      amount: 300000,
      createdAt: '2026-07-01T09:00:00Z',
    },
    {
      id: 'd3',
      date: '2026-07-01',
      partnerName: 'Tariqul Islam',
      amount: 200000,
      createdAt: '2026-07-01T10:00:00Z',
    },
  ];

  const { partnerShares } = aggregatePartnerShares(deposits);
  const roster = buildPartnerEquityRoster(
    ['Md. Mizanur Rahman', 'Md. Sohel Rana', 'Tariqul Islam', 'Zero Equity Partner'],
    partnerShares
  );

  // Even for non-terminating thirds/ninths + 100,000.01 pool, sum of payouts equals pool exactly
  const alloc = calculateProfitDistributionAllocation(100000.01, roster);
  assert.equal(alloc.hasEligiblePartners, true);
  assert.equal(alloc.totalAllocated, 100000.01);
  assert.equal(alloc.allocations.length, 4);
  const zeroPartner = alloc.allocations.find((a) => a.partnerName === 'Zero Equity Partner');
  assert.ok(zeroPartner);
  assert.equal(zeroPartner.payoutAmount, 0);

  // Clean 50 / 30 / 20 split for TK 200,000
  const cleanDeposits: PartnerDepositRecord[] = [
    { ...deposits[0], amount: 500000 },
    { ...deposits[1], amount: 300000 },
    { ...deposits[2], amount: 200000 },
  ];
  const cleanRoster = buildPartnerEquityRoster(
    ['Md. Mizanur Rahman', 'Md. Sohel Rana', 'Tariqul Islam'],
    aggregatePartnerShares(cleanDeposits).partnerShares
  );
  const cleanAlloc = calculateProfitDistributionAllocation(200000, cleanRoster);
  assert.deepEqual(
    cleanAlloc.allocations.map((a) => a.payoutAmount),
    [100000, 60000, 40000]
  );
  assert.equal(cleanAlloc.totalAllocated, 200000);
});

test('validateProfitDistributionInput and ProfitDistributionRecord integrate cleanly with Total Balance without altering partner equity', () => {
  assert.equal(
    validateProfitDistributionInput({
      targetYearMonth: 'bad',
      payoutDate: '2026-11-20',
      totalAmount: 10000,
      allocations: [{ partnerName: 'A', equityPercent: 100, payoutAmount: 10000 }],
    }).valid,
    false
  );
  assert.equal(
    validateProfitDistributionInput({
      targetYearMonth: '2026-11',
      payoutDate: '2026-11-20',
      totalAmount: 10000,
      allocations: [{ partnerName: 'A', equityPercent: 0, payoutAmount: 0 }],
    }).valid,
    false
  );

  const partnerDeposits: PartnerDepositRecord[] = [
    {
      id: 'dep-1',
      date: '2026-11-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 600000,
      createdAt: '2026-11-01T08:00:00Z',
    },
    {
      id: 'dep-2',
      date: '2026-11-01',
      partnerName: 'Md. Sohel Rana',
      amount: 400000,
      createdAt: '2026-11-01T09:00:00Z',
    },
  ];
  const balanceIncomes: BalanceIncomeRecord[] = [
    {
      id: 'inc-1',
      date: '2026-11-10',
      source: 'Export Bonus',
      amount: 250000,
      description: 'Monthly income',
      createdAt: '2026-11-10T08:00:00Z',
    },
  ];
  const otherCosts: OtherCostRecord[] = [
    {
      id: 'cost-1',
      date: '2026-11-12',
      category: 'Air Freight & Cargo',
      amount: 50000,
      description: 'Cargo fee',
      createdAt: '2026-11-12T08:00:00Z',
    },
  ];
  const profitDistributions: ProfitDistributionRecord[] = [
    {
      id: 'pdist-1',
      targetYearMonth: '2026-11',
      payoutDate: '2026-11-20',
      calculatedNetProfit: 200000,
      distributedAmount: 150000,
      retainedAmount: 50000,
      paymentMethod: 'Bank Transfer',
      referenceNo: 'DIV-2026-11',
      notes: 'Monthly dividend payout',
      allocations: [
        { partnerName: 'Md. Mizanur Rahman', equityPercent: 60, payoutAmount: 90000 },
        { partnerName: 'Md. Sohel Rana', equityPercent: 40, payoutAmount: 60000 },
      ],
      createdAt: '2026-11-20T10:00:00Z',
    },
  ];

  const summary = calculateTotalBalanceSummary({
    partnerDeposits,
    profitDistributions,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
  });

  // Total Balance = 1,000,000 + 250,000 - 50,000 - 150,000 = 1,050,000
  // Partner capital remains 1,000,000 (60% / 40% equity intact)
  assert.equal(summary.netPartnerCapital, 1000000);
  assert.equal(summary.totalProfitDistributed, 150000);
  assert.equal(summary.profitDistributionCount, 1);
  assert.equal(summary.totalBalance, 1050000);
  assert.equal(summary.partnerShares[0].sharePercent, 60);
  assert.equal(summary.partnerShares[1].sharePercent, 40);

  const ledger = buildTotalBalanceLedgerEntries({
    partnerDeposits,
    profitDistributions,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
    order: 'chronological',
  });
  const distRow = ledger.find((r) => r.type === 'profit_distribution');
  assert.ok(distRow);
  assert.equal(distRow.id, 'pdist_pdist-1');
  assert.equal(distRow.deletableType, 'profit_distribution');
  assert.equal(distRow.debitAmount, 150000);
  assert.equal(distRow.runningBalance, 1050000);

  const filtered = filterBalanceLedgerEntries(ledger, { typeFilter: 'profit_distribution' });
  assert.equal(filtered.length, 1);

  const trend = buildMonthlyTotalBalanceTrend({
    partnerDeposits,
    profitDistributions,
    balanceIncomes,
    purchases: [],
    packings: [],
    otherCosts,
    endYearMonth: '2026-11',
    monthsCount: 12,
  });
  assert.equal(trend.currentBalance, summary.totalBalance);
  const novPoint = trend.points.find((p) => p.yearMonth === '2026-11');
  assert.ok(novPoint);
  assert.equal(novPoint.profitDistribution, 150000);
  assert.equal(novPoint.endingTotalBalance, 1050000);
});

test('externalDebts automatically deduct from Total Balance, running ledger, and monthly trend', () => {
  const partnerDeposits: PartnerDepositRecord[] = [
    {
      id: 'dep-ext-1',
      date: '2026-11-01',
      partnerName: 'Md. Mizanur Rahman',
      amount: 1000000,
      createdAt: '2026-11-01T08:00:00Z',
    },
  ];
  const externalDebts = [
    {
      id: 'debt-ext-1',
      title: 'Working Capital Loan',
      lenderName: 'Islami Bank',
      category: 'Bank Business Loan',
      originationDate: '2026-11-10',
      principalAmount: 200000,
      interestAmount: 10000,
      frequency: 'monthly' as const,
      installmentCount: 6,
      firstDueDate: '2026-12-10',
      repayments: [
        {
          id: 'rep-ext-1',
          date: '2026-11-12',
          amount: 35000,
          createdAt: '2026-11-12T10:00:00Z',
        },
      ],
      createdAt: '2026-11-10T09:00:00Z',
    },
  ];

  const summary = calculateTotalBalanceSummary({
    partnerDeposits,
    externalDebts,
    balanceIncomes: [],
    purchases: [],
    packings: [],
    otherCosts: [],
  });

  // 1,000,000 - 210,000 (200k principal + 10k interest) = 790,000
  assert.equal(summary.totalExternalDebtPrincipal, 200000);
  assert.equal(summary.totalExternalDebtObligation, 210000);
  assert.equal(summary.totalExternalDebtPaid, 35000);
  assert.equal(summary.totalExternalDebtOutstanding, 175000);
  assert.equal(summary.externalDebtCount, 1);
  assert.equal(summary.activeExternalDebtCount, 1);
  assert.equal(summary.totalBalance, 790000);

  const ledger = buildTotalBalanceLedgerEntries({
    partnerDeposits,
    externalDebts,
    balanceIncomes: [],
    purchases: [],
    packings: [],
    otherCosts: [],
    order: 'chronological',
  });
  const debtRow = ledger.find((r) => r.type === 'external_debt');
  assert.ok(debtRow);
  assert.equal(debtRow.debitAmount, 210000);
  assert.equal(debtRow.deletableType, 'external_debt');
  assert.equal(debtRow.runningBalance, 790000);

  const filtered = filterBalanceLedgerEntries(ledger, { typeFilter: 'external_debt' });
  assert.equal(filtered.length, 1);

  const trend = buildMonthlyTotalBalanceTrend({
    partnerDeposits,
    externalDebts,
    balanceIncomes: [],
    purchases: [],
    packings: [],
    otherCosts: [],
    endYearMonth: '2026-11',
    monthsCount: 12,
  });
  assert.equal(trend.currentBalance, 790000);
  const novPoint = trend.points.find((p) => p.yearMonth === '2026-11');
  assert.ok(novPoint);
  assert.equal(novPoint.externalDebtDeducted, 210000);
  assert.equal(novPoint.endingTotalBalance, 790000);
});




