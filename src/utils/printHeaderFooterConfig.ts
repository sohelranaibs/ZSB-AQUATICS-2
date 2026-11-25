export const PRINT_HEADER_FOOTER_STORAGE_KEY = 'zsb_print_header_footer_config_v1';

export interface PrintHeaderFooterConfig {
  showHeader: boolean;
  showCompanyName: boolean;
  showCompanyContact: boolean;
  showDate: boolean;
  customHeaderText: string;
  showFooter: boolean;
  showSignatures: boolean;
  showPageNumber: boolean;
  customFooterText: string;
}

export const DEFAULT_PRINT_HEADER_FOOTER_CONFIG: PrintHeaderFooterConfig = {
  showHeader: true,
  showCompanyName: true,
  showCompanyContact: true,
  showDate: false,
  customHeaderText: '',
  showFooter: true,
  showSignatures: true,
  showPageNumber: true,
  customFooterText: '',
};

/**
 * Sanitizes a raw/partial config object (e.g. loaded from localStorage) against defaults.
 */
export function sanitizePrintHeaderFooterConfig(
  raw: unknown
): PrintHeaderFooterConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  const boolOr = (key: keyof PrintHeaderFooterConfig, fallback: boolean): boolean =>
    typeof obj[key] === 'boolean' ? (obj[key] as boolean) : fallback;
  const strOr = (key: keyof PrintHeaderFooterConfig, fallback: string): string =>
    typeof obj[key] === 'string' ? (obj[key] as string).slice(0, 180) : fallback;

  return {
    showHeader: boolOr('showHeader', DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showHeader),
    showCompanyName: boolOr('showCompanyName', DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showCompanyName),
    showCompanyContact: boolOr(
      'showCompanyContact',
      DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showCompanyContact
    ),
    showDate: boolOr('showDate', DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showDate),
    customHeaderText: strOr('customHeaderText', ''),
    showFooter: boolOr('showFooter', DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showFooter),
    showSignatures: boolOr('showSignatures', DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showSignatures),
    showPageNumber: boolOr('showPageNumber', DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showPageNumber),
    customFooterText: strOr('customFooterText', ''),
  };
}

/**
 * Loads saved header/footer config from a Storage-like object safely.
 */
export function loadPrintHeaderFooterConfig(
  storage?: Pick<Storage, 'getItem'> | null
): PrintHeaderFooterConfig {
  if (!storage) return { ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG };
  try {
    const raw = storage.getItem(PRINT_HEADER_FOOTER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG };
    return sanitizePrintHeaderFooterConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PRINT_HEADER_FOOTER_CONFIG };
  }
}

/**
 * Saves header/footer config to a Storage-like object safely.
 */
export function savePrintHeaderFooterConfig(
  config: PrintHeaderFooterConfig,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  if (!storage) return;
  try {
    storage.setItem(
      PRINT_HEADER_FOOTER_STORAGE_KEY,
      JSON.stringify(sanitizePrintHeaderFooterConfig(config))
    );
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

/**
 * Returns true if any setting differs from DEFAULT_PRINT_HEADER_FOOTER_CONFIG.
 */
export function isPrintHeaderFooterCustomized(config: PrintHeaderFooterConfig): boolean {
  return (
    config.showHeader !== DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showHeader ||
    config.showCompanyName !== DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showCompanyName ||
    config.showCompanyContact !== DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showCompanyContact ||
    config.showDate !== DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showDate ||
    config.customHeaderText.trim() !== '' ||
    config.showFooter !== DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showFooter ||
    config.showSignatures !== DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showSignatures ||
    config.showPageNumber !== DEFAULT_PRINT_HEADER_FOOTER_CONFIG.showPageNumber ||
    config.customFooterText.trim() !== ''
  );
}

/**
 * Formats a date as DD/MM/YYYY for the printed header date badge.
 */
export function formatPrintHeaderDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
