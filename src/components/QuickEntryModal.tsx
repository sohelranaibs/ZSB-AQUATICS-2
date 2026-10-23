import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  parsePurchasesCSV,
  parsePackingsCSV,
  parsePaymentsCSV,
  ParseResult,
} from '../utils/csvParser.ts';
import { formatCurrency, formatDate } from '../utils/calculations.ts';
import {
  Zap,
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  Table,
} from 'lucide-react';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadType = 'purchase' | 'packing' | 'payment';

const SAMPLE_TEMPLATES: Record<UploadType, string> = {
  purchase: `Supplier, Date, Item, Quantity, Rate, PreviousAmount, PaidAmount, ContactNumber
ABDULLAH VAI, 2026-10-21, FF1, 120, 460, 10000, 45000, +8801711223344
UZZAL VAI, 2026-10-21, F1, 150, 330, 0, 49500, +8801822334455
NAPAL VAI, 2026-10-21, 2F, 80, 380, 15000, 30000, +8801933445566
FAISAL VAI, 2026-10-21, XXL, 90, 520, 5000, 40000, +8801671036114`,

  packing: `ShippingMark, Flight, Destination, Shipper, Date, Item, Box, Weight, Rate
AAD, CAN, GUANGZHOU, ZSB AQUATICS, 2026-10-21, 2F, 8, 15, 420
CHJ-22, YG CAN, KUNMING, SAJID INT., 2026-10-21, 3F, 6, 14, 400
LXB-52, CZ, SHANGHAI, ZSB AQUATICS, 2026-10-21, XXL, 5, 16, 580
ROE, MU KMG, XIAMEN, RIK INTERNATIONAL, 2026-10-21, 4F, 7, 15, 390`,

  payment: `Party, Date, DebitAmount, CreditAmount, Status, ReturnRMB, ExportRef
ABDULLAH VAI, 2026-10-21, 65000, 0, PAID, 3000, PKG-2026-0001
UZZAL VAI, 2026-10-21, 49500, 0, REPORT, 2500, PKG-2026-0002
NAPAL VAI, 2026-10-21, 30000, 0, PAID, 1800, PKG-2026-0003`,
};

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({ isOpen, onClose }) => {
  const {
    addPurchase,
    addPacking,
    addPayment,
    purchases,
    packings,
    payments,
    companyProfile,
    showToast,
  } = useApp();

  const [activeType, setActiveType] = useState<UploadType>('purchase');
  const [csvText, setCsvText] = useState<string>(SAMPLE_TEMPLATES.purchase);

  if (!isOpen) return null;

  // Real-time parsing based on active type
  let parseResult: ParseResult<any>;
  if (activeType === 'purchase') {
    parseResult = parsePurchasesCSV(csvText, purchases.length);
  } else if (activeType === 'packing') {
    parseResult = parsePackingsCSV(csvText, packings.length);
  } else {
    parseResult = parsePaymentsCSV(csvText, payments.length);
  }

  const handleTypeChange = (type: UploadType) => {
    setActiveType(type);
    setCsvText(SAMPLE_TEMPLATES[type]);
  };

  const handleLoadSample = () => {
    setCsvText(SAMPLE_TEMPLATES[activeType]);
  };

  const handleClear = () => {
    setCsvText('');
  };

  const handleCommitUpload = () => {
    if (!parseResult.success || parseResult.records.length === 0) {
      showToast('No valid records found in the CSV text area. Please check the format.');
      return;
    }

    if (activeType === 'purchase') {
      parseResult.records.forEach((rec) => addPurchase(rec));
      showToast(`Successfully bulk-imported ${parseResult.records.length} purchase records!`);
    } else if (activeType === 'packing') {
      parseResult.records.forEach((rec) => addPacking(rec));
      showToast(`Successfully bulk-imported ${parseResult.records.length} packing list records!`);
    } else {
      parseResult.records.forEach((rec) => addPayment(rec));
      showToast(`Successfully bulk-imported ${parseResult.records.length} payment records!`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg font-black text-xl">
              <Zap className="w-6 h-6 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-extrabold tracking-wide uppercase font-serif text-amber-400">
                  Quick Entry – CSV Bulk Upload
                </h2>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-400/40">
                  FAST DATA POPULATION
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bulk-insert multiple rows directly into ZSB AQUATICS database sheets via simple comma-separated text.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Module Selector Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Target Sheet:</span>
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleTypeChange('purchase')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                    activeType === 'purchase'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Purchases (Challan)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('packing')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                    activeType === 'packing'
                      ? 'bg-teal-600 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Packing Lists (Export)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('payment')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                    activeType === 'payment'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Payments (Supplier/Exporter)
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 rounded hover:bg-amber-100 transition flex items-center space-x-1"
                title="Populate sample records"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Load Sample CSV</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 transition flex items-center space-x-1"
                title="Clear text area"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Expected Columns Guideline */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1 font-mono">
            <span className="font-bold text-slate-800 font-sans block text-[11px] uppercase tracking-wide">
              Expected Column Order ({activeType.toUpperCase()}):
            </span>
            {activeType === 'purchase' && (
              <p className="text-blue-900 font-semibold">
                Supplier, Date (YYYY-MM-DD), Item, Quantity, Rate, [PreviousAmount], [PaidAmount], [ContactNumber]
              </p>
            )}
            {activeType === 'packing' && (
              <p className="text-teal-900 font-semibold">
                ShippingMark, Flight, Destination, Shipper, Date, Item, Box, Weight, Rate
              </p>
            )}
            {activeType === 'payment' && (
              <p className="text-purple-900 font-semibold">
                Party, Date (YYYY-MM-DD), DebitAmount, CreditAmount, Status [PAID/REPORT/NO REPORT], [ReturnRMB], [ExportRef]
              </p>
            )}
          </div>

          {/* CSV Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 uppercase">
                Paste / Type CSV Lines (One Record per Line):
              </label>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                  parseResult.records.length > 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {parseResult.records.length} Valid Row(s) Detected
              </span>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste comma-separated rows here..."
              className="w-full bg-slate-900 text-amber-200 font-mono text-xs p-3.5 rounded-xl border border-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
            />
          </div>

          {/* Errors or Warnings */}
          {parseResult.errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs space-y-1">
              <div className="font-bold flex items-center space-x-1">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Format Warnings ({parseResult.errors.length}):</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                {parseResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Live Parsed Preview Table */}
          {parseResult.records.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase">
                <Table className="w-4 h-4 text-blue-600" />
                <span>Live Parse Preview Before Saving:</span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-56">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-800 uppercase font-bold text-[10px] border-b">
                    <tr>
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2">DOC NO</th>
                      <th className="p-2">DATE</th>
                      <th className="p-2">PARTY / MARK</th>
                      <th className="p-2">DETAILS</th>
                      <th className="p-2 text-right">TOTAL AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {parseResult.records.map((rec: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-blue-900">{rec.invoiceNumber}</td>
                        <td className="p-2 font-mono text-slate-600">
                          {formatDate(rec.date || rec.packingDate)}
                        </td>
                        <td className="p-2 font-bold text-slate-800">
                          {rec.description || `${rec.shippingMark} (${rec.destination})`}
                        </td>
                        <td className="p-2 text-slate-600">
                          {activeType === 'purchase' && rec.items?.[0] && (
                            <span>
                              {rec.items[0].item}: {rec.items[0].quantity} @ {rec.items[0].rate}
                            </span>
                          )}
                          {activeType === 'packing' && rec.items?.[0] && (
                            <span>
                              {rec.items[0].box} Boxes × {rec.items[0].weight} KG ({rec.totalWeight} KG)
                            </span>
                          )}
                          {activeType === 'payment' && (
                            <span>
                              Status: <strong>{rec.status}</strong> {rec.returnRMB ? `| ¥${rec.returnRMB}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(rec.totalAmount, companyProfile.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Records will be safely appended to localStorage database and reflect immediately across all sheets.
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommitUpload}
              disabled={parseResult.records.length === 0}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-extrabold uppercase shadow transition ${
                parseResult.records.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Import &amp; Save ({parseResult.records.length} Records)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
