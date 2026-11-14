import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export const LandingLoginView: React.FC = () => {
  const { login } = useApp();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const result = login(username, password);
    if (!result.valid) {
      setErrorMessage(result.error || 'Authentication failed. Please check your credentials.');
    }
  };

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
          <h1
            id="authorized-access-heading"
            className="text-lg sm:text-xl font-bold tracking-tight text-white"
          >
            Authorized access only
          </h1>
          <Lock className="w-5 h-5 text-sky-200 shrink-0" aria-hidden="true" />
        </div>

        <form
          onSubmit={handleSubmit}
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
        </form>
      </section>
    </main>
  );
};


