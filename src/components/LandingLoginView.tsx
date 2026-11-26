import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ForgetPasswordView } from './ForgetPasswordView.tsx';
import { SupplierPortalView } from './SupplierPortalView.tsx';
import { HeaderOfflineAlert } from './HeaderOfflineAlert.tsx';
import { SupplierPortalSession } from '../utils/supplierPortal.ts';
import { resolveCompanyLogoSrc } from '../utils/pdfGenerator.ts';
import { COMPANY_LOGO_URL } from '../context/initialData.ts';
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  KeyRound,
  FileSpreadsheet,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

type LandingMode = 'staff' | 'supplier';

export const LandingLoginView: React.FC = () => {
  const { login, verifySupplierPortalLogin, companyProfile } = useApp();

  const [landingMode, setLandingMode] = useState<LandingMode>(() => {
    if (typeof window === 'undefined') return 'staff';
    const params = new URLSearchParams(window.location.search);
    return params.get('portal') === 'supplier' ? 'supplier' : 'staff';
  });

  // Staff login state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgetPassword, setShowForgetPassword] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'forget_password' || Boolean(params.get('reset_token'));
  });

  // Supplier statement login state (in-memory session only)
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierPassword, setSupplierPassword] = useState<string>('');
  const [showSupplierPassword, setShowSupplierPassword] = useState<boolean>(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [isVerifyingSupplier, setIsVerifyingSupplier] = useState<boolean>(false);
  const [supplierSession, setSupplierSession] = useState<SupplierPortalSession | null>(null);

  const resolvedLogoSrc = resolveCompanyLogoSrc(companyProfile.logoUrl);

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const result = login(username, password);
    if (!result.valid) {
      setErrorMessage(result.error || 'Authentication failed. Please check your credentials.');
    }
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError(null);
    setIsVerifyingSupplier(true);
    try {
      const result = await verifySupplierPortalLogin(supplierName, supplierPassword);
      if (!result.valid) {
        setSupplierError(result.error);
        return;
      }
      setSupplierPassword('');
      setSupplierSession(result.session);
    } finally {
      setIsVerifyingSupplier(false);
    }
  };

  if (supplierSession) {
    return (
      <SupplierPortalView
        session={supplierSession}
        onSignOut={() => {
          setSupplierSession(null);
          setSupplierPassword('');
          setSupplierError(null);
        }}
      />
    );
  }

  if (showForgetPassword) {
    return (
      <ForgetPasswordView
        mode="login_portal"
        initialIdentifier={username}
        onBackToLogin={(prefill) => {
          if (prefill) {
            setUsername(prefill);
          }
          setPassword('');
          setErrorMessage(null);
          setShowForgetPassword(false);
        }}
      />
    );
  }

  return (
    <main
      data-testid="landing-login-screen"
      className="min-h-screen w-full flex items-center justify-center bg-[#EDF2F7] px-4 py-8"
    >
      <section
        aria-labelledby="authorized-access-heading"
        data-testid="login-portal-card"
        className="w-full max-w-md zsb-surface-card rounded-2xl overflow-hidden"
      >
        <div className="bg-[#273E56] text-white px-6 py-5 border-b border-[#1E3247] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-[#5eead4] bg-white p-0.5 shrink-0 flex items-center justify-center">
              <img
                src={resolvedLogoSrc}
                alt={companyProfile.companyName}
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith(COMPANY_LOGO_URL)) {
                    target.src = COMPANY_LOGO_URL;
                  }
                }}
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black tracking-wider uppercase text-amber-400 truncate">
                {companyProfile.companyName}
              </div>
              <h1
                id="authorized-access-heading"
                className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight"
              >
                {landingMode === 'staff' ? 'Authorized access only' : 'Supplier Statement Portal'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HeaderOfflineAlert compact />
            <Lock className="w-4 h-4 text-sky-200 shrink-0" aria-hidden="true" />
          </div>
        </div>

        {/* Mode Switcher: Staff Login vs Supplier Ledger Statement */}
        <div
          role="tablist"
          aria-label="Portal Access Mode"
          className="grid grid-cols-2 bg-[#F1F5F9] border-b border-[#CBD8E6] p-2 gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={landingMode === 'staff'}
            data-testid="landing-tab-staff"
            onClick={() => {
              setLandingMode('staff');
              setSupplierError(null);
            }}
            className={`py-2 px-2 sm:px-3 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 leading-tight transition cursor-pointer ${
              landingMode === 'staff'
                ? 'ring-2 ring-[#273E56] ring-offset-1 shadow-md'
                : 'opacity-50 hover:opacity-80'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Staff Login</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={landingMode === 'supplier'}
            data-testid="landing-tab-supplier"
            onClick={() => {
              setLandingMode('supplier');
              setErrorMessage(null);
            }}
            className={`py-2 px-2 sm:px-3 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 leading-tight transition cursor-pointer ${
              landingMode === 'supplier'
                ? 'ring-2 ring-[#273E56] ring-offset-1 shadow-md'
                : 'opacity-50 hover:opacity-80'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">Supplier</span>
            <span className="hidden sm:inline">Supplier Statement</span>
          </button>
        </div>

        {landingMode === 'staff' ? (
          <form
            onSubmit={handleStaffSubmit}
            data-testid="secure-login-form"
            className="p-6 space-y-4 bg-white"
            noValidate
          >
            {errorMessage && (
              <div
                role="alert"
                data-testid="login-error-alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-username-input"
                className="block text-xs font-bold text-[#0F172A] mb-1.5"
              >
                Username or Email
              </label>
              <input
                id="login-username-input"
                data-testid="login-username-input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter username or email"
                className="w-full px-3.5 py-2.5 text-sm font-medium text-[#0F172A] placeholder-slate-400 bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D6CE0] focus:border-[#1D6CE0] transition"
              />
            </div>

            <div>
              <label
                htmlFor="login-password-input"
                className="block text-xs font-bold text-[#0F172A] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password-input"
                  data-testid="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm font-medium text-[#0F172A] placeholder-slate-400 bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D6CE0] focus:border-[#1D6CE0] transition"
                />
                <button
                  type="button"
                  data-testid="login-toggle-password-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#273E56] text-white cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="login-submit-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-[#273E56] text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Login</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="pt-1 border-t border-[#CBD8E6]">
              <button
                type="button"
                data-testid="login-forget-password-btn"
                onClick={() => setShowForgetPassword(true)}
                className="w-full py-2 px-4 rounded-xl bg-[#273E56] text-white font-bold text-xs transition flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                <span>FORGET PASSWORD</span>
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleSupplierSubmit}
            data-testid="supplier-portal-login-form"
            className="p-6 space-y-4 bg-white"
            noValidate
          >
            <p className="text-xs text-slate-600 leading-relaxed">
              Sign in with your registered supplier name and password to view your payment ledger statement and purchase invoices.
            </p>

            {supplierError && (
              <div
                role="alert"
                data-testid="supplier-login-error-alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{supplierError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="supplier-portal-name-input"
                className="block text-xs font-bold text-[#0F172A] mb-1.5"
              >
                Supplier Name
              </label>
              <input
                id="supplier-portal-name-input"
                data-testid="supplier-portal-name-input"
                type="text"
                autoComplete="organization"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  if (supplierError) setSupplierError(null);
                }}
                placeholder="Enter your supplier name"
                className="w-full px-3.5 py-2.5 text-sm font-medium text-[#0F172A] placeholder-slate-400 bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00897b] focus:border-[#00897b] transition"
              />
            </div>

            <div>
              <label
                htmlFor="supplier-portal-password-input"
                className="block text-xs font-bold text-[#0F172A] mb-1.5"
              >
                Supplier Password
              </label>
              <div className="relative">
                <input
                  id="supplier-portal-password-input"
                  data-testid="supplier-portal-password-input"
                  type={showSupplierPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={supplierPassword}
                  onChange={(e) => {
                    setSupplierPassword(e.target.value);
                    if (supplierError) setSupplierError(null);
                  }}
                  placeholder="Enter supplier password"
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm font-medium text-[#0F172A] placeholder-slate-400 bg-[#F8FAFC] border border-[#CBD8E6] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00897b] focus:border-[#00897b] transition"
                />
                <button
                  type="button"
                  data-testid="supplier-toggle-password-btn"
                  onClick={() => setShowSupplierPassword((prev) => !prev)}
                  aria-label={showSupplierPassword ? 'Hide supplier password' : 'Show supplier password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#273E56] text-white cursor-pointer"
                >
                  {showSupplierPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifyingSupplier}
              data-testid="supplier-portal-submit-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-[#00897b] hover:bg-[#007367] text-white font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isVerifyingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>View Statement &amp; Invoices</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>

            <div className="pt-2 border-t border-[#CBD8E6] text-[11px] text-slate-500 text-center">
              Need access? Ask {companyProfile.companyName} office to set your supplier portal password.
            </div>
          </form>
        )}
      </section>
    </main>
  );
};


