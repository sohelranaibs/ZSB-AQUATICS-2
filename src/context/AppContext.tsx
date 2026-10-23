import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CompanyProfile,
  DropdownOptions,
  PurchaseRecord,
  PackingRecord,
  PackingFormDraft,
  PackingItemRow,
  PaymentRecord,
  OtherCostRecord,
  ActiveTab,
} from '../types/index.ts';
import {
  initialCompanyProfile,
  initialDropdownOptions,
  initialPurchases,
  initialPackings,
  initialPayments,
  initialOtherCosts,
} from './initialData.ts';
import { generateRecordId, deduplicateRecords } from '../utils/idGenerator.ts';
import { generateInvoiceNumber } from '../utils/calculations.ts';

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
  paymentStatus: 'NO REPORT',
  customRmbAmount: '',
  remarks: '',
  rows: createEmptyPackingDraftRows(),
});

export interface PrintModalData {
  isOpen: boolean;
  type:
    | 'purchase'
    | 'packing'
    | 'payment'
    | 'exporter_payment_slip'
    | 'monthly_statement'
    | 'batch_print'
    | 'profit_loss';
  title: string;
  data: any;
  items?: any[];
  selectedIds?: string[];
}

interface AppContextType {
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
  editingPurchaseId: string | null;
  setEditingPurchaseId: (id: string | null) => void;

  packings: PackingRecord[];
  addPacking: (record: Omit<PackingRecord, 'id' | 'createdAt'>) => string;
  updatePacking: (id: string, record: Partial<PackingRecord>, silent?: boolean) => void;
  deletePacking: (id: string) => void;
  editingPackingId: string | null;
  setEditingPackingId: (id: string | null) => void;
  packingDraft: PackingFormDraft;
  setPackingDraft: React.Dispatch<React.SetStateAction<PackingFormDraft>>;
  resetPackingDraft: (nextPackingCount?: number) => void;

  payments: PaymentRecord[];
  addPayment: (record: Omit<PaymentRecord, 'id' | 'createdAt'>) => string;
  updatePayment: (id: string, record: Partial<PaymentRecord>) => void;
  deletePayment: (id: string) => void;

  otherCosts: OtherCostRecord[];
  addOtherCost: (record: Omit<OtherCostRecord, 'id' | 'createdAt'>) => string;
  deleteOtherCost: (id: string) => void;

  // Print & PDF modal state
  printModalData: PrintModalData;
  openPrintModal: (modal: Omit<PrintModalData, 'isOpen'>) => void;
  closePrintModal: () => void;

  // Database management
  clearAllDatabaseRecords: () => void;
  resetAllData: () => void;
  exportDatabaseJSON: () => void;
  importDatabaseJSON: (jsonStr: string) => boolean;

