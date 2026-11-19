import { PackingRecord, PaymentRecord } from '../types/index.ts';
import { calculatePackingTotalAmountBDT } from './calculations.ts';

export type AgingBucketKey = '0_7' | '8_15' | '16_30' | 'over_30';

export interface AgingShipmentEntry {
  packingId: string;
  invoiceNumber: string;
  packingDate: string;
  shippingMark: string;
  flight: string;
  destination: string;
  totalBox: number;
  totalWeightKg: number;
  billedRmb: number;
  settledRmb: number;
  outstandingRmb: number;
  rmbRate: number;
  outstandingBdt: number;
  daysOutstanding: number;
  bucket: AgingBucketKey;
  status: string;
}

export interface BuyerAgingSummaryRow {
  buyerKey: string;
  shippingMark: string;
  destinations: string[];
  unpaidShipmentsCount: number;
  totalBox: number;
  totalWeightKg: number;
  totalBilledRmb: number;
  totalSettledRmb: number;
  outstandingRmb: number;
  outstandingBdt: number;
  bucket0To7Rmb: number;
  bucket8To15Rmb: number;
  bucket16To30Rmb: number;
  bucketOver30Rmb: number;
  maxDaysOverdue: number;
  oldestDate: string;
  shipments: AgingShipmentEntry[];
}

export interface BuyerReceivablesAgingReport {
  asOfDate: string;
  totalOutstandingRmb: number;
  totalOutstandingBdt: number;
  totalUnpaidShipments: number;
  totalBuyersWithDue: number;
  bucketTotalsRmb: Record<AgingBucketKey, number>;
  bucketTotalsBdt: Record<AgingBucketKey, number>;
  bucketCounts: Record<AgingBucketKey, number>;
  buyers: BuyerAgingSummaryRow[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function classifyAgingBucket(daysOutstanding: number): AgingBucketKey {
  if (daysOutstanding <= 7) return '0_7';
  if (daysOutstanding <= 15) return '8_15';
  if (daysOutstanding <= 30) return '16_30';
  return 'over_30';
}

export function calculateDaysBetweenDates(startDateIso: string, endDateIso: string): number {
  const startMs = Date.parse((startDateIso || '').slice(0, 10));
  const endMs = Date.parse((endDateIso || '').slice(0, 10));
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / MS_PER_DAY));
}

/**
 * Computes Chinese Importer / Shipping Mark Receivables Aging across all packing manifests
 * and exporter payment vouchers, grouping unpaid RMB & BDT balances into 0–7, 8–15, 16–30,
 * and 30+ day overdue buckets.
 */
