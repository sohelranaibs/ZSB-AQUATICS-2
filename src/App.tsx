/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { ExcelHeaderRibbon } from './components/ExcelHeaderRibbon.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { PurchaseFormView } from './components/PurchaseFormView.tsx';
import { PackingListView } from './components/PackingListView.tsx';
import { AirWayBillView } from './components/AirWayBillView.tsx';
import { PaymentFormView } from './components/PaymentFormView.tsx';
import { ExporterPaymentFormView } from './components/ExporterPaymentFormView.tsx';
import { ExporterPaymentSlipView } from './components/ExporterPaymentSlipView.tsx';
import { ProfitLossView } from './components/ProfitLossView.tsx';
import { DatabaseView } from './components/DatabaseView.tsx';
import { SearchReportsView } from './components/SearchReportsView.tsx';
import { AuditLogsView } from './components/AuditLogsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { AdministrationView } from './components/AdministrationView.tsx';
import { LandingLoginView } from './components/LandingLoginView.tsx';
import { PrintPreviewModal } from './components/PrintPreviewModal.tsx';
import { QuickEntryModal } from './components/QuickEntryModal.tsx';
import { SuperAdminClearModal } from './components/SuperAdminClearModal.tsx';
import { DatabaseSnapshotModal } from './components/DatabaseSnapshotModal.tsx';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal.tsx';
import {
  ShortcutActionId,
  ORDERED_WORKBOOK_TABS,
  resolveGlobalKeyboardShortcut,
  isEditableElement,
  getAdjacentWorkbookTab,
  dispatchViewShortcutAction,
} from './utils/keyboardShortcuts.ts';
import { ActiveTab } from './types/index.ts';
import { CheckCircle2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    toastMessage,
    showToast,
    printModalData,
    closePrintModal,
    dataCenterModal,
    openDataCenterModal,
    closeDataCenterModal,
    snapshotModalOpen,
    openSnapshotModal,
    closeSnapshotModal,
    superAdminClearModal,
    closeSuperAdminClearModal,
    triggerManualSync,
    createSnapshot,
    exportCurrentViewToPdf,
  } = useApp();

  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  const getDatasetForTab = useCallback((tab: ActiveTab) => {
    if (
      tab === 'packing_form' ||
      tab === 'air_way_bill' ||
      tab === 'packing_db' ||
      tab === 'exporter_payment_slip'
    ) {
      return 'packing' as const;
    }
    if (tab === 'payment_form' || tab === 'exporter_payment_form' || tab === 'payment_db') {
      return 'payment' as const;
    }
    if (tab === 'profit_loss') {
      return 'other_cost' as const;
    }
    return 'purchase' as const;
  }, []);

  const executeShortcutAction = useCallback(
    (action: ShortcutActionId, targetTab?: ActiveTab) => {
      switch (action) {
        case 'CLOSE_ACTIVE_MODAL': {
          if (shortcutsModalOpen) {
            setShortcutsModalOpen(false);
            return;
          }
          if (printModalData.isOpen) {
            closePrintModal();
            return;
          }
          if (dataCenterModal.isOpen) {
            closeDataCenterModal();
            return;
          }
          if (snapshotModalOpen) {
            closeSnapshotModal();
            return;
          }
          if (superAdminClearModal.isOpen) {
            closeSuperAdminClearModal();
            return;
          }
          return;
        }
        case 'FOCUS_GLOBAL_SEARCH': {
          const input = document.getElementById('header-global-search-input') as HTMLInputElement | null;
          if (input) {
            input.focus();
            input.select();
          }
          return;
        }
        case 'OPEN_SHORTCUTS_MODAL': {
          setShortcutsModalOpen((prev) => !prev);
          return;
        }
        case 'OPEN_SNAPSHOT_MODAL': {
          openSnapshotModal();
          showToast('Opened Database Snapshot Manager (Ctrl+Shift+S).');
          return;
        }
        case 'OPEN_EXCEL_MODAL': {
          openDataCenterModal('import', getDatasetForTab(activeTab));
          showToast('Opened Excel & CSV Data Center (Ctrl+E).');
          return;
        }
        case 'SAVE_ACTIVE_VIEW': {
          const handled = dispatchViewShortcutAction('SAVE_ACTIVE_VIEW');
          if (!handled) {
            triggerManualSync('All Ledgers (Ctrl+S)');
            createSnapshot(
              'Quick Save (Ctrl+S)',
              `Saved from ${activeTab} via Ctrl+S shortcut`,
              'manual'
            );
            showToast('All ledgers synced and database snapshot saved (Ctrl+S).');
          }
          return;
        }
        case 'PRINT_ACTIVE_VIEW': {
          const handled = dispatchViewShortcutAction('PRINT_ACTIVE_VIEW');
          if (!handled) {
            void exportCurrentViewToPdf({ openPreviewOnly: true });
          }
          return;
        }
        case 'ADD_FORM_ROW': {
          const handled = dispatchViewShortcutAction('ADD_FORM_ROW');
          if (!handled) {
            showToast(
              'Switch to a data-entry form (Alt+2..Alt+6) to add a new line item row (Alt+N).'
            );
          }
          return;
        }
        case 'RESET_FORM': {
          const handled = dispatchViewShortcutAction('RESET_FORM');
          if (!handled) {
            showToast(
              'Switch to a data-entry form (Alt+2..Alt+6) to reset form fields (Alt+R).'
            );
          }
          return;
        }
        case 'NEXT_TAB': {
          const nextTab = getAdjacentWorkbookTab(activeTab, 'next');
          setActiveTab(nextTab);
          const info = ORDERED_WORKBOOK_TABS.find((t) => t.id === nextTab);
          if (info) {
            showToast(`Switched to Sheet #${info.number}: ${info.label} (Alt+→)`);
          }
          return;
        }
        case 'PREV_TAB': {
          const prevTab = getAdjacentWorkbookTab(activeTab, 'prev');
          setActiveTab(prevTab);
          const info = ORDERED_WORKBOOK_TABS.find((t) => t.id === prevTab);
          if (info) {
            showToast(`Switched to Sheet #${info.number}: ${info.label} (Alt+←)`);
          }
          return;
        }
        case 'JUMP_TO_TAB': {
          if (targetTab) {
            setActiveTab(targetTab);
            const info = ORDERED_WORKBOOK_TABS.find((t) => t.id === targetTab);
            if (info) {
              const keyDigit = info.number === 10 ? 0 : info.number;
              showToast(`Switched to Sheet #${info.number}: ${info.label} (Alt+${keyDigit})`);
            }
          }
          return;
        }
      }
    },
    [
      activeTab,
      closeDataCenterModal,
      closePrintModal,
      closeSnapshotModal,
      closeSuperAdminClearModal,
      createSnapshot,
      dataCenterModal.isOpen,
      exportCurrentViewToPdf,
      getDatasetForTab,
      openDataCenterModal,
      openSnapshotModal,
      printModalData.isOpen,
      setActiveTab,
      shortcutsModalOpen,
      showToast,
      snapshotModalOpen,
      superAdminClearModal.isOpen,
      triggerManualSync,
    ]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const resolved = resolveGlobalKeyboardShortcut({
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        repeat: e.repeat,
        isEditableTarget: isEditableElement(target),
      });

      if (!resolved) return;

      if (resolved.preventDefault) {
        e.preventDefault();
      }

      executeShortcutAction(resolved.action, resolved.targetTab);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeShortcutAction]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 pb-12">
      {/* Excel Ribbon & Sheet Navigation Tabs */}
      <ExcelHeaderRibbon onOpenShortcutsModal={() => setShortcutsModalOpen(true)} />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="global-toast-banner"
          className="fixed bottom-4 right-4 z-[70] bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border-2 border-emerald-400/80 flex items-center space-x-2.5 text-xs font-bold transition-all duration-150 print:hidden max-w-md"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Main Active Sheet Body */}
      <main className="flex-1 w-full">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'purchase_form' && <PurchaseFormView />}
        {activeTab === 'packing_form' && <PackingListView />}
        {activeTab === 'air_way_bill' && <AirWayBillView />}
        {activeTab === 'payment_form' && <PaymentFormView />}
        {activeTab === 'exporter_payment_form' && <ExporterPaymentFormView />}
        {activeTab === 'exporter_payment_slip' && <ExporterPaymentSlipView />}
        {activeTab === 'profit_loss' && <ProfitLossView />}
        {activeTab === 'purchase_db' && <DatabaseView initialType="purchase" />}
        {activeTab === 'packing_db' && <DatabaseView initialType="packing" />}
        {activeTab === 'payment_db' && <DatabaseView initialType="payment" />}
        {activeTab === 'search_reports' && <SearchReportsView />}
        {activeTab === 'audit_logs' && <AuditLogsView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'administration' && <AdministrationView />}
      </main>

      {/* Printable Modal (Voucher / Statement / PDF) */}
      <PrintPreviewModal />

      {/* Global Excel (.XLSX) & CSV Import / Export Center Modal */}
      <QuickEntryModal />

      {/* Super Admin Password Verification Modal for Clear All Records */}
      <SuperAdminClearModal />

      {/* Local JSON Database Snapshot & State Recovery Modal */}
      <DatabaseSnapshotModal />

      {/* Global Keyboard Shortcuts Reference & Command Modal */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        onExecuteShortcut={executeShortcutAction}
      />
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <LandingLoginView />;
  }

  return <MainContent />;
};

export default function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
}
