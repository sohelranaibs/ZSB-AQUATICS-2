import React from 'react';
import { RotateCcw, FileText, AlignLeft } from 'lucide-react';
import {
  DEFAULT_PRINT_HEADER_FOOTER_CONFIG,
  PrintHeaderFooterConfig,
  isPrintHeaderFooterCustomized,
} from '../utils/printHeaderFooterConfig.ts';

interface PrintHeaderFooterConfigPanelProps {
  config: PrintHeaderFooterConfig;
  onChange: (next: PrintHeaderFooterConfig) => void;
}

export const PrintHeaderFooterConfigPanel: React.FC<PrintHeaderFooterConfigPanelProps> = ({
  config,
  onChange,
}) => {
  const customized = isPrintHeaderFooterCustomized(config);

  const updateField = <K extends keyof PrintHeaderFooterConfig>(
    key: K,
    value: PrintHeaderFooterConfig[K]
  ) => {
    onChange({
      ...config,
      [key]: value,
    });
  };

  return (
    <div
      data-testid="print-header-footer-panel"
      className="bg-[#1E3247] text-white px-5 py-3.5 border-b border-white/15 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-200">
          <FileText className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>Print Header &amp; Footer Configuration</span>
        </div>

        <button
          type="button"
          data-testid="print-config-reset-btn"
          disabled={!customized}
          onClick={() => onChange({ ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG })}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-[#273E56] hover:bg-[#334b59] text-slate-100 border border-white/15 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Header Options Card */}
        <div className="bg-[#152536] border border-white/12 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
            <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="print-toggle-header"
                checked={config.showHeader}
                onChange={(e) => updateField('showHeader', e.target.checked)}
                className="w-4 h-4 rounded accent-[#00897b] cursor-pointer"
              />
              <span>Document Header</span>
            </label>
            <span className="text-[10px] font-mono uppercase tracking-wide text-slate-300">
              {config.showHeader ? 'Visible' : 'Hidden'}
            </span>
          </div>

          <div
            className={`space-y-2.5 transition-opacity ${
              config.showHeader ? 'opacity-100' : 'opacity-45 pointer-events-none'
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="print-toggle-company-name"
                  disabled={!config.showHeader}
                  checked={config.showCompanyName}
                  onChange={(e) => updateField('showCompanyName', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#00897b] cursor-pointer"
                />
                <span>Company Name &amp; Logo</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="print-toggle-company-contact"
                  disabled={!config.showHeader}
                  checked={config.showCompanyContact}
                  onChange={(e) => updateField('showCompanyContact', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#00897b] cursor-pointer"
                />
                <span>Address &amp; Contact</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="print-toggle-header-date"
                  disabled={!config.showHeader}
                  checked={config.showDate}
                  onChange={(e) => updateField('showDate', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#00897b] cursor-pointer"
                />
                <span>Print Date</span>
              </label>
            </div>

            <div>
              <label
                htmlFor="print-custom-header-input"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1"
              >
                Custom Header Note (Optional)
              </label>
              <input
                id="print-custom-header-input"
                type="text"
                data-testid="print-custom-header-input"
                disabled={!config.showHeader}
                maxLength={180}
                value={config.customHeaderText}
                onChange={(e) => updateField('customHeaderText', e.target.value)}
                placeholder="e.g. Original Export Copy · Ref #2026"
                className="w-full bg-[#0f1c29] border border-white/20 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>
        </div>

        {/* Footer Options Card */}
        <div className="bg-[#152536] border border-white/12 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
            <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="print-toggle-footer"
                checked={config.showFooter}
                onChange={(e) => updateField('showFooter', e.target.checked)}
                className="w-4 h-4 rounded accent-[#00897b] cursor-pointer"
              />
              <span>Document Footer</span>
            </label>
            <span className="text-[10px] font-mono uppercase tracking-wide text-slate-300">
              {config.showFooter ? 'Visible' : 'Hidden'}
            </span>
          </div>

          <div
            className={`space-y-2.5 transition-opacity ${
              config.showFooter ? 'opacity-100' : 'opacity-45 pointer-events-none'
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="print-toggle-signatures"
                  disabled={!config.showFooter}
                  checked={config.showSignatures}
                  onChange={(e) => updateField('showSignatures', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#00897b] cursor-pointer"
                />
                <span>Signature Block</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="print-toggle-page-number"
                  disabled={!config.showFooter}
                  checked={config.showPageNumber}
                  onChange={(e) => updateField('showPageNumber', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#00897b] cursor-pointer"
                />
                <span>Page Number</span>
              </label>
            </div>

            <div>
              <label
                htmlFor="print-custom-footer-input"
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1"
              >
                <AlignLeft className="w-3 h-3 text-slate-400" />
                <span>Custom Footer Text (Optional)</span>
              </label>
              <input
                id="print-custom-footer-input"
                type="text"
                data-testid="print-custom-footer-input"
                disabled={!config.showFooter}
                maxLength={180}
                value={config.customFooterText}
                onChange={(e) => updateField('customFooterText', e.target.value)}
                placeholder="Overrides default certification line..."
                className="w-full bg-[#0f1c29] border border-white/20 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