export function calculateBuyerReceivablesAging(
  packings: PackingRecord[],
  payments: PaymentRecord[],
  options?: {
    defaultRmbRate?: number;
    asOfDate?: string;
  }
): BuyerReceivablesAgingReport {
  const defaultRmbRate = Number(options?.defaultRmbRate) > 0 ? Number(options?.defaultRmbRate) : 16.5;
  const asOfDate = (options?.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);

  // Build map of settled RMB credits per packingId or invoiceNumber from exporter payment vouchers
  const extraSettledByPackingId = new Map<string, number>();
  const extraSettledByInvoice = new Map<string, number>();

  for (const pm of payments || []) {
    if (!pm) continue;
    const isExporter =
      pm.paymentCategory === 'exporter' ||
      Boolean(pm.shippingMark) ||
      (pm.items || []).some((row) => Boolean(row.packingId || row.shippingMark));
    if (!isExporter) continue;

    for (const row of pm.items || []) {
      const credit = Number(row.creditAmount) || 0;
      if (credit <= 0) continue;
      if (row.packingId) {
        extraSettledByPackingId.set(
          row.packingId,
          (extraSettledByPackingId.get(row.packingId) || 0) + credit
        );
      } else if (row.invoiceNumber) {
        const key = row.invoiceNumber.trim().toUpperCase();
        extraSettledByInvoice.set(key, (extraSettledByInvoice.get(key) || 0) + credit);
      }
    }
  }

  const bucketTotalsRmb: Record<AgingBucketKey, number> = {
    '0_7': 0,
    '8_15': 0,
    '16_30': 0,
    over_30: 0,
  };
  const bucketTotalsBdt: Record<AgingBucketKey, number> = {
    '0_7': 0,
    '8_15': 0,
    '16_30': 0,
    over_30: 0,
  };
  const bucketCounts: Record<AgingBucketKey, number> = {
    '0_7': 0,
    '8_15': 0,
    '16_30': 0,
    over_30: 0,
  };

  const buyerMap = new Map<string, BuyerAgingSummaryRow>();

  for (const pkg of packings || []) {
    if (!pkg) continue;
    const rawStatus = String(pkg.paymentStatus || pkg.exporterStatus || 'UNPAID')
      .trim()
      .toUpperCase();

    const billedRmb = round2(
      Number(pkg.reportAmount) > 0
        ? Number(pkg.reportAmount)
        : Number(pkg.debitAmount) > 0
        ? Number(pkg.debitAmount)
        : Number(pkg.rmbAmount) > 0
        ? Number(pkg.rmbAmount)
        : Number(pkg.totalAmount) || 0
    );

    if (billedRmb <= 0) continue;

    const inlineSettled = Math.max(
      Number(pkg.creditAmount) || 0,
      Number(pkg.settledAmount) || 0
    );
    const linkedSettled =
      extraSettledByPackingId.get(pkg.id) ||
      extraSettledByInvoice.get((pkg.invoiceNumber || '').trim().toUpperCase()) ||
      0;

    // Avoid double counting if packing record already reflects creditAmount/settledAmount
    const effectiveSettledRmb = round2(Math.max(inlineSettled, linkedSettled));

    let outstandingRmb = 0;
    if (rawStatus === 'PAID') {
      outstandingRmb = 0;
    } else if (pkg.balanceAmount !== undefined && Number(pkg.balanceAmount) >= 0 && inlineSettled > 0) {
      outstandingRmb = round2(Math.max(0, Number(pkg.balanceAmount)));
    } else {
      outstandingRmb = round2(Math.max(0, billedRmb - effectiveSettledRmb));
    }

    if (outstandingRmb <= 0.01) continue;

    const rmbRate = Number(pkg.rmbRate) > 0 ? Number(pkg.rmbRate) : defaultRmbRate;
    const outstandingBdt = round2(calculatePackingTotalAmountBDT(outstandingRmb, rmbRate));
    const dateStr = (pkg.packingDate || pkg.createdAt || asOfDate).slice(0, 10);
    const daysOutstanding = calculateDaysBetweenDates(dateStr, asOfDate);
    const bucket = classifyAgingBucket(daysOutstanding);

    const shippingMark = (pkg.shippingMark || 'UNASSIGNED MARK').trim();
    const buyerKey = shippingMark.toUpperCase();

    const shipmentEntry: AgingShipmentEntry = {
      packingId: pkg.id,
      invoiceNumber: pkg.invoiceNumber || pkg.id,
      packingDate: dateStr,
      shippingMark,
      flight: pkg.flight || '—',
      destination: pkg.destination || '—',
      totalBox: Number(pkg.totalBox) || 0,
      totalWeightKg: round2(Number(pkg.totalWeight) || 0),
      billedRmb,
      settledRmb: effectiveSettledRmb,
      outstandingRmb,
      rmbRate,
      outstandingBdt,
      daysOutstanding,
      bucket,
      status: rawStatus,
    };

    bucketTotalsRmb[bucket] = round2(bucketTotalsRmb[bucket] + outstandingRmb);
    bucketTotalsBdt[bucket] = round2(bucketTotalsBdt[bucket] + outstandingBdt);
    bucketCounts[bucket] += 1;

    let group = buyerMap.get(buyerKey);
    if (!group) {
      group = {
        buyerKey,
        shippingMark,
        destinations: [],
        unpaidShipmentsCount: 0,
        totalBox: 0,
        totalWeightKg: 0,
        totalBilledRmb: 0,
        totalSettledRmb: 0,
        outstandingRmb: 0,
        outstandingBdt: 0,
        bucket0To7Rmb: 0,
        bucket8To15Rmb: 0,
        bucket16To30Rmb: 0,
        bucketOver30Rmb: 0,
        maxDaysOverdue: 0,
        oldestDate: dateStr,
        shipments: [],
      };
      buyerMap.set(buyerKey, group);
    }

    if (pkg.destination && !group.destinations.includes(pkg.destination)) {
      group.destinations.push(pkg.destination);
    }
    group.unpaidShipmentsCount += 1;
    group.totalBox += shipmentEntry.totalBox;
    group.totalWeightKg = round2(group.totalWeightKg + shipmentEntry.totalWeightKg);
    group.totalBilledRmb = round2(group.totalBilledRmb + billedRmb);
    group.totalSettledRmb = round2(group.totalSettledRmb + effectiveSettledRmb);
    group.outstandingRmb = round2(group.outstandingRmb + outstandingRmb);
    group.outstandingBdt = round2(group.outstandingBdt + outstandingBdt);

    if (bucket === '0_7') group.bucket0To7Rmb = round2(group.bucket0To7Rmb + outstandingRmb);
    else if (bucket === '8_15') group.bucket8To15Rmb = round2(group.bucket8To15Rmb + outstandingRmb);
    else if (bucket === '16_30') group.bucket16To30Rmb = round2(group.bucket16To30Rmb + outstandingRmb);
    else group.bucketOver30Rmb = round2(group.bucketOver30Rmb + outstandingRmb);

    if (daysOutstanding > group.maxDaysOverdue) {
      group.maxDaysOverdue = daysOutstanding;
    }
    if (dateStr < group.oldestDate) {
      group.oldestDate = dateStr;
    }
    group.shipments.push(shipmentEntry);
  }

  const buyers = Array.from(buyerMap.values()).map((b) => ({
    ...b,
    shipments: b.shipments.sort((a, c) => c.daysOutstanding - a.daysOutstanding),
  }));

  // Sort buyers with highest overdue days first, then largest outstanding RMB
  buyers.sort((a, b) => {
    if (b.bucketOver30Rmb !== a.bucketOver30Rmb) return b.bucketOver30Rmb - a.bucketOver30Rmb;
    return b.outstandingRmb - a.outstandingRmb;
  });

  const totalOutstandingRmb = round2(
    bucketTotalsRmb['0_7'] +
      bucketTotalsRmb['8_15'] +
      bucketTotalsRmb['16_30'] +
      bucketTotalsRmb.over_30
  );
  const totalOutstandingBdt = round2(
    bucketTotalsBdt['0_7'] +
      bucketTotalsBdt['8_15'] +
      bucketTotalsBdt['16_30'] +
      bucketTotalsBdt.over_30
  );
  const totalUnpaidShipments =
    bucketCounts['0_7'] + bucketCounts['8_15'] + bucketCounts['16_30'] + bucketCounts.over_30;

  return {
    asOfDate,
    totalOutstandingRmb,
    totalOutstandingBdt,
    totalUnpaidShipments,
    totalBuyersWithDue: buyers.length,
    bucketTotalsRmb,
    bucketTotalsBdt,
    bucketCounts,
    buyers,
  };
}

