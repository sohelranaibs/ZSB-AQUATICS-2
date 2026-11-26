import React from 'react';
import { Archive, Clock, Download, FolderOpen, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { useSnapshotReminder } from '../hooks/useSnapshotReminder.ts';

export const SnapshotReminderPrompt: React.FC = () => {
  const { isAuthenticated, snapshotModalOpen } = useApp();
  const {
    reminderState,
    isDue,
    formattedUsage,
    liveRecordCount,
    saveSnapshotNow,
    saveAndDownloadSnapshot,
    snoozeReminder,
    openSnapshotsManager,
  } = useSnapshotReminder();

  if (!isAuthenticated || !isDue || snapshotModalOpen) {
    return null;
  }

  const lastSnapshotText = reminderState.lastSnapshotAt
    ? new Date(reminderState.lastSnapshotAt).toLocaleString()
    : 'No local snapshot saved yet';

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="snapshot-reminder-title"
      data-testid="snapshot-reminder-prompt"
      className="fixed bottom-20 md:bottom-4 right-3 sm:right-4 z-50 w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-[#1E3247] text-white border-2 border-amber-400/75 shadow-2xl overflow-hidden print:hidden"
    >
      {/* Top Header Strip */}
      <div className="bg-[#152536] px-4 py-3 border-b border-white/15 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h2
              id="snapshot-reminder-title"
              className="text-sm font-extrabold tracking-wide text-white leading-tight"
            >
              24-Hour Backup Reminder
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-200 mt-0.5">
              <Clock className="w-3 h-3 shrink-0" />
              <span data-testid="snapshot-reminder-usage-text">
                {formattedUsage} of active usage reached
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={snoozeReminder}
          aria-label="Snooze backup reminder for 2 hours"
          data-testid="snapshot-reminder-close-btn"
          className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
          title="Remind me in 2 hours"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Summary & Actions */}
      <div className="p-4 space-y-3.5 text-xs">
        <p className="text-slate-200 leading-relaxed">
          You have logged <strong className="text-amber-300 font-mono">{formattedUsage}</strong> of active workspace usage since your last backup. Save a local database snapshot now to protect{' '}
          <strong className="text-white font-mono">{liveRecordCount}</strong> active ledger records.
        </p>

        <div className="bg-[#152536] border border-white/10 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-400 font-semibold">Last Snapshot:</span>
          <span className="font-mono text-sky-200 truncate">{lastSnapshotText}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            data-testid="snapshot-reminder-save-btn"
            onClick={saveSnapshotNow}
            className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold shadow transition cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Save Snapshot Now</span>
          </button>

          <button
            type="button"
            data-testid="snapshot-reminder-download-btn"
            onClick={saveAndDownloadSnapshot}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shadow transition cursor-pointer"
            title="Save local snapshot and download JSON archive to your device"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save &amp; JSON</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
          <button
            type="button"
            data-testid="snapshot-reminder-manage-btn"
            onClick={openSnapshotsManager}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Manage Snapshots</span>
          </button>

          <button
            type="button"
            data-testid="snapshot-reminder-snooze-btn"
            onClick={snoozeReminder}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Remind Later (2h)</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
