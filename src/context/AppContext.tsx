import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  CompanyProfile,
  DropdownOptions,
  PurchaseRecord,
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
} from '../types/index.ts';
import {
  initialCompanyProfile,
  initialDropdownOptions,
  initialPurchases,
  initialPackings,
  initialPayments,
  initialOtherCosts,
  initialSupplierCredits,
  initialMortalities,
  COMPANY_LOGO_URL,
} from './initialData.ts';
import { generateRecordId, deduplicateRecords } from '../utils/idGenerator.ts';
import { generateInvoiceNumber, calculatePackingTotals } from '../utils/calculations.ts';
import {
  buildPackingShipmentGroupKey,
  mergePackingRecordsByShipmentGroup,
} from '../utils/csvParser.ts';
import {
  createSupplierCreditRecord,
  applySupplierCreditNote,
  applyCreditAmountAcrossSupplierNotes,
} from '../utils/supplierCredits.ts';
import {
  DEFAULT_SUPER_ADMIN_PASSWORD,
  ClearRecordsScope,
  verifySuperAdminPassword,
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
  dropdownOptions: DropdownOptions;
  addDropdownItem: (category: keyof DropdownOptions, item: string) => void;
  editDropdownItem: (category: keyof DropdownOptions, oldItem: string, newItem: string) => void;
  deleteDropdownItem: (category: keyof DropdownOptions, item: string) => void;
  resetDropdowns: () => void;

  purchases: PurchaseRecord[];
  addPurchase: (record: Omit<PurchaseRecord, 'id' | 'createdAt'>) => string;
  updatePurchase: (id: string, record: Partial<PurchaseRecord>) => void;
  deletePurchase: (id: string) => void;
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
  bulkImportPayments: (
    records: Omit<PaymentRecord, 'id' | 'createdAt'>[],
    mode?: 'append' | 'replace'
  ) => number;

  otherCosts: OtherCostRecord[];
  addOtherCost: (record: Omit<OtherCostRecord, 'id' | 'createdAt'>) => string;
  deleteOtherCost: (id: string) => void;
  bulkImportOtherCosts: (
    records: Omit<OtherCostRecord, 'id' | 'createdAt'>[],
    mode?: 'append' | 'replace'
  ) => number;

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

  // Print & PDF modal state + Global View PDF Export
  printModalData: PrintModalData;
  openPrintModal: (modal: Omit<PrintModalData, 'isOpen'>) => void;
  closePrintModal: () => void;
  globalViewReport: GlobalViewTableReport;
  isExportingGlobalPdf: boolean;
  lastExportedPdfFilename: string | null;
  exportCurrentViewToPdf: (options?: { openPreviewOnly?: boolean }) => Promise<boolean>;

  // Excel & CSV Import/Export Data Center modal state
  dataCenterModal: DataCenterModalConfig;
  openDataCenterModal: (
    initialTab?: 'import' | 'export',
    initialDataset?: 'purchase' | 'packing' | 'payment' | 'other_cost' | 'all'
  ) => void;
  closeDataCenterModal: () => void;

  // Super Admin Password & Clear Modal
  superAdminPassword: string;
  updateSuperAdminPassword: (
    currentPasswordInput: string,
    newPassword: string,
    confirmPassword: string
  ) => { valid: boolean; error?: string };
  superAdminClearModal: SuperAdminClearModalConfig;
  openSuperAdminClearModal: (scope?: ClearRecordsScope) => void;
  closeSuperAdminClearModal: () => void;
  clearRecordsWithSuperAdmin: (
    passwordInput: string,
    scope?: ClearRecordsScope
  ) => { valid: boolean; error?: string };

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

  // Local Database Persistence Sync Status
  syncStatus: SyncStatusState;
  lastSyncedAt: string;
  lastSyncedEntity: string;
  triggerManualSync: (entityLabel?: string) => void;

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
  PURCHASES: 'zsb_purchases_v5',
  PACKINGS: 'zsb_packings_v5',
  PACKING_DRAFT: 'zsb_packing_draft_v5',
  PAYMENTS: 'zsb_payments_v5',
  OTHER_COSTS: 'zsb_other_costs_v5',
  SUPPLIER_CREDITS: 'zsb_supplier_credits_v3',
  MORTALITIES: 'zsb_mortalities_v3',
  SUPER_ADMIN_PASSWORD: 'zsb_super_admin_password_v1',
  SNAPSHOTS: 'zsb_database_snapshots_v1',
  AUTH_USER: 'zsb_auth_user_v1',
  AUDIT_LOGS: 'zsb_audit_logs_v1',
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
        if (searchParams.get('autostart') === '1' || initialDeepLink?.isShipmentLink) {
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

  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    initialDeepLink?.isShipmentLink ? 'packing_db' : 'dashboard'
  );
  const [focusedShipmentInvoice, setFocusedShipmentInvoice] = useState<string | null>(() => {
    if (initialDeepLink?.isShipmentLink) {
      return initialDeepLink.invoiceNumber || initialDeepLink.shippingMark || null;
    }
    return null;
  });
  const [editingPackingId, setEditingPackingId] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (!saved) return initialCompanyProfile;
      const parsed = JSON.parse(saved);
      const merged: CompanyProfile = {
        ...initialCompanyProfile,
        ...parsed,
        email: parsed.email || initialCompanyProfile.email,
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
      };
      if (parsed.partner === 'Md. Faisal Ahmed' || parsed.managingPartner === 'Md. Sohel Rana') {
        merged.managingPartner = 'Md. Mizanur Rahman';
        merged.partner = 'Md. Sohel Rana';
      }
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
      localStorage.removeItem('zsb_purchases_v1');
      localStorage.removeItem('zsb_purchases_v2');
      localStorage.removeItem('zsb_purchases_v3');
      localStorage.removeItem('zsb_purchases_v4');
      const saved = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      if (!saved) return initialPurchases;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pur') : initialPurchases;
    } catch {
      return initialPurchases;
    }
  });

  const [packings, setPackings] = useState<PackingRecord[]>(() => {
    try {
      localStorage.removeItem('zsb_packings_v1');
      localStorage.removeItem('zsb_packings_v2');
      localStorage.removeItem('zsb_packings_v3');
      localStorage.removeItem('zsb_packings_v4');
      const saved = localStorage.getItem(STORAGE_KEYS.PACKINGS);
      if (!saved) return initialPackings;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pkg') : initialPackings;
    } catch {
      return initialPackings;
    }
  });

  const [packingDraft, setPackingDraft] = useState<PackingFormDraft>(() => {
    try {
      localStorage.removeItem('zsb_packing_draft_v1');
      localStorage.removeItem('zsb_packing_draft_v2');
      localStorage.removeItem('zsb_packing_draft_v3');
      localStorage.removeItem('zsb_packing_draft_v4');
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
      localStorage.removeItem('zsb_payments_v1');
      localStorage.removeItem('zsb_payments_v2');
      localStorage.removeItem('zsb_payments_v3');
      localStorage.removeItem('zsb_payments_v4');
      const saved = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (!saved) return initialPayments;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pay') : initialPayments;
    } catch {
      return initialPayments;
    }
  });

  const [otherCosts, setOtherCosts] = useState<OtherCostRecord[]>(() => {
    try {
      localStorage.removeItem('zsb_other_costs_v1');
      localStorage.removeItem('zsb_other_costs_v2');
      localStorage.removeItem('zsb_other_costs_v3');
      localStorage.removeItem('zsb_other_costs_v4');
      const saved = localStorage.getItem(STORAGE_KEYS.OTHER_COSTS);
      if (!saved) return initialOtherCosts;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'cost') : initialOtherCosts;
    } catch {
      return initialOtherCosts;
    }
  });

  const [supplierCredits, setSupplierCredits] = useState<SupplierCreditRecord[]>(() => {
    try {
      localStorage.removeItem('zsb_supplier_credits_v1');
      localStorage.removeItem('zsb_supplier_credits_v2');
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
      localStorage.removeItem('zsb_mortalities_v1');
      localStorage.removeItem('zsb_mortalities_v2');
      const saved = localStorage.getItem(STORAGE_KEYS.MORTALITIES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'mort') : [];
    } catch {
      return [];
    }
  });

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

  const openSuperAdminClearModal = (scope: ClearRecordsScope = 'all') => {
    setSuperAdminClearModal({
      isOpen: true,
      initialScope: scope,
    });
  };

  const closeSuperAdminClearModal = () => {
    setSuperAdminClearModal((prev) => ({ ...prev, isOpen: false }));
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
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toISOString());
  const [lastSyncedEntity, setLastSyncedEntity] = useState<string>('All Ledgers');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

  const persistWithSyncIndicator = (entityLabel: string, writeFn: () => void) => {
    try {
      writeFn();
      if (!isInitialMountRef.current) {
        setSyncStatus('saving');
        setLastSyncedEntity(entityLabel);
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(() => {
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toISOString());
        }, 550);
      }
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  const triggerManualSync = (entityLabel: string = 'All Ledgers') => {
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
      localStorage.setItem(STORAGE_KEYS.SUPPLIER_CREDITS, JSON.stringify(supplierCredits));
      localStorage.setItem(STORAGE_KEYS.MORTALITIES, JSON.stringify(mortalities));
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = setTimeout(() => {
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toISOString());
      }, 550);
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
    });
  }, [purchases]);

  useEffect(() => {
    persistWithSyncIndicator('Packing DB', () => {
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify(packings));
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
    });
  }, [payments]);

  useEffect(() => {
    persistWithSyncIndicator('Costing DB', () => {
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify(otherCosts));
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
    };
  }, []);

  // One-time cleanup of obsolete storage versions on startup
  useEffect(() => {
    try {
      const legacyKeys = [
        'zsb_purchases_v1',
        'zsb_purchases_v2',
        'zsb_packings_v1',
        'zsb_packings_v2',
        'zsb_packings_v5',
        'zsb_packing_draft_v1',
        'zsb_packing_draft_v2',
        'zsb_payments_v1',
        'zsb_payments_v2',
        'zsb_other_costs_v1',
        'zsb_other_costs_v2',
        'zsb_exporter_slip_custom_rows_v1',
        'zsb_exporter_slip_custom_rows_v2',
      ];
      legacyKeys.forEach((k) => localStorage.removeItem(k));
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
    setAuditLogs([]);
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
    showToast('System audit trail cleared.');
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
    setCompanyProfile((prev) => ({ ...prev, ...profile }));
    addAuditLog({
      action: 'UPDATE',
      module: 'Settings',
      entityId: 'CFG-PROFILE',
      summary: 'Updated company profile and system configuration settings',
      details: `Company: ${profile.companyName || companyProfile.companyName}`,
    });
    showToast('Company profile updated successfully.');
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
    setDropdownOptions((prev) => ({
      ...prev,
      [category]: prev[category].filter((it) => it !== item),
    }));
    showToast(`Removed "${item}" from ${category}.`);
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
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    addAuditLog({
      action: 'DELETE',
      module: 'Purchase',
      entityId: target?.invoiceNumber || id,
      summary: `Deleted purchase challan ${target?.invoiceNumber || id} (${target?.description || 'Unknown Supplier'})`,
      details: `Deleted Amount: ${companyProfile.currency} ${(target?.totalAmount ?? 0).toLocaleString()}`,
    });
    showToast(`Purchase record deleted from database.`);
  };

  const bulkImportPurchases = (
    records: Omit<PurchaseRecord, 'id' | 'createdAt'>[],
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!records || records.length === 0) return 0;
    const now = new Date().toISOString();
    const hydrated: PurchaseRecord[] = records.map((rec) => ({
      ...rec,
      id: generateRecordId('pur'),
      createdAt: now,
    }));
    setPurchases((prev) => (mode === 'replace' ? hydrated : [...hydrated, ...prev]));
    addAuditLog({
      action: 'IMPORT',
      module: 'Purchase',
      entityId: `BULK-PUR-${hydrated.length}`,
      summary: `Bulk imported ${hydrated.length} purchase challan record(s) (${mode} mode)`,
    });
    return hydrated.length;
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
    setPackings((prev) => prev.filter((p) => p.id !== id));
    addAuditLog({
      action: 'DELETE',
      module: 'Packing',
      entityId: target?.invoiceNumber || id,
      summary: `Deleted export packing list ${target?.invoiceNumber || id} (${target?.shippingMark || 'Unknown Mark'})`,
      details: `Weight: ${target?.totalWeight ?? 0} KG · Value: RMB ${(target?.totalAmount ?? 0).toLocaleString()}`,
    });
    showToast(`Packing record deleted from database.`);
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

    setPackings((prev) => {
      const updatedExisting = [...prev];
      const existingIndexByKey = new Map<string, number>();
      updatedExisting.forEach((p, idx) => {
        existingIndexByKey.set(
          buildPackingShipmentGroupKey({
            shippingMark: p.shippingMark,
            flight: p.flight,
            destination: p.destination,
            shipper: p.shipper,
            packingDate: p.packingDate,
          }),
          idx
        );
      });

      const newlyCreated: PackingRecord[] = [];
      let nextSeqCount = prev.length;

      for (const incoming of mergedIncoming) {
        const key = buildPackingShipmentGroupKey({
          shippingMark: incoming.shippingMark,
          flight: incoming.flight,
          destination: incoming.destination,
          shipper: incoming.shipper,
          packingDate: incoming.packingDate,
        });

        const matchIdx = existingIndexByKey.get(key);
        if (matchIdx !== undefined) {
          const target = updatedExisting[matchIdx];
          const combinedItems: PackingItemRow[] = [
            ...(target.items || []),
            ...(incoming.items || []).map((it, idx) => ({
              ...it,
              id: `pki-merged-${Date.now()}-${target.items.length + idx}`,
            })),
          ];
          const totals = calculatePackingTotals(combinedItems);
          const rmbRate =
            target.rmbRate && target.rmbRate > 0
              ? target.rmbRate
              : incoming.rmbRate && incoming.rmbRate > 0
              ? incoming.rmbRate
              : undefined;
          const totalAmountBDT =
            rmbRate && rmbRate > 0
              ? Math.round(totals.totalAmount * rmbRate * 100) / 100
              : target.totalAmountBDT;
          const rmbAmount =
            totals.totalWeight > 0
              ? Math.round((totals.totalAmount / totals.totalWeight) * 100) / 100
              : 0;

          updatedExisting[matchIdx] = {
            ...target,
            items: combinedItems,
            totalBox: totals.totalBox,
            totalWeight: totals.totalWeight,
            totalAmount: totals.totalAmount,
            rmbAmount,
            settledAmount: totals.totalAmount,
            rmbRate,
            totalAmountBDT,
          };
        } else {
          const invoiceNumber =
            incoming.invoiceNumber || generateInvoiceNumber('PKG', nextSeqCount);
          nextSeqCount++;
          newlyCreated.push({
            ...incoming,
            invoiceNumber,
            id: generateRecordId('pkg'),
            createdAt: now,
          });
        }
      }

      return [...newlyCreated, ...updatedExisting];
    });

    addAuditLog({
      action: 'IMPORT',
      module: 'Packing',
      entityId: `BULK-PKG-${mergedIncoming.length}`,
      summary: `Bulk imported ${mergedIncoming.length} merged packing list manifest(s) (append mode)`,
    });
    return mergedIncoming.length;
  };

  // Payments CRUD
  const addPayment = (record: Omit<PaymentRecord, 'id' | 'createdAt'>) => {
    const id = generateRecordId('pay');
    const newRecord: PaymentRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    setPayments((prev) => [newRecord, ...prev]);
    addAuditLog({
      action: 'CREATE',
      module: 'Payment',
      entityId: newRecord.invoiceNumber,
      summary: `Recorded ${newRecord.paymentCategory === 'exporter' ? 'exporter' : 'supplier'} payment voucher ${newRecord.invoiceNumber} (${newRecord.description})`,
      details: `Amount: ${companyProfile.currency} ${newRecord.totalAmount.toLocaleString()} · Status: ${newRecord.status}`,
    });
    showToast(`Payment voucher ${newRecord.invoiceNumber} saved to database!`);
    return id;
  };

  const updatePayment = (id: string, record: Partial<PaymentRecord>) => {
    const target = payments.find((p) => p.id === id);
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...record } : p)));
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
    setPayments((prev) => prev.filter((p) => p.id !== id));
    addAuditLog({
      action: 'DELETE',
      module: 'Payment',
      entityId: target?.invoiceNumber || id,
      summary: `Deleted payment voucher ${target?.invoiceNumber || id} (${target?.description || 'Unknown Party'})`,
      details: `Amount: ${companyProfile.currency} ${(target?.totalAmount ?? 0).toLocaleString()}`,
    });
    showToast(`Payment record deleted from database.`);
  };

  const bulkImportPayments = (
    records: Omit<PaymentRecord, 'id' | 'createdAt'>[],
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!records || records.length === 0) return 0;
    const now = new Date().toISOString();
    const hydrated: PaymentRecord[] = records.map((rec) => ({
      ...rec,
      id: generateRecordId('pay'),
      createdAt: now,
    }));
    setPayments((prev) => (mode === 'replace' ? hydrated : [...hydrated, ...prev]));
    addAuditLog({
      action: 'IMPORT',
      module: 'Payment',
      entityId: `BULK-PAY-${hydrated.length}`,
      summary: `Bulk imported ${hydrated.length} payment voucher(s) (${mode} mode)`,
    });
    return hydrated.length;
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
    setOtherCosts((prev) => prev.filter((c) => c.id !== id));
    addAuditLog({
      action: 'DELETE',
      module: 'OtherCost',
      entityId: id,
      summary: `Deleted operating expense "${target?.category || id}"`,
      details: `Amount: ${companyProfile.currency} ${(target?.amount ?? 0).toLocaleString()}`,
    });
    showToast(`Expense deleted.`);
  };

  const bulkImportOtherCosts = (
    records: Omit<OtherCostRecord, 'id' | 'createdAt'>[],
    mode: 'append' | 'replace' = 'append'
  ): number => {
    if (!records || records.length === 0) return 0;
    const now = new Date().toISOString();
    const hydrated: OtherCostRecord[] = records.map((rec) => ({
      ...rec,
      id: generateRecordId('cost'),
      createdAt: now,
    }));
    setOtherCosts((prev) => (mode === 'replace' ? hydrated : [...hydrated, ...prev]));
    addAuditLog({
      action: 'IMPORT',
      module: 'OtherCost',
      entityId: `BULK-COST-${hydrated.length}`,
      summary: `Bulk imported ${hydrated.length} operating expense record(s) (${mode} mode)`,
    });
    return hydrated.length;
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
    setSupplierCredits((prev) => prev.filter((cn) => cn.id !== id));
    addAuditLog({
      action: 'DELETE',
      module: 'SupplierCredit',
      entityId: target?.creditNoteNumber || id,
      summary: `Deleted supplier credit note ${target?.creditNoteNumber || id}`,
      details: `Supplier: ${target?.supplierName || '-'} · Amount: ${companyProfile.currency} ${(target?.amount ?? 0).toLocaleString()}`,
    });
    showToast('Supplier credit note deleted.');
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
    setMortalities((prev) => prev.filter((m) => m.id !== id));
    addAuditLog({
      action: 'DELETE',
      module: 'Mortality',
      entityId: id,
      summary: `Deleted mortality record (${target?.quantityKg || 0} KG · ${target?.species || id})`,
    });
    showToast('Deleted mortality record. Stock adjustment restored.');
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
    showToast('Super Admin password updated successfully.');
    return { valid: true };
  };

  const executeUnconditionalClearAll = () => {
    setPurchases([]);
    setPackings([]);
    setPayments([]);
    setOtherCosts([]);
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
      localStorage.setItem(STORAGE_KEYS.SUPPLIER_CREDITS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MORTALITIES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PACKING_DRAFT, JSON.stringify(freshDraft));
      const keysToClear = [
        'zsb_purchases_v1',
        'zsb_purchases_v2',
        'zsb_purchases_v3',
        'zsb_purchases_v4',
        'zsb_purchases_v5',
        'zsb_packings_v1',
        'zsb_packings_v2',
        'zsb_packings_v3',
        'zsb_packings_v4',
        'zsb_packings_v5',
        'zsb_packing_draft_v1',
        'zsb_packing_draft_v2',
        'zsb_packing_draft_v3',
        'zsb_packing_draft_v4',
        'zsb_packing_draft_v5',
        'zsb_payments_v1',
        'zsb_payments_v2',
        'zsb_payments_v3',
        'zsb_payments_v4',
        'zsb_payments_v5',
        'zsb_other_costs_v1',
        'zsb_other_costs_v2',
        'zsb_other_costs_v3',
        'zsb_other_costs_v4',
        'zsb_other_costs_v5',
        'zsb_supplier_credits_v1',
        'zsb_supplier_credits_v2',
        'zsb_supplier_credits_v3',
        'zsb_mortalities_v1',
        'zsb_mortalities_v2',
        'zsb_mortalities_v3',
        'zsb_awb_row_overrides_v1',
        'zsb_awb_custom_rows_v1',
        'zsb_frb_row_overrides_v1',
        'zsb_frb_custom_rows_v1',
        'zsb_exporter_slip_custom_rows_v1',
        'zsb_exporter_slip_custom_rows_v2',
        'zsb_exporter_slip_custom_rows_v3',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
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
    setSnapshots((prev) => {
      const updated = prev.filter((s) => s.id !== snapshotId);
      try {
        localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    showToast('Snapshot removed from local archive.');
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
        dropdownOptions,
        addDropdownItem,
        editDropdownItem,
        deleteDropdownItem,
        resetDropdowns,
        purchases,
        addPurchase,
        updatePurchase,
        deletePurchase,
        bulkImportPurchases,
        editingPurchaseId,
        setEditingPurchaseId,
        packings,
        addPacking,
        updatePacking,
        deletePacking,
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
        bulkImportPayments,
        otherCosts,
        addOtherCost,
        deleteOtherCost,
        bulkImportOtherCosts,
        supplierCredits,
        addSupplierCredit,
        applySupplierCredit,
        applySupplierCreditsForPayment,
        deleteSupplierCredit,
        mortalities,
        addMortality,
        updateMortality,
        deleteMortality,
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
        superAdminPassword,
        updateSuperAdminPassword,
        superAdminClearModal,
        openSuperAdminClearModal,
        closeSuperAdminClearModal,
        clearRecordsWithSuperAdmin,
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
