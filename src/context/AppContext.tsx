import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  CompanyProfile,
  DropdownOptions,
  PurchaseRecord,
  PurchaseItemRow,
  PackingRecord,
  PackingFormDraft,
  PackingItemRow,
  PaymentRecord,
  OtherCostRecord,
  SupplierCreditRecord,
  MortalityRecord,
  AuditLogRecord,
  AuthUser,
  ActiveTab,
  PrivateImportDraft,
  ExporterStatus,
  PartnerDepositRecord,
  PartnerWithdrawalRecord,
  ProfitDistributionRecord,
  PartnerNotificationLogRecord,
  BalanceIncomeRecord,
  RecurringExpenseRecord,
  ExternalDebtRecord,
  ExternalDebtRepayment,
  BusinessDocumentRecord,
} from '../types/index.ts';
import { computeExternalDebtTotalObligation } from '../utils/externalDebts.ts';
import {
  buildRecurringCostDeductionRecord,
  getDueRecurringExpenseCycles,
  hasRecurringDeductionForMonth,
} from '../utils/recurringExpenses.ts';
import {
  buildBatchStatusUpdateForPurchase,
  buildBatchStatusUpdateForPacking,
  buildBatchStatusUpdateForPayment,
  filterRecordsAfterBatchDelete,
} from '../utils/batchDatabaseUpdate.ts';
import {
  initialCompanyProfile,
  initialDropdownOptions,
  initialPurchases,
  initialPackings,
  initialPayments,
  initialOtherCosts,
  initialSupplierCredits,
  initialMortalities,
  samplePurchases,
  samplePackings,
  samplePayments,
  COMPANY_LOGO_URL,
} from './initialData.ts';
import { generateRecordId, deduplicateRecords } from '../utils/idGenerator.ts';
import {
  generateInvoiceNumber,
  calculatePurchaseTotals,
  calculatePackingTotals,
} from '../utils/calculations.ts';
import {
  mergePurchaseRecordsBySupplierAndDate,
  mergePackingRecordsByShipmentGroup,
} from '../utils/csvParser.ts';
import {
  upsertPurchasesInPlace,
  upsertPackingsInPlace,
  upsertPaymentsInPlace,
  upsertOtherCostsInPlace,
} from '../utils/importUpsert.ts';
import {
  createSupplierCreditRecord,
  applySupplierCreditNote,
  applyCreditAmountAcrossSupplierNotes,
} from '../utils/supplierCredits.ts';
import {
  buildPartnerDirectory,
  calculateTotalBalanceSummary,
  validateAddPartnerName,
  addPartnerToCompanyList,
  removePartnerFromCompanyList,
} from '../utils/totalBalance.ts';
import {
  buildPartnerAlertEmailContent,
  collectValidPartnerRecipients,
  PartnerAlertEmailPayload,
  resolvePartnerEmailDirectory,
  setPartnerEmailInMap,
  validatePartnerEmailAddress,
} from '../utils/partnerNotifications.ts';
import {
  DEFAULT_SUPER_ADMIN_PASSWORD,
  ClearRecordsScope,
  PendingSingleDeleteRequest,
  verifySuperAdminPassword,
  verifySuperAdminForSingleDelete,
  validateSuperAdminPasswordChange,
} from '../utils/superAdminAuth.ts';
import {
  DatabaseSnapshot,
  SnapshotTrigger,
  SnapshotValidationResult,
  createDatabaseSnapshot,
  serializeSnapshotToJSON,
  validateAndParseSnapshotJSON,
  appendSnapshotWithRetention,
} from '../utils/snapshotManager.ts';
import { emitPaymentSyncTrigger } from '../utils/paymentSync.ts';
import { SyncStatusState } from '../utils/syncStatus.ts';
import {
  parseShipmentDeepLink,
  buildShipmentDetailUrl,
} from '../utils/shipmentQrCode.ts';
import {
  GlobalViewTableReport,
  buildGlobalViewTableReport,
  extractLiveDomTablesFromContainer,
} from '../utils/globalViewPdfExport.ts';
import { exportElementToPdf } from '../utils/pdfGenerator.ts';
import {
  authenticateUser,
  AuthVerificationResult,
  createAuditLogEntry,
  CreateAuditLogInput,
  DEFAULT_ADMIN_ACCOUNTS,
} from '../utils/auditLogger.ts';
import {
  RegisteredAccountMatch,
  validatePasswordResetNewPassword,
  applyResetPasswordToTeamMembers,
} from '../utils/passwordReset.ts';
import {
  loadInitialTeamMembers,
  TEAM_MEMBERS_STORAGE_KEY,
} from '../utils/administration.ts';
import { indexedStorageDriver, DB_STORE_NAMES } from '../utils/indexedStorage.ts';

const createEmptyPackingDraftRows = (): PackingItemRow[] =>
  ['1', '2', '3', '4', '5'].map((id) => ({
    id,
    item: '',
    box: 0,
    weight: 0,
    totalWeight: 0,
    unit: 'KG',
    rate: 0,
    amount: 0,
  }));

export const createInitialPackingDraft = (packingCount: number = 0): PackingFormDraft => ({
  invoiceNumber: generateInvoiceNumber('PKG', packingCount),
  packingDate: new Date().toISOString().slice(0, 10),
  shippingMark: '',
  flight: '',
  destination: '',
  shipper: '',
  paymentStatus: 'UNPAID',
  customRmbAmount: '',
  remarks: '',
  rows: createEmptyPackingDraftRows(),
});

export interface PrintModalData {
  isOpen: boolean;
  type:
    | 'purchase'
    | 'packing'
    | 'air_way_bill'
    | 'payment'
    | 'exporter_payment_slip'
    | 'monthly_statement'
    | 'batch_print'
    | 'batch_payment_slips'
    | 'profit_loss'
    | 'global_view_table'
    | 'mortality_report';
  title: string;
  data: any;
  items?: any[];
  selectedIds?: string[];
}

export interface DataCenterModalConfig {
  isOpen: boolean;
  initialTab: 'import' | 'export';
  initialDataset: 'purchase' | 'packing' | 'payment' | 'other_cost' | 'all';
}

export interface SuperAdminClearModalConfig {
  isOpen: boolean;
  initialScope: ClearRecordsScope;
}

interface AppContextType {
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  login: (usernameOrEmail: string, password: string) => AuthVerificationResult;
  logout: () => void;

  auditLogs: AuditLogRecord[];
  addAuditLog: (input: CreateAuditLogInput) => AuditLogRecord;
  clearAuditLogs: () => void;

  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  companyProfile: CompanyProfile;
  updateCompanyProfile: (profile: Partial<CompanyProfile>) => void;
  addCompanyPartner: (
    name: string,
    email?: string
  ) => { valid: boolean; error?: string; cleanName?: string };
  removeCompanyPartner: (name: string, options?: { purgeEntries?: boolean }) => void;
  setPartnerEmail: (partnerName: string, email: string) => { valid: boolean; error?: string };
  setPartnerAlertsEnabled: (enabled: boolean) => void;
  dropdownOptions: DropdownOptions;
  addDropdownItem: (category: keyof DropdownOptions, item: string) => void;
  editDropdownItem: (category: keyof DropdownOptions, oldItem: string, newItem: string) => void;
  deleteDropdownItem: (category: keyof DropdownOptions, item: string) => void;
  resetDropdowns: () => void;

  purchases: PurchaseRecord[];
  addPurchase: (record: Omit<PurchaseRecord, 'id' | 'createdAt'>) => string;
  updatePurchase: (id: string, record: Partial<PurchaseRecord>) => void;
  deletePurchase: (id: string) => void;
  batchDeletePurchases: (ids: string[]) => number;
  batchUpdatePurchasesStatus: (ids: string[], status: ExporterStatus) => number;
  bulkImportPurchases: (
    records: Omit<PurchaseRecord, 'id' | 'createdAt'>[],
    mode?: 'append' | 'replace'
  ) => number;
  editingPurchaseId: string | null;
  setEditingPurchaseId: (id: string | null) => void;

  packings: PackingRecord[];
  addPacking: (record: Omit<PackingRecord, 'id' | 'createdAt'>) => string;
  updatePacking: (id: string, record: Partial<PackingRecord>, silent?: boolean) => void;
  deletePacking: (id: string) => void;
  batchDeletePackings: (ids: string[]) => number;
  batchUpdatePackingsStatus: (ids: string[], status: ExporterStatus) => number;
  bulkImportPackings: (
    records: Omit<PackingRecord, 'id' | 'createdAt'>[],
    mode?: 'append' | 'replace'
  ) => number;
  editingPackingId: string | null;
  setEditingPackingId: (id: string | null) => void;
  packingDraft: PackingFormDraft;
  setPackingDraft: React.Dispatch<React.SetStateAction<PackingFormDraft>>;
  resetPackingDraft: (nextPackingCount?: number) => void;

  payments: PaymentRecord[];
  addPayment: (record: Omit<PaymentRecord, 'id' | 'createdAt'>) => string;
  updatePayment: (id: string, record: Partial<PaymentRecord>) => void;
  deletePayment: (id: string) => void;
  batchDeletePayments: (ids: string[]) => number;
  batchUpdatePaymentsStatus: (ids: string[], status: ExporterStatus) => number;
  bulkImportPayments: (
    records: Omit<PaymentRecord, 'id' | 'createdAt'>[],
    mode?: 'append' | 'replace'
  ) => number;
  editingPaymentId: string | null;
  setEditingPaymentId: (id: string | null) => void;

  otherCosts: OtherCostRecord[];
  addOtherCost: (record: Omit<OtherCostRecord, 'id' | 'createdAt'>) => string;
  deleteOtherCost: (id: string) => void;
  bulkImportOtherCosts: (
    records: Omit<OtherCostRecord, 'id' | 'createdAt'>[],
    mode?: 'append' | 'replace'
  ) => number;

  partnerDeposits: PartnerDepositRecord[];
  addPartnerDeposit: (record: Omit<PartnerDepositRecord, 'id' | 'createdAt'>) => string;
  updatePartnerDeposit: (id: string, record: Partial<PartnerDepositRecord>) => void;
  deletePartnerDeposit: (id: string) => void;

  partnerWithdrawals: PartnerWithdrawalRecord[];
  addPartnerWithdrawal: (record: Omit<PartnerWithdrawalRecord, 'id' | 'createdAt'>) => string;
  deletePartnerWithdrawal: (id: string) => void;

  profitDistributions: ProfitDistributionRecord[];
  issueProfitDistribution: (record: Omit<ProfitDistributionRecord, 'id' | 'createdAt'>) => string;
  deleteProfitDistribution: (id: string) => void;

  partnerNotifications: PartnerNotificationLogRecord[];
  clearPartnerNotifications: () => void;

  balanceIncomes: BalanceIncomeRecord[];
  addBalanceIncome: (record: Omit<BalanceIncomeRecord, 'id' | 'createdAt'>) => string;
  deleteBalanceIncome: (id: string) => void;

  recurringExpenses: RecurringExpenseRecord[];
  addRecurringExpense: (
    record: Omit<RecurringExpenseRecord, 'id' | 'createdAt' | 'lastProcessedYearMonth'>
  ) => { id: string; autoDeductedCount: number };
  toggleRecurringExpenseAutoDeduct: (ruleId: string) => void;
  deleteRecurringExpense: (ruleId: string) => void;
  runDueRecurringExpensesNow: (silent?: boolean) => number;
  deductRecurringExpenseNow: (ruleId: string) => boolean;

  externalDebts: ExternalDebtRecord[];
  addExternalDebt: (
    record: Omit<ExternalDebtRecord, 'id' | 'createdAt' | 'repayments'>
  ) => string;
  recordExternalDebtRepayment: (
    debtId: string,
    repayment: Omit<ExternalDebtRepayment, 'id' | 'createdAt'>
  ) => string;
  deleteExternalDebtRepayment: (debtId: string, repaymentId: string) => void;
  deleteExternalDebt: (debtId: string) => void;

  supplierCredits: SupplierCreditRecord[];
  addSupplierCredit: (input: {
    creditNoteNumber?: string;
    date: string;
    supplierName: string;
    refPurchaseInvoice?: string;
    reason?: string;
    amount: number;
    remarks?: string;
  }) => SupplierCreditRecord;
  applySupplierCredit: (
    creditId: string,
    application: {
      amount: number;
      date?: string;
      targetPaymentInvoice?: string;
      targetPurchaseInvoice?: string;
      notes?: string;
    }
  ) => number;
  applySupplierCreditsForPayment: (
    supplierName: string,
    amountToApply: number,
    meta?: {
      date?: string;
      targetPaymentInvoice?: string;
      targetPurchaseInvoice?: string;
      notes?: string;
      specificCreditId?: string;
    }
  ) => { totalApplied: number; affectedCreditNotes: string[] };
  deleteSupplierCredit: (id: string) => void;

  mortalities: MortalityRecord[];
  addMortality: (record: Omit<MortalityRecord, 'id' | 'createdAt'>) => string;
  updateMortality: (id: string, record: Partial<MortalityRecord>) => void;
  deleteMortality: (id: string) => void;

  businessDocuments: BusinessDocumentRecord[];
  addBusinessDocument: (record: Omit<BusinessDocumentRecord, 'id' | 'createdAt'>) => string;
  updateBusinessDocument: (id: string, record: Partial<BusinessDocumentRecord>) => void;
  deleteBusinessDocument: (id: string) => void;

  // Print & PDF modal state + Global View PDF Export
  printModalData: PrintModalData;
  openPrintModal: (modal: Omit<PrintModalData, 'isOpen'>) => void;
  closePrintModal: () => void;
  globalViewReport: GlobalViewTableReport;
  isExportingGlobalPdf: boolean;
  lastExportedPdfFilename: string | null;
  exportCurrentViewToPdf: (options?: { openPreviewOnly?: boolean }) => Promise<boolean>;

  // Excel & CSV Import/Export Data Center modal state + Private Import Draft
  dataCenterModal: DataCenterModalConfig;
  openDataCenterModal: (
    initialTab?: 'import' | 'export',
    initialDataset?: 'purchase' | 'packing' | 'payment' | 'other_cost' | 'all'
  ) => void;
  closeDataCenterModal: () => void;
  privateImportDraft: PrivateImportDraft | null;
  savePrivateImportDraft: (draft: Omit<PrivateImportDraft, 'id' | 'ownerUsername' | 'savedAt'>) => PrivateImportDraft;
  clearPrivateImportDraft: () => void;

  // Super Admin Password & Clear / Single Delete Modals
  superAdminPassword: string;
  updateSuperAdminPassword: (
    currentPasswordInput: string,
    newPassword: string,
    confirmPassword: string
  ) => { valid: boolean; error?: string };
  resetAccountPasswordViaEmail: (
    account: RegisteredAccountMatch,
    newPassword: string,
    confirmPassword: string
  ) => { valid: boolean; error?: string };
  resetSuperAdminPasswordToDefault: () => void;
  superAdminClearModal: SuperAdminClearModalConfig;
  openSuperAdminClearModal: (scope?: ClearRecordsScope) => void;
  closeSuperAdminClearModal: () => void;
  clearRecordsWithSuperAdmin: (
    passwordInput: string,
    scope?: ClearRecordsScope
  ) => { valid: boolean; error?: string };
  pendingSingleDelete: PendingSingleDeleteRequest | null;
  requestSuperAdminSingleDelete: (
    request: PendingSingleDeleteRequest,
    onConfirm: () => void
  ) => void;
  confirmSingleDeleteWithSuperAdmin: (
    passwordInput: string
  ) => { valid: boolean; error?: string };
  cancelSingleDelete: () => void;

  // Database management & Snapshots
  clearAllDatabaseRecords: (scope?: ClearRecordsScope) => void;
  resetAllData: () => void;
  exportDatabaseJSON: () => void;
  importDatabaseJSON: (jsonStr: string) => boolean;

  snapshots: DatabaseSnapshot[];
  snapshotModalOpen: boolean;
  openSnapshotModal: () => void;
  closeSnapshotModal: () => void;
  createSnapshot: (
    label?: string,
    notes?: string,
    trigger?: SnapshotTrigger
  ) => DatabaseSnapshot;
  restoreSnapshot: (
    snapshotId: string,
    options?: { includeSettings?: boolean; createPreRestoreBackup?: boolean }
  ) => boolean;
  deleteSnapshot: (snapshotId: string) => void;
  downloadSnapshotJSON: (snapshotId?: string) => void;
  importSnapshotFromJSON: (
    jsonStr: string,
    autoRestore?: boolean
  ) => SnapshotValidationResult;

  // Local Database Persistence Sync Status & Live Sync
  syncStatus: SyncStatusState;
  lastSyncedAt: string;
  lastSyncedEntity: string;
  triggerManualSync: (entityLabel?: string) => void;
  isLiveSyncEnabled: boolean;
  toggleLiveSync: (enabled?: boolean) => void;
  hasUnsyncedChanges: boolean;

