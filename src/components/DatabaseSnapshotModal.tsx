import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  DatabaseSnapshot,
  describeSnapshotTrigger,
  serializeSnapshotToJSON,
  createDatabaseSnapshot,
} from '../utils/snapshotManager.ts';
import { formatCurrency } from '../utils/calculations.ts';
import {
  Archive,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  X,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Eye,
  EyeOff,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';

export const DatabaseSnapshotModal: React.FC = () => {
  const {
    snapshotModalOpen,
    closeSnapshotModal,
    snapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    downloadSnapshotJSON,
    importSnapshotFromJSON,
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile,
    dropdownOptions,
    packingDraft,
  } = useApp();

  const [activeMode, setActiveMode] = useState<'archive' | 'import_json'>('archive');
  const [labelInput, setLabelInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [includeSettingsOnRestore, setIncludeSettingsOnRestore] = useState<boolean>(true);
  const [expandedJsonId, setExpandedJsonId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Import / Paste JSON state
  const [jsonTextInput, setJsonTextInput] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{
    type: 'error' | 'success';
    message: string;
    warnings?: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!snapshotModalOpen) {
    return null;
  }

  const liveTotalRecords =
    purchases.length + packings.length + payments.length + otherCosts.length;

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const created = createSnapshot(
      labelInput.trim() || undefined,
      notesInput.trim() || undefined,
      'manual'
    );
    setLabelInput('');
    setNotesInput('');
    setImportStatus({
      type: 'success',
      message: `Created local snapshot "${created.label}" (${created.recordCounts.totalRecords} records archived).`,
    });
  };

  const handleRestoreSnapshot = (snap: DatabaseSnapshot) => {
    const ok = restoreSnapshot(snap.id, {
      includeSettings: includeSettingsOnRestore,
      createPreRestoreBackup: false,
    });
    if (ok) {
      setImportStatus({
        type: 'success',
        message: `State restored to "${snap.label}" (${snap.recordCounts.totalRecords} records active).`,
      });
    }
  };

  const handleCopySnapshotJson = async (snap: DatabaseSnapshot) => {
    try {
      await navigator.clipboard.writeText(serializeSnapshotToJSON(snap));
      setCopiedId(snap.id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === snap.id ? null : curr));
      }, 2000);
    } catch {
      // ignore clipboard errors in restricted environments
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonTextInput(content);
        const result = importSnapshotFromJSON(content, true);
        if (!result.valid) {
          setImportStatus({
            type: 'error',
            message: result.error || 'Failed to parse JSON snapshot file.',
          });
        } else {
          setImportStatus({
            type: 'success',
            message: `Successfully restored ${result.snapshot?.recordCounts.totalRecords ?? 0} records from "${file.name}" and saved to local snapshots.`,
            warnings: result.warnings,
          });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleValidateAndRestoreJson = (autoRestore: boolean) => {
    const result = importSnapshotFromJSON(jsonTextInput, autoRestore);
    if (!result.valid) {
      setImportStatus({
        type: 'error',
        message: result.error || 'Corrupted or invalid JSON snapshot payload.',
      });
      return;
    }

    setImportStatus({
      type: 'success',
      message: autoRestore
        ? `Restored ${result.snapshot?.recordCounts.totalRecords ?? 0} records from JSON archive and saved snapshot "${result.snapshot?.label}".`
        : `Validated and saved snapshot "${result.snapshot?.label}" (${result.snapshot?.recordCounts.totalRecords ?? 0} records) to local archive.`,
      warnings: result.warnings,
    });
  };

  const handleLoadLiveJsonToEditor = () => {
    const previewSnap = createDatabaseSnapshot(
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
        label: `Live State Preview (${new Date().toISOString().slice(0, 10)})`,
        trigger: 'manual',
      }
    );
    setJsonTextInput(serializeSnapshotToJSON(previewSnap));
    setImportStatus(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
      data-testid="database-snapshot-modal"
    >
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#1b2b44] text-white px-5 py-4 flex items-center justify-between border-b-2 border-amber-500 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="zsb-3d-text text-sm sm:text-base font-black tracking-wider">
                  {companyProfile.companyName}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-xs font-mono text-amber-300 font-semibold">
                  Local JSON Archive &amp; Recovery Engine
                </span>
              </div>
              <h2
                id="snapshot-modal-title"
                className="text-sm sm:text-base font-extrabold text-white mt-0.5"
              >
                Database Snapshot &amp; State Recovery Center
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSnapshotModal}
            aria-label="Close Database Snapshot Modal"
            data-testid="close-snapshot-modal-btn"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Database Telemetry & Mode Switcher Bar */}
        <div className="bg-slate-900 text-slate-200 px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
            <span className="text-slate-400 font-sans font-semibold">Current Live State:</span>
            <span className="text-white font-bold" data-testid="snapshot-live-total-count">
              {liveTotalRecords} Total Records
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-blue-300">Purchases: {purchases.length}</span>
            <span className="text-slate-600">·</span>
            <span className="text-teal-300">Packings: {packings.length}</span>
            <span className="text-slate-600">·</span>
            <span className="text-purple-300">Payments: {payments.length}</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-300">Expenses: {otherCosts.length}</span>
          </div>

          {/* Segmented Control Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700">
            <button
              type="button"
              data-testid="snapshot-tab-archive"
              onClick={() => {
                setActiveMode('archive');
                setImportStatus(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                activeMode === 'archive'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Saved Snapshots ({snapshots.length})
            </button>
            <button
              type="button"
              data-testid="snapshot-tab-import-json"
              onClick={() => {
                setActiveMode('import_json');
                setImportStatus(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                activeMode === 'import_json'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Restore / Paste JSON Archive
            </button>
          </div>
        </div>

        {/* Status Feedback Banner */}
        {importStatus && (
          <div
            role="alert"
            data-testid={
              importStatus.type === 'error' ? 'snapshot-status-error' : 'snapshot-status-success'
            }
            className={`px-5 py-2.5 border-b text-xs flex items-start justify-between gap-3 shrink-0 ${
              importStatus.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-start space-x-2">
              {importStatus.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">{importStatus.message}</p>
                {importStatus.warnings && importStatus.warnings.length > 0 && (
                  <ul className="mt-1 text-[11px] text-amber-800 list-disc list-inside">
                    {importStatus.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setImportStatus(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeMode === 'archive' ? (
            <>
              {/* Create New Snapshot Section */}
              <form
                onSubmit={handleCreateSnapshot}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                      Create Local JSON Snapshot
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Captures an instant, checksum-verified JSON archive of all current ledgers and settings in local storage.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="download-current-snapshot-btn"
                    onClick={() => downloadSnapshotJSON()}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Current .JSON File</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="snapshot-label-input"
                      className="block font-bold text-slate-700 mb-1 text-[11px]"
                    >
                      Snapshot Label (Optional)
                    </label>
                    <input
                      id="snapshot-label-input"
                      data-testid="snapshot-label-input"
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder="e.g., October Closing Checkpoint"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label
                      htmlFor="snapshot-notes-input"
                      className="block font-bold text-slate-700 mb-1 text-[11px]"
                    >
                      Recovery Note (Optional)
                    </label>
                    <input
                      id="snapshot-notes-input"
                      data-testid="snapshot-notes-input"
                      type="text"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="e.g., Verified all supplier balances"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      data-testid="create-snapshot-btn"
                      className="w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#1b73b4] hover:bg-[#155d93] text-white shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Create Snapshot</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Saved Local Snapshots Header & Restore Options */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                      Saved Local Snapshots ({snapshots.length})
                    </h3>
                    <span className="text-slate-400">·</span>
                    <span className="text-[11px] text-slate-500">
                      Auto-creates a safety snapshot before any Super Admin Clear
                    </span>
                  </div>

                  <label className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeSettingsOnRestore}
                      onChange={(e) => setIncludeSettingsOnRestore(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Restore company profile &amp; dropdown presets</span>
                  </label>
                </div>

                {snapshots.length === 0 ? (
                  <div
                    data-testid="snapshots-empty-state"
                    className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                  >
                    <Archive className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-bold text-slate-700 text-xs">
                      No Local Database Snapshots Saved Yet
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Click &ldquo;Create Snapshot&rdquo; above to capture a local JSON archive of your current records, or upload an existing .JSON backup file.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5" data-testid="snapshots-list">
                    {snapshots.map((snap, idx) => {
                      const isExpanded = expandedJsonId === snap.id;
                      const isCopied = copiedId === snap.id;
                      return (
                        <div
                          key={snap.id}
                          data-testid={`snapshot-card-${snap.id}`}
                          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">
                                  {snap.label}
                                </span>
                              </div>
                              {/* Unboxed clean metadata with typographic separators */}
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                                <span>{describeSnapshotTrigger(snap.trigger)}</span>
                                <span aria-hidden="true">·</span>
                                <span>{snap.createdAt.replace('T', ' ').slice(0, 19)} UTC</span>
                                <span aria-hidden="true">·</span>
                                <span>Checksum: {snap.checksum}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-bold text-slate-700">
                                  {snap.recordCounts.totalRecords} records
                                </span>
                              </div>
                              {snap.notes && (
                                <p className="text-[11px] text-slate-600 italic">
                                  Note: {snap.notes}
                                </p>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                data-testid={
                                  idx === 0
                                    ? 'restore-latest-snapshot-btn'
                                    : `restore-snapshot-btn-${snap.id}`
                                }
                                onClick={() => handleRestoreSnapshot(snap)}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition whitespace-nowrap shrink-0 cursor-pointer"
                                title="Restore database records from this snapshot"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restore State</span>
                              </button>

                              <button
                                type="button"
                                data-testid={`download-snapshot-btn-${snap.id}`}
                                onClick={() => downloadSnapshotJSON(snap.id)}
                                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition whitespace-nowrap shrink-0 cursor-pointer"
                                title="Download this snapshot as a local .JSON file"
                              >
                                <Download className="w-3.5 h-3.5 text-slate-600" />
                                <span>.JSON</span>
                              </button>

                              <button
                                type="button"
                                data-testid={`inspect-snapshot-btn-${snap.id}`}
                                onClick={() =>
                                  setExpandedJsonId(isExpanded ? null : snap.id)
                                }
                                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition whitespace-nowrap shrink-0 cursor-pointer"
                                title="Inspect raw JSON archive payload"
                              >
                                {isExpanded ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                <span>{isExpanded ? 'Hide JSON' : 'View JSON'}</span>
                              </button>

                              <button
                                type="button"
                                data-testid={`delete-snapshot-btn-${snap.id}`}
                                onClick={() => deleteSnapshot(snap.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Delete snapshot from local archive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Tabular Record & Financial Breakdown Strip */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600">
                            <div className="flex flex-wrap items-center gap-3">
                              <span>
                                Purchases: <strong className="text-slate-900">{snap.recordCounts.purchases}</strong>
                              </span>
                              <span>·</span>
                              <span>
                                Packings: <strong className="text-slate-900">{snap.recordCounts.packings}</strong>
                              </span>
                              <span>·</span>
                              <span>
                                Payments: <strong className="text-slate-900">{snap.recordCounts.payments}</strong>
                              </span>
                              <span>·</span>
                              <span>
                                Expenses: <strong className="text-slate-900">{snap.recordCounts.otherCosts}</strong>
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <span>
                                Purchase Vol:{' '}
                                <strong className="text-blue-900">
                                  {formatCurrency(snap.financialSummary.totalPurchaseTk, 'Tk')}
                                </strong>
                              </span>
                              <span>·</span>
                              <span>
                                Export Vol:{' '}
                                <strong className="text-teal-900">
                                  {formatCurrency(snap.financialSummary.totalExportRmb, 'RMB')}
                                </strong>
                              </span>
                            </div>
                          </div>

                          {/* Collapsible Raw JSON Inspector */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-slate-200 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-700 font-mono">
                                  Raw JSON Archive Payload ({snap.id})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopySnapshotJson(snap)}
                                  className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>Copied JSON</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="p-3 rounded-lg bg-slate-950 text-emerald-300 font-mono text-[11px] max-h-56 overflow-auto leading-relaxed">
                                {serializeSnapshotToJSON(snap)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Restore / Import from JSON Archive Mode */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                    <FileJson className="w-4 h-4 text-blue-700" />
                    <span>Upload or Paste Local JSON Snapshot Archive</span>
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Supports both ZSB Aquatics Snapshot Archives and legacy JSON backup files. Automatically validates schema, repairs partial records, and deduplicates IDs.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="upload-json-file-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#1b73b4] hover:bg-[#155d93] text-white shadow-xs transition whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .JSON File</span>
                  </button>
                  <button
                    type="button"
                    data-testid="load-live-json-preview-btn"
                    onClick={handleLoadLiveJsonToEditor}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Load Current State JSON</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="snapshot-json-textarea"
                  className="block font-bold text-slate-700 mb-1.5 text-xs"
                >
                  Paste Raw Snapshot JSON Archive:
                </label>
                <textarea
                  id="snapshot-json-textarea"
                  data-testid="snapshot-json-textarea"
                  rows={10}
                  value={jsonTextInput}
                  onChange={(e) => {
                    setJsonTextInput(e.target.value);
                    if (importStatus) setImportStatus(null);
                  }}
                  placeholder='{"schemaVersion": 1, "label": "My Backup", "payload": {"purchases": [...], "packings": [...], "payments": [...], "otherCosts": [...]}}'
                  className="w-full p-3 rounded-xl bg-slate-950 text-amber-200 font-mono text-xs border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  data-testid="save-json-archive-only-btn"
                  onClick={() => handleValidateAndRestoreJson(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Validate &amp; Save to Archive Only
                </button>
                <button
                  type="button"
                  data-testid="restore-json-submit-btn"
                  onClick={() => handleValidateAndRestoreJson(true)}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Validate &amp; Restore Database State</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>
            Local Storage Key: <code className="font-mono text-slate-700">zsb_database_snapshots_v1</code> (Up to 25 snapshots retained)
          </span>
          <button
            type="button"
            onClick={closeSnapshotModal}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
