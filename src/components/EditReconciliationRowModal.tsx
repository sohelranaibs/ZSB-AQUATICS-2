import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  ExternalLink,
  X,
} from 'lucide-react';
import { ExporterStatus } from '../types/index.ts';
import { formatCurrency } from '../utils/calculations.ts';
import {
  LedgerEditFormValues,
  LedgerEditValidationResult,
  ResolvedLedgerRowSource,
  validateLedgerEditForm,
} from '../utils/supplierLedgerEdit.ts';

interface EditReconciliationRowModalProps {
  target: ResolvedLedgerRowSource | null;
  suppliers: string[];
  currency: string;
  onClose: () => void;
  onSave: (
    target: ResolvedLedgerRowSource,
    validated: LedgerEditValidationResult,
    remarks: string
  ) => void;
  onOpenFullPurchaseForm?: (purchaseId: string) => void;
}

const RECORD_TYPE_META: Record<
  ResolvedLedgerRowSource['recordType'],
  { label: string; badgeClass: string; subtitle: string }
> = {
  PURCHASE_BILL: {
    label: 'PURCHASE BILL',
    badgeClass: 'bg-blue-500/20 text-blue-100 border-blue-300/40',
    subtitle: 'Correct challan date, supplier, debit/credit amounts, or status directly in the ledger.',
  },
  PAYMENT_VOUCHER: {
    label: 'PAYMENT VOUCHER',
    badgeClass: 'bg-emerald-500/20 text-emerald-100 border-emerald-300/40',
    subtitle: 'Correct payment date, supplier, disbursed credit amount, or status.',
  },
  CREDIT_NOTE: {
    label: 'CREDIT NOTE',
    badgeClass: 'bg-amber-500/20 text-amber-100 border-amber-300/40',
    subtitle: 'Correct supplier credit note date, credit amount, status, or remarks.',
  },
};

