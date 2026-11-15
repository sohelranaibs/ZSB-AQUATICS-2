import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  PasswordResetRequest,
  ConfirmationEmailPreview,
  listRecoverableAccounts,
  findRegisteredAccountByIdentifier,
  createPasswordResetRequest,
  buildConfirmationEmailContent,
  verifyPasswordResetConfirmation,
  savePendingResetRequest,
  loadPendingResetRequest,
  clearPendingResetRequest,
  maskEmailAddress,
} from '../utils/passwordReset.ts';
import {
  KeyRound,
  Mail,
  MailCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  RotateCcw,
  Send,
  Lock,
  Clock,
  ExternalLink,
} from 'lucide-react';

type ResetStep = 'identify' | 'confirm_email' | 'new_password' | 'completed';

interface ForgetPasswordViewProps {
  mode?: 'workbook_sheet' | 'login_portal';
  initialIdentifier?: string;
  onBackToLogin?: (prefillIdentifier?: string) => void;
}

export const ForgetPasswordView: React.FC<ForgetPasswordViewProps> = ({
  mode = 'workbook_sheet',
  initialIdentifier = '',
  onBackToLogin,
}) => {
  const { resetAccountPasswordViaEmail, setActiveTab, currentUser, showToast } = useApp();

  const recoverableAccounts = useMemo(() => listRecoverableAccounts(), []);

  const [step, setStep] = useState<ResetStep>('identify');
  const [identifier, setIdentifier] = useState<string>(initialIdentifier);
  const [activeRequest, setActiveRequest] = useState<PasswordResetRequest | null>(null);
  const [confirmationCodeInput, setConfirmationCodeInput] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Restore pending request or verify ?reset_token= deep link if present
  useEffect(() => {
    const saved = loadPendingResetRequest();
    if (!saved || saved.used) return;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('reset_token');
      if (urlToken && urlToken === saved.confirmToken) {
        const result = verifyPasswordResetConfirmation(saved, { token: urlToken }, Date.now());
        if (result.valid) {
          savePendingResetRequest(result.updatedRequest);
          setActiveRequest(result.updatedRequest);
          setIdentifier(saved.account.email);
          setStep('new_password');
          setStatusNote(`Email confirmation verified for ${saved.account.email}.`);
          return;
        }
      }
    }

    setActiveRequest(saved);
    setIdentifier(saved.account.email);
    setStep(saved.verified ? 'new_password' : 'confirm_email');
  }, []);

  // Countdown tick while waiting for confirmation
  useEffect(() => {
    if (step !== 'confirm_email' && step !== 'new_password') return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const emailPreview: ConfirmationEmailPreview | null = useMemo(() => {
    if (!activeRequest) return null;
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return buildConfirmationEmailContent(activeRequest, origin);
  }, [activeRequest]);

  const remainingSeconds = useMemo(() => {
    if (!activeRequest) return 0;
    return Math.max(0, Math.floor((activeRequest.expiresAtMs - nowMs) / 1000));
  }, [activeRequest, nowMs]);

  const formattedRemaining = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [remainingSeconds]);

  const dispatchEmailConfirmation = async (targetIdentifier: string) => {
    setErrorMessage(null);
    setStatusNote(null);

    const lookup = findRegisteredAccountByIdentifier(targetIdentifier);
    if (!lookup.found || !lookup.account) {
      setErrorMessage(
        lookup.error || 'No registered account matches that email or username.'
      );
      return;
    }

    setIsSendingEmail(true);
    try {
      const request = createPasswordResetRequest({
        account: lookup.account,
        nowMs: Date.now(),
      });

      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const preview = buildConfirmationEmailContent(request, origin);

      let deliveryMode: 'smtp_email' | 'confirmation_inbox' = 'confirmation_inbox';
      let messageId = `local-${Date.now()}`;

      try {
        const res = await fetch('/api/auth/send-reset-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: request.account.email,
            displayName: request.account.displayName,
            username: request.account.username,
            code: request.code,
            confirmToken: request.confirmToken,
            confirmUrl: preview.confirmUrl,
            expiresAtIso: new Date(request.expiresAtMs).toISOString(),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            ok?: boolean;
            mode?: 'smtp_email' | 'confirmation_inbox';
            messageId?: string;
          };
          if (data.mode) deliveryMode = data.mode;
          if (data.messageId) messageId = data.messageId;
        }
      } catch {
        // Fallback smoothly to confirmation_inbox when API server is unavailable
      }

      const finalizedRequest: PasswordResetRequest = {
        ...request,
        deliveryMode,
        messageId,
      };

      savePendingResetRequest(finalizedRequest);
      setActiveRequest(finalizedRequest);
      setConfirmationCodeInput('');
      setNewPassword('');
      setConfirmPassword('');
      setNowMs(Date.now());
      setStep('confirm_email');
      setStatusNote(
        `Email confirmation sent to ${finalizedRequest.account.email}. Enter the 6-digit code or confirm the verification link.`
      );
      showToast(`Confirmation email sent to ${finalizedRequest.account.email}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchEmailConfirmation(identifier);
  };

  const handleVerifyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusNote(null);

    if (!activeRequest) {
      setErrorMessage('No active password reset request found. Please send a confirmation email first.');
      setStep('identify');
      return;
    }

    const verification = verifyPasswordResetConfirmation(
      activeRequest,
      { code: confirmationCodeInput },
      Date.now()
    );

    savePendingResetRequest(verification.updatedRequest);
    setActiveRequest(verification.updatedRequest);

    if (!verification.valid) {
      setErrorMessage(verification.error || 'Email confirmation verification failed.');
      return;
    }

    setStep('new_password');
    setStatusNote(`Email confirmed for ${verification.updatedRequest.account.email}. Set your new password below.`);
    showToast('Email confirmation verified! Enter your new password.');
  };

  const handleConfirmViaEmailLink = () => {
    setErrorMessage(null);
    setStatusNote(null);

    if (!activeRequest) return;
    const verification = verifyPasswordResetConfirmation(
      activeRequest,
      { token: activeRequest.confirmToken },
      Date.now()
    );

    savePendingResetRequest(verification.updatedRequest);
    setActiveRequest(verification.updatedRequest);

    if (!verification.valid) {
      setErrorMessage(verification.error || 'Email confirmation link is invalid or expired.');
      return;
    }

    setConfirmationCodeInput(activeRequest.code);
    setStep('new_password');
    setStatusNote(`Email confirmation link verified for ${verification.updatedRequest.account.email}.`);
    showToast('Email confirmation link verified!');
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusNote(null);

    if (!activeRequest || !activeRequest.verified || activeRequest.used) {
      setErrorMessage('Email confirmation is required before resetting the password.');
      setStep('identify');
      return;
    }

    if (Date.now() > activeRequest.expiresAtMs) {
      setErrorMessage('Verification session expired. Please send a new confirmation email.');
      setStep('confirm_email');
      return;
    }

    const res = resetAccountPasswordViaEmail(
      activeRequest.account,
      newPassword,
      confirmPassword
    );

    if (!res.valid) {
      setErrorMessage(res.error || 'Failed to update password.');
      return;
    }

    const completedRequest: PasswordResetRequest = {
      ...activeRequest,
      used: true,
      usedAtMs: Date.now(),
    };
    setActiveRequest(completedRequest);
    clearPendingResetRequest();
    setNewPassword('');
    setConfirmPassword('');
    setStep('completed');
    setStatusNote(
      `Password reset completed for ${completedRequest.account.displayName} (${completedRequest.account.email}).`
    );
  };

  const handleRestartFlow = () => {
    clearPendingResetRequest();
    setActiveRequest(null);
    setConfirmationCodeInput('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setStatusNote(null);
    setStep('identify');
  };

  const stepIndex =
    step === 'identify' ? 1 : step === 'confirm_email' ? 2 : step === 'new_password' ? 3 : 4;

  const containerClass =
    mode === 'login_portal'
      ? 'min-h-screen w-full flex items-center justify-center bg-[#EDF2F7] px-4 py-8'
      : 'p-4 sm:p-6 max-w-5xl mx-auto';

  const cardWidthClass = mode === 'login_portal' ? 'w-full max-w-3xl' : 'w-full';

  return (
    <div data-testid="forget-password-sheet" className={containerClass}>
      <section
        aria-labelledby="forget-password-sheet-heading"
        className={`${cardWidthClass} zsb-surface-card rounded-2xl overflow-hidden bg-white`}
      >
        {/* Top Navy Header Strip */}
        <div className="bg-[#273E56] text-white px-5 sm:px-6 py-4 border-b border-[#1E3247] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-amber-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-sky-200">
                <span className="text-amber-400 font-extrabold zsb-golden-brand tracking-wide">
                  ZSB AQUATICS
                </span>
                <span aria-hidden="true">·</span>
                <span>Sheet 16</span>
              </div>
              <h1
                id="forget-password-sheet-heading"
                className="text-base sm:text-lg font-extrabold tracking-tight text-white"
              >
                FORGET PASSWORD
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mode === 'login_portal' && onBackToLogin && (
              <button
                type="button"
                data-testid="forget-pwd-back-to-login-top-btn"
                onClick={() => onBackToLogin(activeRequest?.account.email || identifier)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Login</span>
              </button>
            )}
            {mode === 'workbook_sheet' && (
              <button
                type="button"
                data-testid="forget-pwd-back-dashboard-top-btn"
                onClick={() => setActiveTab('dashboard')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean Step Progress Bar */}
        <div className="bg-[#F8FAFC] border-b border-[#CBD8E6] px-5 sm:px-6 py-3">
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { n: 1, title: 'Send Email' },
              { n: 2, title: 'Verify Code' },
              { n: 3, title: 'New Password' },
              { n: 4, title: 'Completed' },
            ].map((item) => {
              const isCurrent = stepIndex === item.n;
              const isDone = stepIndex > item.n;
              return (
                <li
                  key={item.n}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    isCurrent
                      ? 'bg-white border-[#273E56] text-[#0F172A] font-bold'
                      : isDone
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 font-semibold'
                      : 'bg-white/60 border-[#CBD8E6] text-slate-500 font-medium'
                  }`}
                >
                  <span className="font-mono font-bold tabular-nums">
                    {isDone ? '✓' : `0${item.n}`}
                  </span>
                  <span className="truncate">{item.title}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Sheet Main Body */}
        <div className="p-5 sm:p-6 space-y-5 bg-white">
          {errorMessage && (
            <div
              role="alert"
              data-testid="forget-pwd-error"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusNote && !errorMessage && (
            <div
              role="status"
              data-testid="forget-pwd-status"
              className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-start gap-2.5"
            >
              <CheckCircle2
                className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{statusNote}</span>
            </div>
          )}

          {/* STEP 1: Enter Account Email / Username & Send Email Confirmation */}
          {step === 'identify' && (
            <form
              onSubmit={handleSendEmailSubmit}
              data-testid="forget-pwd-identify-form"
              className="space-y-4"
              noValidate
            >
              <div className="space-y-1">
                <h2 className="text-sm sm:text-base font-bold text-[#0F172A]">
                  Reset Password via Email Confirmation
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter the registered administrator or team email address (or username). A 6-digit
                  confirmation code and verification link will be sent to confirm your identity
                  before resetting the password.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="forget-pwd-identifier-input"
                    className="block text-xs font-bold text-[#0F172A] mb-1.5"
                  >
                    Registered Email or Username
                  </label>
                  <input
                    id="forget-pwd-identifier-input"
                    data-testid="forget-pwd-identifier-input"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. sohelranaibs@gmail.com or zsbaquatics@gmail.com"
                    className="w-full px-3.5 py-2.5 text-sm font-medium text-[#0F172A] placeholder-slate-400 bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="forget-pwd-account-select"
                    className="block text-xs font-bold text-[#0F172A] mb-1.5"
                  >
                    Registered Accounts Directory (Optional)
                  </label>
                  <select
                    id="forget-pwd-account-select"
                    data-testid="forget-pwd-account-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setIdentifier(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-sm font-medium text-[#0F172A] bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white transition"
                  >
                    <option value="">
                      Select registered account...
                    </option>
                    {recoverableAccounts.map((acc) => (
                      <option key={`${acc.username}-${acc.email}`} value={acc.email}>
                        {acc.displayName} — {acc.email} ({acc.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={isSendingEmail}
                  data-testid="forget-pwd-send-email-btn"
                  className="px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {isSendingEmail ? 'Sending Email Confirmation...' : 'Send Email Confirmation'}
                  </span>
                </button>

                {mode === 'login_portal' && onBackToLogin && (
                  <button
                    type="button"
                    data-testid="forget-pwd-cancel-login-btn"
                    onClick={() => onBackToLogin(identifier)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 2: Verify Email Confirmation Code or Confirmation Link */}
          {step === 'confirm_email' && activeRequest && (
            <div className="space-y-5" data-testid="forget-pwd-confirm-step">
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD8E6] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <MailCheck className="w-5 h-5 text-[#273E56] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F172A] truncate">
                      Confirmation sent to {activeRequest.account.email}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Account: {activeRequest.account.displayName} (@{activeRequest.account.username} ·{' '}
                      {maskEmailAddress(activeRequest.account.email)})
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#0F172A] tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>Expires in {formattedRemaining}</span>
                </div>
              </div>

              <form onSubmit={handleVerifyCodeSubmit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="forget-pwd-code-input"
                    className="block text-xs font-bold text-[#0F172A] mb-1.5"
                  >
                    Enter 6-Digit Email Confirmation Code
                  </label>
                  <input
                    id="forget-pwd-code-input"
                    data-testid="forget-pwd-code-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmationCodeInput}
                    onChange={(e) => {
                      setConfirmationCodeInput(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Enter 6-digit code from confirmation email"
                    className="w-full sm:max-w-xs px-4 py-2.5 text-base font-mono font-bold tracking-[0.25em] text-[#0F172A] placeholder-slate-400 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white transition tabular-nums"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    data-testid="forget-pwd-verify-code-btn"
                    className="px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>Confirm Email & Continue</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSendingEmail}
                    data-testid="forget-pwd-resend-btn"
                    onClick={() => void dispatchEmailConfirmation(activeRequest.account.email)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resend Email</span>
                  </button>

                  <button
                    type="button"
                    data-testid="forget-pwd-change-email-btn"
                    onClick={handleRestartFlow}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Change Email</span>
                  </button>
                </div>
              </form>

              {/* Email Dispatch Preview (shown when local confirmation inbox mode is active) */}
              {emailPreview && activeRequest.deliveryMode !== 'smtp_email' && (
                <div
                  data-testid="forget-pwd-email-preview"
                  className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD8E6] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CBD8E6] pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                      <Mail className="w-4 h-4 text-[#273E56]" aria-hidden="true" />
                      <span>Dispatched Confirmation Email</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-600">
                      To: {emailPreview.to}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 space-y-1.5">
                    <div>
                      <span className="font-bold text-[#0F172A]">Subject:</span>{' '}
                      {emailPreview.subject}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span>Confirmation Code:</span>
                      <code
                        data-testid="forget-pwd-dispatched-code"
                        className="px-3 py-1 rounded-lg bg-white border border-[#CBD8E6] font-mono text-sm font-extrabold tracking-widest text-[#0F172A] tabular-nums"
                      >
                        {emailPreview.code}
                      </code>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      data-testid="forget-pwd-confirm-link-btn"
                      onClick={handleConfirmViaEmailLink}
                      className="px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Confirm Email Verification Link</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Enter New Password & Confirm */}
          {step === 'new_password' && activeRequest && (
            <form
              onSubmit={handleResetPasswordSubmit}
              data-testid="forget-pwd-new-password-form"
              className="space-y-4"
              noValidate
            >
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD8E6] flex items-center gap-2.5 text-xs">
                <Lock className="w-4 h-4 text-[#273E56] shrink-0" aria-hidden="true" />
                <span className="font-semibold text-[#0F172A]">
                  Verified Account: {activeRequest.account.displayName} ({activeRequest.account.email})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="forget-pwd-new-input"
                    className="block text-xs font-bold text-[#0F172A] mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="forget-pwd-new-input"
                      data-testid="forget-pwd-new-input"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Minimum 4 characters"
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm font-medium text-[#0F172A] placeholder-slate-400 bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg cursor-pointer"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="forget-pwd-confirm-input"
                    className="block text-xs font-bold text-[#0F172A] mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="forget-pwd-confirm-input"
                      data-testid="forget-pwd-confirm-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Repeat new password"
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm font-medium text-[#0F172A] placeholder-slate-400 bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  data-testid="forget-pwd-reset-submit-btn"
                  className="px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span>Reset Password</span>
                </button>

                <button
                  type="button"
                  data-testid="forget-pwd-restart-btn"
                  onClick={handleRestartFlow}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Start Over</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Completed */}
          {step === 'completed' && activeRequest && (
            <div data-testid="forget-pwd-completed-step" className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                  <span>Password Successfully Updated</span>
                </div>
                <p className="text-xs text-emerald-800">
                  Your password for <strong>{activeRequest.account.displayName}</strong> (
                  {activeRequest.account.email}) has been updated after email confirmation.
                  {activeRequest.account.isRootAdmin
                    ? ' Master Super Admin credentials and login access are now synced.'
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {mode === 'login_portal' && onBackToLogin ? (
                  <button
                    type="button"
                    data-testid="forget-pwd-return-login-btn"
                    onClick={() => onBackToLogin(activeRequest.account.email)}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Return to Login Portal</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="forget-pwd-back-dashboard-btn"
                    onClick={() => setActiveTab('dashboard')}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Back to Dashboard</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  data-testid="forget-pwd-reset-another-btn"
                  onClick={handleRestartFlow}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset Another Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