/**
 * Generates a bilingual English + Chinese statement ready for WeChat / WhatsApp / PDF sharing.
 */
export function formatBilingualBuyerStatement(
  buyer: BuyerAgingSummaryRow,
  companyName: string,
  asOfDate: string
): string {
  const lines: string[] = [
    `${companyName} — RECEIVABLES AGING STATEMENT / 应收账款对账单`,
    `Shipping Mark / 唛头: ${buyer.shippingMark}`,
    `Statement Date / 对账日期: ${asOfDate}`,
    `Unpaid Shipments / 未结票数: ${buyer.unpaidShipmentsCount} (${buyer.totalBox} Boxes / ${buyer.totalWeightKg.toFixed(2)} KG)`,
    `--------------------------------------------------`,
  ];

  buyer.shipments.forEach((s, idx) => {
    lines.push(
      `${idx + 1}. ${s.packingDate} | ${s.invoiceNumber} | Flight: ${s.flight} | Due: ¥${s.outstandingRmb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${s.daysOutstanding}d)`
    );
  });

  lines.push(`--------------------------------------------------`);
  lines.push(
    `0-7d: ¥${buyer.bucket0To7Rmb.toFixed(2)} | 8-15d: ¥${buyer.bucket8To15Rmb.toFixed(2)} | 16-30d: ¥${buyer.bucket16To30Rmb.toFixed(2)} | 30+d: ¥${buyer.bucketOver30Rmb.toFixed(2)}`
  );
  lines.push(
    `TOTAL DUE / 应付总额: ¥${buyer.outstandingRmb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RMB (≈ TK ${buyer.outstandingBdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
  );
  lines.push(`Please arrange remittance at your earliest convenience. 请尽快安排汇款，谢谢合作！`);

  return lines.join('\n');
}

export function buildBuyerAgingCsv(report: BuyerReceivablesAgingReport): string {
  const headers = [
    'Shipping Mark',
    'Destinations',
    'Unpaid Shipments',
    'Total Boxes',
    'Total Weight (KG)',
    '0-7 Days (RMB)',
    '8-15 Days (RMB)',
    '16-30 Days (RMB)',
    '30+ Days Overdue (RMB)',
    'Total Outstanding (RMB)',
    'Estimated Outstanding (BDT)',
    'Max Days Overdue',
    'Oldest Unpaid Date',
  ];

  const rows = report.buyers.map((b) => [
    `"${b.shippingMark.replace(/"/g, '""')}"`,
    `"${b.destinations.join(' / ').replace(/"/g, '""')}"`,
    b.unpaidShipmentsCount,
    b.totalBox,
    b.totalWeightKg.toFixed(2),
    b.bucket0To7Rmb.toFixed(2),
    b.bucket8To15Rmb.toFixed(2),
    b.bucket16To30Rmb.toFixed(2),
    b.bucketOver30Rmb.toFixed(2),
    b.outstandingRmb.toFixed(2),
    b.outstandingBdt.toFixed(2),
    b.maxDaysOverdue,
    `"${b.oldestDate}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