  // Notification toast
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Shipment QR Code Deep-Link Focus
  focusedShipmentInvoice: string | null;
  openShipmentDetails: (invoiceNumber: string, shippingMark?: string) => void;
  clearFocusedShipment: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROFILE: 'zsb_company_profile_v1',
  DROPDOWNS: 'zsb_dropdown_options_v1',
  PURCHASES: 'zsb_purchases_v8',
  PACKINGS: 'zsb_packings_v8',
  PACKING_DRAFT: 'zsb_packing_draft_v8',
  PAYMENTS: 'zsb_payments_v8',
  OTHER_COSTS: 'zsb_other_costs_v8',
  PARTNER_DEPOSITS: 'zsb_partner_deposits_v1',
  PARTNER_WITHDRAWALS: 'zsb_partner_withdrawals_v1',
  PROFIT_DISTRIBUTIONS: 'zsb_profit_distributions_v1',
  PARTNER_NOTIFICATIONS: 'zsb_partner_notifications_v1',
  BALANCE_INCOMES: 'zsb_balance_incomes_v1',
  RECURRING_EXPENSES: 'zsb_recurring_expenses_v1',
  EXTERNAL_DEBTS: 'zsb_external_debts_v1',
  SUPPLIER_CREDITS: 'zsb_supplier_credits_v6',
  MORTALITIES: 'zsb_mortalities_v6',
  BUSINESS_DOCUMENTS: 'zsb_business_documents_v1',
  SUPER_ADMIN_PASSWORD: 'zsb_super_admin_password_v1',
  SNAPSHOTS: 'zsb_database_snapshots_v2',
  AUTH_USER: 'zsb_auth_user_v2',
  AUDIT_LOGS: 'zsb_audit_logs_v2',
  LIVE_SYNC: 'zsb_live_sync_enabled_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialDeepLink =
    typeof window !== 'undefined' ? parseShipmentDeepLink(window.location.search) : null;

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = sessionStorage.getItem(STORAGE_KEYS.AUTH_USER);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && parsed.username) {
            return parsed as AuthUser;
          }
        }
        const searchParams = new URLSearchParams(window.location.search);
        if (
          searchParams.get('autostart') === '1' ||
          Boolean(searchParams.get('wechat_tx')) ||
          Boolean(searchParams.get('wechat_tmp_token')) ||
          initialDeepLink?.isShipmentLink
        ) {
          return {
            username: DEFAULT_ADMIN_ACCOUNTS[0].username,
            displayName: DEFAULT_ADMIN_ACCOUNTS[0].displayName,
            role: DEFAULT_ADMIN_ACCOUNTS[0].role,
            email: DEFAULT_ADMIN_ACCOUNTS[0].email,
            loginAt: new Date().toISOString(),
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = Boolean(currentUser);

  const privateDraftStorageKey = currentUser?.username
    ? `zsb_private_import_draft_v1_${currentUser.username}`
    : 'zsb_private_import_draft_v1_anonymous';

  const [privateImportDraft, setPrivateImportDraft] = useState<PrivateImportDraft | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(privateDraftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.ownerUsername === (currentUser?.username || 'anonymous')) {
          setPrivateImportDraft(parsed as PrivateImportDraft);
          return;
        }
      }
      setPrivateImportDraft(null);
    } catch {
      setPrivateImportDraft(null);
    }
  }, [privateDraftStorageKey, currentUser?.username]);

  const savePrivateImportDraft = (
    draftInput: Omit<PrivateImportDraft, 'id' | 'ownerUsername' | 'savedAt'>
  ): PrivateImportDraft => {
    const nextDraft: PrivateImportDraft = {
      ...draftInput,
      id: generateRecordId('draft'),
      ownerUsername: currentUser?.username || 'anonymous',
      savedAt: new Date().toISOString(),
    };
    setPrivateImportDraft(nextDraft);
    try {
      localStorage.setItem(privateDraftStorageKey, JSON.stringify(nextDraft));
    } catch (e) {
      console.error('Failed to save private import draft:', e);
    }
    return nextDraft;
  };

  const clearPrivateImportDraft = () => {
    setPrivateImportDraft(null);
    try {
      localStorage.removeItem(privateDraftStorageKey);
    } catch {
      // ignore
    }
  };

  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const isSeedRequested =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('seed') === '1';

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab') as ActiveTab | null;
      const validTabs: ActiveTab[] = [
        'dashboard',
        'purchase_form',
        'packing_form',
        'air_way_bill',
        'payment_form',
        'exporter_payment_form',
        'exporter_payment_slip',
        'profit_loss',
        'total_balance',
        'purchase_db',
        'packing_db',
        'payment_db',
        'search_reports',
        'audit_logs',
        'settings',
        'administration',
        'forget_password',
      ];
      if (tabParam && validTabs.includes(tabParam)) {
        return tabParam;
      }
      if (searchParams.get('reset_token')) {
        return 'forget_password';
      }
      if (searchParams.get('wechat_tx') || searchParams.get('wechat_tmp_token')) {
        return 'exporter_payment_form';
      }
    }
    return initialDeepLink?.isShipmentLink ? 'packing_db' : 'dashboard';
  });
  const [focusedShipmentInvoice, setFocusedShipmentInvoice] = useState<string | null>(() => {
    if (initialDeepLink?.isShipmentLink) {
      return initialDeepLink.invoiceNumber || initialDeepLink.shippingMark || null;
    }
    return null;
  });
  const [editingPackingId, setEditingPackingId] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (!saved) return initialCompanyProfile;
      const parsed = JSON.parse(saved);
      const merged: CompanyProfile = {
        ...initialCompanyProfile,
        ...parsed,
        email:
          parsed.email && parsed.email !== 'www.zsbaquatics.com'
            ? parsed.email
            : 'zsbaquatics@gmail.com',
        website: parsed.website || 'www.zsbaquatics.com',
        logoUrl:
          typeof parsed.logoUrl === 'string' && parsed.logoUrl.startsWith('data:image/')
            ? parsed.logoUrl
            : COMPANY_LOGO_URL,
        minInventoryThresholdKg:
          parsed.minInventoryThresholdKg !== undefined
            ? Number(parsed.minInventoryThresholdKg)
            : initialCompanyProfile.minInventoryThresholdKg,
        approachingThresholdPercent:
          parsed.approachingThresholdPercent !== undefined
            ? Number(parsed.approachingThresholdPercent)
            : initialCompanyProfile.approachingThresholdPercent,
        minTotalBalanceThreshold:
          parsed.minTotalBalanceThreshold !== undefined
            ? Number(parsed.minTotalBalanceThreshold)
            : initialCompanyProfile.minTotalBalanceThreshold,
        documentAlertWindowDays:
          parsed.documentAlertWindowDays !== undefined
            ? Number(parsed.documentAlertWindowDays)
            : initialCompanyProfile.documentAlertWindowDays,
      };
      if (parsed.partner === 'Md. Faisal Ahmed' || parsed.managingPartner === 'Md. Sohel Rana') {
        merged.managingPartner = 'Md. Mizanur Rahman';
        merged.partner = 'Md. Sohel Rana';
      }
      merged.partners = buildPartnerDirectory(merged, []);
      return merged;
    } catch {
      return initialCompanyProfile;
    }
  });

  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DROPDOWNS);
      if (!saved) return initialDropdownOptions;
      const parsed = JSON.parse(saved);
      if (
        !parsed.paymentDescriptions ||
        !parsed.paymentDescriptions.includes('CASH') ||
        parsed.paymentDescriptions.includes('ABDULLAH VAI')
      ) {
        parsed.paymentDescriptions = initialDropdownOptions.paymentDescriptions;
      }
      if (
        !parsed.paymentStatuses ||
        parsed.paymentStatuses.includes('NO REPORT') ||
        parsed.paymentStatuses.includes('REPORT') ||
        !parsed.paymentStatuses.includes('UNPAID')
      ) {
        parsed.paymentStatuses = initialDropdownOptions.paymentStatuses;
      }
      return { ...initialDropdownOptions, ...parsed };
    } catch {
      return initialDropdownOptions;
    }
  });

  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => {
    try {
      if (isSeedRequested) {
        localStorage.setItem('zsb_db_wipe_all_v12', '1');
        localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(samplePurchases));
        return samplePurchases;
      }
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        localStorage.removeItem(STORAGE_KEYS.PURCHASES);
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pur') : [];
    } catch {
      return [];
    }
  });

  const [packings, setPackings] = useState<PackingRecord[]>(() => {
    try {
      if (isSeedRequested) {
        localStorage.setItem('zsb_db_wipe_all_v12', '1');
        localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify(samplePackings));
        return samplePackings;
      }
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        localStorage.removeItem(STORAGE_KEYS.PACKINGS);
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEYS.PACKINGS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pkg') : [];
    } catch {
      return [];
    }
  });

  const [packingDraft, setPackingDraft] = useState<PackingFormDraft>(() => {
    try {
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        localStorage.removeItem(STORAGE_KEYS.PACKING_DRAFT);
        return createInitialPackingDraft(0);
      }
      const saved = localStorage.getItem(STORAGE_KEYS.PACKING_DRAFT);
      if (!saved) return createInitialPackingDraft(0);
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)) {
        return {
          ...createInitialPackingDraft(0),
          ...parsed,
        };
      }
      return createInitialPackingDraft(0);
    } catch {
      return createInitialPackingDraft(0);
    }
  });

  const resetPackingDraft = (nextPackingCount?: number) => {
    const count = nextPackingCount !== undefined ? nextPackingCount : packings.length;
    setPackingDraft(createInitialPackingDraft(count));
  };

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      if (isSeedRequested) {
        localStorage.setItem('zsb_db_wipe_all_v12', '1');
        localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(samplePayments));
        return samplePayments;
      }
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const deduped = Array.isArray(parsed) ? deduplicateRecords(parsed, 'pay') : [];
      return deduped.map((pm: PaymentRecord) => {
        if (pm.paymentCategory === 'exporter') return pm;
        const rowDebit = Array.isArray(pm.items)
          ? pm.items.reduce((s, r) => s + (Number(r.debitAmount) || 0), 0)
          : 0;
        const rowCredit = Array.isArray(pm.items)
          ? pm.items.reduce((s, r) => s + (Number(r.creditAmount) || 0), 0)
          : 0;
        const nextTotal = Math.round((Number(pm.totalAmount) || rowDebit || 0) * 100) / 100;
        const nextPaid = Math.round((Number(pm.paidAmount) || rowCredit || 0) * 100) / 100;
        const nextBal =
          Number(pm.paidAmount) === 0 && (rowCredit > 0 || rowDebit > 0)
            ? Math.round((nextTotal - nextPaid) * 100) / 100
            : Number(pm.balance) || Math.round((nextTotal - nextPaid) * 100) / 100;
        return {
          ...pm,
          totalAmount: nextTotal,
          paidAmount: nextPaid,
          balance: nextBal,
        };
      });
    } catch {
      return [];
    }
  });

  const [otherCosts, setOtherCosts] = useState<OtherCostRecord[]>(() => {
    try {
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        localStorage.removeItem(STORAGE_KEYS.OTHER_COSTS);
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEYS.OTHER_COSTS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'cost') : [];
    } catch {
      return [];
    }
  });

  const [supplierCredits, setSupplierCredits] = useState<SupplierCreditRecord[]>(() => {
    try {
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        localStorage.removeItem(STORAGE_KEYS.SUPPLIER_CREDITS);
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEYS.SUPPLIER_CREDITS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'cn') : [];
    } catch {
      return [];
    }
  });

  const [mortalities, setMortalities] = useState<MortalityRecord[]>(() => {
    try {
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        localStorage.removeItem(STORAGE_KEYS.MORTALITIES);
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEYS.MORTALITIES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'mort') : [];
    } catch {
      return [];
    }
  });

  const [partnerDeposits, setPartnerDeposits] = useState<PartnerDepositRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTNER_DEPOSITS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pdep') : [];
    } catch {
      return [];
    }
  });

  const [partnerWithdrawals, setPartnerWithdrawals] = useState<PartnerWithdrawalRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTNER_WITHDRAWALS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pwdr') : [];
    } catch {
      return [];
    }
  });

  const [profitDistributions, setProfitDistributions] = useState<ProfitDistributionRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pdist') : [];
    } catch {
      return [];
    }
  });

  const [balanceIncomes, setBalanceIncomes] = useState<BalanceIncomeRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BALANCE_INCOMES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'binc') : [];
    } catch {
      return [];
    }
  });

  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECURRING_EXPENSES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'rexp') : [];
    } catch {
      return [];
    }
  });

  const [externalDebts, setExternalDebts] = useState<ExternalDebtRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXTERNAL_DEBTS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'edebt') : [];
    } catch {
      return [];
    }
  });

  const [businessDocuments, setBusinessDocuments] = useState<BusinessDocumentRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BUSINESS_DOCUMENTS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'bdoc') : [];
    } catch {
      return [];
    }
  });

  const [partnerNotifications, setPartnerNotifications] = useState<PartnerNotificationLogRecord[]>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.PARTNER_NOTIFICATIONS);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
      } catch {
        return [];
      }
    }
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [printModalData, setPrintModalData] = useState<PrintModalData>({
    isOpen: false,
    type: 'purchase',
    title: '',
    data: null,
  });

  const [dataCenterModal, setDataCenterModal] = useState<DataCenterModalConfig>({
    isOpen: false,
    initialTab: 'import',
    initialDataset: 'purchase',
  });

  const [superAdminPassword, setSuperAdminPassword] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUPER_ADMIN_PASSWORD);
      if (saved && saved.trim().length > 0) {
        return saved.trim();
      }
      return DEFAULT_SUPER_ADMIN_PASSWORD;
    } catch {
      return DEFAULT_SUPER_ADMIN_PASSWORD;
    }
  });

  const [superAdminClearModal, setSuperAdminClearModal] = useState<SuperAdminClearModalConfig>({
    isOpen: false,
    initialScope: 'all',
  });

  const [pendingSingleDeleteState, setPendingSingleDeleteState] = useState<
    (PendingSingleDeleteRequest & { onConfirm: () => void }) | null
  >(null);

  const openSuperAdminClearModal = (scope: ClearRecordsScope = 'all') => {
    setSuperAdminClearModal({
      isOpen: true,
      initialScope: scope,
    });
  };

  const closeSuperAdminClearModal = () => {
    setSuperAdminClearModal((prev) => ({ ...prev, isOpen: false }));
  };

  const requestSuperAdminSingleDelete = (
    request: PendingSingleDeleteRequest,
    onConfirm: () => void
  ) => {
    setPendingSingleDeleteState({
      ...request,
      onConfirm,
    });
  };

  const cancelSingleDelete = () => {
    setPendingSingleDeleteState(null);
  };

  const confirmSingleDeleteWithSuperAdmin = (
    passwordInput: string
  ): { valid: boolean; error?: string } => {
    const verification = verifySuperAdminForSingleDelete(
      passwordInput,
      superAdminPassword
    );
    if (!verification.valid) {
      return { valid: false, error: verification.error };
    }
    if (pendingSingleDeleteState) {
      const action = pendingSingleDeleteState.onConfirm;
      setPendingSingleDeleteState(null);
      action();
    }
    return { valid: true };
  };

  const openDataCenterModal = (
    initialTab: 'import' | 'export' = 'import',
    initialDataset: 'purchase' | 'packing' | 'payment' | 'other_cost' | 'all' = 'purchase'
  ) => {
    setDataCenterModal({
      isOpen: true,
      initialTab,
      initialDataset,
    });
  };

  const closeDataCenterModal = () => {
    setDataCenterModal((prev) => ({ ...prev, isOpen: false }));
  };

  const [snapshotModalOpen, setSnapshotModalOpen] = useState<boolean>(false);

  const openSnapshotModal = () => {
    setSnapshotModalOpen(true);
  };

  const closeSnapshotModal = () => {
    setSnapshotModalOpen(false);
  };

  const [snapshots, setSnapshots] = useState<DatabaseSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Local Database Persistence Sync Status state
  const [isLiveSyncEnabled, setIsLiveSyncEnabled] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEYS.LIVE_SYNC);
        if (saved !== null) {
          return saved === 'true';
        }
      }
      return true;
    } catch {
      return true;
    }
  });

  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState<boolean>(false);
  const isLiveSyncEnabledRef = useRef<boolean>(isLiveSyncEnabled);
  isLiveSyncEnabledRef.current = isLiveSyncEnabled;

  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEYS.LIVE_SYNC);
        if (saved === 'false') return 'paused';
      }
      return 'synced';
    } catch {
      return 'synced';
    }
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toISOString());
  const [lastSyncedEntity, setLastSyncedEntity] = useState<string>('All Ledgers');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

  const triggerManualSync = (
    entityLabel: string = 'All Ledgers',
    targetStatus?: SyncStatusState
  ) => {
    try {
      setSyncStatus('saving');
      setLastSyncedEntity(entityLabel);
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(companyProfile));
      localStorage.setItem(STORAGE_KEYS.DROPDOWNS, JSON.stringify(dropdownOptions));
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify(packings));
      localStorage.setItem(STORAGE_KEYS.PACKING_DRAFT, JSON.stringify(packingDraft));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify(otherCosts));
      localStorage.setItem(STORAGE_KEYS.PARTNER_DEPOSITS, JSON.stringify(partnerDeposits));
      localStorage.setItem(STORAGE_KEYS.PARTNER_WITHDRAWALS, JSON.stringify(partnerWithdrawals));
      localStorage.setItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, JSON.stringify(profitDistributions));
      localStorage.setItem(STORAGE_KEYS.BALANCE_INCOMES, JSON.stringify(balanceIncomes));
      localStorage.setItem(STORAGE_KEYS.RECURRING_EXPENSES, JSON.stringify(recurringExpenses));
      localStorage.setItem(STORAGE_KEYS.EXTERNAL_DEBTS, JSON.stringify(externalDebts));
      localStorage.setItem(STORAGE_KEYS.SUPPLIER_CREDITS, JSON.stringify(supplierCredits));
      localStorage.setItem(STORAGE_KEYS.MORTALITIES, JSON.stringify(mortalities));
      localStorage.setItem(STORAGE_KEYS.BUSINESS_DOCUMENTS, JSON.stringify(businessDocuments));
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
      setHasUnsyncedChanges(false);
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      const finalStatus =
        targetStatus !== undefined
          ? targetStatus
          : isLiveSyncEnabledRef.current
          ? 'synced'
          : 'paused';
      syncTimerRef.current = setTimeout(() => {
        setSyncStatus(finalStatus);
        setLastSyncedAt(new Date().toISOString());
      }, 550);
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  const toggleLiveSync = (forcedValue?: boolean) => {
    const nextValue =
      forcedValue !== undefined ? forcedValue : !isLiveSyncEnabledRef.current;
    isLiveSyncEnabledRef.current = nextValue;
    setIsLiveSyncEnabled(nextValue);
    try {
      localStorage.setItem(STORAGE_KEYS.LIVE_SYNC, String(nextValue));
    } catch (e) {
      console.error(e);
    }
    if (nextValue) {
      // When turning Live Sync on, immediately flush all state to storage and show Synced
      triggerManualSync('All Ledgers (Live Sync Restored)', 'synced');
      setHasUnsyncedChanges(false);
      showToast('Live Sync enabled: Auto-saving database changes in the background.');
    } else {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      setSyncStatus('paused');
      showToast(
        'Live Sync paused: Background auto-saving disabled. Use "Sync Now" (Ctrl+S) to save.'
      );
    }
  };

  const debouncedSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const persistWithSyncIndicator = (entityLabel: string, writeFn: () => void) => {
    try {
      if (!isLiveSyncEnabledRef.current) {
        if (!isInitialMountRef.current) {
          setHasUnsyncedChanges(true);
          setSyncStatus('paused');
          setLastSyncedEntity(entityLabel);
        }
        return;
      }

      if (isInitialMountRef.current) {
        return;
      }

      setHasUnsyncedChanges(false);
      setSyncStatus('saving');
      setLastSyncedEntity(entityLabel);

      const existingTimer = debouncedSaveTimersRef.current.get(entityLabel);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        try {
          writeFn();
          if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
          }
          syncTimerRef.current = setTimeout(() => {
            setSyncStatus('synced');
            setLastSyncedAt(new Date().toISOString());
          }, 300);
        } catch (e) {
          console.error(e);
          setSyncStatus('error');
        }
      }, 250);

      debouncedSaveTimersRef.current.set(entityLabel, timer);
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  // Sync to localStorage
  useEffect(() => {
    persistWithSyncIndicator('Company Profile', () => {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(companyProfile));
    });
  }, [companyProfile]);

  useEffect(() => {
    persistWithSyncIndicator('Master Lists', () => {
      localStorage.setItem(STORAGE_KEYS.DROPDOWNS, JSON.stringify(dropdownOptions));
    });
  }, [dropdownOptions]);

  useEffect(() => {
    persistWithSyncIndicator('Purchase DB', () => {
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
      indexedStorageDriver.saveCollection(DB_STORE_NAMES.PURCHASES, purchases);
    });
  }, [purchases]);

  useEffect(() => {
    persistWithSyncIndicator('Packing DB', () => {
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify(packings));
      indexedStorageDriver.saveCollection(DB_STORE_NAMES.PACKINGS, packings);
    });
  }, [packings]);

  useEffect(() => {
    persistWithSyncIndicator('Packing Draft', () => {
      localStorage.setItem(STORAGE_KEYS.PACKING_DRAFT, JSON.stringify(packingDraft));
    });
  }, [packingDraft]);

  useEffect(() => {
    persistWithSyncIndicator('Payment DB', () => {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
      indexedStorageDriver.saveCollection(DB_STORE_NAMES.PAYMENTS, payments);
    });
  }, [payments]);

  useEffect(() => {
    persistWithSyncIndicator('Costing DB', () => {
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify(otherCosts));
      indexedStorageDriver.saveCollection(DB_STORE_NAMES.OTHER_COSTS, otherCosts);
    });
  }, [otherCosts]);

  useEffect(() => {
    persistWithSyncIndicator('Supplier Credits', () => {
      localStorage.setItem(
        STORAGE_KEYS.SUPPLIER_CREDITS,
        JSON.stringify(supplierCredits)
      );
    });
  }, [supplierCredits]);

  useEffect(() => {
    persistWithSyncIndicator('Mortality Log', () => {
      localStorage.setItem(STORAGE_KEYS.MORTALITIES, JSON.stringify(mortalities));
    });
  }, [mortalities]);

  useEffect(() => {
    persistWithSyncIndicator('Partner Deposit Shares', () => {
      localStorage.setItem(STORAGE_KEYS.PARTNER_DEPOSITS, JSON.stringify(partnerDeposits));
    });
  }, [partnerDeposits]);

  useEffect(() => {
    persistWithSyncIndicator('Partner Withdrawals', () => {
      localStorage.setItem(STORAGE_KEYS.PARTNER_WITHDRAWALS, JSON.stringify(partnerWithdrawals));
    });
  }, [partnerWithdrawals]);

  useEffect(() => {
    persistWithSyncIndicator('Profit Distributions', () => {
      localStorage.setItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, JSON.stringify(profitDistributions));
    });
  }, [profitDistributions]);

  useEffect(() => {
    persistWithSyncIndicator('Balance Income Ledger', () => {
      localStorage.setItem(STORAGE_KEYS.BALANCE_INCOMES, JSON.stringify(balanceIncomes));
    });
  }, [balanceIncomes]);

  useEffect(() => {
    persistWithSyncIndicator('Recurring Expenses', () => {
      localStorage.setItem(STORAGE_KEYS.RECURRING_EXPENSES, JSON.stringify(recurringExpenses));
    });
  }, [recurringExpenses]);

  useEffect(() => {
    persistWithSyncIndicator('External Debts', () => {
      localStorage.setItem(STORAGE_KEYS.EXTERNAL_DEBTS, JSON.stringify(externalDebts));
    });
  }, [externalDebts]);

  useEffect(() => {
    persistWithSyncIndicator('Business Documents', () => {
      localStorage.setItem(STORAGE_KEYS.BUSINESS_DOCUMENTS, JSON.stringify(businessDocuments));
    });
  }, [businessDocuments]);

  // Automated Monthly Recurring Expense Deduction Engine (idempotent per ruleId + YYYY-MM)
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dueCycles = getDueRecurringExpenseCycles(recurringExpenses, otherCosts, todayStr);
    if (dueCycles.length === 0) return;

    const nowIso = new Date().toISOString();
    const generatedCosts: OtherCostRecord[] = [];
    const latestMonthByRule = new Map<string, string>();

    for (const cycle of dueCycles) {
      const existsInBatch = generatedCosts.some(
        (c) =>
          c.recurringExpenseId === cycle.rule.id &&
          c.recurringYearMonth === cycle.yearMonth
      );
      if (existsInBatch) continue;

      generatedCosts.push({
        ...buildRecurringCostDeductionRecord(cycle.rule, cycle.yearMonth),
        id: generateRecordId('cost'),
        createdAt: nowIso,
      });

      const prevLatest = latestMonthByRule.get(cycle.rule.id);
      if (!prevLatest || cycle.yearMonth > prevLatest) {
        latestMonthByRule.set(cycle.rule.id, cycle.yearMonth);
      }
    }

    if (generatedCosts.length === 0) return;

    setOtherCosts((prev) => [...generatedCosts.reverse(), ...prev]);
    setRecurringExpenses((prev) =>
      prev.map((rule) => {
        const processedYm = latestMonthByRule.get(rule.id);
        if (!processedYm) return rule;
        if (rule.lastProcessedYearMonth && rule.lastProcessedYearMonth >= processedYm) {
          return rule;
        }
        return { ...rule, lastProcessedYearMonth: processedYm };
      })
    );
    const totalAutoAmount = generatedCosts.reduce((sum, c) => sum + c.amount, 0);
    addAuditLog({
      action: 'CREATE',
      module: 'RecurringExpense',
      entityId: generatedCosts[0]?.id,
      summary: `Auto-deducted ${generatedCosts.length} scheduled monthly recurring expense(s) from Total Balance`,
      details: `Total Deducted: ${companyProfile.currency} ${totalAutoAmount.toLocaleString()}`,
    });
  }, [recurringExpenses, otherCosts]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PARTNER_NOTIFICATIONS,
        JSON.stringify(partnerNotifications.slice(0, 100))
      );
    } catch (e) {
      console.error(e);
    }
  }, [partnerNotifications]);

  useEffect(() => {
    persistWithSyncIndicator('Security Config', () => {
      localStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_PASSWORD, superAdminPassword);
    });
  }, [superAdminPassword]);

  useEffect(() => {
    persistWithSyncIndicator('Snapshot Archive', () => {
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
    });
  }, [snapshots]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
    } catch (e) {
      console.error(e);
    }
  }, [auditLogs]);

  useEffect(() => {
    isInitialMountRef.current = false;
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      debouncedSaveTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // One-time cleanup of obsolete storage versions on startup
  useEffect(() => {
    try {
      const legacyKeys = [
        'zsb_purchases_v1',
        'zsb_purchases_v2',
        'zsb_purchases_v3',
        'zsb_purchases_v4',
        'zsb_purchases_v5',
        'zsb_purchases_v6',
        'zsb_packings_v1',
        'zsb_packings_v2',
        'zsb_packings_v3',
        'zsb_packings_v4',
        'zsb_packings_v5',
        'zsb_packings_v6',
        'zsb_packing_draft_v1',
        'zsb_packing_draft_v2',
        'zsb_packing_draft_v3',
        'zsb_packing_draft_v4',
        'zsb_packing_draft_v5',
        'zsb_packing_draft_v6',
        'zsb_payments_v1',
        'zsb_payments_v2',
        'zsb_payments_v3',
        'zsb_payments_v4',
        'zsb_payments_v5',
        'zsb_payments_v6',
        'zsb_other_costs_v1',
        'zsb_other_costs_v2',
        'zsb_other_costs_v3',
        'zsb_other_costs_v4',
        'zsb_other_costs_v5',
        'zsb_other_costs_v6',
        'zsb_supplier_credits_v1',
        'zsb_supplier_credits_v2',
        'zsb_supplier_credits_v3',
        'zsb_supplier_credits_v4',
        'zsb_mortalities_v1',
        'zsb_mortalities_v2',
        'zsb_mortalities_v3',
        'zsb_mortalities_v4',
        'zsb_database_snapshots_v1',
        'zsb_audit_logs_v1',
        'zsb_awb_row_overrides_v1',
        'zsb_exporter_slip_custom_rows_v1',
        'zsb_exporter_slip_custom_rows_v2',
        'zsb_exporter_slip_custom_rows_v3',
      ];
      legacyKeys.forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem('zsb_auth_user_v1');
      if (!localStorage.getItem('zsb_db_wipe_all_v12')) {
        indexedStorageDriver.clearAllStores();
        localStorage.setItem('zsb_db_wipe_all_v12', '1');
      }
    } catch {
      // ignore
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const addAuditLog = (input: CreateAuditLogInput): AuditLogRecord => {
    const entry = createAuditLogEntry({
      ...input,
      actor:
        input.actor ||
        (currentUser
          ? `${currentUser.displayName} (${currentUser.role})`
          : 'Md. Sohel Rana (Partner & Administrator)'),
    });
    setAuditLogs((prev) => [entry, ...prev].slice(0, 500));
    return entry;
  };

  const clearAuditLogs = () => {
    requestSuperAdminSingleDelete(
      {
        recordType: 'audit_log',
        recordId: 'AUDIT-TRAIL',
        recordTitle: 'System Audit Logs',
        recordSubtitle: `${auditLogs.length} audit entry record(s)`,
      },
      () => {
        setAuditLogs([]);
        try {
          localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
        } catch (e) {
          console.error(e);
        }
        showToast('Super Admin verified: System audit trail cleared.');
      }
    );
  };

  const login = (usernameOrEmail: string, password: string): AuthVerificationResult => {
    const verification = authenticateUser(usernameOrEmail, password, superAdminPassword);
    if (!verification.valid || !verification.user) {
      return verification;
    }
    setCurrentUser(verification.user);
    try {
      sessionStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(verification.user));
    } catch (e) {
      console.error(e);
    }
    addAuditLog({
      action: 'AUTH',
      module: 'Authentication',
      entityId: 'AUTH-LOGIN',
      summary: `Administrator "${verification.user.displayName}" (${verification.user.role}) signed in to ZSB Aquatics Trade Ledger`,
      details: `Email: ${verification.user.email} · Verified Session`,
      actor: `${verification.user.displayName} (${verification.user.role})`,
    });
    showToast(`Welcome back, ${verification.user.displayName}!`);
    return verification;
  };

  const logout = () => {
    if (currentUser) {
      addAuditLog({
        action: 'AUTH',
        module: 'Authentication',
        entityId: 'AUTH-LOGOUT',
        summary: `Administrator "${currentUser.displayName}" signed out of the session`,
        details: `Account: ${currentUser.email}`,
        actor: `${currentUser.displayName} (${currentUser.role})`,
      });
    }
    setCurrentUser(null);
    try {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } catch (e) {
      console.error(e);
    }
    showToast('Signed out of ZSB Aquatics Control Center.');
  };

  const updateCompanyProfile = (profile: Partial<CompanyProfile>) => {
    setCompanyProfile((prev) => {
      const merged = { ...prev, ...profile };
      merged.partners = buildPartnerDirectory(merged, []);
      return merged;
    });
    addAuditLog({
      action: 'UPDATE',
      module: 'Settings',
      entityId: 'CFG-PROFILE',
      summary: 'Updated company profile and system configuration settings',
      details: `Company: ${profile.companyName || companyProfile.companyName}`,
    });
    showToast('Company profile updated successfully.');
  };

  const addCompanyPartner = (
    name: string,
    email?: string
  ): { valid: boolean; error?: string; cleanName?: string } => {
    const existing = buildPartnerDirectory(companyProfile, []);
    const check = validateAddPartnerName(name, existing);
    if (!check.valid || !check.cleanName) {
      return check;
    }
    const emailCheck = validatePartnerEmailAddress(email || '');
    if (!emailCheck.valid) {
      return { valid: false, error: emailCheck.error };
    }
    const nextList = addPartnerToCompanyList(companyProfile, check.cleanName);
    setCompanyProfile((prev) => ({
      ...prev,
      partners: addPartnerToCompanyList(prev, check.cleanName!),
      partnerEmails: emailCheck.cleanEmail
        ? setPartnerEmailInMap(prev.partnerEmails, check.cleanName!, emailCheck.cleanEmail)
        : prev.partnerEmails,
    }));
    addAuditLog({
      action: 'CREATE',
      module: 'Settings',
      entityId: 'CFG-PARTNER',
      summary: `Added company partner "${check.cleanName}" (${nextList.length} registered partners)`,
      details: emailCheck.cleanEmail
        ? `Partners: ${nextList.join(', ')} · Alert Email: ${emailCheck.cleanEmail}`
        : `Partners: ${nextList.join(', ')}`,
    });
    showToast(`Added partner "${check.cleanName}" to company partners.`);
    return check;
  };

  const setPartnerEmail = (
    partnerName: string,
    email: string
  ): { valid: boolean; error?: string } => {
    const cleanName = (partnerName || '').trim();
    if (!cleanName) {
      return { valid: false, error: 'Partner name is required.' };
    }
    const check = validatePartnerEmailAddress(email);
    if (!check.valid) {
      return { valid: false, error: check.error };
    }
    setCompanyProfile((prev) => ({
      ...prev,
      partnerEmails: setPartnerEmailInMap(prev.partnerEmails, cleanName, check.cleanEmail),
    }));
    addAuditLog({
      action: 'UPDATE',
      module: 'PartnerNotification',
      entityId: 'PARTNER-EMAIL',
      summary: check.cleanEmail
        ? `Updated notification email for "${cleanName}" to ${check.cleanEmail}`
        : `Cleared custom notification email for "${cleanName}"`,
    });
    showToast(
      check.cleanEmail
        ? `Saved alert email for ${cleanName}: ${check.cleanEmail}`
        : `Cleared custom email for ${cleanName}.`
    );
    return { valid: true };
  };

  const setPartnerAlertsEnabled = (enabled: boolean) => {
    setCompanyProfile((prev) => ({
      ...prev,
      partnerAlertsEnabled: enabled,
    }));
    addAuditLog({
      action: 'UPDATE',
      module: 'PartnerNotification',
      entityId: 'AUTO-ALERTS',
      summary: enabled
        ? 'Enabled automated Resend partner email alerts for Withdrawals & Profit Distributions'
        : 'Paused automated Resend partner email alerts',
    });
    showToast(
      enabled
        ? 'Automated partner email alerts enabled.'
        : 'Automated partner email alerts paused.'
    );
  };

  const clearPartnerNotifications = () => {
    setPartnerNotifications([]);
    showToast('Partner email notification history cleared.');
  };

  const removeCompanyPartner = (name: string, options?: { purgeEntries?: boolean }) => {
    const cleanTarget = (name || '').trim();
    if (!cleanTarget) return;
    const targetKey = cleanTarget.toLowerCase();
    setCompanyProfile((prev) => ({
      ...prev,
      partners: removePartnerFromCompanyList(prev, cleanTarget),
    }));
    if (options?.purgeEntries) {
      setPartnerDeposits((prev) =>
        prev.filter((d) => (d.partnerName || '').trim().toLowerCase() !== targetKey)
      );
      setPartnerWithdrawals((prev) =>
        prev.filter((w) => (w.partnerName || '').trim().toLowerCase() !== targetKey)
      );
    }
    addAuditLog({
      action: 'DELETE',
      module: 'Settings',
      entityId: 'CFG-PARTNER',
      summary: options?.purgeEntries
        ? `Deleted partner "${cleanTarget}" and removed associated deposit/withdrawal entries`
        : `Deleted partner "${cleanTarget}" from company list`,
    });
    showToast(`Deleted partner "${cleanTarget}" successfully.`);
  };

  const addDropdownItem = (category: keyof DropdownOptions, item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    setDropdownOptions((prev) => {
      if (prev[category].includes(trimmed)) return prev;
      return {
        ...prev,
        [category]: [...prev[category], trimmed],
      };
    });
    showToast(`Added "${trimmed}" to ${category}.`);
  };

  const editDropdownItem = (category: keyof DropdownOptions, oldItem: string, newItem: string) => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setDropdownOptions((prev) => ({
      ...prev,
      [category]: prev[category].map((it) => (it === oldItem ? trimmed : it)),
    }));
    showToast(`Updated "${oldItem}" to "${trimmed}".`);
  };

  const deleteDropdownItem = (category: keyof DropdownOptions, item: string) => {
    requestSuperAdminSingleDelete(
      {
        recordType: 'dropdown_item',
        recordId: `${String(category)}:${item}`,
        recordTitle: `${item} (${String(category)})`,
        recordSubtitle: `Master list option in ${String(category)}`,
      },
      () => {
        setDropdownOptions((prev) => ({
          ...prev,
          [category]: prev[category].filter((it) => it !== item),
        }));
        addAuditLog({
          action: 'DELETE',
          module: 'Settings',
          entityId: `${String(category)}:${item}`,
          summary: `Super Admin verified & deleted master option "${item}" from ${String(category)}`,
        });
        showToast(`Super Admin verified: Removed "${item}" from ${category}.`);
      }
    );
  };

  const resetDropdowns = () => {
    setDropdownOptions(initialDropdownOptions);
    showToast('Dropdown options reset to system defaults.');
  };

  // Purchases CRUD
  const addPurchase = (record: Omit<PurchaseRecord, 'id' | 'createdAt'>) => {
    const id = generateRecordId('pur');
    const newRecord: PurchaseRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    setPurchases((prev) => [newRecord, ...prev]);
    emitPaymentSyncTrigger({
      category: 'supplier',
      action: 'confirm',
      invoiceNumber: newRecord.invoiceNumber,
      partyName: newRecord.description,
      debitAmount: newRecord.totalAmount,
      creditAmount: newRecord.paidAmount,
      runningBalance: newRecord.balance,
    });
    addAuditLog({
      action: 'CREATE',
      module: 'Purchase',
      entityId: newRecord.invoiceNumber,
      summary: `Created purchase challan ${newRecord.invoiceNumber} for supplier ${newRecord.description}`,
      details: `Subtotal: ${companyProfile.currency} ${newRecord.totalAmount.toLocaleString()} · Paid: ${companyProfile.currency} ${newRecord.paidAmount.toLocaleString()}`,
    });
    showToast(`Purchase invoice ${newRecord.invoiceNumber} saved to database!`);
    return id;
  };

  const updatePurchase = (id: string, record: Partial<PurchaseRecord>) => {
    const target = purchases.find((p) => p.id === id);
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...record } : p)));
    emitPaymentSyncTrigger({
      category: 'supplier',
      action: 'update',
      invoiceNumber: record.invoiceNumber || target?.invoiceNumber || id,
      partyName: record.description || target?.description,
      debitAmount: record.totalAmount ?? target?.totalAmount,
      creditAmount: record.paidAmount ?? target?.paidAmount,
      runningBalance: record.balance ?? target?.balance,
    });
    addAuditLog({
      action: 'UPDATE',
      module: 'Purchase',
      entityId: record.invoiceNumber || target?.invoiceNumber || id,
      summary: `Modified purchase challan ${record.invoiceNumber || target?.invoiceNumber || id}`,
      details: `Supplier: ${record.description || target?.description || '-'} · Subtotal: ${companyProfile.currency} ${(record.totalAmount ?? target?.totalAmount ?? 0).toLocaleString()}`,
    });
    showToast(`Purchase invoice updated.`);
  };

  const deletePurchase = (id: string) => {
    const target = purchases.find((p) => p.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'purchase',
        recordId: id,
        recordTitle: target
          ? `${target.invoiceNumber} — ${target.description}`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date} · Total: ${companyProfile.currency} ${(target.totalAmount ?? 0).toLocaleString()}`
          : undefined,
      },
      () => {
        setPurchases((prev) => prev.filter((p) => p.id !== id));
        if (editingPurchaseId === id) {
          setEditingPurchaseId(null);
        }
        emitPaymentSyncTrigger({
          category: 'supplier',
          action: 'delete',
          invoiceNumber: target?.invoiceNumber || id,
          partyName: target?.description,
        });
        addAuditLog({
          action: 'DELETE',
          module: 'Purchase',
          entityId: target?.invoiceNumber || id,
          summary: `Super Admin verified & deleted purchase challan ${target?.invoiceNumber || id} (${target?.description || 'Unknown Supplier'})`,
          details: `Deleted Amount: ${companyProfile.currency} ${(target?.totalAmount ?? 0).toLocaleString()}`,
        });
        showToast(`Super Admin verified: Purchase record ${target?.invoiceNumber || ''} deleted from database.`);
      }
    );
  };

  const batchDeletePurchases = (ids: string[]): number => {
    if (!ids || ids.length === 0) return 0;
    const { remaining, deleted, deletedCount } = filterRecordsAfterBatchDelete(purchases, ids);
    if (deletedCount === 0) return 0;

    setPurchases(remaining);
    if (editingPurchaseId && ids.includes(editingPurchaseId)) {
      setEditingPurchaseId(null);
    }
    emitPaymentSyncTrigger({
      category: 'supplier',
      action: 'delete',
      invoiceNumber: deleted.map((d) => d.invoiceNumber).slice(0, 3).join(', '),
      partyName: deleted[0]?.description,
    });
    addAuditLog({
      action: 'DELETE',
      module: 'Purchase',
      entityId: `BATCH-PUR-DEL-${deletedCount}`,
      summary: `Batch deleted ${deletedCount} purchase challan record(s)`,
      details: `Invoices: ${deleted.map((d) => d.invoiceNumber).slice(0, 6).join(', ')}`,
    });
    showToast(`Deleted ${deletedCount} selected purchase record(s) from database.`);
    return deletedCount;
  };

  const batchUpdatePurchasesStatus = (ids: string[], status: ExporterStatus): number => {
    if (!ids || ids.length === 0 || !status) return 0;
    const targetSet = new Set(ids);
    const cleanStatus = status.trim().toUpperCase();
    let updatedCount = 0;

    setPurchases((prev) =>
      prev.map((p) => {
        if (!targetSet.has(p.id)) return p;
        updatedCount++;
        return {
          ...p,
          ...buildBatchStatusUpdateForPurchase(p, cleanStatus),
        };
      })
    );

    if (updatedCount > 0) {
      emitPaymentSyncTrigger({
        category: 'supplier',
        action: 'update',
        invoiceNumber: `BATCH-${updatedCount}`,
      });
      addAuditLog({
        action: 'UPDATE',
        module: 'Purchase',
        entityId: `BATCH-PUR-STATUS-${updatedCount}`,
        summary: `Batch updated status to ${cleanStatus} for ${updatedCount} purchase record(s)`,
      });
      showToast(`Updated status to ${cleanStatus} for ${updatedCount} selected purchase record(s).`);
    }
    return updatedCount;
  };

  const bulkImportPurchases = (
    records: Omit<PurchaseRecord, 'id' | 'createdAt'>[],
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!records || records.length === 0) return 0;
    const now = new Date().toISOString();
    const mergedIncoming = mergePurchaseRecordsBySupplierAndDate(
      records,
      mode === 'replace' ? 0 : purchases.length
    );

    if (mode === 'replace') {
      const hydrated: PurchaseRecord[] = mergedIncoming.map((rec, idx) => ({
        ...rec,
        invoiceNumber: rec.invoiceNumber || generateInvoiceNumber('INV', idx),
        id: generateRecordId('pur'),
        createdAt: now,
      }));
      setPurchases(hydrated);
      addAuditLog({
        action: 'IMPORT',
        module: 'Purchase',
        entityId: `BULK-PUR-${hydrated.length}`,
        summary: `Bulk imported ${hydrated.length} merged purchase challan record(s) (replace mode)`,
      });
      return hydrated.length;
    }

    const upsertResult = upsertPurchasesInPlace(
      purchases,
      mergedIncoming,
      generateRecordId,
      now
    );
    setPurchases(upsertResult.records);

    addAuditLog({
      action: 'IMPORT',
      module: 'Purchase',
      entityId: `BULK-PUR-${mergedIncoming.length}`,
      summary: `Imported Purchases: ${upsertResult.insertedCount} added, ${upsertResult.updatedCount} updated in place, ${upsertResult.unchangedCount} identical unchanged`,
    });
    return upsertResult.insertedCount + upsertResult.updatedCount;
  };

  // Packings CRUD
  const addPacking = (record: Omit<PackingRecord, 'id' | 'createdAt'>) => {
    const id = generateRecordId('pkg');
    const newRecord: PackingRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    setPackings((prev) => [newRecord, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'Packing',
      entityId: newRecord.invoiceNumber,
      summary: `Created export packing list ${newRecord.invoiceNumber} (${newRecord.shippingMark} · ${newRecord.totalWeight} KG)`,
      details: `Total Boxes: ${newRecord.totalBox} · Value: RMB ${newRecord.totalAmount.toLocaleString()}`,
    });
    showToast(`Packing list ${newRecord.invoiceNumber} saved to database!`);
    return id;
  };

  const updatePacking = (id: string, record: Partial<PackingRecord>, silent: boolean = false) => {
    const target = packings.find((p) => p.id === id);
    setPackings((prev) => prev.map((p) => (p.id === id ? { ...p, ...record } : p)));
    if (!silent) {
      addAuditLog({
        action: 'UPDATE',
        module: 'Packing',
        entityId: record.invoiceNumber || target?.invoiceNumber || id,
        summary: `Updated export packing list ${record.invoiceNumber || target?.invoiceNumber || id}`,
        details: `Mark: ${record.shippingMark || target?.shippingMark || '-'} · Value: RMB ${(record.totalAmount ?? target?.totalAmount ?? 0).toLocaleString()}`,
      });
      showToast(`Packing list updated.`);
    }
  };

  const deletePacking = (id: string) => {
    const target = packings.find((p) => p.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'packing',
        recordId: id,
        recordTitle: target
          ? `${target.invoiceNumber} (${target.shippingMark})`
          : id,
        recordSubtitle: target
          ? `Shipment Date: ${target.packingDate} · ${target.totalBox} Box · ${target.totalWeight} KG · RMB ${(target.totalAmount ?? 0).toLocaleString()}`
          : undefined,
      },
      () => {
        setPackings((prev) => prev.filter((p) => p.id !== id));
        if (editingPackingId === id) {
          setEditingPackingId(null);
        }
        addAuditLog({
          action: 'DELETE',
          module: 'Packing',
          entityId: target?.invoiceNumber || id,
          summary: `Super Admin verified & deleted export packing list ${target?.invoiceNumber || id} (${target?.shippingMark || 'Unknown Mark'})`,
          details: `Weight: ${target?.totalWeight ?? 0} KG · Value: RMB ${(target?.totalAmount ?? 0).toLocaleString()}`,
        });
        showToast(`Super Admin verified: Packing record ${target?.invoiceNumber || ''} deleted from database.`);
      }
    );
  };

  const batchDeletePackings = (ids: string[]): number => {
    if (!ids || ids.length === 0) return 0;
    const { remaining, deleted, deletedCount } = filterRecordsAfterBatchDelete(packings, ids);
    if (deletedCount === 0) return 0;

    setPackings(remaining);
    if (editingPackingId && ids.includes(editingPackingId)) {
      setEditingPackingId(null);
    }
    addAuditLog({
      action: 'DELETE',
      module: 'Packing',
      entityId: `BATCH-PKG-DEL-${deletedCount}`,
      summary: `Batch deleted ${deletedCount} export packing list record(s)`,
      details: `Manifests: ${deleted.map((d) => d.invoiceNumber).slice(0, 6).join(', ')}`,
    });
    showToast(`Deleted ${deletedCount} selected packing list record(s) from database.`);
    return deletedCount;
  };

  const batchUpdatePackingsStatus = (ids: string[], status: ExporterStatus): number => {
    if (!ids || ids.length === 0 || !status) return 0;
    const targetSet = new Set(ids);
    const cleanStatus = status.trim().toUpperCase();
    let updatedCount = 0;

    setPackings((prev) =>
      prev.map((pkg) => {
        if (!targetSet.has(pkg.id)) return pkg;
        updatedCount++;
        return {
          ...pkg,
          ...buildBatchStatusUpdateForPacking(pkg, cleanStatus),
        };
      })
    );

    if (updatedCount > 0) {
      addAuditLog({
        action: 'UPDATE',
        module: 'Packing',
        entityId: `BATCH-PKG-STATUS-${updatedCount}`,
        summary: `Batch updated status to ${cleanStatus} for ${updatedCount} packing list record(s)`,
      });
      showToast(`Updated status to ${cleanStatus} for ${updatedCount} selected packing record(s).`);
    }
    return updatedCount;
  };

  const bulkImportPackings = (
    records: Omit<PackingRecord, 'id' | 'createdAt'>[],
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!records || records.length === 0) return 0;
    const now = new Date().toISOString();
    const mergedIncoming = mergePackingRecordsByShipmentGroup(
      records,
      mode === 'replace' ? 0 : packings.length
    );

    if (mode === 'replace') {
      const hydrated: PackingRecord[] = mergedIncoming.map((rec) => ({
        ...rec,
        id: generateRecordId('pkg'),
        createdAt: now,
      }));
      setPackings(hydrated);
      addAuditLog({
        action: 'IMPORT',
        module: 'Packing',
        entityId: `BULK-PKG-${hydrated.length}`,
        summary: `Bulk imported ${hydrated.length} merged packing list manifest(s) (replace mode)`,
      });
      return hydrated.length;
    }

    const upsertResult = upsertPackingsInPlace(
      packings,
      mergedIncoming,
      generateRecordId,
      now
    );
    setPackings(upsertResult.records);

    addAuditLog({
      action: 'IMPORT',
      module: 'Packing',
      entityId: `BULK-PKG-${mergedIncoming.length}`,
      summary: `Imported Packings: ${upsertResult.insertedCount} added, ${upsertResult.updatedCount} updated in place, ${upsertResult.unchangedCount} identical unchanged`,
    });
    return upsertResult.insertedCount + upsertResult.updatedCount;
  };

  // Payments CRUD
  const addPayment = (record: Omit<PaymentRecord, 'id' | 'createdAt'>) => {
    const id = generateRecordId('pay');
    const rowDebit = Array.isArray(record.items)
      ? record.items.reduce((s, r) => s + (Number(r.debitAmount) || 0), 0)
      : 0;
    const rowCredit = Array.isArray(record.items)
      ? record.items.reduce((s, r) => s + (Number(r.creditAmount) || 0), 0)
      : 0;
    const isSupplier = record.paymentCategory !== 'exporter';
    const normalizedTotal = isSupplier
      ? Math.round((Number(record.totalAmount) || rowDebit || 0) * 100) / 100
      : record.totalAmount;
    const normalizedPaid = isSupplier
      ? Math.round((Number(record.paidAmount) || rowCredit || 0) * 100) / 100
      : record.paidAmount;
    const normalizedBalance =
      isSupplier && Number(record.paidAmount) === 0 && (rowCredit > 0 || rowDebit > 0)
        ? Math.round((normalizedTotal - normalizedPaid) * 100) / 100
        : record.balance;

    const newRecord: PaymentRecord = {
      ...record,
      totalAmount: normalizedTotal,
      paidAmount: normalizedPaid,
      balance: normalizedBalance,
      id,
      createdAt: new Date().toISOString(),
    };
    setPayments((prev) => [newRecord, ...prev]);
    emitPaymentSyncTrigger({
      category: newRecord.paymentCategory === 'exporter' ? 'exporter' : 'supplier',
      action: 'confirm',
      invoiceNumber: newRecord.invoiceNumber,
      partyName: newRecord.description,
      debitAmount: newRecord.totalAmount,
      creditAmount: newRecord.paidAmount,
      runningBalance: newRecord.balance,
    });
    addAuditLog({
      action: 'CREATE',
      module: 'Payment',
      entityId: newRecord.invoiceNumber,
      summary: `Recorded ${newRecord.paymentCategory === 'exporter' ? 'exporter' : 'supplier'} payment voucher ${newRecord.invoiceNumber} (${newRecord.description})`,
      details: `Debit: ${companyProfile.currency} ${newRecord.totalAmount.toLocaleString()} · Credit: ${companyProfile.currency} ${newRecord.paidAmount.toLocaleString()} · Balance: ${companyProfile.currency} ${newRecord.balance.toLocaleString()} · Status: ${newRecord.status}`,
    });
    showToast(`Payment voucher ${newRecord.invoiceNumber} saved to database!`);
    return id;
  };

  const updatePayment = (id: string, record: Partial<PaymentRecord>) => {
    const target = payments.find((p) => p.id === id);
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...record } : p)));
    emitPaymentSyncTrigger({
      category:
        (record.paymentCategory || target?.paymentCategory) === 'exporter'
          ? 'exporter'
          : 'supplier',
      action: 'update',
      invoiceNumber: record.invoiceNumber || target?.invoiceNumber || id,
      partyName: record.description || target?.description,
      debitAmount: record.totalAmount ?? target?.totalAmount,
      creditAmount: record.paidAmount ?? target?.paidAmount,
      runningBalance: record.balance ?? target?.balance,
    });
    addAuditLog({
      action: 'UPDATE',
      module: 'Payment',
      entityId: record.invoiceNumber || target?.invoiceNumber || id,
      summary: `Edited payment voucher ${record.invoiceNumber || target?.invoiceNumber || id}`,
      details: `Party: ${record.description || target?.description || '-'} · Total: ${companyProfile.currency} ${(record.totalAmount ?? target?.totalAmount ?? 0).toLocaleString()}`,
    });
    showToast(`Payment voucher updated.`);
  };

  const deletePayment = (id: string) => {
    const target = payments.find((p) => p.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'payment',
        recordId: id,
        recordTitle: target
          ? `${target.invoiceNumber} — ${target.description}`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date} · Paid: ${companyProfile.currency} ${(target.paidAmount ?? 0).toLocaleString()}`
          : undefined,
      },
      () => {
        setPayments((prev) => prev.filter((p) => p.id !== id));
        if (editingPaymentId === id) {
          setEditingPaymentId(null);
        }
        emitPaymentSyncTrigger({
          category: target?.paymentCategory === 'exporter' ? 'exporter' : 'supplier',
          action: 'delete',
          invoiceNumber: target?.invoiceNumber || id,
          partyName: target?.description,
        });
        addAuditLog({
          action: 'DELETE',
          module: 'Payment',
          entityId: target?.invoiceNumber || id,
          summary: `Super Admin verified & deleted payment voucher ${target?.invoiceNumber || id} (${target?.description || 'Unknown Party'})`,
          details: `Amount: ${companyProfile.currency} ${(target?.totalAmount ?? 0).toLocaleString()}`,
        });
        showToast(`Super Admin verified: Payment record ${target?.invoiceNumber || ''} deleted from database.`);
      }
    );
  };

  const batchDeletePayments = (ids: string[]): number => {
    if (!ids || ids.length === 0) return 0;
    const { remaining, deleted, deletedCount } = filterRecordsAfterBatchDelete(payments, ids);
    if (deletedCount === 0) return 0;

    setPayments(remaining);
    if (editingPaymentId && ids.includes(editingPaymentId)) {
      setEditingPaymentId(null);
    }
    emitPaymentSyncTrigger({
      category: deleted[0]?.paymentCategory === 'exporter' ? 'exporter' : 'supplier',
      action: 'delete',
      invoiceNumber: deleted.map((d) => d.invoiceNumber).slice(0, 3).join(', '),
      partyName: deleted[0]?.description,
    });
    addAuditLog({
      action: 'DELETE',
      module: 'Payment',
      entityId: `BATCH-PAY-DEL-${deletedCount}`,
      summary: `Batch deleted ${deletedCount} payment voucher record(s)`,
      details: `Vouchers: ${deleted.map((d) => d.invoiceNumber).slice(0, 6).join(', ')}`,
    });
    showToast(`Deleted ${deletedCount} selected payment voucher(s) from database.`);
    return deletedCount;
  };

  const batchUpdatePaymentsStatus = (ids: string[], status: ExporterStatus): number => {
    if (!ids || ids.length === 0 || !status) return 0;
    const targetSet = new Set(ids);
    const cleanStatus = status.trim().toUpperCase();
    let updatedCount = 0;

    setPayments((prev) =>
      prev.map((pm) => {
        if (!targetSet.has(pm.id)) return pm;
        updatedCount++;
        return {
          ...pm,
          ...buildBatchStatusUpdateForPayment(pm, cleanStatus),
        };
      })
    );

    if (updatedCount > 0) {
      emitPaymentSyncTrigger({
        category: 'supplier',
        action: 'update',
        invoiceNumber: `BATCH-${updatedCount}`,
      });
      addAuditLog({
        action: 'UPDATE',
        module: 'Payment',
        entityId: `BATCH-PAY-STATUS-${updatedCount}`,
        summary: `Batch updated status to ${cleanStatus} for ${updatedCount} payment voucher(s)`,
      });
      showToast(`Updated status to ${cleanStatus} for ${updatedCount} selected payment record(s).`);
    }
    return updatedCount;
  };

  const bulkImportPayments = (
    records: Omit<PaymentRecord, 'id' | 'createdAt'>[],
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!records || records.length === 0) return 0;
    const now = new Date().toISOString();
    if (mode === 'replace') {
      const hydrated: PaymentRecord[] = records.map((rec) => ({
        ...rec,
        id: generateRecordId('pay'),
        createdAt: now,
      }));
      setPayments(hydrated);
      addAuditLog({
        action: 'IMPORT',
        module: 'Payment',
        entityId: `BULK-PAY-${hydrated.length}`,
        summary: `Bulk imported ${hydrated.length} payment voucher(s) (replace mode)`,
      });
      return hydrated.length;
    }

    const upsertResult = upsertPaymentsInPlace(
      payments,
      records,
      generateRecordId,
      now
    );
    setPayments(upsertResult.records);
    addAuditLog({
      action: 'IMPORT',
      module: 'Payment',
      entityId: `BULK-PAY-${records.length}`,
      summary: `Imported Payments: ${upsertResult.insertedCount} added, ${upsertResult.updatedCount} updated in place, ${upsertResult.unchangedCount} identical unchanged`,
    });
    return upsertResult.insertedCount + upsertResult.updatedCount;
  };

  // Other Costs CRUD
  const addOtherCost = (record: Omit<OtherCostRecord, 'id' | 'createdAt'>) => {
    const id = generateRecordId('cost');
    const newRecord: OtherCostRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    setOtherCosts((prev) => [newRecord, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'OtherCost',
      entityId: id,
      summary: `Recorded operating expense "${newRecord.category}" (${newRecord.description || 'General Cost'})`,
      details: `Amount: ${companyProfile.currency} ${newRecord.amount.toLocaleString()}`,
    });
    showToast(`Expense recorded in Profit & Loss.`);
    return id;
  };

  const deleteOtherCost = (id: string) => {
    const target = otherCosts.find((c) => c.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'other_cost',
        recordId: id,
        recordTitle: target
          ? `${target.category}${target.description ? ` — ${target.description}` : ''}`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date} · Amount: ${companyProfile.currency} ${(target.amount ?? 0).toLocaleString()}`
          : undefined,
      },
      () => {
        setOtherCosts((prev) => prev.filter((c) => c.id !== id));
        addAuditLog({
          action: 'DELETE',
          module: 'OtherCost',
          entityId: id,
          summary: `Super Admin verified & deleted operating expense "${target?.category || id}"`,
          details: `Amount: ${companyProfile.currency} ${(target?.amount ?? 0).toLocaleString()}`,
        });
        showToast(`Super Admin verified: Expense deleted.`);
      }
    );
  };

  const bulkImportOtherCosts = (
    records: Omit<OtherCostRecord, 'id' | 'createdAt'>[],
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!records || records.length === 0) return 0;
    const now = new Date().toISOString();
    if (mode === 'replace') {
      const hydrated: OtherCostRecord[] = records.map((rec) => ({
        ...rec,
        id: generateRecordId('cost'),
        createdAt: now,
      }));
      setOtherCosts(hydrated);
      addAuditLog({
        action: 'IMPORT',
        module: 'OtherCost',
        entityId: `BULK-COST-${hydrated.length}`,
        summary: `Bulk imported ${hydrated.length} operating expense record(s) (replace mode)`,
      });
      return hydrated.length;
    }

    const upsertResult = upsertOtherCostsInPlace(
      otherCosts,
      records,
      generateRecordId,
      now
    );
    setOtherCosts(upsertResult.records);
    addAuditLog({
      action: 'IMPORT',
      module: 'OtherCost',
      entityId: `BULK-COST-${records.length}`,
      summary: `Imported Other Costs: ${upsertResult.insertedCount} added, ${upsertResult.updatedCount} updated in place, ${upsertResult.unchangedCount} identical unchanged`,
    });
    return upsertResult.insertedCount + upsertResult.updatedCount;
  };

  // Partner Deposit Share CRUD (Total Balance Capital)
  const addPartnerDeposit = (
    record: Omit<PartnerDepositRecord, 'id' | 'createdAt'>
  ): string => {
    const id = generateRecordId('pdep');
    const newRecord: PartnerDepositRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    setPartnerDeposits((prev) => [newRecord, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'PartnerDeposit',
      entityId: id,
      summary: `Recorded Partner Deposit Share for "${newRecord.partnerName}"`,
      details: `Date: ${newRecord.date} · Amount: ${companyProfile.currency} ${newRecord.amount.toLocaleString()}`,
    });
    showToast(
      `Partner deposit share (${companyProfile.currency} ${newRecord.amount.toLocaleString()}) added to Total Balance.`
    );
    return id;
  };

  const updatePartnerDeposit = (id: string, record: Partial<PartnerDepositRecord>) => {
    const target = partnerDeposits.find((d) => d.id === id);
    setPartnerDeposits((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...record } : d))
    );
    addAuditLog({
      action: 'UPDATE',
      module: 'PartnerDeposit',
      entityId: id,
      summary: `Updated partner deposit for "${record.partnerName || target?.partnerName || id}"`,
      details: `Amount: ${companyProfile.currency} ${(record.amount ?? target?.amount ?? 0).toLocaleString()}`,
    });
    showToast('Partner deposit share entry updated.');
  };

  const deletePartnerDeposit = (id: string) => {
    const target = partnerDeposits.find((d) => d.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'partner_deposit',
        recordId: id,
        recordTitle: target
          ? `${target.partnerName} (${companyProfile.currency} ${(target.amount ?? 0).toLocaleString()})`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date}${target.paymentMethod ? ` · ${target.paymentMethod}` : ''}`
          : undefined,
      },
      () => {
        setPartnerDeposits((prev) => prev.filter((d) => d.id !== id));
        addAuditLog({
          action: 'DELETE',
          module: 'PartnerDeposit',
          entityId: id,
          summary: `Super Admin verified & deleted partner deposit for "${target?.partnerName || id}"`,
          details: `Amount: ${companyProfile.currency} ${(target?.amount ?? 0).toLocaleString()}`,
        });
        showToast('Super Admin verified: Partner deposit deleted.');
      }
    );
  };

  const triggerAutomatedPartnerAlert = async (input: {
    eventType: 'partner_withdrawal' | 'profit_distribution';
    eventId: string;
    amount: number;
    withdrawal?: PartnerAlertEmailPayload['withdrawal'];
    profitDistribution?: PartnerAlertEmailPayload['profitDistribution'];
    nextWithdrawals?: PartnerWithdrawalRecord[];
  }) => {
    if (companyProfile.partnerAlertsEnabled === false) {
      return;
    }

    const activeWithdrawals = input.nextWithdrawals ?? partnerWithdrawals;
    const directory = buildPartnerDirectory(
      companyProfile,
      partnerDeposits,
      activeWithdrawals
    );
    const resolvedEntries = resolvePartnerEmailDirectory(
      directory,
      companyProfile.partnerEmails,
      loadInitialTeamMembers()
    );
    const recipients = collectValidPartnerRecipients(resolvedEntries);

    const payload: PartnerAlertEmailPayload = {
      eventType: input.eventType,
      companyName: companyProfile.companyName || 'ZSB AQUATICS',
      currency: companyProfile.currency || 'TK',
      triggeredBy: currentUser
        ? `${currentUser.displayName} (${currentUser.role})`
        : 'Md. Sohel Rana (Partner & Administrator)',
      recipients,
      withdrawal: input.withdrawal,
      profitDistribution: input.profitDistribution,
    };

    const preview = buildPartnerAlertEmailContent(payload);
    const logId = generateRecordId('palert');
    const triggeredAt = new Date().toISOString();

    if (recipients.length === 0) {
      const noRecipientLog: PartnerNotificationLogRecord = {
        id: logId,
        eventType: input.eventType,
        eventId: input.eventId,
        triggeredAt,
        subject: preview.subject,
        recipients: [],
        status: 'failed',
        mode: 'client_error',
        errorDetail: 'No partner email addresses configured in Total Balance alerts.',
        amount: input.amount,
        currency: companyProfile.currency || 'TK',
        summaryLine: preview.summaryLine,
        previewHtml: preview.html,
        previewText: preview.text,
      };
      setPartnerNotifications((prev) => [noRecipientLog, ...prev].slice(0, 100));
      addAuditLog({
        action: 'UPDATE',
        module: 'PartnerNotification',
        entityId: input.eventId,
        summary: `Skipped partner email alert (${input.eventType}): no partner email recipients configured`,
      });
      return;
    }

    const pendingLog: PartnerNotificationLogRecord = {
      id: logId,
      eventType: input.eventType,
      eventId: input.eventId,
      triggeredAt,
      subject: preview.subject,
      recipients,
      status: 'sending',
      mode: 'local_dispatch',
      amount: input.amount,
      currency: companyProfile.currency || 'TK',
      summaryLine: preview.summaryLine,
      previewHtml: preview.html,
      previewText: preview.text,
    };
    setPartnerNotifications((prev) => [pendingLog, ...prev].slice(0, 100));

    try {
      const response = await fetch('/api/notifications/partner-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        mode?: 'resend_email' | 'local_dispatch' | 'resend_error_fallback';
        messageId?: string;
        errorDetail?: string;
        error?: string;
      };

      const ok = response.ok && Boolean(data.ok);
      const resolvedMode =
        data.mode === 'resend_email'
          ? 'resend_email'
          : data.mode === 'resend_error_fallback'
            ? 'resend_error_fallback'
            : ok
              ? 'local_dispatch'
              : 'client_error';

      const status: PartnerNotificationLogRecord['status'] =
        resolvedMode === 'resend_email'
          ? 'sent_resend'
          : ok && resolvedMode !== 'resend_error_fallback'
            ? 'local_dispatch'
            : 'failed';

      setPartnerNotifications((prev) =>
        prev.map((item) =>
          item.id === logId
            ? {
                ...item,
                status,
                mode: resolvedMode,
                messageId: data.messageId || item.messageId,
                errorDetail: data.errorDetail || (!ok ? data.error || `HTTP ${response.status}` : undefined),
              }
            : item
        )
      );

      addAuditLog({
        action: 'CREATE',
        module: 'PartnerNotification',
        entityId: data.messageId || logId,
        summary:
          status === 'sent_resend'
            ? `Sent Resend email alert to ${recipients.length} partner(s): ${preview.subject}`
            : status === 'local_dispatch'
              ? `Dispatched partner alert locally (${recipients.length} recipient(s), RESEND_API_KEY not configured): ${preview.subject}`
              : `Partner email alert fallback (${data.errorDetail || data.error || 'Dispatch error'})`,
        details: `To: ${recipients.map((r) => r.email).join(', ')}`,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error sending alert';
      setPartnerNotifications((prev) =>
        prev.map((item) =>
          item.id === logId
            ? {
                ...item,
                status: 'failed',
                mode: 'client_error',
                errorDetail: errMsg,
              }
            : item
        )
      );
      addAuditLog({
        action: 'UPDATE',
        module: 'PartnerNotification',
        entityId: logId,
        summary: `Failed to dispatch partner email alert: ${errMsg}`,
      });
    }
  };

  // Partner Withdrawal CRUD (Deducted from Total Balance & Partner Equity)
  const addPartnerWithdrawal = (
    record: Omit<PartnerWithdrawalRecord, 'id' | 'createdAt'>
  ): string => {
    const id = generateRecordId('pwdr');
    const newRecord: PartnerWithdrawalRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    const nextWithdrawals = [newRecord, ...partnerWithdrawals];
    setPartnerWithdrawals(nextWithdrawals);
    addAuditLog({
      action: 'CREATE',
      module: 'PartnerWithdrawal',
      entityId: id,
      summary: `Logged Partner Withdrawal for "${newRecord.partnerName}"`,
      details: `Date: ${newRecord.date} · Amount: ${companyProfile.currency} ${newRecord.amount.toLocaleString()}`,
    });

    const updatedSummary = calculateTotalBalanceSummary({
      partnerDeposits,
      partnerWithdrawals: nextWithdrawals,
      profitDistributions,
      balanceIncomes,
      purchases,
      packings,
      otherCosts,
    });

    void triggerAutomatedPartnerAlert({
      eventType: 'partner_withdrawal',
      eventId: id,
      amount: newRecord.amount,
      nextWithdrawals,
      withdrawal: {
        id,
        date: newRecord.date,
        partnerName: newRecord.partnerName,
        amount: newRecord.amount,
        paymentMethod: newRecord.paymentMethod,
        referenceNo: newRecord.referenceNo,
        notes: newRecord.notes,
        updatedTotalBalance: updatedSummary.totalBalance,
        partnerShares: updatedSummary.partnerShares.map((s) => ({
          partnerName: s.partnerName,
          equityPercent: s.sharePercent,
          netCapital: s.netContribution,
        })),
      },
    });

    const recipientCount = collectValidPartnerRecipients(
      resolvePartnerEmailDirectory(
        buildPartnerDirectory(companyProfile, partnerDeposits, nextWithdrawals),
        companyProfile.partnerEmails,
        loadInitialTeamMembers()
      )
    ).length;

    showToast(
      companyProfile.partnerAlertsEnabled !== false && recipientCount > 0
        ? `Partner withdrawal (${companyProfile.currency} ${newRecord.amount.toLocaleString()}) deducted & email alert triggered for ${recipientCount} partner(s).`
        : `Partner withdrawal (${companyProfile.currency} ${newRecord.amount.toLocaleString()}) deducted from Total Balance.`
    );
    return id;
  };

  const deletePartnerWithdrawal = (id: string) => {
    const target = partnerWithdrawals.find((w) => w.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'partner_withdrawal',
        recordId: id,
        recordTitle: target
          ? `${target.partnerName} (${companyProfile.currency} ${(target.amount ?? 0).toLocaleString()})`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date}${target.paymentMethod ? ` · ${target.paymentMethod}` : ''}`
          : undefined,
      },
      () => {
        setPartnerWithdrawals((prev) => prev.filter((w) => w.id !== id));
        addAuditLog({
          action: 'DELETE',
          module: 'PartnerWithdrawal',
          entityId: id,
          summary: `Super Admin verified & deleted partner withdrawal for "${target?.partnerName || id}"`,
          details: `Amount: ${companyProfile.currency} ${(target?.amount ?? 0).toLocaleString()}`,
        });
        showToast('Super Admin verified: Partner withdrawal deleted.');
      }
    );
  };

  // Monthly Profit Distribution & Partner Payout CRUD
  const issueProfitDistribution = (
    record: Omit<ProfitDistributionRecord, 'id' | 'createdAt'>
  ): string => {
    const id = generateRecordId('pdist');
    const newRecord: ProfitDistributionRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    const nextDistributions = [newRecord, ...profitDistributions];
    setProfitDistributions(nextDistributions);
    const splitSummary = (newRecord.allocations || [])
      .filter((a) => Number(a.payoutAmount) > 0)
      .map((a) => `${a.partnerName}: ${companyProfile.currency} ${a.payoutAmount.toLocaleString()} (${a.equityPercent.toFixed(2)}%)`)
      .join(' · ');
    addAuditLog({
      action: 'CREATE',
      module: 'ProfitDistribution',
      entityId: id,
      summary: `Issued profit distribution payout for ${newRecord.targetYearMonth} (${companyProfile.currency} ${newRecord.distributedAmount.toLocaleString()})`,
      details: splitSummary || `Payout Date: ${newRecord.payoutDate}`,
    });

    const updatedSummary = calculateTotalBalanceSummary({
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions: nextDistributions,
      balanceIncomes,
      purchases,
      packings,
      otherCosts,
    });

    void triggerAutomatedPartnerAlert({
      eventType: 'profit_distribution',
      eventId: id,
      amount: newRecord.distributedAmount,
      profitDistribution: {
        id,
        targetYearMonth: newRecord.targetYearMonth,
        payoutDate: newRecord.payoutDate,
        calculatedNetProfit: newRecord.calculatedNetProfit,
        distributedAmount: newRecord.distributedAmount,
        retainedAmount: newRecord.retainedAmount,
        paymentMethod: newRecord.paymentMethod,
        referenceNo: newRecord.referenceNo,
        notes: newRecord.notes,
        updatedTotalBalance: updatedSummary.totalBalance,
        allocations: newRecord.allocations,
      },
    });

    const recipientCount = collectValidPartnerRecipients(
      resolvePartnerEmailDirectory(
        buildPartnerDirectory(companyProfile, partnerDeposits, partnerWithdrawals),
        companyProfile.partnerEmails,
        loadInitialTeamMembers()
      )
    ).length;

    showToast(
      companyProfile.partnerAlertsEnabled !== false && recipientCount > 0
        ? `Profit payout (${companyProfile.currency} ${newRecord.distributedAmount.toLocaleString()}) issued & email alert triggered for ${recipientCount} partner(s).`
        : `Profit payout (${companyProfile.currency} ${newRecord.distributedAmount.toLocaleString()}) issued for ${newRecord.targetYearMonth} and deducted from Total Balance.`
    );
    return id;
  };

  const deleteProfitDistribution = (id: string) => {
    const target = profitDistributions.find((d) => d.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'profit_distribution',
        recordId: id,
        recordTitle: target
          ? `${target.targetYearMonth} Profit Payout (${companyProfile.currency} ${(target.distributedAmount ?? 0).toLocaleString()})`
          : id,
        recordSubtitle: target
          ? `Payout Date: ${target.payoutDate} · ${(target.allocations || []).filter((a) => a.payoutAmount > 0).length} partner(s)`
          : undefined,
      },
      () => {
        setProfitDistributions((prev) => prev.filter((d) => d.id !== id));
        addAuditLog({
          action: 'DELETE',
          module: 'ProfitDistribution',
          entityId: id,
          summary: `Super Admin verified & deleted profit distribution payout (${target?.targetYearMonth || id})`,
          details: `Amount: ${companyProfile.currency} ${(target?.distributedAmount ?? 0).toLocaleString()}`,
        });
        showToast('Super Admin verified: Profit distribution payout deleted.');
      }
    );
  };

  // Direct Income CRUD (Total Balance Income)
  const addBalanceIncome = (
    record: Omit<BalanceIncomeRecord, 'id' | 'createdAt'>
  ): string => {
    const id = generateRecordId('binc');
    const newRecord: BalanceIncomeRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    setBalanceIncomes((prev) => [newRecord, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'BalanceIncome',
      entityId: id,
      summary: `Added income "${newRecord.source}" to Total Balance`,
      details: `Date: ${newRecord.date} · Amount: ${companyProfile.currency} ${newRecord.amount.toLocaleString()}`,
    });
    showToast(
      `Income (${companyProfile.currency} ${newRecord.amount.toLocaleString()}) added to Total Balance.`
    );
    return id;
  };

  // Recurring Monthly Fixed Expenses CRUD & Automation
  const addRecurringExpense = (
    record: Omit<RecurringExpenseRecord, 'id' | 'createdAt' | 'lastProcessedYearMonth'>
  ): { id: string; autoDeductedCount: number } => {
    const id = generateRecordId('rexp');
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);

    const baseRule: RecurringExpenseRecord = {
      ...record,
      id,
      createdAt: nowIso,
    };

    const dueCycles = baseRule.autoDeduct
      ? getDueRecurringExpenseCycles([baseRule], otherCosts, todayStr)
      : [];

    let lastProcessedYearMonth: string | undefined;
    const generatedCosts: OtherCostRecord[] = dueCycles.map((cycle) => {
      if (!lastProcessedYearMonth || cycle.yearMonth > lastProcessedYearMonth) {
        lastProcessedYearMonth = cycle.yearMonth;
      }
      return {
        ...buildRecurringCostDeductionRecord(baseRule, cycle.yearMonth),
        id: generateRecordId('cost'),
        createdAt: nowIso,
      };
    });

    const finalRule: RecurringExpenseRecord = lastProcessedYearMonth
      ? { ...baseRule, lastProcessedYearMonth }
      : baseRule;

    setRecurringExpenses((prev) => [finalRule, ...prev]);
    if (generatedCosts.length > 0) {
      setOtherCosts((prev) => [...generatedCosts.reverse(), ...prev]);
    }

    const autoSum = generatedCosts.reduce((s, c) => s + c.amount, 0);
    addAuditLog({
      action: 'CREATE',
      module: 'RecurringExpense',
      entityId: id,
      summary: `Created monthly recurring expense "${finalRule.title}" (${companyProfile.currency} ${finalRule.amount.toLocaleString()}/mo, Day ${finalRule.billingDay})`,
      details:
        generatedCosts.length > 0
          ? `Auto-deducted ${generatedCosts.length} due cycle(s) totaling ${companyProfile.currency} ${autoSum.toLocaleString()} from Total Balance`
          : `Auto-Deduct: ${finalRule.autoDeduct ? 'ON' : 'PAUSED'} · Start: ${finalRule.startYearMonth}`,
    });

    showToast(
      generatedCosts.length > 0
        ? `Saved "${finalRule.title}" & auto-deducted ${generatedCosts.length} due payment(s) (${companyProfile.currency} ${autoSum.toLocaleString()}) from Total Balance.`
        : `Recurring fixed expense "${finalRule.title}" scheduled (Day ${finalRule.billingDay} monthly).`
    );

    return { id, autoDeductedCount: generatedCosts.length };
  };

  const toggleRecurringExpenseAutoDeduct = (ruleId: string) => {
    const target = recurringExpenses.find((r) => r.id === ruleId);
    if (!target) return;
    const nextAuto = !target.autoDeduct;
    setRecurringExpenses((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, autoDeduct: nextAuto } : r))
    );
    addAuditLog({
      action: 'UPDATE',
      module: 'RecurringExpense',
      entityId: ruleId,
      summary: `${nextAuto ? 'Resumed' : 'Paused'} auto-deduction for "${target.title}"`,
    });
    showToast(
      nextAuto
        ? `Auto-deduction resumed for "${target.title}".`
        : `Auto-deduction paused for "${target.title}".`
    );
  };

  const deleteRecurringExpense = (ruleId: string) => {
    const target = recurringExpenses.find((r) => r.id === ruleId);
    if (!target) return;
    setRecurringExpenses((prev) => prev.filter((r) => r.id !== ruleId));
    addAuditLog({
      action: 'DELETE',
      module: 'RecurringExpense',
      entityId: ruleId,
      summary: `Deleted recurring expense rule "${target.title}"`,
      details: `Monthly Fixed Cost was ${companyProfile.currency} ${target.amount.toLocaleString()}`,
    });
    showToast(`Deleted recurring expense rule "${target.title}".`);
  };

  const runDueRecurringExpensesNow = (silent: boolean = false): number => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dueCycles = getDueRecurringExpenseCycles(recurringExpenses, otherCosts, todayStr);
    if (dueCycles.length === 0) {
      if (!silent) {
        showToast('All active monthly recurring expenses are already deducted through today.');
      }
      return 0;
    }

    const nowIso = new Date().toISOString();
    const generatedCosts: OtherCostRecord[] = [];
    const latestMonthByRule = new Map<string, string>();

    for (const cycle of dueCycles) {
      const dup = generatedCosts.some(
        (c) =>
          c.recurringExpenseId === cycle.rule.id &&
          c.recurringYearMonth === cycle.yearMonth
      );
      if (dup) continue;

      generatedCosts.push({
        ...buildRecurringCostDeductionRecord(cycle.rule, cycle.yearMonth),
        id: generateRecordId('cost'),
        createdAt: nowIso,
      });

      const prevLatest = latestMonthByRule.get(cycle.rule.id);
      if (!prevLatest || cycle.yearMonth > prevLatest) {
        latestMonthByRule.set(cycle.rule.id, cycle.yearMonth);
      }
    }

    if (generatedCosts.length === 0) return 0;

    setOtherCosts((prev) => [...generatedCosts.reverse(), ...prev]);
    setRecurringExpenses((prev) =>
      prev.map((rule) => {
        const processedYm = latestMonthByRule.get(rule.id);
        if (!processedYm) return rule;
        if (rule.lastProcessedYearMonth && rule.lastProcessedYearMonth >= processedYm) {
          return rule;
        }
        return { ...rule, lastProcessedYearMonth: processedYm };
      })
    );

    const totalDeducted = generatedCosts.reduce((sum, c) => sum + c.amount, 0);
    addAuditLog({
      action: 'CREATE',
      module: 'RecurringExpense',
      entityId: generatedCosts[0]?.id,
      summary: `Processed ${generatedCosts.length} scheduled recurring expense deduction(s)`,
      details: `Total Deducted: ${companyProfile.currency} ${totalDeducted.toLocaleString()}`,
    });
    if (!silent) {
      showToast(
        `Deducted ${generatedCosts.length} due recurring expense(s) totaling ${companyProfile.currency} ${totalDeducted.toLocaleString()} from Total Balance.`
      );
    }
    return generatedCosts.length;
  };

  const deductRecurringExpenseNow = (ruleId: string): boolean => {
    const rule = recurringExpenses.find((r) => r.id === ruleId);
    if (!rule) return false;

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYearMonth = todayStr.slice(0, 7);

    if (hasRecurringDeductionForMonth(otherCosts, rule.id, currentYearMonth)) {
      showToast(`"${rule.title}" has already been deducted for ${currentYearMonth}.`);
      return false;
    }

    const nowIso = new Date().toISOString();
    const newCost: OtherCostRecord = {
      ...buildRecurringCostDeductionRecord(rule, currentYearMonth, todayStr),
      id: generateRecordId('cost'),
      createdAt: nowIso,
    };

    setOtherCosts((prev) => [newCost, ...prev]);
    setRecurringExpenses((prev) =>
      prev.map((r) =>
        r.id === rule.id
          ? {
              ...r,
              lastProcessedYearMonth:
                r.lastProcessedYearMonth && r.lastProcessedYearMonth >= currentYearMonth
                  ? r.lastProcessedYearMonth
                  : currentYearMonth,
            }
          : r
      )
    );

    addAuditLog({
      action: 'CREATE',
      module: 'RecurringExpense',
      entityId: newCost.id,
      summary: `Manually deducted monthly fixed expense "${rule.title}" for ${currentYearMonth}`,
      details: `Amount: ${companyProfile.currency} ${rule.amount.toLocaleString()}`,
    });
    showToast(
      `Deducted "${rule.title}" (${companyProfile.currency} ${rule.amount.toLocaleString()}) for ${currentYearMonth} from Total Balance.`
    );
    return true;
  };

  const addExternalDebt = (
    record: Omit<ExternalDebtRecord, 'id' | 'createdAt' | 'repayments'>
  ): string => {
    const id = generateRecordId('edebt');
    const createdAt = new Date().toISOString();
    const newDebt: ExternalDebtRecord = {
      ...record,
      id,
      repayments: [],
      createdAt,
    };
    const totalObligation = computeExternalDebtTotalObligation(newDebt);
    setExternalDebts((prev) => [newDebt, ...prev]);

    addAuditLog({
      action: 'CREATE',
      module: 'ExternalDebt',
      entityId: id,
      summary: `Recorded External Debt "${newDebt.title}" (${newDebt.lenderName}) — ${companyProfile.currency} ${totalObligation.toLocaleString()} automatically deducted from Total Balance`,
      details: `Principal: ${companyProfile.currency} ${newDebt.principalAmount.toLocaleString()} · Interest/Fee: ${companyProfile.currency} ${newDebt.interestAmount.toLocaleString()} · Schedule: ${newDebt.installmentCount}x (${newDebt.frequency}) starting ${newDebt.firstDueDate}`,
    });
    showToast(
      `External Debt "${newDebt.title}" added (${companyProfile.currency} ${totalObligation.toLocaleString()} deducted from Total Balance).`
    );
    return id;
  };

  const recordExternalDebtRepayment = (
    debtId: string,
    repayment: Omit<ExternalDebtRepayment, 'id' | 'createdAt'>
  ): string => {
    const target = externalDebts.find((d) => d.id === debtId);
    const id = generateRecordId('erep');
    const newRepayment: ExternalDebtRepayment = {
      ...repayment,
      id,
      createdAt: new Date().toISOString(),
    };
    setExternalDebts((prev) =>
      prev.map((debt) =>
        debt.id === debtId
          ? { ...debt, repayments: [newRepayment, ...(debt.repayments || [])] }
          : debt
      )
    );
    addAuditLog({
      action: 'UPDATE',
      module: 'ExternalDebt',
      entityId: debtId,
      summary: `Recorded repayment of ${companyProfile.currency} ${newRepayment.amount.toLocaleString()} toward "${target?.title || debtId}"`,
      details: `Date: ${newRepayment.date} · Method: ${newRepayment.paymentMethod || 'Bank Transfer'}${newRepayment.referenceNo ? ` · Ref: ${newRepayment.referenceNo}` : ''}`,
    });
    showToast(
      `Recorded ${companyProfile.currency} ${newRepayment.amount.toLocaleString()} repayment for "${target?.title || 'External Debt'}".`
    );
    return id;
  };

  const deleteExternalDebtRepayment = (debtId: string, repaymentId: string) => {
    const targetDebt = externalDebts.find((d) => d.id === debtId);
    const targetRep = targetDebt?.repayments?.find((r) => r.id === repaymentId);
    setExternalDebts((prev) =>
      prev.map((debt) =>
        debt.id === debtId
          ? {
              ...debt,
              repayments: (debt.repayments || []).filter((r) => r.id !== repaymentId),
            }
          : debt
      )
    );
    addAuditLog({
      action: 'DELETE',
      module: 'ExternalDebt',
      entityId: repaymentId,
      summary: `Removed repayment (${companyProfile.currency} ${(targetRep?.amount ?? 0).toLocaleString()}) from "${targetDebt?.title || debtId}"`,
    });
    showToast('External debt repayment removed and schedule updated.');
  };

  const deleteExternalDebt = (debtId: string) => {
    const target = externalDebts.find((d) => d.id === debtId);
    const obligation = target ? computeExternalDebtTotalObligation(target) : 0;
    requestSuperAdminSingleDelete(
      {
        recordType: 'other_cost',
        recordId: debtId,
        recordTitle: target
          ? `${target.title} (${target.lenderName}) — ${companyProfile.currency} ${obligation.toLocaleString()}`
          : debtId,
        recordSubtitle: target
          ? `Originated: ${target.originationDate} · ${target.installmentCount} installment(s)`
          : undefined,
      },
      () => {
        setExternalDebts((prev) => prev.filter((d) => d.id !== debtId));
        addAuditLog({
          action: 'DELETE',
          module: 'ExternalDebt',
          entityId: debtId,
          summary: `Super Admin verified & deleted External Debt "${target?.title || debtId}"`,
          details: `Restored ${companyProfile.currency} ${obligation.toLocaleString()} back to Total Balance`,
        });
        showToast('Super Admin verified: External Debt deleted & Total Balance updated.');
      }
    );
  };

  const deleteBalanceIncome = (id: string) => {
    const target = balanceIncomes.find((inc) => inc.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'balance_income',
        recordId: id,
        recordTitle: target
          ? `${target.source} (${companyProfile.currency} ${(target.amount ?? 0).toLocaleString()})`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date}${target.description ? ` · ${target.description}` : ''}`
          : undefined,
      },
      () => {
        setBalanceIncomes((prev) => prev.filter((inc) => inc.id !== id));
        addAuditLog({
          action: 'DELETE',
          module: 'BalanceIncome',
          entityId: id,
          summary: `Super Admin verified & deleted Total Balance income "${target?.source || id}"`,
          details: `Amount: ${companyProfile.currency} ${(target?.amount ?? 0).toLocaleString()}`,
        });
        showToast('Super Admin verified: Income entry deleted.');
      }
    );
  };

  // Supplier Credits CRUD & Application
  const addSupplierCredit = (input: {
    creditNoteNumber?: string;
    date: string;
    supplierName: string;
    refPurchaseInvoice?: string;
    reason?: string;
    amount: number;
    remarks?: string;
  }): SupplierCreditRecord => {
    const newCredit = createSupplierCreditRecord(input, supplierCredits.length);
    setSupplierCredits((prev) => [newCredit, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'SupplierCredit',
      entityId: newCredit.creditNoteNumber,
      summary: `Issued Supplier Credit Note ${newCredit.creditNoteNumber} for ${newCredit.supplierName}`,
      details: `Amount: ${companyProfile.currency} ${newCredit.amount.toLocaleString()} · Reason: ${newCredit.reason}`,
    });
    showToast(
      `Supplier Credit Note ${newCredit.creditNoteNumber} (${newCredit.supplierName}) recorded.`
    );
    return newCredit;
  };

  const applySupplierCredit = (
    creditId: string,
    application: {
      amount: number;
      date?: string;
      targetPaymentInvoice?: string;
      targetPurchaseInvoice?: string;
      notes?: string;
    }
  ): number => {
    let appliedDeltaResult = 0;
    let targetNoteNo = '';
    setSupplierCredits((prev) =>
      prev.map((cn) => {
        if (cn.id !== creditId) return cn;
        const { updatedCredit, appliedDelta } = applySupplierCreditNote(
          cn,
          application
        );
        appliedDeltaResult = appliedDelta;
        targetNoteNo = updatedCredit.creditNoteNumber;
        return updatedCredit;
      })
    );
    if (appliedDeltaResult > 0) {
      addAuditLog({
        action: 'UPDATE',
        module: 'SupplierCredit',
        entityId: targetNoteNo,
        summary: `Applied credit note ${targetNoteNo} towards supplier balance`,
        details: `Applied Amount: ${companyProfile.currency} ${appliedDeltaResult.toLocaleString()}`,
      });
      showToast(
        `Applied ${companyProfile.currency} ${appliedDeltaResult.toLocaleString()} from credit note ${targetNoteNo}.`
      );
    }
    return appliedDeltaResult;
  };

  const applySupplierCreditsForPayment = (
    supplierName: string,
    amountToApply: number,
    meta: {
      date?: string;
      targetPaymentInvoice?: string;
      targetPurchaseInvoice?: string;
      notes?: string;
      specificCreditId?: string;
    } = {}
  ): { totalApplied: number; affectedCreditNotes: string[] } => {
    const res = applyCreditAmountAcrossSupplierNotes(
      supplierCredits,
      supplierName,
      amountToApply,
      meta
    );
    if (res.totalApplied > 0) {
      setSupplierCredits(res.updatedCredits);
      showToast(
        `Applied ${companyProfile.currency} ${res.totalApplied.toLocaleString()} credit (${res.affectedCreditNotes.join(', ')}) to payment.`
      );
    }
    return {
      totalApplied: res.totalApplied,
      affectedCreditNotes: res.affectedCreditNotes,
    };
  };

  const deleteSupplierCredit = (id: string) => {
    const target = supplierCredits.find((cn) => cn.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'supplier_credit',
        recordId: id,
        recordTitle: target
          ? `${target.creditNoteNumber} — ${target.supplierName}`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date} · Credit: ${companyProfile.currency} ${(target.amount ?? 0).toLocaleString()}`
          : undefined,
      },
      () => {
        setSupplierCredits((prev) => prev.filter((cn) => cn.id !== id));
        addAuditLog({
          action: 'DELETE',
          module: 'SupplierCredit',
          entityId: target?.creditNoteNumber || id,
          summary: `Super Admin verified & deleted supplier credit note ${target?.creditNoteNumber || id}`,
          details: `Supplier: ${target?.supplierName || '-'} · Amount: ${companyProfile.currency} ${(target?.amount ?? 0).toLocaleString()}`,
        });
        showToast('Super Admin verified: Supplier credit note deleted.');
      }
    );
  };

  const addMortality = (record: Omit<MortalityRecord, 'id' | 'createdAt'>): string => {
    const newId = generateRecordId('mort');
    const newRecord: MortalityRecord = {
      ...record,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setMortalities((prev) => [newRecord, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'Mortality',
      entityId: newId,
      summary: `Logged mortality of ${newRecord.quantityKg} KG for ${newRecord.species}`,
      details: `Cause: ${newRecord.cause || 'Unspecified'} · Date: ${newRecord.date}`,
    });
    showToast(
      `Recorded mortality of ${newRecord.quantityKg} KG for ${newRecord.species}. Stock adjustment applied.`
    );
    return newId;
  };

  const updateMortality = (id: string, record: Partial<MortalityRecord>) => {
    const target = mortalities.find((m) => m.id === id);
    setMortalities((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...record } : m))
    );
    addAuditLog({
      action: 'UPDATE',
      module: 'Mortality',
      entityId: id,
      summary: `Updated mortality log for ${record.species || target?.species || id}`,
      details: `Quantity: ${record.quantityKg ?? target?.quantityKg ?? 0} KG`,
    });
    showToast('Updated mortality record and recalculated inventory stock.');
  };

  const deleteMortality = (id: string) => {
    const target = mortalities.find((m) => m.id === id);
    requestSuperAdminSingleDelete(
      {
        recordType: 'mortality',
        recordId: id,
        recordTitle: target
          ? `${target.species} (${target.quantityKg} KG)`
          : id,
        recordSubtitle: target
          ? `Date: ${target.date} · Cause: ${target.cause || 'Unspecified'}`
          : undefined,
      },
      () => {
        setMortalities((prev) => prev.filter((m) => m.id !== id));
        addAuditLog({
          action: 'DELETE',
          module: 'Mortality',
          entityId: id,
          summary: `Super Admin verified & deleted mortality record (${target?.quantityKg || 0} KG · ${target?.species || id})`,
        });
        showToast('Super Admin verified: Deleted mortality record. Stock adjustment restored.');
      }
    );
  };

  const addBusinessDocument = (
    record: Omit<BusinessDocumentRecord, 'id' | 'createdAt'>
  ): string => {
    const newId = generateRecordId('bdoc');
    const newDoc: BusinessDocumentRecord = {
      ...record,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setBusinessDocuments((prev) => [newDoc, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'BusinessDocument',
      entityId: newId,
      summary: `Tracked compliance document "${newDoc.title}" (${newDoc.category}) expiring ${newDoc.expiryDate}`,
      details: newDoc.referenceNumber ? `Ref: ${newDoc.referenceNumber}` : undefined,
    });
    showToast(`Added "${newDoc.title}" (Expires ${newDoc.expiryDate}) to document expiry monitor.`);
    return newId;
  };

  const updateBusinessDocument = (
    id: string,
    record: Partial<BusinessDocumentRecord>
  ) => {
    const target = businessDocuments.find((d) => d.id === id);
    setBusinessDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...record } : d))
    );
    addAuditLog({
      action: 'UPDATE',
      module: 'BusinessDocument',
      entityId: id,
      summary: `Updated compliance document "${record.title || target?.title || id}"`,
      details: record.expiryDate ? `New Expiry Date: ${record.expiryDate}` : undefined,
    });
    showToast(
      record.expiryDate
        ? `Updated expiry for "${record.title || target?.title || 'Document'}" to ${record.expiryDate}.`
        : 'Updated tracked document details.'
    );
  };

  const deleteBusinessDocument = (id: string) => {
    const target = businessDocuments.find((d) => d.id === id);
    setBusinessDocuments((prev) => prev.filter((d) => d.id !== id));
    addAuditLog({
      action: 'DELETE',
      module: 'BusinessDocument',
      entityId: id,
      summary: `Removed tracked compliance document "${target?.title || id}"`,
    });
    showToast(`Removed "${target?.title || 'Document'}" from document expiry tracker.`);
  };

  // Print modal & Global View Table PDF Export
  const [isExportingGlobalPdf, setIsExportingGlobalPdf] = useState<boolean>(false);
  const [lastExportedPdfFilename, setLastExportedPdfFilename] = useState<string | null>(null);
  const [liveDomTablesSnapshot, setLiveDomTablesSnapshot] = useState<
    ReturnType<typeof extractLiveDomTablesFromContainer>
  >([]);

  const globalViewReport = React.useMemo(
    () =>
      buildGlobalViewTableReport({
        activeTab,
        companyProfile,
        purchases,
        packings,
        payments,
        otherCosts,
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
        balanceIncomes,
        supplierCredits,
        packingDraft,
        dropdownOptions,
        domTables: liveDomTablesSnapshot,
      }),
    [
      activeTab,
      companyProfile,
      purchases,
      packings,
      payments,
      otherCosts,
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions,
      balanceIncomes,
      supplierCredits,
      packingDraft,
      dropdownOptions,
      liveDomTablesSnapshot,
    ]
  );

  // Clear stale DOM table snapshot whenever the user switches activeTab
  useEffect(() => {
    setLiveDomTablesSnapshot([]);
  }, [activeTab]);

  const openPrintModal = (modal: Omit<PrintModalData, 'isOpen'>) => {
    setPrintModalData({
      ...modal,
      isOpen: true,
    });
  };

  const closePrintModal = () => {
    setPrintModalData((prev) => ({ ...prev, isOpen: false }));
  };

  const exportCurrentViewToPdf = async (options?: {
    openPreviewOnly?: boolean;
  }): Promise<boolean> => {
    const mainEl =
      typeof document !== 'undefined'
        ? (document.querySelector('main') as HTMLElement | null)
        : null;
    const extractedDomTables = extractLiveDomTablesFromContainer(mainEl);
    setLiveDomTablesSnapshot(extractedDomTables);

    const freshReport = buildGlobalViewTableReport({
      activeTab,
      companyProfile,
      purchases,
      packings,
      payments,
      otherCosts,
      partnerDeposits,
      partnerWithdrawals,
      profitDistributions,
      balanceIncomes,
      supplierCredits,
      packingDraft,
      dropdownOptions,
      domTables: extractedDomTables,
    });

    if (options?.openPreviewOnly) {
      if (activeTab === 'exporter_payment_slip' && freshReport.exporterSlipPayload) {
        openPrintModal({
          type: 'exporter_payment_slip',
          title: freshReport.documentTitle,
          data: freshReport.exporterSlipPayload,
          items: freshReport.exporterSlipPayload.rows,
        });
      } else {
        openPrintModal({
          type: 'global_view_table',
          title: freshReport.documentTitle,
          data: freshReport,
        });
      }
      return true;
    }

    setIsExportingGlobalPdf(true);
    try {
      // Wait briefly so the offscreen #global-printable-document updates with freshReport
      await new Promise((resolve) => setTimeout(resolve, 60));
      const targetElementId = printModalData.isOpen
        ? 'printable-document'
        : 'global-printable-document';
      const success = await exportElementToPdf(targetElementId, freshReport.filename);
      if (success) {
        setLastExportedPdfFilename(freshReport.filename);
        showToast(`PDF downloaded: ${freshReport.filename}`);
        return true;
      } else {
        showToast('Error generating PDF for current view.');
        return false;
      }
    } catch (err) {
      console.error('Global PDF export failed:', err);
      showToast('Error generating PDF for current view.');
      return false;
    } finally {
      setIsExportingGlobalPdf(false);
    }
  };

  // Super Admin Password & Protected Clear Operations
  const updateSuperAdminPassword = (
    currentPasswordInput: string,
    newPassword: string,
    confirmPassword: string
  ): { valid: boolean; error?: string } => {
    const check = validateSuperAdminPasswordChange(
      currentPasswordInput,
      newPassword,
      confirmPassword,
      superAdminPassword
    );
    if (!check.valid || !check.normalizedNewPassword) {
      return { valid: false, error: check.error };
    }
    setSuperAdminPassword(check.normalizedNewPassword);
    try {
      localStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_PASSWORD, check.normalizedNewPassword);
      const members = loadInitialTeamMembers();
      const updatedMembers = members.map((m) =>
        m.isRoot || m.role === 'Super Admin'
          ? { ...m, password: check.normalizedNewPassword }
          : m
      );
      localStorage.setItem(TEAM_MEMBERS_STORAGE_KEY, JSON.stringify(updatedMembers));
    } catch {
      // Ignore storage error
    }
    showToast('Super Admin password updated successfully.');
    return { valid: true };
  };

  const resetAccountPasswordViaEmail = (
    account: RegisteredAccountMatch,
    newPassword: string,
    confirmPassword: string
  ): { valid: boolean; error?: string } => {
    const check = validatePasswordResetNewPassword(newPassword, confirmPassword);
    if (!check.valid || !check.normalizedPassword) {
      return { valid: false, error: check.error };
    }

    const currentMembers = loadInitialTeamMembers();
    const applied = applyResetPasswordToTeamMembers(
      currentMembers,
      account,
      check.normalizedPassword
    );

    try {
      localStorage.setItem(TEAM_MEMBERS_STORAGE_KEY, JSON.stringify(applied.updatedMembers));
      if (applied.shouldUpdateSuperAdminPassword) {
        setSuperAdminPassword(check.normalizedPassword);
        localStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_PASSWORD, check.normalizedPassword);
      }
    } catch {
      // Ignore storage error
    }

    addAuditLog({
      action: 'AUTH',
      module: 'Authentication',
      entityId: 'FORGET-PASSWORD-RESET',
      summary: `Password reset via Email Confirmation for "${account.displayName}" (${account.email})`,
      details: `Account: @${account.username} · Verified email confirmation`,
      actor: `${account.displayName} (${account.role})`,
    });

    showToast(`Password reset successfully for ${account.email}.`);
    return { valid: true };
  };

  const resetSuperAdminPasswordToDefault = () => {
    setSuperAdminPassword(DEFAULT_SUPER_ADMIN_PASSWORD);
    try {
      localStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_PASSWORD, DEFAULT_SUPER_ADMIN_PASSWORD);
    } catch {
      // Ignore storage error
    }
    addAuditLog({
      action: 'UPDATE',
      module: 'Settings',
      entityId: 'SUPER-ADMIN-PASSWORD',
      summary:
        'Admin login & Super Admin password reset to default (admin123) via Forgot Password recovery.',
    });
    showToast('Password reset to default: admin123');
  };

  const executeUnconditionalClearAll = () => {
    setPurchases([]);
    setPackings([]);
    setPayments([]);
    setOtherCosts([]);
    setPartnerDeposits([]);
    setPartnerWithdrawals([]);
    setProfitDistributions([]);
    setPartnerNotifications([]);
    setBalanceIncomes([]);
    setRecurringExpenses([]);
    setSupplierCredits([]);
    setMortalities([]);
    setEditingPackingId(null);
    setEditingPurchaseId(null);
    const freshDraft = createInitialPackingDraft(0);
    setPackingDraft(freshDraft);
    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PARTNER_DEPOSITS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PARTNER_WITHDRAWALS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PROFIT_DISTRIBUTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PARTNER_NOTIFICATIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.BALANCE_INCOMES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RECURRING_EXPENSES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SUPPLIER_CREDITS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MORTALITIES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PACKING_DRAFT, JSON.stringify(freshDraft));
      const keysToClear = [
        'zsb_purchases_v1',
        'zsb_purchases_v2',
        'zsb_purchases_v3',
        'zsb_purchases_v4',
        'zsb_purchases_v5',
        'zsb_purchases_v6',
        'zsb_packings_v1',
        'zsb_packings_v2',
        'zsb_packings_v3',
        'zsb_packings_v4',
        'zsb_packings_v5',
        'zsb_packings_v6',
        'zsb_packing_draft_v1',
        'zsb_packing_draft_v2',
        'zsb_packing_draft_v3',
        'zsb_packing_draft_v4',
        'zsb_packing_draft_v5',
        'zsb_packing_draft_v6',
        'zsb_payments_v1',
        'zsb_payments_v2',
        'zsb_payments_v3',
        'zsb_payments_v4',
        'zsb_payments_v5',
        'zsb_payments_v6',
        'zsb_other_costs_v1',
        'zsb_other_costs_v2',
        'zsb_other_costs_v3',
        'zsb_other_costs_v4',
        'zsb_other_costs_v5',
        'zsb_other_costs_v6',
        'zsb_supplier_credits_v1',
        'zsb_supplier_credits_v2',
        'zsb_supplier_credits_v3',
        'zsb_supplier_credits_v4',
        'zsb_mortalities_v1',
        'zsb_mortalities_v2',
        'zsb_mortalities_v3',
        'zsb_mortalities_v4',
        'zsb_awb_row_overrides_v1',
        'zsb_awb_custom_rows_v1',
        'zsb_frb_row_overrides_v1',
        'zsb_frb_custom_rows_v1',
        'zsb_exporter_slip_custom_rows_v1',
        'zsb_exporter_slip_custom_rows_v2',
        'zsb_exporter_slip_custom_rows_v3',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
      indexedStorageDriver.clearAllStores();
      window.dispatchEvent(new CustomEvent('zsb-clear-all-db'));
    } catch (e) {
      console.error(e);
    }
  };

  const createSnapshot = (
    label?: string,
    notes?: string,
    trigger: SnapshotTrigger = 'manual'
  ): DatabaseSnapshot => {
    const newSnap = createDatabaseSnapshot(
      {
        purchases,
        packings,
        payments,
        otherCosts,
        partnerDeposits,
        partnerWithdrawals,
        profitDistributions,
        balanceIncomes,
        companyProfile,
        dropdownOptions,
        packingDraft,
      },
      {
        label,
        notes,
        trigger,
      }
    );
    setSnapshots((prev) => {
      const updated = appendSnapshotWithRetention(prev, newSnap);
      try {
        localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    if (trigger === 'manual') {
      showToast(
        `Database Snapshot "${newSnap.label}" saved (${newSnap.recordCounts.totalRecords} records).`
      );
    }
    return newSnap;
  };

  const applySnapshotPayloadToState = (
    snap: DatabaseSnapshot,
    includeSettings: boolean = true
  ) => {
    const p = snap.payload;
    const nextPurchases = deduplicateRecords(p.purchases || [], 'pur');
    const nextPackings = deduplicateRecords(p.packings || [], 'pkg');
    const nextPayments = deduplicateRecords(p.payments || [], 'pay');
    const nextOtherCosts = deduplicateRecords(p.otherCosts || [], 'cost');
    const nextDraft = p.packingDraft || createInitialPackingDraft(nextPackings.length);

    setPurchases(nextPurchases);
    setPackings(nextPackings);
    setPayments(nextPayments);
    setOtherCosts(nextOtherCosts);
    if (Array.isArray(p.partnerDeposits)) {
      const nextPartnerDeposits = deduplicateRecords(p.partnerDeposits, 'pdep');
      setPartnerDeposits(nextPartnerDeposits);
      try {
        localStorage.setItem(STORAGE_KEYS.PARTNER_DEPOSITS, JSON.stringify(nextPartnerDeposits));
      } catch (e) {
        console.error(e);
      }
    }
    if (Array.isArray(p.partnerWithdrawals)) {
      const nextPartnerWithdrawals = deduplicateRecords(p.partnerWithdrawals, 'pwdr');
      setPartnerWithdrawals(nextPartnerWithdrawals);
      try {
        localStorage.setItem(
          STORAGE_KEYS.PARTNER_WITHDRAWALS,
          JSON.stringify(nextPartnerWithdrawals)
        );
      } catch (e) {
        console.error(e);
      }
    }
    if (Array.isArray(p.profitDistributions)) {
      const nextProfitDistributions = deduplicateRecords(p.profitDistributions, 'pdist');
      setProfitDistributions(nextProfitDistributions);
      try {
        localStorage.setItem(
          STORAGE_KEYS.PROFIT_DISTRIBUTIONS,
          JSON.stringify(nextProfitDistributions)
        );
      } catch (e) {
        console.error(e);
      }
    }
    if (Array.isArray(p.balanceIncomes)) {
      const nextBalanceIncomes = deduplicateRecords(p.balanceIncomes, 'inc');
      setBalanceIncomes(nextBalanceIncomes);
      try {
        localStorage.setItem(STORAGE_KEYS.BALANCE_INCOMES, JSON.stringify(nextBalanceIncomes));
      } catch (e) {
        console.error(e);
      }
    }
    setPackingDraft(nextDraft);
    setEditingPurchaseId(null);
    setEditingPackingId(null);

    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(nextPurchases));
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify(nextPackings));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(nextPayments));
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify(nextOtherCosts));
      localStorage.setItem(STORAGE_KEYS.PACKING_DRAFT, JSON.stringify(nextDraft));
    } catch (e) {
      console.error(e);
    }

    if (includeSettings) {
      if (p.companyProfile) {
        setCompanyProfile(p.companyProfile);
        try {
          localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(p.companyProfile));
        } catch (e) {
          console.error(e);
        }
      }
      if (p.dropdownOptions) {
        setDropdownOptions(p.dropdownOptions);
        try {
          localStorage.setItem(STORAGE_KEYS.DROPDOWNS, JSON.stringify(p.dropdownOptions));
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const restoreSnapshot = (
    snapshotId: string,
    options?: { includeSettings?: boolean; createPreRestoreBackup?: boolean }
  ): boolean => {
    const target = snapshots.find((s) => s.id === snapshotId);
    if (!target) {
      showToast('Snapshot not found in local archive.');
      return false;
    }

    const currentTotal =
      purchases.length + packings.length + payments.length + otherCosts.length;
    if (options?.createPreRestoreBackup && currentTotal > 0) {
      createSnapshot(
        `Auto Backup Before Restoring "${target.label}"`,
        `Automatically captured ${currentTotal} records before restoring snapshot ${target.id}.`,
        'auto_pre_restore'
      );
    }

    applySnapshotPayloadToState(target, options?.includeSettings ?? true);
    showToast(
      `Restored "${target.label}" (${target.recordCounts.totalRecords} records recovered).`
    );
    return true;
  };

  const deleteSnapshot = (snapshotId: string) => {
    const target = snapshots.find((s) => s.id === snapshotId);
    requestSuperAdminSingleDelete(
      {
        recordType: 'snapshot',
        recordId: snapshotId,
        recordTitle: target ? target.label : snapshotId,
        recordSubtitle: target
          ? `Created: ${target.createdAt.slice(0, 10)} · ${target.recordCounts.totalRecords} records`
          : undefined,
      },
      () => {
        setSnapshots((prev) => {
          const updated = prev.filter((s) => s.id !== snapshotId);
          try {
            localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
          } catch (e) {
            console.error(e);
          }
          return updated;
        });
        showToast('Super Admin verified: Snapshot removed from local archive.');
      }
    );
  };

  const downloadSnapshotJSON = (snapshotId?: string) => {
    let target = snapshotId ? snapshots.find((s) => s.id === snapshotId) : undefined;
    if (!target) {
      target = createSnapshot(
        `Exported JSON Snapshot (${new Date().toISOString().slice(0, 10)})`,
        'Created via JSON Archive Download',
        'manual'
      );
    }
    const jsonString = serializeSnapshotToJSON(target);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeDate = target.createdAt.slice(0, 10);
    a.download = `ZSB_AQUATICS_SNAPSHOT_${safeDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Snapshot JSON archive downloaded (${target.recordCounts.totalRecords} records).`);
  };

  const importSnapshotFromJSON = (
    jsonStr: string,
    autoRestore: boolean = true
  ): SnapshotValidationResult => {
    const validation = validateAndParseSnapshotJSON(jsonStr);
    if (!validation.valid || !validation.snapshot) {
      showToast(validation.error || 'Invalid or corrupted JSON archive.');
      return validation;
    }

    const importedSnap = validation.snapshot;
    setSnapshots((prev) => {
      const updated = appendSnapshotWithRetention(prev, importedSnap);
      try {
        localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    if (autoRestore) {
      applySnapshotPayloadToState(importedSnap, true);
      showToast(
        `Restored ${importedSnap.recordCounts.totalRecords} records from JSON archive & saved snapshot!`
      );
    } else {
      showToast(
        `Imported snapshot "${importedSnap.label}" (${importedSnap.recordCounts.totalRecords} records) to local archive.`
      );
    }

    return validation;
  };

  const clearRecordsWithSuperAdmin = (
    passwordInput: string,
    scope: ClearRecordsScope = 'all'
  ): { valid: boolean; error?: string } => {
    const verification = verifySuperAdminPassword(passwordInput, superAdminPassword);
    if (!verification.valid) {
      return { valid: false, error: verification.error };
    }

    // Automatically create a safety snapshot before clearing any non-empty records
    const currentTotal =
      purchases.length + packings.length + payments.length + otherCosts.length;
    if (currentTotal > 0) {
      createSnapshot(
        `Auto Safety Snapshot (Before Clear ${scope.toUpperCase()})`,
        `Automatic pre-clear backup of ${currentTotal} records before Super Admin clear (${scope}).`,
        'auto_pre_clear'
      );
    }

    if (scope === 'purchase') {
      setPurchases([]);
      setEditingPurchaseId(null);
      try {
        localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([]));
      } catch (e) {
        console.error(e);
      }
      showToast('Super Admin verified: Purchase DB cleared (Safety Snapshot saved).');
    } else if (scope === 'packing') {
      setPackings([]);
      setEditingPackingId(null);
      const freshDraft = createInitialPackingDraft(0);
      setPackingDraft(freshDraft);
      try {
        localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.PACKING_DRAFT, JSON.stringify(freshDraft));
      } catch (e) {
        console.error(e);
      }
      showToast('Super Admin verified: Packing DB cleared (Safety Snapshot saved).');
    } else if (scope === 'payment') {
      setPayments([]);
      try {
        localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
      } catch (e) {
        console.error(e);
      }
      showToast('Super Admin verified: Payment DB cleared (Safety Snapshot saved).');
    } else if (scope === 'other_cost') {
      setOtherCosts([]);
      try {
        localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify([]));
      } catch (e) {
        console.error(e);
      }
      showToast('Super Admin verified: Costing DB cleared (Safety Snapshot saved).');
    } else {
      executeUnconditionalClearAll();
      showToast(
        'Super Admin verified: All database records cleared. A local Safety Snapshot was saved for recovery.'
      );
    }

    addAuditLog({
      action: 'CLEAR',
      module: 'Database',
      entityId: `CLEAR-${scope.toUpperCase()}`,
      summary: `Super Admin cleared database records (scope: ${scope.toUpperCase()})`,
    });

    window.dispatchEvent(new CustomEvent('zsb-records-cleared', { detail: { scope } }));
    return { valid: true };
  };

  // Opens Super Admin password confirmation modal before clearing records
  const clearAllDatabaseRecords = (scope: ClearRecordsScope = 'all') => {
    openSuperAdminClearModal(scope);
  };

  const resetAllData = () => {
    openSuperAdminClearModal('all');
  };

  const exportDatabaseJSON = () => {
    downloadSnapshotJSON();
  };

  const importDatabaseJSON = (jsonStr: string): boolean => {
    const res = importSnapshotFromJSON(jsonStr, true);
    return res.valid;
  };

  const openShipmentDetails = (invoiceNumber: string, shippingMark?: string) => {
    const cleanInv = (invoiceNumber || '').trim();
    const cleanMark = (shippingMark || '').trim();
    const targetRef = cleanInv || cleanMark;
    if (!targetRef) return;

    setFocusedShipmentInvoice(targetRef);
    setPrintModalData((prev) => ({ ...prev, isOpen: false }));
    setActiveTab('packing_db');

    try {
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        const matched = packings.find(
          (p) =>
            p.invoiceNumber.toLowerCase() === cleanInv.toLowerCase() ||
            (cleanMark && p.shippingMark.toLowerCase() === cleanMark.toLowerCase())
        );
        const url = buildShipmentDetailUrl(window.location.origin, {
          id: matched?.id,
          invoiceNumber: cleanInv || matched?.invoiceNumber || '',
          shippingMark: cleanMark || matched?.shippingMark || '',
          packingDate: matched?.packingDate || '',
        });
        const parsedUrl = new URL(url);
        window.history.replaceState({}, '', `${parsedUrl.pathname}${parsedUrl.search}`);
      }
    } catch {
      // ignore URL state update errors
    }

    showToast(`Opened shipment details for ${targetRef} in Packing DB.`);
  };

  const clearFocusedShipment = () => {
    setFocusedShipmentInvoice(null);
    try {
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      // ignore
    }
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        login,
        logout,
        auditLogs,
        addAuditLog,
        clearAuditLogs,
        activeTab,
        setActiveTab,
        companyProfile,
        updateCompanyProfile,
        addCompanyPartner,
        removeCompanyPartner,
        setPartnerEmail,
        setPartnerAlertsEnabled,
        dropdownOptions,
        addDropdownItem,
        editDropdownItem,
        deleteDropdownItem,
        resetDropdowns,
        purchases,
        addPurchase,
        updatePurchase,
        deletePurchase,
        batchDeletePurchases,
        batchUpdatePurchasesStatus,
        bulkImportPurchases,
        editingPurchaseId,
        setEditingPurchaseId,
        packings,
        addPacking,
        updatePacking,
        deletePacking,
        batchDeletePackings,
        batchUpdatePackingsStatus,
        bulkImportPackings,
        editingPackingId,
        setEditingPackingId,
        packingDraft,
        setPackingDraft,
        resetPackingDraft,
        payments,
        addPayment,
        updatePayment,
        deletePayment,
        batchDeletePayments,
        batchUpdatePaymentsStatus,
        bulkImportPayments,
        editingPaymentId,
        setEditingPaymentId,
        otherCosts,
        addOtherCost,
        deleteOtherCost,
        bulkImportOtherCosts,
        partnerDeposits,
        addPartnerDeposit,
        updatePartnerDeposit,
        deletePartnerDeposit,
        partnerWithdrawals,
        addPartnerWithdrawal,
        deletePartnerWithdrawal,
        profitDistributions,
        issueProfitDistribution,
        deleteProfitDistribution,
        partnerNotifications,
        clearPartnerNotifications,
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
        supplierCredits,
        addSupplierCredit,
        applySupplierCredit,
        applySupplierCreditsForPayment,
        deleteSupplierCredit,
        mortalities,
        addMortality,
        updateMortality,
        deleteMortality,
        businessDocuments,
        addBusinessDocument,
        updateBusinessDocument,
        deleteBusinessDocument,
        printModalData,
        openPrintModal,
        closePrintModal,
        globalViewReport,
        isExportingGlobalPdf,
        lastExportedPdfFilename,
        exportCurrentViewToPdf,
        dataCenterModal,
        openDataCenterModal,
        closeDataCenterModal,
        privateImportDraft,
        savePrivateImportDraft,
        clearPrivateImportDraft,
        superAdminPassword,
        updateSuperAdminPassword,
        resetAccountPasswordViaEmail,
        resetSuperAdminPasswordToDefault,
        superAdminClearModal,
        openSuperAdminClearModal,
        closeSuperAdminClearModal,
        clearRecordsWithSuperAdmin,
        pendingSingleDelete: pendingSingleDeleteState
          ? {
              recordType: pendingSingleDeleteState.recordType,
              recordId: pendingSingleDeleteState.recordId,
              recordTitle: pendingSingleDeleteState.recordTitle,
              recordSubtitle: pendingSingleDeleteState.recordSubtitle,
            }
          : null,
        requestSuperAdminSingleDelete,
        confirmSingleDeleteWithSuperAdmin,
        cancelSingleDelete,
        clearAllDatabaseRecords,
        resetAllData,
        exportDatabaseJSON,
        importDatabaseJSON,
        snapshots,
        snapshotModalOpen,
        openSnapshotModal,
        closeSnapshotModal,
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        downloadSnapshotJSON,
        importSnapshotFromJSON,
        syncStatus,
        lastSyncedAt,
        lastSyncedEntity,
        triggerManualSync,
        isLiveSyncEnabled,
        toggleLiveSync,
        hasUnsyncedChanges,
        toastMessage,
        showToast,
        focusedShipmentInvoice,
        openShipmentDetails,
        clearFocusedShipment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
