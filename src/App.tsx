/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { ExcelHeaderRibbon } from './components/ExcelHeaderRibbon.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { PurchaseFormView } from './components/PurchaseFormView.tsx';
import { PackingListView } from './components/PackingListView.tsx';
import { PaymentFormView } from './components/PaymentFormView.tsx';
import { ExporterPaymentFormView } from './components/ExporterPaymentFormView.tsx';
import { ExporterPaymentSlipView } from './components/ExporterPaymentSlipView.tsx';
import { ProfitLossView } from './components/ProfitLossView.tsx';
import { DatabaseView } from './components/DatabaseView.tsx';
import { SearchReportsView } from './components/SearchReportsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { PrintPreviewModal } from './components/PrintPreviewModal.tsx';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeTab, toastMessage } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 pb-12">
      {/* Excel Ribbon & Sheet Navigation Tabs */}
      <ExcelHeaderRibbon />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-amber-500/50 flex items-center space-x-2 text-xs font-semibold animate-bounce print:hidden">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Active Sheet Body */}
      <main className="flex-1 w-full">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'purchase_form' && <PurchaseFormView />}
        {activeTab === 'packing_form' && <PackingListView />}
        {activeTab === 'payment_form' && <PaymentFormView />}
        {activeTab === 'exporter_payment_form' && <ExporterPaymentFormView />}
        {activeTab === 'exporter_payment_slip' && <ExporterPaymentSlipView />}
        {activeTab === 'profit_loss' && <ProfitLossView />}
        {activeTab === 'purchase_db' && <DatabaseView initialType="purchase" />}
        {activeTab === 'packing_db' && <DatabaseView initialType="packing" />}
        {activeTab === 'payment_db' && <DatabaseView initialType="payment" />}
        {activeTab === 'search_reports' && <SearchReportsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Printable Modal (Voucher / Statement / PDF) */}
      <PrintPreviewModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
