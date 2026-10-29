import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  ClearRecordsScope,
  DEFAULT_SUPER_ADMIN_PASSWORD,
  describeClearScope,
} from '../utils/superAdminAuth.ts';
import {
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  X,
  AlertTriangle,
  KeyRound,
  Settings,
  Archive,
} from 'lucide-react';

export const SuperAdminClearModal: React.FC = () => {
  const {
    superAdminClearModal,
    closeSuperAdminClearModal,
    clearRecordsWithSuperAdmin,
    superAdminPassword,
    purchases,
    packings,
    payments,
    otherCosts,
    companyProfile,
    setActiveTab,
    openSnapshotModal,
  } = useApp();

  const [selectedScope, setSelectedScope] = useState<ClearRecordsScope>('all');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (superAdminClearModal.isOpen) {
      setSelectedScope(superAdminClearModal.initialScope || 'all');
      setPasswordInput('');
      setShowPassword(false);
      setErrorMessage(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [superAdminClearModal.isOpen, superAdminClearModal.initialScope]);

  if (!superAdminClearModal.isOpen) {
    return null;
  }

  const counts = {
    purchases: purchases.length,
    packings: packings.length,
    payments: payments.length,
    otherCosts: otherCosts.length,
  };

  const scopeDetails = describeClearScope(selectedScope, counts);
  const isDefaultPassword = superAdminPassword === DEFAULT_SUPER_ADMIN_PASSWORD;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = clearRecordsWithSuperAdmin(passwordInput, selectedScope);
    if (!result.valid) {
      setErrorMessage(
        result.error || 'Invalid Super Admin password. Access denied — records were not cleared.'
      );
      inputRef.current?.focus();
      return;
    }
    setPasswordInput('');
    setErrorMessage(null);
    closeSuperAdminClearModal();
  };

  const scopeOptions: { id: ClearRecordsScope; label: string; count: number }[] = [
    {
      id: 'all',
      label: 'All Database Sheets',
      count: counts.purchases + counts.packings + counts.payments + counts.otherCosts,
    },
    {
      id: 'purchase',
      label: 'Purchase DB Only',
      count: counts.purchases,
    },
    {
      id: 'packing',
      label: 'Packing DB Only',
      count: counts.packings,
    },
    {
      id: 'payment',
      label: 'Payment DB Only',
      count: counts.payments,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="super-admin-modal-title"
      data-testid="super-admin-clear-modal"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-rose-600/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Security Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b-2 border-amber-400">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-300/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="zsb-3d-text text-sm font-black tracking-wider">
                  {companyProfile.companyName}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/30 text-rose-100 border border-rose-400/30 font-bold">
                  Super Admin Gate
                </span>
              </div>
              <h2
                id="super-admin-modal-title"
                className="text-sm sm:text-base font-extrabold tracking-wide text-white mt-0.5"
              >
                Super Admin Password Required to Clear Records
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSuperAdminClearModal}
            aria-label="Close Super Admin Modal"
            className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-rose-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Warning Summary Banner */}
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-rose-950">
                <p className="font-bold text-xs">
                  Permanent Database Deletion Protection
                </p>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Clearing records removes ledgers from active views. A{' '}
                  <strong>Local JSON Safety Snapshot</strong> is automatically archived prior to clearing so you can restore state if needed.
                </p>
              </div>
            </div>
            <button
              type="button"
              data-testid="super-admin-open-snapshots-btn"
              onClick={() => {
                closeSuperAdminClearModal();
                openSnapshotModal();
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-bold shrink-0 transition cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-rose-700" />
              <span>Snapshots</span>
            </button>
          </div>

          {/* Target Scope Selection */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-2">
              1. Select Records Scope to Clear:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scopeOptions.map((opt) => {
                const isSelected = selectedScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`clear-scope-${opt.id}`}
                    onClick={() => {
                      setSelectedScope(opt.id);
                      setErrorMessage(null);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-700 shadow-sm font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                    }`}
                  >
                    <span className="truncate pr-2 text-[11px]">{opt.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                        isSelected
                          ? 'bg-rose-900/60 text-rose-100'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between text-[11px] text-slate-700">
              <span>
                Target: <strong className="text-slate-900">{scopeDetails.title}</strong>
              </span>
              <span className="font-mono font-bold text-rose-700">
                {scopeDetails.totalRecords} record(s) queued
              </span>
            </div>
          </div>

          {/* Super Admin Password Input */}
          <div>
            <label
              htmlFor="super-admin-password-input"
              className="block font-bold text-slate-800 uppercase tracking-wide text-[11px] mb-1.5 flex items-center space-x-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-rose-600" />
              <span>2. Enter Super Admin Password:</span>
            </label>

            <div className="relative">
              <input
                ref={inputRef}
                id="super-admin-password-input"
                data-testid="super-admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter Super Admin password..."
                autoComplete="off"
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm font-mono font-bold rounded-lg border-2 focus:outline-none transition ${
                  errorMessage
                    ? 'border-rose-500 bg-rose-50/40 text-rose-950 focus:border-rose-600'
                    : 'border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:border-rose-600'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Validation Error Banner */}
            {errorMessage && (
              <div
                role="alert"
                data-testid="super-admin-error-banner"
                className="mt-2 p-2.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 font-bold text-xs flex items-center space-x-2"
              >
                <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Helpful Security Hint */}
            <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-950">
              <div className="flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  {isDefaultPassword ? (
                    <>
                      Default Super Admin Password:{' '}
                      <code className="px-1.5 py-0.5 rounded bg-amber-200/70 font-mono font-black text-amber-950">
                        {DEFAULT_SUPER_ADMIN_PASSWORD}
                      </code>
                    </>
                  ) : (
                    <span>Custom Super Admin password is active.</span>
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeSuperAdminClearModal();
                  setActiveTab('settings');
                }}
                className="inline-flex items-center space-x-1 font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>Manage Password in Settings</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              data-testid="super-admin-cancel-btn"
              onClick={closeSuperAdminClearModal}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              data-testid="super-admin-confirm-clear-btn"
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-md transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Verify &amp; Clear Records</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
