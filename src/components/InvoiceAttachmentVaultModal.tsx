import React, { useRef, useState } from 'react';
import {
  AttachmentProofCategory,
  InvoiceAttachmentModule,
  InvoiceAttachmentRecord,
  MAX_ATTACHMENTS_PER_INVOICE,
  addAttachmentToList,
  getAttachmentsForRecord,
  removeAttachmentFromList,
  saveAllInvoiceAttachments,
} from '../utils/invoiceAttachments.ts';
import { formatStorageBytes } from '../utils/snapshotManager.ts';
import {
  Download,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

export interface AttachmentVaultTarget {
  module: InvoiceAttachmentModule;
  recordId: string;
  invoiceNumber: string;
  subtitle?: string;
}

interface InvoiceAttachmentVaultModalProps {
  target: AttachmentVaultTarget | null;
  allAttachments: InvoiceAttachmentRecord[];
  onChangeAttachments: (next: InvoiceAttachmentRecord[]) => void;
  onClose: () => void;
  canEdit?: boolean;
  onNotify?: (msg: string) => void;
}

const PROOF_CATEGORIES: AttachmentProofCategory[] = [
  'Supplier Challan',
  'Air Waybill (AWB)',
  'Quarantine / Health Cert',
  'WeChat / Bank Receipt',
  'Other Proof',
];

export const InvoiceAttachmentVaultModal: React.FC<InvoiceAttachmentVaultModalProps> = ({
  target,
  allAttachments,
  onChangeAttachments,
  onClose,
  canEdit = true,
  onNotify,
}) => {
  const [category, setCategory] = useState<AttachmentProofCategory>('Supplier Challan');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<InvoiceAttachmentRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!target) return null;

  const recordAttachments = getAttachmentsForRecord(
    allAttachments,
    target.module,
    target.recordId
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const result = addAttachmentToList(allAttachments, {
        module: target.module,
        recordId: target.recordId,
        invoiceNumber: target.invoiceNumber,
        category,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl,
        notes: notes.trim() || undefined,
      });

      if (!result.valid) {
        setErrorMsg(result.error || 'Could not attach document.');
        return;
      }

      const saved = saveAllInvoiceAttachments(result.updatedList);
      if (!saved) {
        setErrorMsg('Local storage is full. Remove older attachments or snapshots and try again.');
        return;
      }
      onChangeAttachments(result.updatedList);
      setNotes('');
      onNotify?.(`Attached "${file.name}" to ${target.invoiceNumber}.`);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (attachment: InvoiceAttachmentRecord) => {
    const next = removeAttachmentFromList(allAttachments, attachment.id);
    saveAllInvoiceAttachments(next);
    onChangeAttachments(next);
    if (previewAttachment?.id === attachment.id) {
      setPreviewAttachment(null);
    }
    onNotify?.(`Removed attachment "${attachment.fileName}".`);
  };

  const handleDownload = (attachment: InvoiceAttachmentRecord) => {
    const a = document.createElement('a');
    a.href = attachment.dataUrl;
    a.download = attachment.fileName;
    a.click();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Attachment Vault for ${target.invoiceNumber}`}
      data-testid="invoice-attachment-vault-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 print:hidden"
    >
      <div className="bg-white w-full max-w-3xl max-h-[88vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#273E56] text-white px-5 py-4 flex items-center justify-between border-b-2 border-[#00897b]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00897b] flex items-center justify-center shrink-0">
              <Paperclip className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-mono text-[#5eead4]">
                Receipt, AWB &amp; Payment Proof Vault · {target.module.toUpperCase()}
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                {target.invoiceNumber}
                {target.subtitle ? ` — ${target.subtitle}` : ''}
              </h2>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Attachment Vault"
            data-testid="close-attachment-vault-btn"
            onClick={onClose}
            className="p-1.5 text-black cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {canEdit && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="vault-category-select"
                    className="block text-[11px] font-bold text-slate-700 mb-1"
                  >
                    Document Proof Category
                  </label>
                  <select
                    id="vault-category-select"
                    data-testid="vault-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AttachmentProofCategory)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900"
                  >
                    {PROOF_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label
                    htmlFor="vault-notes-input"
                    className="block text-[11px] font-bold text-slate-700 mb-1"
                  >
                    Proof Note (Optional)
                  </label>
                  <input
                    id="vault-notes-input"
                    data-testid="vault-notes-input"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Signed AWB copy / WeChat transfer slip"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="button"
                    data-testid="vault-upload-trigger-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-black cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Attach File</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    data-testid="vault-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                Supports JPG, PNG, WEBP, or PDF up to 2 MB each ({recordAttachments.length}/
                {MAX_ATTACHMENTS_PER_INVOICE} attached to this invoice).
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  data-testid="vault-error-banner"
                  className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold text-[11px]"
                >
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* Attachments List */}
          {recordAttachments.length === 0 ? (
            <div
              data-testid="vault-empty-state"
              className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 space-y-1"
            >
              <Paperclip className="w-7 h-7 mx-auto text-slate-400" />
              <p className="font-bold text-slate-700">No Receipt or AWB Proof Attached Yet</p>
              <p className="text-[11px]">
                Attach a scanned supplier challan, airline AWB, quarantine certificate, or WeChat payment screenshot for instant audit proof.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="vault-attachments-list">
              {recordAttachments.map((att) => {
                const isImage = att.mimeType.startsWith('image/');
                return (
                  <div
                    key={att.id}
                    data-testid={`vault-attachment-item-${att.id}`}
                    className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isImage ? (
                        <img
                          src={att.dataUrl}
                          alt={att.fileName}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{att.fileName}</div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {att.category} · {formatStorageBytes(att.sizeBytes)} ·{' '}
                          {att.uploadedAt.slice(0, 10)}
                        </div>
                        {att.notes && (
                          <div className="text-[11px] text-slate-600 italic">{att.notes}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isImage && (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>Preview</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownload(att)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-black cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Delete attachment ${att.fileName}`}
                          onClick={() => handleRemove(att)}
                          className="p-1.5 text-black cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {previewAttachment && previewAttachment.mimeType.startsWith('image/') && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-white text-[11px] font-mono">
                <span>Preview: {previewAttachment.fileName}</span>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="px-2 py-0.5 text-[11px] font-bold text-black cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
              <img
                src={previewAttachment.dataUrl}
                alt={previewAttachment.fileName}
                className="max-h-72 mx-auto rounded-lg object-contain"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Stored locally in ZSB Attachment Vault for offline invoice audit access</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-black cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
