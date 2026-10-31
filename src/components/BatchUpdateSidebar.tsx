import React, { useState } from 'react';
import {
  X,
  Layers,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Calendar,
  Tag,
  Plane,
  MapPin,
  UserCheck,
  FileText,
  DollarSign,
} from 'lucide-react';
import {
  DropdownOptions,
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
} from '../types/index.ts';
import {
  BatchDbViewType,
  PurchaseBatchPatch,
  PackingBatchPatch,
  PaymentBatchPatch,
  buildPurchaseBatchUpdate,
  buildPackingBatchUpdate,
  buildPaymentBatchUpdate,
  countActiveBatchFields,
} from '../utils/batchDatabaseUpdate.ts';

interface BatchUpdateSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeDbType: BatchDbViewType;
  selectedIds: string[];
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  dropdownOptions: DropdownOptions;
  defaultRmbRate: number;
  onUpdatePurchase: (id: string, record: Partial<PurchaseRecord>) => void;
  onUpdatePacking: (id: string, record: Partial<PackingRecord>, silent?: boolean) => void;
  onUpdatePayment: (id: string, record: Partial<PaymentRecord>) => void;
  onSuccess: (message: string) => void;
}

export const BatchUpdateSidebar: React.FC<BatchUpdateSidebarProps> = ({
  isOpen,
  onClose,
  activeDbType,
  selectedIds,
  purchases,
  packings,
  payments,
  dropdownOptions,
  defaultRmbRate,
  onUpdatePurchase,
  onUpdatePacking,
  onUpdatePayment,
  onSuccess,
}) => {
  // Purchase batch fields
  const [purDate, setPurDate] = useState<string>('');
  const [purSupplier, setPurSupplier] = useState<string>('');
  const [purContact, setPurContact] = useState<string>('');
  const [purRemarks, setPurRemarks] = useState<string>('');
  const [purSettleFull, setPurSettleFull] = useState<boolean>(false);

  // Packing batch fields
  const [pkgDate, setPkgDate] = useState<string>('');
  const [pkgMark, setPkgMark] = useState<string>('');
  const [pkgFlight, setPkgFlight] = useState<string>('');
  const [pkgDestination, setPkgDestination] = useState<string>('');
  const [pkgShipper, setPkgShipper] = useState<string>('');
  const [pkgRmbRate, setPkgRmbRate] = useState<string>('');
  const [pkgStatus, setPkgStatus] = useState<string>('');
  const [pkgRemarks, setPkgRemarks] = useState<string>('');

  // Payment batch fields
  const [payDate, setPayDate] = useState<string>('');
  const [payDescription, setPayDescription] = useState<string>('');
  const [payStatus, setPayStatus] = useState<string>('');
  const [payCategory, setPayCategory] = useState<'' | 'supplier' | 'exporter'>('');
  const [payExportRef, setPayExportRef] = useState<string>('');
  const [payRemarks, setPayRemarks] = useState<string>('');

  if (!isOpen) return null;

  const selectedRecords =
    activeDbType === 'purchase'
      ? purchases.filter((r) => selectedIds.includes(r.id))
      : activeDbType === 'packing'
      ? packings.filter((r) => selectedIds.includes(r.id))
      : payments.filter((r) => selectedIds.includes(r.id));

  const currentPatch: PurchaseBatchPatch | PackingBatchPatch | PaymentBatchPatch =
    activeDbType === 'purchase'
      ? {
          date: purDate,
          description: purSupplier,
          contactNumber: purContact,
          remarks: purRemarks,
          settleFullBalance: purSettleFull,
        }
      : activeDbType === 'packing'
      ? {
          packingDate: pkgDate,
          shippingMark: pkgMark,
          flight: pkgFlight,
          destination: pkgDestination,
          shipper: pkgShipper,
          rmbRate:
            pkgRmbRate.trim() !== '' && !Number.isNaN(Number(pkgRmbRate))
              ? Number(pkgRmbRate)
              : undefined,
          paymentStatus: pkgStatus || undefined,
          remarks: pkgRemarks,
        }
      : {
          date: payDate,
          description: payDescription,
          status: payStatus || undefined,
          paymentCategory: payCategory || undefined,
          exportGoodsRef: payExportRef,
          remarks: payRemarks,
        };

  const activeFieldCount = countActiveBatchFields(currentPatch);

  const handleResetFields = () => {
    setPurDate('');
    setPurSupplier('');
    setPurContact('');
    setPurRemarks('');
    setPurSettleFull(false);

    setPkgDate('');
    setPkgMark('');
    setPkgFlight('');
    setPkgDestination('');
    setPkgShipper('');
    setPkgRmbRate('');
    setPkgStatus('');
    setPkgRemarks('');

    setPayDate('');
    setPayDescription('');
    setPayStatus('');
    setPayCategory('');
    setPayExportRef('');
    setPayRemarks('');
  };

  const handleApplyBatchUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecords.length === 0 || activeFieldCount === 0) return;

    if (activeDbType === 'purchase') {
      const patch = currentPatch as PurchaseBatchPatch;
      for (const rec of selectedRecords as PurchaseRecord[]) {
        const updates = buildPurchaseBatchUpdate(rec, patch);
        if (Object.keys(updates).length > 0) {
          onUpdatePurchase(rec.id, updates);
        }
      }
      onSuccess(
        `Batch updated ${selectedRecords.length} Purchase DB record(s) across ${activeFieldCount} field(s).`
      );
    } else if (activeDbType === 'packing') {
      const patch = currentPatch as PackingBatchPatch;
      for (const rec of selectedRecords as PackingRecord[]) {
        const updates = buildPackingBatchUpdate(rec, patch);
        if (Object.keys(updates).length > 0) {
          onUpdatePacking(rec.id, updates, true);
        }
      }
      onSuccess(
        `Batch updated ${selectedRecords.length} Packing DB record(s) across ${activeFieldCount} field(s).`
      );
    } else {
      const patch = currentPatch as PaymentBatchPatch;
      for (const rec of selectedRecords as PaymentRecord[]) {
        const updates = buildPaymentBatchUpdate(rec, patch);
        if (Object.keys(updates).length > 0) {
          onUpdatePayment(rec.id, updates);
        }
      }
      onSuccess(
        `Batch updated ${selectedRecords.length} Payment DB record(s) across ${activeFieldCount} field(s).`
      );
    }

    handleResetFields();
    onClose();
  };

  const dbLabel =
    activeDbType === 'purchase'
      ? 'Purchase DB'
      : activeDbType === 'packing'
      ? 'Packing List DB'
      : 'Payment Vouchers DB';

  return (
    <aside
      aria-label="Batch Update Secondary Sidebar"
      data-testid="batch-update-sidebar"
      className="w-full lg:w-96 shrink-0 bg-white rounded-xl shadow-lg border-2 border-amber-400 overflow-hidden flex flex-col justify-between self-start sticky top-4"
    >
      {/* Top Header */}
      <div>
        <div className="bg-[#1b2b44] text-white px-4 py-3.5 border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400 text-slate-950 shrink-0">
              <Layers className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Batch Update Sidebar
              </h3>
              <p className="text-[11px] text-slate-300">
                Bulk edit {dbLabel} records at once
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-batch-sidebar-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close Batch Update Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Target Records Summary Strip */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Selected Target Rows:</span>
            <span
              data-testid="batch-sidebar-selected-count"
              className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-black ${
                selectedRecords.length > 0
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {selectedRecords.length} Record(s)
            </span>
          </div>

          {selectedRecords.length === 0 ? (
            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 font-medium">
              Check one or more rows in the {dbLabel} table on the left to apply bulk edits.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
              {selectedRecords.map((r) => (
                <span
                  key={r.id}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold text-slate-800 shadow-2xs"
                >
                  {r.invoiceNumber}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleApplyBatchUpdate} className="p-4 space-y-3.5 text-xs">
          <div className="text-[11px] text-slate-500 leading-relaxed">
            Leave any field blank to keep each row&apos;s existing value unchanged. Only filled fields will be applied to the{' '}
            <strong className="text-slate-800">{selectedRecords.length}</strong> selected record(s).
          </div>

          {/* PURCHASE DB BATCH FIELDS */}
          {activeDbType === 'purchase' && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Transaction Date</span>
                </label>
                <input
                  type="date"
                  data-testid="batch-purchase-date-input"
                  value={purDate}
                  onChange={(e) => setPurDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Supplier / Description</span>
                </label>
                <input
                  type="text"
                  list="batch-supplier-presets"
                  data-testid="batch-purchase-supplier-input"
                  placeholder="Keep existing supplier..."
                  value={purSupplier}
                  onChange={(e) => setPurSupplier(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
                <datalist id="batch-supplier-presets">
                  {dropdownOptions.suppliers.map((sup) => (
                    <option key={sup} value={sup} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Contact Number</span>
                </label>
                <input
                  type="text"
                  data-testid="batch-purchase-contact-input"
                  placeholder="Keep existing contact..."
                  value={purContact}
                  onChange={(e) => setPurContact(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Remarks / Audit Note</span>
                </label>
                <input
                  type="text"
                  data-testid="batch-purchase-remarks-input"
                  placeholder="Optional bulk remark..."
                  value={purRemarks}
                  onChange={(e) => setPurRemarks(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="batch-purchase-settle-checkbox"
                  checked={purSettleFull}
                  onChange={(e) => setPurSettleFull(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-bold text-emerald-950 block">
                    Mark Full Balance as Paid (Balance = 0)
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    Sets Paid Amount = Total Amount + Previous Balance for all selected bills
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* PACKING DB BATCH FIELDS */}
          {activeDbType === 'packing' && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>Packing Date</span>
                </label>
                <input
                  type="date"
                  data-testid="batch-packing-date-input"
                  value={pkgDate}
                  onChange={(e) => setPkgDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                    <Tag className="w-3.5 h-3.5 text-teal-600" />
                    <span>Shipping Mark</span>
                  </label>
                  <input
                    type="text"
                    list="batch-mark-presets"
                    data-testid="batch-packing-mark-input"
                    placeholder="Unchanged"
                    value={pkgMark}
                    onChange={(e) => setPkgMark(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                  />
                  <datalist id="batch-mark-presets">
                    {dropdownOptions.shippingMarks.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                    <Plane className="w-3.5 h-3.5 text-teal-600" />
                    <span>Flight No</span>
                  </label>
                  <input
                    type="text"
                    list="batch-flight-presets"
                    data-testid="batch-packing-flight-input"
                    placeholder="Unchanged"
                    value={pkgFlight}
                    onChange={(e) => setPkgFlight(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-slate-50 focus:bg-white"
                  />
                  <datalist id="batch-flight-presets">
                    {dropdownOptions.flights.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>Destination</span>
                  </label>
                  <input
                    type="text"
                    list="batch-dest-presets"
                    data-testid="batch-packing-destination-input"
                    placeholder="Unchanged"
                    value={pkgDestination}
                    onChange={(e) => setPkgDestination(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                  />
                  <datalist id="batch-dest-presets">
                    {dropdownOptions.destinations.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                    <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Shipper</span>
                  </label>
                  <input
                    type="text"
                    list="batch-shipper-presets"
                    data-testid="batch-packing-shipper-input"
                    placeholder="Unchanged"
                    value={pkgShipper}
                    onChange={(e) => setPkgShipper(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                  />
                  <datalist id="batch-shipper-presets">
                    {dropdownOptions.shippers.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="flex items-center justify-between font-bold text-slate-700 mb-1">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                      <span>RMB Rate (BDT)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPkgRmbRate(String(defaultRmbRate))}
                      className="text-[10px] font-mono text-teal-700 hover:underline cursor-pointer"
                    >
                      Use {defaultRmbRate}
                    </button>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    data-testid="batch-packing-rmb-rate-input"
                    placeholder="e.g. 16.50"
                    value={pkgRmbRate}
                    onChange={(e) => setPkgRmbRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg font-mono font-bold text-xs bg-amber-50/60 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Payment Status</span>
                  </label>
                  <select
                    data-testid="batch-packing-status-select"
                    value={pkgStatus}
                    onChange={(e) => setPkgStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- Unchanged --</option>
                    {dropdownOptions.paymentStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>Remarks</span>
                </label>
                <input
                  type="text"
                  data-testid="batch-packing-remarks-input"
                  placeholder="Optional bulk manifest note..."
                  value={pkgRemarks}
                  onChange={(e) => setPkgRemarks(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* PAYMENT DB BATCH FIELDS */}
          {activeDbType === 'payment' && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  <span>Voucher Date</span>
                </label>
                <input
                  type="date"
                  data-testid="batch-payment-date-input"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>Party / Mark Description</span>
                </label>
                <input
                  type="text"
                  data-testid="batch-payment-description-input"
                  placeholder="Keep existing party/mark..."
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Voucher Status</span>
                  </label>
                  <select
                    data-testid="batch-payment-status-select"
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- Unchanged --</option>
                    {dropdownOptions.paymentStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1 font-bold text-slate-700 mb-1">
                    <Tag className="w-3.5 h-3.5 text-purple-600" />
                    <span>Ledger Category</span>
                  </label>
                  <select
                    data-testid="batch-payment-category-select"
                    value={payCategory}
                    onChange={(e) =>
                      setPayCategory(e.target.value as '' | 'supplier' | 'exporter')
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                  >
                    <option value="">-- Unchanged --</option>
                    <option value="supplier">SUPPLIER</option>
                    <option value="exporter">EXPORTER</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>Export Goods Reference</span>
                </label>
                <input
                  type="text"
                  data-testid="batch-payment-export-ref-input"
                  placeholder="Keep existing export ref..."
                  value={payExportRef}
                  onChange={(e) => setPayExportRef(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>Remarks</span>
                </label>
                <input
                  type="text"
                  data-testid="batch-payment-remarks-input"
                  placeholder="Optional bulk voucher remark..."
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="batch-sidebar-reset-btn"
              onClick={handleResetFields}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Fields</span>
            </button>

            <button
              type="submit"
              data-testid="batch-sidebar-apply-btn"
              disabled={selectedRecords.length === 0 || activeFieldCount === 0}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide shadow-sm transition ${
                selectedRecords.length > 0 && activeFieldCount > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Apply to {selectedRecords.length} Row{selectedRecords.length === 1 ? '' : 's'}
                {activeFieldCount > 0 ? ` (${activeFieldCount})` : ''}
              </span>
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
};
