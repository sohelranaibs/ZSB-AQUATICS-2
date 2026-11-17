import { UTF8_BOM, formatCsvRow } from './csvExporter.ts';

export interface DashboardSummaryMetricsInput {
  companyName: string;
  currency: string;
  rmbExchangeRate: number;
  totalExportValueBDT: number;
  totalPurchaseValue: number;
  totalPurchaseCount: number;
  totalPurchaseQtyKg: number;
  totalPackingCount: number;
  totalExportWeightKg: number;
  totalExportBoxes: number;
  totalRmbSettled: number;
  totalPaymentCount: number;
  supplierPaymentCount: number;
  exporterPaymentCount: number;
  totalPaymentsMade: number;
  activePartiesCount: number;
  executiveMarginPercent: string | number;
  availableStockKg: number;
  stockStatus: string;
  totalBalance: number;
  latestPurchaseDate: string;
  latestPackingDate: string;
  latestPaymentDate: string;
  exportedAt?: string;
}

export function buildDashboardSummaryCsvFilename(exportedDate?: string): string {
  const datePart = (exportedDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, '');
  return `ZSB_AQUATICS_DASHBOARD_SUMMARY_${datePart || 'REPORT'}.csv`;
}

export function generateDashboardSummaryCSV(metrics: DashboardSummaryMetricsInput): string {
  const exportDate = metrics.exportedAt || new Date().toISOString().slice(0, 10);
  const currency = metrics.currency || 'TK';
  const companyName = (metrics.companyName || 'ZSB AQUATICS').trim();
  const totalOrdersAndBills = metrics.totalPurchaseCount + metrics.totalPackingCount;

  const metaRows = [
    formatCsvRow([`${companyName} — EXECUTIVE DASHBOARD SUMMARY`]),
    formatCsvRow([
      `Exported Date: ${exportDate}`,
      `Exchange Rate: 1 RMB = ${metrics.rmbExchangeRate} ${currency}`,
      `Currency: ${currency}`,
    ]),
    formatCsvRow([]),
  ];

  const headers = ['Section', 'Metric Name', 'Value', 'Unit / Currency', 'Supporting Details'];

  const dataRows: (string | number)[][] = [
    [
      'Executive BI KPIs',
      'Total Export Revenue',
      Number(metrics.totalExportValueBDT || 0).toFixed(2),
      'BDT',
      `${metrics.totalPackingCount} Manifests · ${metrics.totalExportWeightKg} KG`,
    ],
    [
      'Executive BI KPIs',
      'Total Procurement',
      Number(metrics.totalPurchaseValue || 0).toFixed(2),
      currency,
      `${metrics.totalPurchaseCount} Bills · ${metrics.totalPurchaseQtyKg} KG`,
    ],
    [
      'Executive BI KPIs',
      'Total Orders & Bills',
      totalOrdersAndBills,
      'Records',
      `${metrics.totalPurchaseCount} Purchase Bills + ${metrics.totalPackingCount} Export Manifests`,
    ],
    [
      'Executive BI KPIs',
      'Suppliers & Marks',
      metrics.activePartiesCount,
      'Parties',
      'Unique active suppliers and export shipping marks',
    ],
    [
      'Executive BI KPIs',
      'Gross Margin',
      `${metrics.executiveMarginPercent}%`,
      'Percent',
      'Spread between Total Export Revenue and Total Procurement',
    ],
    [
      'Command Header Cards',
      'Cumulative Procurement',
      Number(metrics.totalPurchaseValue || 0).toFixed(2),
      currency,
      `${metrics.totalPurchaseCount} Bills · ${metrics.totalPurchaseQtyKg} KG · Latest: ${metrics.latestPurchaseDate}`,
    ],
    [
      'Command Header Cards',
      'Cumulative Export Value',
      Number(metrics.totalExportValueBDT || 0).toFixed(2),
      'BDT',
      `${metrics.totalPackingCount} Manifests · ${metrics.totalExportWeightKg} KG (${metrics.totalExportBoxes} Boxes)`,
    ],
    [
      'Command Header Cards',
      'Foreign RMB Remittance',
      Number(metrics.totalRmbSettled || 0).toFixed(2),
      'RMB',
      `Latest Manifest: ${metrics.latestPackingDate}`,
    ],
    [
      'Treasury & Inventory',
      'Available Live Stock',
      Number(metrics.availableStockKg || 0).toFixed(2),
      'KG',
      `Status: ${metrics.stockStatus}`,
    ],
    [
      'Treasury & Inventory',
      'Payment Vouchers Disbursed',
      Number(metrics.totalPaymentsMade || 0).toFixed(2),
      currency,
      `${metrics.totalPaymentCount} Vouchers (${metrics.supplierPaymentCount} Supplier · ${metrics.exporterPaymentCount} Exporter) · Latest: ${metrics.latestPaymentDate}`,
    ],
    [
      'Treasury & Inventory',
      'Net Total Balance',
      Number(metrics.totalBalance || 0).toFixed(2),
      currency,
      'Partner Equity Deposits + Additional Income - All Costing',
    ],
  ];

  const lines = [
    ...metaRows,
    formatCsvRow(headers),
    ...dataRows.map((row) => formatCsvRow(row)),
  ];

  return UTF8_BOM + lines.join('\r\n');
}
