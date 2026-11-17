import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  BalanceLedgerEntryType,
  DEFAULT_TARGET_PARTNER_COUNT,
  INCOME_SOURCE_PRESETS,
  PARTNER_CAPITAL_CHART_COLORS,
  PARTNER_PAYMENT_METHODS,
  buildMonthlyTotalBalanceTrend,
  buildPartnerDirectory,
  buildPartnerEquityRoster,
  buildTotalBalanceLedgerEntries,
  calculateTotalBalanceSummary,
  filterBalanceLedgerEntries,
  validateBalanceCostInput,
  validateBalanceIncomeInput,
  validatePartnerDepositInput,
  validatePartnerWithdrawalInput,
} from '../utils/totalBalance.ts';
import { exportElementToPdf } from '../utils/pdfGenerator.ts';
import { yieldForDomFrame } from '../utils/pdfExportStyles.ts';
import { buildPartnerFinancialStatementData } from '../utils/partnerFinancialStatement.ts';
import { ExternalDebtsCard } from './ExternalDebtsCard.tsx';
import { PartnerCapitalChartCard } from './PartnerCapitalChartCard.tsx';
import { PartnerEmailNotificationCard } from './PartnerEmailNotificationCard.tsx';
import { PartnerEquitySummaryCard } from './PartnerEquitySummaryCard.tsx';
import { PartnerFinancialStatementPrintDocument } from './PartnerFinancialStatementPrintDocument.tsx';
import { ProfitDistributionCard } from './ProfitDistributionCard.tsx';
import { RecurringExpensesCard } from './RecurringExpensesCard.tsx';
import { TotalBalanceTrendChartCard } from './TotalBalanceTrendChartCard.tsx';
import { TransactionLedgerCard } from './TransactionLedgerCard.tsx';
import {
  ArrowDownLeft,
  Coins,
  FileDown,
  FileSpreadsheet,
  Loader2,
  MinusCircle,
  Plus,
  PlusCircle,
  Printer,
  RotateCcw,
  Scale,
  Search,
  Trash2,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

export const TotalBalanceView: React.FC = () => {
  const {
    companyProfile,
    dropdownOptions,
    purchases,
    packings,
    otherCosts,
    addOtherCost,
    deleteOtherCost,
    partnerDeposits,
    addPartnerDeposit,
    deletePartnerDeposit,
    partnerWithdrawals,
    addPartnerWithdrawal,
    deletePartnerWithdrawal,
    profitDistributions,
    issueProfitDistribution,
    deleteProfitDistribution,
    balanceIncomes,
    addBalanceIncome,
    deleteBalanceIncome,
    recurringExpenses,
    addRecurringExpense,
    toggleRecurringExpenseAutoDeduct,
    deleteRecurringExpense,
    runDueRecurringExpensesNow,
    deductRecurringExpenseNow,
    externalDebts,
    addExternalDebt,
    recordExternalDebtRepayment,
    deleteExternalDebtRepayment,
    deleteExternalDebt,
    addCompanyPartner,
    removeCompanyPartner,
    setPartnerEmail,
    setPartnerAlertsEnabled,
    partnerNotifications,
    clearPartnerNotifications,
    exportCurrentViewToPdf,
    isExportingGlobalPdf,
    addAuditLog,
    showToast,
    setActiveTab,
  } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const currency = companyProfile.currency || 'TK';
  const [isExportingFinancialStatement, setIsExportingFinancialStatement] = useState(false);

  // Partner Deposit Form State
  const [depositDate, setDepositDate] = useState(today);
  const [partnerName, setPartnerName] = useState(
    companyProfile.managingPartner || 'Md. Mizanur Rahman'
  );
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>(PARTNER_PAYMENT_METHODS[0]);
  const [depositRef, setDepositRef] = useState('');
  const [depositNotes, setDepositNotes] = useState('');
  const [depositError, setDepositError] = useState('');

  // Partner Withdrawals Form State
  const [withdrawalDate, setWithdrawalDate] = useState(today);
  const [withdrawalPartnerName, setWithdrawalPartnerName] = useState(
    companyProfile.managingPartner || 'Md. Mizanur Rahman'
  );
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>(PARTNER_PAYMENT_METHODS[0]);
  const [withdrawalRef, setWithdrawalRef] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [withdrawalError, setWithdrawalError] = useState('');

  // Add / Delete Partner State (Supports 4+ Company Partners)
  const [showAddPartnerForm, setShowAddPartnerForm] = useState(false);
  const [newPartnerNameInput, setNewPartnerNameInput] = useState('');
  const [newPartnerEmailInput, setNewPartnerEmailInput] = useState('');
  const [addPartnerError, setAddPartnerError] = useState('');

  const [showDeletePartnerForm, setShowDeletePartnerForm] = useState(false);
  const [deletePartnerTarget, setDeletePartnerTarget] = useState('');
  const [purgeDeletedPartnerEntries, setPurgeDeletedPartnerEntries] = useState(true);
  const [deletePartnerError, setDeletePartnerError] = useState('');

  // Costing Deduction (-) vs Income Addition (+) Form State
  const [entryMode, setEntryMode] = useState<'cost' | 'income'>('cost');
  const [entryDate, setEntryDate] = useState(today);
  const [costCategory, setCostCategory] = useState(
    dropdownOptions.costingCategories[0] || 'Air Freight & Cargo'
  );
  const [incomeSource, setIncomeSource] = useState<string>(INCOME_SOURCE_PRESETS[0]);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryRef, setEntryRef] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryError, setEntryError] = useState('');

  // Unified Ledger Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<BalanceLedgerEntryType | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const summary = useMemo(
    () =>
      calculateTotalBalanceSummary({
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
        externalDebts,
        balanceIncomes,
        purchases,
        packings,
        otherCosts,
      }),
    [
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions,
      externalDebts,
      balanceIncomes,
      purchases,
      packings,
      otherCosts,
    ]
  );

  const partnerDirectory = useMemo(
    () => buildPartnerDirectory(companyProfile, partnerDeposits, partnerWithdrawals),
    [companyProfile, partnerDeposits, partnerWithdrawals]
  );

  const partnerEquityRoster = useMemo(
    () => buildPartnerEquityRoster(partnerDirectory, summary.partnerShares),
    [partnerDirectory, summary.partnerShares]
  );

  const monthlyTrend = useMemo(
    () =>
      buildMonthlyTotalBalanceTrend({
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
        externalDebts,
        balanceIncomes,
        purchases,
        packings,
        otherCosts,
      }),
    [
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions,
      externalDebts,
      balanceIncomes,
      purchases,
      packings,
      otherCosts,
    ]
  );

  const allLedgerEntries = useMemo(
    () =>
      buildTotalBalanceLedgerEntries({
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
        externalDebts,
        balanceIncomes,
        purchases,
        packings,
        otherCosts,
        order: 'newest',
      }),
    [
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions,
      externalDebts,
      balanceIncomes,
      purchases,
      packings,
      otherCosts,
    ]
  );

  const filteredEntries = useMemo(
    () =>
      filterBalanceLedgerEntries(allLedgerEntries, {
        query: searchQuery,
        typeFilter,
        startDate,
        endDate,
      }),
    [allLedgerEntries, searchQuery, typeFilter, startDate, endDate]
  );

  const selectedWithdrawalPartnerStats = useMemo(() => {
    const key = withdrawalPartnerName.trim().toLowerCase();
    return partnerEquityRoster.items.find((p) => p.partnerKey === key);
  }, [partnerEquityRoster.items, withdrawalPartnerName]);

  const financialStatementData = useMemo(
    () =>
      buildPartnerFinancialStatementData({
        companyProfile,
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
        externalDebts,
        balanceIncomes,
        purchases,
        packings,
        otherCosts,
        referenceDate: today,
      }),
    [
      companyProfile,
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions,
      externalDebts,
      balanceIncomes,
      purchases,
      packings,
      otherCosts,
      today,
    ]
  );

  const handleExportFinancialStatement = async () => {
    setIsExportingFinancialStatement(true);
    try {
      await yieldForDomFrame();
      const success = await exportElementToPdf(
        'partner-financial-statement-printable',
        financialStatementData.filename
      );
      if (success) {
        addAuditLog({
          action: 'EXPORT',
          module: 'PartnerDeposit',
          entityId: financialStatementData.statementRef,
          summary: `Exported Partner Financial Statement PDF (${financialStatementData.filename})`,
          details: `${financialStatementData.equityDistribution.length} partners · ${financialStatementData.currentDeposits.length} deposits · ${financialStatementData.recentWithdrawals.length} recent withdrawals`,
        });
        showToast(`Financial Statement PDF exported: ${financialStatementData.filename}`);
      } else {
        showToast('Could not generate Financial Statement PDF.');
      }
    } catch (err) {
      console.error('Export Financial Statement PDF failed:', err);
      showToast('Error generating Financial Statement PDF.');
    } finally {
      setIsExportingFinancialStatement(false);
    }
  };

  const handlePartnerDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validatePartnerDepositInput({
      date: depositDate,
      partnerName,
      amount: depositAmount,
    });
    if (!check.valid || check.cleanAmount === undefined) {
      setDepositError(check.error || 'Invalid partner deposit share input.');
      return;
    }
    setDepositError('');
    addPartnerDeposit({
      date: depositDate,
      partnerName: partnerName.trim(),
      amount: check.cleanAmount,
      paymentMethod: paymentMethod.trim() || 'Bank Transfer',
      referenceNo: depositRef.trim() || undefined,
      notes: depositNotes.trim() || undefined,
    });
    setDepositAmount('');
    setDepositRef('');
    setDepositNotes('');
  };

  const handlePartnerWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validatePartnerWithdrawalInput({
      date: withdrawalDate,
      partnerName: withdrawalPartnerName,
      amount: withdrawalAmount,
    });
    if (!check.valid || check.cleanAmount === undefined) {
      setWithdrawalError(check.error || 'Invalid partner withdrawal input.');
      return;
    }
    setWithdrawalError('');
    addPartnerWithdrawal({
      date: withdrawalDate,
      partnerName: withdrawalPartnerName.trim(),
      amount: check.cleanAmount,
      paymentMethod: withdrawalMethod.trim() || 'Bank Transfer',
      referenceNo: withdrawalRef.trim() || undefined,
      notes: withdrawalNotes.trim() || undefined,
    });
    setWithdrawalAmount('');
    setWithdrawalRef('');
    setWithdrawalNotes('');
  };

  const handleSaveNewPartner = () => {
    const res = addCompanyPartner(newPartnerNameInput, newPartnerEmailInput);
    if (!res.valid || !res.cleanName) {
      setAddPartnerError(res.error || 'Please enter a valid partner name.');
      return;
    }
    setAddPartnerError('');
    setPartnerName(res.cleanName);
    setNewPartnerNameInput('');
    setNewPartnerEmailInput('');
    setShowAddPartnerForm(false);
  };

  const primaryPartnerKeys = useMemo(
    () =>
      new Set(
        [companyProfile.managingPartner, companyProfile.partner]
          .map((p) => (p || '').trim().toLowerCase())
          .filter(Boolean)
      ),
    [companyProfile.managingPartner, companyProfile.partner]
  );

  const deletablePartners = useMemo(
    () =>
      partnerDirectory.filter(
        (p) => !primaryPartnerKeys.has(p.trim().toLowerCase())
      ),
    [partnerDirectory, primaryPartnerKeys]
  );

  const selectedDeletePartnerStats = useMemo(() => {
    const key = deletePartnerTarget.trim().toLowerCase();
    return partnerEquityRoster.items.find((p) => p.partnerKey === key);
  }, [partnerEquityRoster.items, deletePartnerTarget]);

  const handleConfirmDeletePartner = () => {
    const target = deletePartnerTarget.trim();
    if (!target) {
      setDeletePartnerError('Please select a partner to delete.');
      return;
    }
    if (primaryPartnerKeys.has(target.toLowerCase())) {
      setDeletePartnerError('Primary signatory partners can only be changed in Settings.');
      return;
    }
    setDeletePartnerError('');
    removeCompanyPartner(target, { purgeEntries: purgeDeletedPartnerEntries });
    const fallbackName = companyProfile.managingPartner || 'Md. Mizanur Rahman';
    if (partnerName.trim().toLowerCase() === target.toLowerCase()) {
      setPartnerName(fallbackName);
    }
    if (withdrawalPartnerName.trim().toLowerCase() === target.toLowerCase()) {
      setWithdrawalPartnerName(fallbackName);
    }
    setDeletePartnerTarget('');
    setShowDeletePartnerForm(false);
  };

  const handleCostOrIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryMode === 'cost') {
      const check = validateBalanceCostInput({
        date: entryDate,
        category: costCategory,
        amount: entryAmount,
      });
      if (!check.valid || check.cleanAmount === undefined) {
        setEntryError(check.error || 'Invalid costing deduction.');
        return;
      }
      setEntryError('');
      addOtherCost({
        date: entryDate,
        category: costCategory.trim(),
        amount: check.cleanAmount,
        description: entryDescription.trim() || `${costCategory.trim()} (Deducted from Total Balance)`,
        refInvoice: entryRef.trim() || undefined,
      });
    } else {
      const check = validateBalanceIncomeInput({
        date: entryDate,
        source: incomeSource,
        amount: entryAmount,
      });
      if (!check.valid || check.cleanAmount === undefined) {
        setEntryError(check.error || 'Invalid income entry.');
        return;
      }
      setEntryError('');
      addBalanceIncome({
        date: entryDate,
        source: incomeSource.trim(),
        amount: check.cleanAmount,
        description: entryDescription.trim() || incomeSource.trim(),
        refInvoice: entryRef.trim() || undefined,
      });
    }
    setEntryAmount('');
    setEntryRef('');
    setEntryDescription('');
  };

  const handleDeleteLedgerRow = (
    deletableType:
      | 'partner_deposit'
      | 'partner_withdrawal'
      | 'profit_distribution'
      | 'external_debt'
      | 'other_income'
      | 'other_cost'
      | undefined,
    recordId: string
  ) => {
    if (!deletableType) return;
    if (deletableType === 'partner_deposit') {
      deletePartnerDeposit(recordId);
    } else if (deletableType === 'partner_withdrawal') {
      deletePartnerWithdrawal(recordId);
    } else if (deletableType === 'profit_distribution') {
      deleteProfitDistribution(recordId);
    } else if (deletableType === 'external_debt') {
      deleteExternalDebt(recordId);
    } else if (deletableType === 'other_income') {
      deleteBalanceIncome(recordId);
    } else if (deletableType === 'other_cost') {
      deleteOtherCost(recordId);
    }
  };

  const resetLedgerFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || typeFilter !== 'all' || startDate !== '' || endDate !== '';

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Corporate Navy Page Header */}
      <div className="bg-[#273E56] rounded-xl p-5 sm:p-6 text-white shadow-sm border border-[#385775]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-sky-200 tracking-wide">
              Sheet 17 · Partner Deposit Share, Income &amp; All Costing
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
              <span className="text-[#fbbf24] zsb-golden-brand font-black">
                {companyProfile.companyName || 'ZSB AQUATICS'}
              </span>
              <span className="text-white/40 font-normal">/</span>
              <span className="text-white">TOTAL BALANCE</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-200">
              Partner Deposit Share Capital + Export &amp; Other Income &minus; All Procurement &amp; Operating Costing
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('profit_loss')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/20 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Loss &amp; Profit</span>
            </button>
            <button
              type="button"
              onClick={() => void exportCurrentViewToPdf({ openPreviewOnly: true })}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/20 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Print Statement</span>
            </button>
            <button
              type="button"
              data-testid="export-financial-statement-btn"
              onClick={() => void handleExportFinancialStatement()}
              disabled={isExportingFinancialStatement}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border border-[#fbbf24]/70 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isExportingFinancialStatement ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Export Financial Statement</span>
            </button>
            <button
              type="button"
              onClick={() => void exportCurrentViewToPdf({ openPreviewOnly: false })}
              disabled={isExportingGlobalPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-white/20 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isExportingGlobalPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <FileDown className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Single-Row 4-Card Total Balance Equation Strip */}
      <div
        data-testid="total-balance-kpi-strip"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              {summary.totalPartnerWithdrawal > 0
                ? 'Net Partner Capital (+ / −)'
                : 'Partner Deposit Share (+)'}
            </span>
            <Users className="w-4 h-4 text-[#1D6CE0] shrink-0" />
          </div>
          <div
            data-testid="kpi-partner-deposit-total"
            className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900"
          >
            {formatCurrency(summary.netPartnerCapital, currency)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between gap-2 font-mono tabular-nums whitespace-nowrap">
            {summary.totalPartnerWithdrawal > 0 ? (
              <>
                <span>Dep: {currency} {Math.round(summary.totalPartnerDeposit).toLocaleString()}</span>
                <span className="text-rose-700 font-semibold">
                  W/D: &minus;{currency} {Math.round(summary.totalPartnerWithdrawal).toLocaleString()}
                </span>
              </>
            ) : (
              <span>
                {summary.partnerShares.length} Partner(s) · {summary.partnerDepositCount} Deposit(s)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Total Income Added (+)
            </span>
            <PlusCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
          </div>
          <div
            data-testid="kpi-income-total"
            className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700"
          >
            {formatCurrency(summary.totalIncomeAdded, currency)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between gap-2 font-mono tabular-nums whitespace-nowrap">
            <span>Export: {currency} {Math.round(summary.exportValueIncome).toLocaleString()}</span>
            <span>Other: {currency} {Math.round(summary.manualIncome).toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              All Costing Deducted (&minus;)
            </span>
            <MinusCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
          </div>
          <div
            data-testid="kpi-costing-total"
            className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-700"
          >
            {formatCurrency(summary.totalCostingDeducted, currency)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between gap-2 font-mono tabular-nums whitespace-nowrap">
            <span>Purchase: {currency} {Math.round(summary.totalPurchasingCost).toLocaleString()}</span>
            <span>Other: {currency} {Math.round(summary.totalOtherCosting).toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#CBD8E6] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              TOTAL BALANCE (=)
            </span>
            <Scale
              className={`w-4 h-4 shrink-0 ${
                summary.totalBalance >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            />
          </div>
          <div
            data-testid="kpi-net-total-balance"
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              summary.totalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(summary.totalBalance, currency)}
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-600 flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
            <span
              className={
                summary.totalBalance >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
              }
            >
              {summary.totalBalance >= 0 ? 'Surplus Balance' : 'Balance Deficit'}
            </span>
            <span aria-hidden="true">·</span>
            {summary.totalExternalDebtObligation > 0 ? (
              <span className="font-mono tabular-nums text-rose-700 font-semibold">
                Debt: &minus;{currency} {Math.round(summary.totalExternalDebtObligation).toLocaleString()}
              </span>
            ) : summary.totalProfitDistributed > 0 ? (
              <span className="font-mono tabular-nums text-rose-700 font-semibold">
                Profit Paid: &minus;{currency} {Math.round(summary.totalProfitDistributed).toLocaleString()}
              </span>
            ) : (
              <span>{allLedgerEntries.length} Entries</span>
            )}
          </div>
        </div>
      </div>

      {/* Partner Equity & Deposit Summary Card */}
      <PartnerEquitySummaryCard roster={partnerEquityRoster} currency={currency} />

      {/* Row 1: Partner Capital Forms — Partner Deposit Share (+) & Partner Withdrawals (−) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Partner Deposit Share Entry Form + Add / Delete Partner */}
        <section className="xl:col-span-6 bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#1D6CE0] shrink-0" />
              <h2 className="text-sm font-bold text-slate-900">
                Add Partner Deposit Share (+)
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">Capital Inflow</span>
          </div>

          <div className="px-4 pt-4 pb-1 space-y-2.5">
            {/* Registered Partners Header + ADD PARTNER / DELETE PARTNER Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <span>Registered Partners</span>
                <span
                  data-testid="registered-partner-count"
                  className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                >
                  {partnerDirectory.length}/{Math.max(DEFAULT_TARGET_PARTNER_COUNT, partnerDirectory.length)} Partners
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="toggle-add-partner-btn"
                  aria-expanded={showAddPartnerForm}
                  onClick={() => {
                    setShowAddPartnerForm((prev) => !prev);
                    setShowDeletePartnerForm(false);
                    setAddPartnerError('');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>{showAddPartnerForm ? 'Close' : 'ADD PARTNER'}</span>
                </button>
                <button
                  type="button"
                  data-testid="toggle-delete-partner-btn"
                  aria-expanded={showDeletePartnerForm}
                  onClick={() => {
                    const nextOpen = !showDeletePartnerForm;
                    setShowDeletePartnerForm(nextOpen);
                    setShowAddPartnerForm(false);
                    setDeletePartnerError('');
                    if (nextOpen && deletablePartners.length > 0 && !deletablePartners.includes(deletePartnerTarget)) {
                      setDeletePartnerTarget(deletablePartners[0]);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserMinus className="w-3.5 h-3.5 shrink-0" />
                  <span>{showDeletePartnerForm ? 'Close' : 'Delete Partner'}</span>
                </button>
              </div>
            </div>

            {/* Inline ADD PARTNER Form */}
            {showAddPartnerForm && (
              <div
                data-testid="add-partner-panel"
                className="p-3 rounded-lg bg-[#F7FAFC] border border-[#CBD8E6] space-y-2"
              >
                <div className="text-xs font-bold text-slate-800">
                  Add New Company Partner (Partner {partnerDirectory.length + 1})
                </div>
                {addPartnerError && (
                  <div
                    role="alert"
                    className="p-2 rounded bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
                  >
                    {addPartnerError}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    data-testid="add-partner-name-input"
                    aria-label="New Partner Name"
                    value={newPartnerNameInput}
                    onChange={(e) => setNewPartnerNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNewPartner();
                      }
                    }}
                    placeholder={`Enter Partner ${partnerDirectory.length + 1} full name`}
                    className="flex-1 min-w-[160px] px-3 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                  />
                  <input
                    type="email"
                    data-testid="add-partner-email-input"
                    aria-label="New Partner Email (for Alerts)"
                    value={newPartnerEmailInput}
                    onChange={(e) => setNewPartnerEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveNewPartner();
                      }
                    }}
                    placeholder="Alert email (optional)"
                    className="flex-1 min-w-[160px] px-3 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
                  />
                  <button
                    type="button"
                    data-testid="confirm-add-partner-btn"
                    onClick={handleSaveNewPartner}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Save Partner</span>
                  </button>
                </div>
              </div>
            )}

            {/* Inline DELETE PARTNER Panel */}
            {showDeletePartnerForm && (
              <div
                data-testid="delete-partner-panel"
                className="p-3 rounded-lg bg-rose-50/60 border border-rose-200 space-y-2.5"
              >
                <div className="text-xs font-bold text-slate-900">
                  Delete Company Partner
                </div>
                {deletePartnerError && (
                  <div
                    role="alert"
                    className="p-2 rounded bg-rose-100 border border-rose-300 text-xs font-medium text-rose-800"
                  >
                    {deletePartnerError}
                  </div>
                )}
                {deletablePartners.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    Only primary signatory partners ({companyProfile.managingPartner} &amp; {companyProfile.partner}) are currently registered. Add a new partner or update primary signatories in Settings.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <select
                        data-testid="delete-partner-select"
                        aria-label="Select partner to delete"
                        value={deletePartnerTarget}
                        onChange={(e) => setDeletePartnerTarget(e.target.value)}
                        className="flex-1 min-w-[180px] px-3 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                      >
                        {deletablePartners.map((pName) => (
                          <option key={pName} value={pName}>
                            {pName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid="confirm-delete-partner-btn"
                        onClick={handleConfirmDeletePartner}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Confirm Delete Partner</span>
                      </button>
                    </div>
                    {selectedDeletePartnerStats &&
                      (selectedDeletePartnerStats.depositCount > 0 ||
                        selectedDeletePartnerStats.withdrawalCount > 0) && (
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            data-testid="delete-partner-purge-entries-checkbox"
                            checked={purgeDeletedPartnerEntries}
                            onChange={(e) => setPurgeDeletedPartnerEntries(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span>
                            Also remove this partner&apos;s {selectedDeletePartnerStats.depositCount} deposit(s) &amp; {selectedDeletePartnerStats.withdrawalCount} withdrawal(s) and recalculate Total Balance &amp; equity
                          </span>
                        </label>
                      )}
                  </>
                )}
              </div>
            )}

            {/* Quick Partner Selector Presets */}
            <div className="flex flex-wrap gap-1.5" data-testid="registered-partner-list">
              {partnerDirectory.map((pName) => {
                const isSelected =
                  partnerName.trim().toLowerCase() === pName.trim().toLowerCase();
                const isCustom = !primaryPartnerKeys.has(pName.trim().toLowerCase());
                return (
                  <div key={pName} className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      data-testid={`select-partner-${pName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      aria-pressed={isSelected}
                      onClick={() => setPartnerName(pName)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border-2 ${
                        isSelected ? 'border-[#fbbf24]' : 'border-transparent'
                      }`}
                    >
                      {pName}
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        data-testid={`quick-delete-partner-${pName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                        onClick={() => {
                          removeCompanyPartner(pName, { purgeEntries: true });
                          const fallback = companyProfile.managingPartner || 'Md. Mizanur Rahman';
                          if (partnerName.trim().toLowerCase() === pName.trim().toLowerCase()) {
                            setPartnerName(fallback);
                          }
                          if (
                            withdrawalPartnerName.trim().toLowerCase() === pName.trim().toLowerCase()
                          ) {
                            setWithdrawalPartnerName(fallback);
                          }
                        }}
                        aria-label={`Delete partner ${pName}`}
                        title={`Delete partner ${pName}`}
                        className="p-1 rounded-md text-xs cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3 shrink-0" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <form
            data-testid="partner-deposit-form"
            onSubmit={handlePartnerDepositSubmit}
            className="p-4 pt-2.5 flex-1 flex flex-col gap-3.5"
          >
            {depositError && (
              <div
                role="alert"
                className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
              >
                {depositError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="partner-deposit-date"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Deposit Date
                </label>
                <input
                  id="partner-deposit-date"
                  data-testid="partner-deposit-date-input"
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="partner-deposit-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Partner Name
                </label>
                <input
                  id="partner-deposit-name"
                  data-testid="partner-deposit-name-input"
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Enter partner name"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="partner-deposit-amount"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Share Deposit Amount ({currency})
                </label>
                <input
                  id="partner-deposit-amount"
                  data-testid="partner-deposit-amount-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="partner-deposit-method"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Payment Method
                </label>
                <select
                  id="partner-deposit-method"
                  data-testid="partner-deposit-method-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                >
                  {PARTNER_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="partner-deposit-ref"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Reference / Slip No.
                </label>
                <input
                  id="partner-deposit-ref"
                  data-testid="partner-deposit-ref-input"
                  type="text"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  placeholder="Bank slip or voucher ref"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                />
              </div>

              <div>
                <label
                  htmlFor="partner-deposit-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Notes / Purpose
                </label>
                <input
                  id="partner-deposit-notes"
                  data-testid="partner-deposit-notes-input"
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  placeholder="Initial share or working capital"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="add-partner-deposit-btn"
              className="mt-auto w-full py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add Partner Deposit Share to Total Balance</span>
            </button>
          </form>
        </section>

        {/* Right: Partner Withdrawals (−) Dedicated Input Form */}
        <section
          data-testid="partner-withdrawal-form-card"
          className="xl:col-span-6 bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden flex flex-col"
        >
          <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-[#DC2626] shrink-0" />
              <h2 className="text-sm font-bold text-slate-900">
                Partner Withdrawals (&minus;)
              </h2>
            </div>
            <span className="text-xs text-rose-700 font-semibold font-mono tabular-nums">
              {summary.totalPartnerWithdrawal > 0
                ? `−${formatCurrency(summary.totalPartnerWithdrawal, currency)}`
                : 'Capital Draw'}
            </span>
          </div>

          <div className="px-4 pt-4 pb-1 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">
                Select Partner for Withdrawal
              </span>
              {selectedWithdrawalPartnerStats && (
                <span className="text-[11px] font-mono tabular-nums text-slate-600">
                  Net: {formatCurrency(selectedWithdrawalPartnerStats.netContribution, currency)} ({selectedWithdrawalPartnerStats.equityPercent.toFixed(2)}%)
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5" data-testid="withdrawal-partner-list">
              {partnerDirectory.map((pName) => {
                const isSelected =
                  withdrawalPartnerName.trim().toLowerCase() === pName.trim().toLowerCase();
                return (
                  <button
                    key={pName}
                    type="button"
                    data-testid={`select-withdrawal-partner-${pName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    aria-pressed={isSelected}
                    onClick={() => setWithdrawalPartnerName(pName)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border-2 ${
                      isSelected ? 'border-[#fbbf24]' : 'border-transparent'
                    }`}
                  >
                    {pName}
                  </button>
                );
              })}
            </div>
          </div>

          <form
            data-testid="partner-withdrawal-form"
            onSubmit={handlePartnerWithdrawalSubmit}
            className="p-4 pt-2.5 flex-1 flex flex-col gap-3.5"
          >
            {withdrawalError && (
              <div
                role="alert"
                className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
              >
                {withdrawalError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="partner-withdrawal-date"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Withdrawal Date
                </label>
                <input
                  id="partner-withdrawal-date"
                  data-testid="partner-withdrawal-date-input"
                  type="date"
                  value={withdrawalDate}
                  onChange={(e) => setWithdrawalDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="partner-withdrawal-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Partner Name
                </label>
                <input
                  id="partner-withdrawal-name"
                  data-testid="partner-withdrawal-name-input"
                  type="text"
                  value={withdrawalPartnerName}
                  onChange={(e) => setWithdrawalPartnerName(e.target.value)}
                  placeholder="Enter partner name"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="partner-withdrawal-amount"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Withdrawal Amount ({currency})
                </label>
                <input
                  id="partner-withdrawal-amount"
                  data-testid="partner-withdrawal-amount-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="partner-withdrawal-method"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Disbursement Method
                </label>
                <select
                  id="partner-withdrawal-method"
                  data-testid="partner-withdrawal-method-select"
                  value={withdrawalMethod}
                  onChange={(e) => setWithdrawalMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                >
                  {PARTNER_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="partner-withdrawal-ref"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Voucher / Cheque Ref
                </label>
                <input
                  id="partner-withdrawal-ref"
                  data-testid="partner-withdrawal-ref-input"
                  type="text"
                  value={withdrawalRef}
                  onChange={(e) => setWithdrawalRef(e.target.value)}
                  placeholder="Optional payout slip or bank ref"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                />
              </div>

              <div>
                <label
                  htmlFor="partner-withdrawal-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Notes / Reason
                </label>
                <input
                  id="partner-withdrawal-notes"
                  data-testid="partner-withdrawal-notes-input"
                  type="text"
                  value={withdrawalNotes}
                  onChange={(e) => setWithdrawalNotes(e.target.value)}
                  placeholder="Capital draw or profit distribution"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="submit-partner-withdrawal-btn"
              className="mt-auto w-full py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <MinusCircle className="w-4 h-4 shrink-0" />
              <span>Log Partner Withdrawal (&minus; Updates Total Balance &amp; Equity)</span>
            </button>
          </form>
        </section>
      </div>

      {/* Row 1b: Costing Deduction (-) vs Income Addition (+) Entry Form */}
      <section className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#1D6CE0] shrink-0" />
            <h2 className="text-sm font-bold text-slate-900">
              {entryMode === 'cost'
                ? 'Deduct Costing from Total Balance (−)'
                : 'Add Income to Total Balance (+)'}
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Entry Transaction Mode"
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === 'cost'}
              data-testid="mode-costing-btn"
              onClick={() => {
                setEntryMode('cost');
                setEntryError('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border-2 ${
                entryMode === 'cost' ? 'border-[#fbbf24]' : 'border-transparent'
              }`}
            >
              <MinusCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Deduct Costing (&minus;)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === 'income'}
              data-testid="mode-income-btn"
              onClick={() => {
                setEntryMode('income');
                setEntryError('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border-2 ${
                entryMode === 'income' ? 'border-[#fbbf24]' : 'border-transparent'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Add Income (+)</span>
            </button>
          </div>
        </div>

        <form
          data-testid="cost-income-form"
          onSubmit={handleCostOrIncomeSubmit}
          className="p-4 space-y-3.5"
        >
          {entryError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
            >
              {entryError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label
                htmlFor="balance-entry-date"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Date
              </label>
              <input
                id="balance-entry-date"
                data-testid="balance-entry-date-input"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono focus:outline-none focus:border-[#1D6CE0]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="balance-entry-category"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {entryMode === 'cost' ? 'Costing Category' : 'Income Source'}
              </label>
              {entryMode === 'cost' ? (
                <select
                  id="balance-entry-category"
                  data-testid="balance-entry-category-select"
                  value={costCategory}
                  onChange={(e) => setCostCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                >
                  {dropdownOptions.costingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="balance-entry-category"
                  data-testid="balance-entry-source-input"
                  type="text"
                  list="income-source-presets"
                  value={incomeSource}
                  onChange={(e) => setIncomeSource(e.target.value)}
                  placeholder="Income source"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
                  required
                />
              )}
              <datalist id="income-source-presets">
                {INCOME_SOURCE_PRESETS.map((src) => (
                  <option key={src} value={src} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="balance-entry-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {entryMode === 'cost'
                  ? `Costing Amount (${currency})`
                  : `Income Amount (${currency})`}
              </label>
              <input
                id="balance-entry-amount"
                data-testid="balance-entry-amount-input"
                type="number"
                min="0.01"
                step="0.01"
                value={entryAmount}
                onChange={(e) => setEntryAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono tabular-nums focus:outline-none focus:border-[#1D6CE0]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="balance-entry-ref"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ref Invoice / Bill No.
              </label>
              <input
                id="balance-entry-ref"
                data-testid="balance-entry-ref-input"
                type="text"
                value={entryRef}
                onChange={(e) => setEntryRef(e.target.value)}
                placeholder="Optional invoice or AWB"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
              />
            </div>

            <div>
              <label
                htmlFor="balance-entry-description"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Particulars / Details
              </label>
              <input
                id="balance-entry-description"
                data-testid="balance-entry-description-input"
                type="text"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                placeholder={
                  entryMode === 'cost'
                    ? 'Cargo freight, boxes, customs, etc.'
                    : 'Settlement bonus, recovery, etc.'
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0]"
              />
            </div>
          </div>

          <button
            type="submit"
            data-testid="submit-balance-entry-btn"
            className="w-full py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            {entryMode === 'cost' ? (
              <>
                <MinusCircle className="w-4 h-4 shrink-0" />
                <span>Deduct Costing from Total Balance (Also Updates Profit &amp; Loss)</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Add Income to Total Balance</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Row 1b-2: Recurring Expenses — Automated Monthly Fixed Costs */}
      <RecurringExpensesCard
        currency={currency}
        costingCategories={dropdownOptions.costingCategories}
        recurringExpenses={recurringExpenses}
        otherCosts={otherCosts}
        onAddRecurringExpense={addRecurringExpense}
        onToggleAutoDeduct={toggleRecurringExpenseAutoDeduct}
        onDeleteRecurringExpense={deleteRecurringExpense}
        onRunDueDeductions={() => runDueRecurringExpensesNow(false)}
        onDeductNow={deductRecurringExpenseNow}
      />

      {/* Row 1b-3: External Debts — Business Loans, Credit Lines & Repayment Schedule */}
      <ExternalDebtsCard
        currency={currency}
        externalDebts={externalDebts}
        onAddExternalDebt={addExternalDebt}
        onRecordRepayment={recordExternalDebtRepayment}
        onDeleteRepayment={deleteExternalDebtRepayment}
        onDeleteExternalDebt={deleteExternalDebt}
      />

      {/* Row 1c: Monthly Profit Distribution & Equity Payout Tool */}
      <ProfitDistributionCard
        currency={currency}
        roster={partnerEquityRoster}
        packings={packings}
        balanceIncomes={balanceIncomes}
        purchases={purchases}
        otherCosts={otherCosts}
        profitDistributions={profitDistributions}
        onIssuePayout={issueProfitDistribution}
        onDeleteDistribution={deleteProfitDistribution}
      />

      {/* Row 1d: Automated Partner Email Alerts (Resend API) */}
      <PartnerEmailNotificationCard
        companyProfile={companyProfile}
        partnerDirectory={partnerDirectory}
        partnerNotifications={partnerNotifications}
        onSetPartnerEmail={setPartnerEmail}
        onSetAlertsEnabled={setPartnerAlertsEnabled}
        onClearNotifications={clearPartnerNotifications}
      />

      {/* Row 2: Partner Capital Structure Chart (Recharts) + Partner-Wise Share Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-5">
          <PartnerCapitalChartCard
            partnerShares={summary.partnerShares}
            partnerDirectory={partnerDirectory}
            totalPartnerDeposit={summary.netPartnerCapital}
            currency={currency}
          />
        </div>

        <section className="xl:col-span-7 bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Partner-Wise Capital &amp; Equity Breakdown
              </h2>
              <p className="text-[11px] text-slate-500">
                Cumulative deposits, partner withdrawals, net equity capital, and ownership share %
              </p>
            </div>
            <span className="text-xs font-mono font-bold tabular-nums text-slate-700">
              {formatCurrency(summary.netPartnerCapital, currency)} Net
            </span>
          </div>

          {summary.partnerShares.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No partner capital entries added yet. Submit a deposit or withdrawal above to calculate each partner&apos;s net contribution and live equity percentage.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                data-testid="partner-share-table"
                className="w-full text-xs text-left border-collapse"
              >
                <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Partner Name</th>
                    <th className="py-2.5 px-3 text-right">Deposited (+)</th>
                    <th className="py-2.5 px-3 text-right">Withdrawn (&minus;)</th>
                    <th className="py-2.5 px-3 text-right">Equity %</th>
                    <th className="py-2.5 px-3 text-right">Net Capital ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(() => {
                    let colorIdx = 0;
                    return summary.partnerShares.map((partner) => {
                      const hasEquity = partner.netContribution > 0;
                      const barColor = hasEquity
                        ? PARTNER_CAPITAL_CHART_COLORS[
                            colorIdx++ % PARTNER_CAPITAL_CHART_COLORS.length
                          ]
                        : '#94A3B8';
                      return (
                        <tr key={partner.partnerKey} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: barColor }}
                              />
                              <span>{partner.partnerName}</span>
                            </div>
                            <div className="text-[11px] font-normal text-slate-500 pl-4">
                              {partner.depositCount} dep{partner.withdrawalCount > 0 ? ` · ${partner.withdrawalCount} w/d` : ''}
                              {partner.lastDepositDate ? ` · ${formatDate(partner.lastDepositDate)}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                            {formatCurrency(partner.totalDeposited, currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap">
                            {partner.totalWithdrawn > 0
                              ? `−${formatCurrency(partner.totalWithdrawn, currency)}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                            <div>{partner.sharePercent.toFixed(2)}%</div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, partner.sharePercent)}%`,
                                  backgroundColor: barColor,
                                }}
                              />
                            </div>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                              partner.netContribution >= 0 ? 'text-slate-900' : 'text-rose-700'
                            }`}
                          >
                            {formatCurrency(partner.netContribution, currency)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Row 2b: Detailed Chronological Partner Transaction Ledger (Deposits, Withdrawals & Profit Payouts) */}
      <TransactionLedgerCard
        currency={currency}
        companyName={companyProfile.companyName}
        partnerDirectory={partnerDirectory}
        partnerDeposits={partnerDeposits}
        partnerWithdrawals={partnerWithdrawals}
        profitDistributions={profitDistributions}
        onDeleteDeposit={deletePartnerDeposit}
        onDeleteWithdrawal={deletePartnerWithdrawal}
        onDeleteProfitDistribution={deleteProfitDistribution}
        onExportAuditLog={(exportedCount, filename) => {
          addAuditLog({
            action: 'EXPORT',
            module: 'TotalBalance',
            summary: `Exported Partner Transaction Ledger CSV (${exportedCount} transaction(s))`,
            details: `File: ${filename}`,
          });
          showToast(`Transaction Ledger CSV exported: ${filename}`);
        }}
      />

      {/* Row 3: Secondary Chart — 12-Month Total Balance Financial Growth Trend */}
      <TotalBalanceTrendChartCard trend={monthlyTrend} currency={currency} />

      {/* Row 4: All Costings Deducted Breakdown Table */}
      <section className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-[#F7FAFC] border-b border-[#CBD8E6] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              All Costings Deducted from Total Balance
            </h2>
            <p className="text-[11px] text-slate-500">
              Automatic rollup from Purchase DB + all Operating Costing categories
            </p>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums text-rose-700">
            &minus; {formatCurrency(summary.totalCostingDeducted, currency)}
          </span>
        </div>

        {summary.costingCategories.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No purchasing bills or operating costs recorded yet. Every purchase bill and operating expense automatically deducts here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="costing-breakdown-table"
              className="w-full text-xs text-left border-collapse"
            >
              <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Costing Category</th>
                  <th className="py-2.5 px-3 text-center">Source</th>
                  <th className="py-2.5 px-3 text-center">Entries</th>
                  <th className="py-2.5 px-3 text-right">Share %</th>
                  <th className="py-2.5 px-3 text-right">Deducted ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.costingCategories.map((cat) => (
                  <tr key={cat.category} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {cat.category}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {cat.sourceType === 'purchase' ? 'Purchase DB' : 'Costing DB'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-700">
                      {cat.entryCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {cat.sharePercent.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-rose-700">
                      {formatCurrency(cat.totalAmount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Unified Total Balance Running Statement Table */}
      <section className="bg-white rounded-xl border border-[#CBD8E6] shadow-xs overflow-hidden">
        <div className="px-4 py-3.5 bg-[#F7FAFC] border-b border-[#CBD8E6] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Complete Total Balance Cashflow &amp; Running Balance Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological running balance across Partner Deposit Shares (+), Export &amp; Direct Income (+), and All Costing Deductions (&minus;)
            </p>
          </div>

          {/* Search & Date Filters */}
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                data-testid="balance-ledger-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search partner, category, ref..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 focus:outline-none focus:border-[#1D6CE0] w-44"
              />
            </div>

            <input
              type="date"
              aria-label="Filter start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono"
            />
            <input
              type="date"
              aria-label="Filter end date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD8E6] bg-white text-slate-900 font-mono"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetLedgerFilters}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Filter Tabs */}
        <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-1.5 bg-white">
          {(
            [
              { id: 'all', label: 'All Entries' },
              { id: 'partner_deposit', label: 'Partner Deposits (+)' },
              { id: 'partner_withdrawal', label: 'Partner Withdrawals (-)' },
              { id: 'profit_distribution', label: 'Profit Payouts (-)' },
              { id: 'external_debt', label: 'External Debts (-)' },
              { id: 'export_income', label: 'Export Income (+)' },
              { id: 'other_income', label: 'Direct Income (+)' },
              { id: 'purchase_cost', label: 'Purchase Cost (-)' },
              { id: 'other_cost', label: 'Operating Cost (-)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`ledger-filter-${tab.id}`}
              onClick={() => setTypeFilter(tab.id)}
              aria-pressed={typeFilter === tab.id}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {allLedgerEntries.length === 0
              ? 'No Total Balance transactions recorded yet. Add a Partner Deposit Share, record a Costing deduction, or save Purchases/Packings to see your live running balance here.'
              : 'No transactions match your current search or filter criteria.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="total-balance-ledger-table"
              className="w-full text-xs text-left border-collapse"
            >
              <thead className="bg-slate-50 border-b border-[#CBD8E6] text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">SL</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Type</th>
                  <th className="py-2.5 px-3">Particulars &amp; Details</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Ref</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    Credit (+ {currency})
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    Costing (&minus; {currency})
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    Running Balance ({currency})
                  </th>
                  <th className="py-2.5 px-3 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEntries.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          row.effect === 'credit' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {row.effectLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{row.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {row.categoryOrSource}
                        {row.notes && row.notes !== row.title ? ` · ${row.notes}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {row.reference}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-emerald-700 whitespace-nowrap">
                      {row.creditAmount > 0 ? formatCurrency(row.creditAmount, currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-rose-700 whitespace-nowrap">
                      {row.debitAmount > 0 ? formatCurrency(row.debitAmount, currency) : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                        row.runningBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                      }`}
                    >
                      {formatCurrency(row.runningBalance, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.deletableType ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteLedgerRow(row.deletableType, row.sourceRecordId)
                          }
                          aria-label={`Delete ${row.title} on ${formatDate(row.date)}`}
                          title="Delete entry (Super Admin verification required)"
                          className="inline-flex items-center justify-center p-1.5 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Auto Sync
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-[#CBD8E6] font-bold">
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-right text-slate-700">
                    Overall Balance Totals (Deposits + Income &minus; Withdrawals, Profit Payouts, External Debts &amp; Costing):
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                    {formatCurrency(
                      summary.totalPartnerDeposit + summary.totalIncomeAdded,
                      currency
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-rose-700 whitespace-nowrap">
                    {formatCurrency(
                      summary.totalCostingDeducted +
                        summary.totalPartnerWithdrawal +
                        summary.totalProfitDistributed +
                        summary.totalExternalDebtObligation,
                      currency
                    )}
                  </td>
                  <td
                    data-testid="ledger-footer-net-balance"
                    className={`py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                      summary.totalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatCurrency(summary.totalBalance, currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Offscreen Corporate A4 Financial Statement Container for Structured PDF Export */}
      <div
        id="partner-financial-statement-host"
        aria-hidden="true"
        className="print:hidden"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: '760px',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <PartnerFinancialStatementPrintDocument
          statement={financialStatementData}
          companyProfile={companyProfile}
          elementId="partner-financial-statement-printable"
        />
      </div>
    </div>
  );
};