export const EditReconciliationRowModal: React.FC<EditReconciliationRowModalProps> = ({
  target,
  suppliers,
  currency,
  onClose,
  onSave,
  onOpenFullPurchaseForm,
}) => {
  const [form, setForm] = useState<LedgerEditFormValues>({
    date: '',
    invoiceNumber: '',
    supplierName: '',
    debitAmount: '0',
    creditAmount: '0',
    status: 'REPORT',
    remarks: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setForm(target.initialValues);
      setValidationError(null);
    }
  }, [target]);

  const liveBalance = useMemo(() => {
    if (!target) return 0;
    const debit = target.recordType === 'CREDIT_NOTE' ? 0 : parseFloat(form.debitAmount) || 0;
    const credit = parseFloat(form.creditAmount) || 0;
    return Math.round((debit - credit) * 100) / 100;
  }, [form.debitAmount, form.creditAmount, target]);

  if (!target) return null;

  const meta = RECORD_TYPE_META[target.recordType];
  const isCreditNote = target.recordType === 'CREDIT_NOTE';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateLedgerEditForm(form, target.recordType);
    if (!result.valid) {
      setValidationError(result.error || 'Please check the entered values.');
      return;
    }
    setValidationError(null);
    onSave(target, result, form.remarks);
  };

  return (
    <div
      data-testid="edit-reconciliation-row-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-reconciliation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1F3349] via-[#273E56] to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Edit2 className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="edit-reconciliation-modal-title"
                  className="font-black text-sm sm:text-base tracking-wide text-white uppercase"
                >
                  Edit Reconciliation Entry
                </h3>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-black uppercase ${meta.badgeClass}`}
                >
                  {meta.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit reconciliation entry modal"
            className="p-1.5 text-slate-900 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4 text-xs">
          {validationError && (
            <div
              data-testid="edit-reconciliation-error-banner"
              role="alert"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Date & Invoice Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="recon-edit-date"
                className="block font-bold text-slate-700 mb-1 uppercase text-[11px]"
              >
                Transaction Date *
              </label>
              <input
                id="recon-edit-date"
                type="date"
                data-testid="edit-reconciliation-date-input"
                value={form.date}
                onChange={(e) => {
                  setValidationError(null);
                  setForm((prev) => ({ ...prev, date: e.target.value }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label
                htmlFor="recon-edit-invoice"
                className="block font-bold text-slate-700 mb-1 uppercase text-[11px]"
              >
                {isCreditNote ? 'Credit Note No. *' : 'Invoice / Voucher No. *'}
              </label>
              <input
                id="recon-edit-invoice"
                type="text"
                data-testid="edit-reconciliation-invoice-input"
                value={form.invoiceNumber}
                onChange={(e) => {
                  setValidationError(null);
                  setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-[#1F3349] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Supplier Name */}
          <div>
            <label
              htmlFor="recon-edit-supplier"
              className="block font-bold text-slate-700 mb-1 uppercase text-[11px]"
            >
              Supplier Name *
            </label>
            <input
              id="recon-edit-supplier"
              type="text"
              list="recon-edit-suppliers-datalist"
              data-testid="edit-reconciliation-supplier-input"
              value={form.supplierName}
              onChange={(e) => {
                setValidationError(null);
                setForm((prev) => ({ ...prev, supplierName: e.target.value }));
              }}
              placeholder="Select or enter supplier name"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
            <datalist id="recon-edit-suppliers-datalist">
              {suppliers.map((sup) => (
                <option key={sup} value={sup} />
              ))}
            </datalist>
          </div>

          {/* Debit, Credit & Computed Balance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label
                htmlFor="recon-edit-debit"
                className="block font-black text-slate-700 mb-1 text-[11px] uppercase tracking-wide"
              >
                Debit Amount ({currency})
              </label>
              <input
                id="recon-edit-debit"
                type="number"
                step="any"
                min="0"
                disabled={isCreditNote}
                data-testid="edit-reconciliation-debit-input"
                value={isCreditNote ? '0' : form.debitAmount}
                onChange={(e) => {
                  setValidationError(null);
                  setForm((prev) => ({ ...prev, debitAmount: e.target.value }));
                }}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-black text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-medium">
                {isCreditNote ? 'Not applicable to Credit Notes' : 'Billed / Purchase Debit'}
              </p>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
              <label
                htmlFor="recon-edit-credit"
                className="block font-black text-emerald-900 mb-1 text-[11px] uppercase tracking-wide"
              >
                Credit / Paid ({currency})
              </label>
              <input
                id="recon-edit-credit"
                type="number"
                step="any"
                min="0"
                data-testid="edit-reconciliation-credit-input"
                value={form.creditAmount}
                onChange={(e) => {
                  setValidationError(null);
                  setForm((prev) => ({ ...prev, creditAmount: e.target.value }));
                }}
                className="w-full px-3 py-1.5 border-2 border-emerald-400 rounded-lg font-mono font-black text-emerald-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              />
              <p className="text-[10px] text-emerald-700 mt-1 font-medium">
                Paid / Credited Amount
              </p>
            </div>

            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 flex flex-col justify-between">
              <span className="block font-black text-blue-900 text-[11px] uppercase tracking-wide">
                Row Balance
              </span>
              <div
                data-testid="edit-reconciliation-live-balance"
                className={`font-mono font-black text-base mt-1 ${
                  liveBalance > 0
                    ? 'text-rose-700'
                    : liveBalance < 0
                    ? 'text-emerald-700'
                    : 'text-slate-900'
                }`}
              >
                {formatCurrency(liveBalance, currency)}
              </div>
              <p className="text-[10px] text-blue-700 mt-1 font-medium">
                Auto: Debit − Credit
              </p>
            </div>
          </div>

          {/* Status & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="recon-edit-status"
                className="block font-bold text-slate-700 mb-1 uppercase text-[11px]"
              >
                Status
              </label>
              <select
                id="recon-edit-status"
                data-testid="edit-reconciliation-status-select"
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as ExporterStatus,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="PAID">PAID</option>
                <option value="REPORT">REPORT</option>
                <option value="NO REPORT">NO REPORT</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="recon-edit-remarks"
                className="block font-bold text-slate-700 mb-1 uppercase text-[11px]"
              >
                Remarks / Note
              </label>
              <input
                id="recon-edit-remarks"
                type="text"
                data-testid="edit-reconciliation-remarks-input"
                value={form.remarks}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
                placeholder="Reason for correction or note"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
            <div>
              {target.recordType === 'PURCHASE_BILL' && onOpenFullPurchaseForm ? (
                <button
                  type="button"
                  data-testid="edit-reconciliation-open-full-form-btn"
                  onClick={() => onOpenFullPurchaseForm(target.recordId)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold uppercase transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>OPEN FULL CHALLAN FORM</span>
                </button>
              ) : (
                <span className="text-[11px] font-mono text-slate-400">
                  ID: {target.recordId}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="edit-reconciliation-cancel-btn"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                data-testid="edit-reconciliation-save-btn"
                className="px-5 py-2 text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>SAVE CHANGES</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
