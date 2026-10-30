import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { ZSB_BANNER_IMAGE_URL } from '../utils/auditLogger.ts';
import { DEFAULT_SUPER_ADMIN_PASSWORD } from '../utils/superAdminAuth.ts';
import {
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Plane,
  FileSpreadsheet,
  KeyRound,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';

export const LandingLoginView: React.FC = () => {
  const { login, companyProfile, superAdminPassword } = useApp();

  const activePassword = superAdminPassword || DEFAULT_SUPER_ADMIN_PASSWORD;
  const isCustomUpdated = Boolean(superAdminPassword) && superAdminPassword !== DEFAULT_SUPER_ADMIN_PASSWORD;

  const [username, setUsername] = useState<string>('zsbaquatics@gmail.com');
  const [password, setPassword] = useState<string>(activePassword);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const result = login(username, password);
    if (!result.valid) {
      setErrorMessage(
        result.error || 'Authentication failed. Please check your credentials.'
      );
    }
  };

  const handleFillAdminCredentials = (accountType: 'sohel' | 'mizanur') => {
    setErrorMessage(null);
    if (accountType === 'sohel') {
      setUsername('zsbaquatics@gmail.com');
      setPassword(activePassword);
    } else {
      setUsername('mizanur');
      setPassword(activePassword);
    }
  };

  const scrollToLogin = () => {
    const el = document.getElementById('zsb-login-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const input = document.getElementById('login-username-input');
    if (input) {
      input.focus();
    }
  };

  return (
    <div
      data-testid="landing-login-screen"
      className="min-h-screen flex flex-col bg-[#06182c] text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="w-full border-b border-sky-900/70 bg-[#041222]/95 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Brand mark with new ZSB Aquatics logo */}
          <a
            href="#top"
            className="flex items-center gap-2.5 text-lg sm:text-xl font-black tracking-tight text-amber-400 whitespace-nowrap shrink-0"
          >
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt="ZSB AQUATICS Logo"
              referrerPolicy="no-referrer"
              data-testid="landing-header-logo"
              className="w-9 h-9 rounded-full object-contain bg-white p-0.5 border border-amber-400 shrink-0"
            />
            <span>{companyProfile.companyName || 'ZSB AQUATICS'}</span>
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a
              href="#banner-showcase"
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Export Banner
            </a>
            <a
              href="#capabilities"
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#trade-modules"
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Ledger Modules
            </a>
            <a
              href="#contact-footer"
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Contact
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              data-testid="header-scroll-login-btn"
              onClick={scrollToLogin}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Official Uploaded ZSB AQUATICS Wide Banner Showcase */}
        <section
          id="banner-showcase"
          aria-label="ZSB Aquatics Official Export Banner"
          data-testid="landing-banner-showcase"
          className="rounded-2xl overflow-hidden border-2 border-sky-800/80 shadow-2xl bg-[#041527]"
        >
          <img
            src={ZSB_BANNER_IMAGE_URL}
            alt="ZSB AQUATICS — Exporter of live crabs, eel fish and chilled fish (জীবন্ত কাঁকড়া, জীবন্ত কুঁচে ও বরফায়িত মাছ রপ্তানিকারক)"
            referrerPolicy="no-referrer"
            data-testid="landing-banner-image"
            className="w-full h-auto object-cover block"
          />
        </section>

        {/* Hero Split: Company Value Proposition (7 Cols) + Secure Login Entry Portal (5 Cols) */}
        <section
          aria-label="Exporter Portal and Secure Login"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
        >
          {/* Left 7 Columns: Corporate Seafood Export Overview & System Capabilities */}
          <div
            id="capabilities"
            className="lg:col-span-7 bg-[#08203a] rounded-2xl border border-sky-900/80 p-6 sm:p-8 flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                  alt="ZSB AQUATICS Official Emblem"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-contain bg-white p-0.5 border-2 border-amber-400 shadow-md shrink-0"
                />
                <div className="text-xs font-semibold text-amber-400 tracking-wide">
                  Dhaka, Bangladesh · International Live &amp; Chilled Seafood Exporter
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
                <div className="flex-1 space-y-3">
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight text-balance">
                    Exporter of Live Crabs, Eel Fish &amp; Chilled Seafood
                  </h1>

                  <p className="text-base sm:text-lg font-semibold text-sky-200">
                    জীবন্ত কাঁকড়া, জীবন্ত কুঁচে ও বরফায়িত মাছ রপ্তানিকারক
                  </p>

                  <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                    ZSB AQUATICS operates an integrated seafood procurement, holding depot, air-freight packing manifest, and multi-currency (BDT / RMB) trade settlement ledger connecting local fish suppliers in Bangladesh with international buyers across Guangzhou, Shanghai, Kunming, and Xiamen.
                  </p>
                </div>

                {/* Live Crab Showcase Image */}
                <div className="shrink-0 self-center md:self-start">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-xl shadow-sky-950/60 bg-slate-900 group">
                    <img
                      src="/assets/aistudio/videoframe_2696_57a1efb1.png"
                      alt="ZSB Live Crab Specimen - Exporter of Live Crabs, Eel Fish & Chilled Seafood"
                      referrerPolicy="no-referrer"
                      className="w-32 sm:w-40 md:w-44 h-48 sm:h-56 md:h-60 object-cover rounded-2xl transform group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-2 inset-x-2 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-slate-900/90 px-2 py-0.5 rounded-full border border-amber-400/40 shadow-xs inline-block">
                        Live Crab Export
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Numbered Core Capabilities */}
              <div
                id="trade-modules"
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-sky-900/70"
              >
                <div className="bg-[#06182c]/90 p-4 rounded-xl border border-sky-900/60">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-mono font-bold">
                    <span>01. Air-Freight Manifests</span>
                    <Plane className="w-4 h-4 text-teal-400 shrink-0" />
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    Export Packing Lists &amp; QR Tracking
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Carton-level weight verification, shipping mark dispatch, flight manifests, and bilingual Exporter Payment Slips (付款单).
                  </p>
                </div>

                <div className="bg-[#06182c]/90 p-4 rounded-xl border border-sky-900/60">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-mono font-bold">
                    <span>02. Dual-Currency Settlement</span>
                    <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    BDT Vouchers &amp; RMB Remittance
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Automated supplier debit/credit ledgers, batch PDF payment slip export, and monthly profit &amp; loss statements.
                  </p>
                </div>

                <div className="bg-[#06182c]/90 p-4 rounded-xl border border-sky-900/60">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-mono font-bold">
                    <span>03. Security &amp; Audit Trail</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    Admin Verification &amp; Audit Logs
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Every voucher entry, edit, and deletion is tracked in the Administrator Audit Logs with JSON snapshot recovery.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Corporate Contact Strip */}
            <div className="pt-4 border-t border-sky-900/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 font-mono">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>29/B Tarartek, Nishat Nagar Turag, Dhaka 1230</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>+880 1841-165902 · +880 1711-331545</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>zsbaquatics@gmail.com</span>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Secure Login Portal Card */}
          <div
            id="zsb-login-card"
            data-testid="login-portal-card"
            className="lg:col-span-5 bg-white text-slate-900 rounded-2xl border-2 border-amber-400/90 shadow-2xl overflow-hidden flex flex-col justify-between"
          >
            <div>
              {/* Login Header */}
              <div className="bg-slate-900 text-white px-6 py-5 border-b border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white p-0.5 border-2 border-amber-400 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
                        alt="ZSB AQUATICS"
                        referrerPolicy="no-referrer"
                        data-testid="login-card-logo"
                        className="w-full h-full object-contain rounded-full"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-amber-400">
                        Authorized Access Only
                      </div>
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                        Business Control Center Login
                      </h2>
                    </div>
                  </div>
                  <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                </div>
              </div>

              {/* Login Form */}
              <form
                onSubmit={handleSubmit}
                data-testid="secure-login-form"
                className="p-6 space-y-4"
              >
                {errorMessage && (
                  <div
                    role="alert"
                    data-testid="login-error-alert"
                    className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="login-username-input"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Administrator Email or Username
                  </label>
                  <div className="relative">
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
                      placeholder="zsbaquatics@gmail.com or admin"
                      className="w-full pl-3.5 pr-9 py-2.5 text-sm font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
                    />
                    <UserCheck className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password-input"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Administrator Password
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
                      placeholder="Enter administrator password"
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      data-testid="login-toggle-password-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  data-testid="login-submit-btn"
                  className="w-full py-3 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 active:bg-sky-900 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Sign In to Control Center</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Partner Quick-Select Credential Presets */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Verified Partner Accounts</span>
                    </span>
                    <span className="font-mono text-slate-600">
                      Pass: {isCustomUpdated ? '(Updated Active Password)' : DEFAULT_SUPER_ADMIN_PASSWORD}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="login-preset-sohel-btn"
                      onClick={() => handleFillAdminCredentials('sohel')}
                      className="px-3 py-2 rounded-lg border border-slate-200 hover:border-sky-500 bg-slate-50 hover:bg-sky-50/50 text-left transition cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-900 truncate">
                        Md. Sohel Rana
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        zsbaquatics@gmail.com
                      </div>
                    </button>

                    <button
                      type="button"
                      data-testid="login-preset-mizanur-btn"
                      onClick={() => handleFillAdminCredentials('mizanur')}
                      className="px-3 py-2 rounded-lg border border-slate-200 hover:border-sky-500 bg-slate-50 hover:bg-sky-50/50 text-left transition cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-900 truncate">
                        Md. Mizanur Rahman
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        Managing Partner
                      </div>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Card Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>Session verified prior to loading ledger modules</span>
              <span className="font-mono font-bold text-emerald-700">
                TLS · Local Vault
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer
        id="contact-footer"
        className="w-full border-t border-sky-900/60 bg-[#041222] py-4 px-6 text-xs text-slate-400"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src={companyProfile.logoUrl || '/assets/aistudio/Image_20260915140835_5_211_5a70ba77.jpg'}
              alt="ZSB AQUATICS"
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-full object-contain bg-white p-0.5 border border-amber-400 shrink-0"
            />
            <span>
              <strong className="text-white">{companyProfile.companyName}</strong> · 29/B Tarartek, Nishat Nagar Turag, Dhaka 1230
            </span>
          </div>
          <div className="font-mono">
            Mobile: +880 1841-165902, +880 1711-331545 · Email: zsbaquatics@gmail.com
          </div>
        </div>
      </footer>
    </div>
  );
};