  // Notification toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROFILE: 'zsb_company_profile_v1',
  DROPDOWNS: 'zsb_dropdown_options_v1',
  PURCHASES: 'zsb_purchases_v2',
  PACKINGS: 'zsb_packings_v2',
  PACKING_DRAFT: 'zsb_packing_draft_v1',
  PAYMENTS: 'zsb_payments_v2',
  OTHER_COSTS: 'zsb_other_costs_v2',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [editingPackingId, setEditingPackingId] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (!saved) return initialCompanyProfile;
      const parsed = JSON.parse(saved);
      if (parsed.partner === 'Md. Faisal Ahmed' || parsed.managingPartner === 'Md. Sohel Rana') {
        return {
          ...parsed,
          managingPartner: 'Md. Mizanur Rahman',
          partner: 'Md. Sohel Rana',
        };
      }
      return parsed;
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
      return { ...initialDropdownOptions, ...parsed };
    } catch {
      return initialDropdownOptions;
    }
  });

  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      if (!saved) return initialPurchases;
      const parsed: PurchaseRecord[] = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pur') : initialPurchases;
    } catch {
      return initialPurchases;
    }
  });

  const [packings, setPackings] = useState<PackingRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PACKINGS);
      if (!saved) return initialPackings;
      const parsed: PackingRecord[] = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pkg') : initialPackings;
    } catch {
      return initialPackings;
    }
  });

  const [packingDraft, setPackingDraft] = useState<PackingFormDraft>(() => {
    try {
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
      const saved = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (!saved) return initialPayments;
      const parsed: PaymentRecord[] = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'pay') : initialPayments;
    } catch {
      return initialPayments;
    }
  });

  const [otherCosts, setOtherCosts] = useState<OtherCostRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OTHER_COSTS);
      if (!saved) return initialOtherCosts;
      const parsed: OtherCostRecord[] = JSON.parse(saved);
      return Array.isArray(parsed) ? deduplicateRecords(parsed, 'cost') : initialOtherCosts;
    } catch {
      return initialOtherCosts;
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [printModalData, setPrintModalData] = useState<PrintModalData>({
    isOpen: false,
    type: 'purchase',
    title: '',
    data: null,
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(companyProfile));
    } catch (e) {
      console.error(e);
    }
  }, [companyProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DROPDOWNS, JSON.stringify(dropdownOptions));
    } catch (e) {
      console.error(e);
    }
  }, [dropdownOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));
    } catch (e) {
      console.error(e);
    }
  }, [purchases]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify(packings));
    } catch (e) {
      console.error(e);
    }
  }, [packings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKING_DRAFT, JSON.stringify(packingDraft));
    } catch (e) {
      console.error(e);
    }
  }, [packingDraft]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
    } catch (e) {
      console.error(e);
    }
  }, [payments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify(otherCosts));
    } catch (e) {
      console.error(e);
    }
  }, [otherCosts]);

  // One-time cleanup of obsolete storage versions on startup
  useEffect(() => {
    try {
      localStorage.removeItem('zsb_purchases_v1');
      localStorage.removeItem('zsb_packings_v1');
      localStorage.removeItem('zsb_payments_v1');
      localStorage.removeItem('zsb_other_costs_v1');
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

  const updateCompanyProfile = (profile: Partial<CompanyProfile>) => {
    setCompanyProfile((prev) => ({ ...prev, ...profile }));
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
    showToast(`Purchase invoice ${newRecord.invoiceNumber} saved to database!`);
    return id;
  };

  const updatePurchase = (id: string, record: Partial<PurchaseRecord>) => {
    setPurchases((prev) => prev.map((p) => (p.id === id ? { ...p, ...record } : p)));
    showToast(`Purchase invoice updated.`);
  };

  const deletePurchase = (id: string) => {
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    showToast(`Purchase record deleted from database.`);
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
    showToast(`Packing list ${newRecord.invoiceNumber} saved to database!`);
    return id;
  };

  const updatePacking = (id: string, record: Partial<PackingRecord>, silent: boolean = false) => {
    setPackings((prev) => prev.map((p) => (p.id === id ? { ...p, ...record } : p)));
    if (!silent) {
      showToast(`Packing list updated.`);
    }
  };

  const deletePacking = (id: string) => {
    setPackings((prev) => prev.filter((p) => p.id !== id));
    showToast(`Packing record deleted from database.`);
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
    showToast(`Payment voucher ${newRecord.invoiceNumber} saved to database!`);
    return id;
  };

  const updatePayment = (id: string, record: Partial<PaymentRecord>) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...record } : p)));
    showToast(`Payment voucher updated.`);
  };

  const deletePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
    showToast(`Payment record deleted from database.`);
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
    showToast(`Expense recorded in Profit & Loss.`);
    return id;
  };

  const deleteOtherCost = (id: string) => {
    setOtherCosts((prev) => prev.filter((c) => c.id !== id));
    showToast(`Expense deleted.`);
  };

  // Print modal
  const openPrintModal = (modal: Omit<PrintModalData, 'isOpen'>) => {
    setPrintModalData({
      ...modal,
      isOpen: true,
    });
  };

  const closePrintModal = () => {
    setPrintModalData((prev) => ({ ...prev, isOpen: false }));
  };

  // Backup & Reset
  const clearAllDatabaseRecords = () => {
    setPurchases([]);
    setPackings([]);
    setPayments([]);
    setOtherCosts([]);
    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify([]));
      localStorage.removeItem('zsb_purchases_v1');
      localStorage.removeItem('zsb_packings_v1');
      localStorage.removeItem('zsb_payments_v1');
      localStorage.removeItem('zsb_other_costs_v1');
    } catch (e) {
      console.error(e);
    }
    showToast('All database records cleared. All databases are now clean and empty.');
  };

  const resetAllData = () => {
    setCompanyProfile(initialCompanyProfile);
    setDropdownOptions(initialDropdownOptions);
    setPurchases([]);
    setPackings([]);
    setPayments([]);
    setOtherCosts([]);
    try {
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PACKINGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.OTHER_COSTS, JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }
    showToast('Database records cleared and settings reset to system defaults.');
  };

  const exportDatabaseJSON = () => {
    const backup = {
      companyProfile,
      dropdownOptions,
      purchases,
      packings,
      payments,
      otherCosts,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZSB_AQUATICS_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Database exported successfully as JSON file.');
  };

  const importDatabaseJSON = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.purchases && Array.isArray(data.purchases)) setPurchases(deduplicateRecords(data.purchases, 'pur'));
      if (data.packings && Array.isArray(data.packings)) setPackings(deduplicateRecords(data.packings, 'pkg'));
      if (data.payments && Array.isArray(data.payments)) setPayments(deduplicateRecords(data.payments, 'pay'));
      if (data.otherCosts && Array.isArray(data.otherCosts)) setOtherCosts(deduplicateRecords(data.otherCosts, 'cost'));
      if (data.dropdownOptions) setDropdownOptions(data.dropdownOptions);
      if (data.companyProfile) setCompanyProfile(data.companyProfile);
      showToast('Database successfully imported from JSON file!');
      return true;
    } catch (e) {
      showToast('Invalid backup file format.');
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
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
        editingPurchaseId,
        setEditingPurchaseId,
        packings,
        addPacking,
        updatePacking,
        deletePacking,
        editingPackingId,
        setEditingPackingId,
        packingDraft,
        setPackingDraft,
        resetPackingDraft,
        payments,
        addPayment,
        updatePayment,
        deletePayment,
        otherCosts,
        addOtherCost,
        deleteOtherCost,
        printModalData,
        openPrintModal,
        closePrintModal,
        clearAllDatabaseRecords,
        resetAllData,
        exportDatabaseJSON,
        importDatabaseJSON,
        toastMessage,
        showToast,
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
