import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
  SupplierCreditRecord,
  ActiveTab,
} from '../types/index.ts';

export type SearchResultModule =
  | 'purchase'
  | 'packing'
  | 'payment'
  | 'other_cost'
  | 'supplier_credit';

export interface SearchResultItem {
  id: string;
  module: SearchResultModule;
  moduleLabel: string;
  badgeColor: string;
  primaryTitle: string; // e.g. "PUR-2026-0001" or "PKG-2026-0002"
  secondaryTitle: string; // e.g. "Abdullah Vai" or "Mark: AAD · Flight: CZ392"
  subtitle: string; // Description, destination or item summary
  date: string;
  amountFormatted: string;
  details: string[];
  matchedFields: string[];
  targetTab: ActiveTab;
  rawRecord: any;
  score: number;
}

export interface GlobalSearchDataset {
  purchases: PurchaseRecord[];
  packings: PackingRecord[];
  payments: PaymentRecord[];
  otherCosts?: OtherCostRecord[];
  supplierCredits?: SupplierCreditRecord[];
}

export interface SearchOptions {
  limit?: number;
  filterModule?: 'all' | SearchResultModule;
}

export interface GlobalSearchResultSummary {
  items: SearchResultItem[];
  totalMatches: number;
  countsByModule: {
    all: number;
    purchase: number;
    packing: number;
    payment: number;
    other_cost: number;
    supplier_credit: number;
  };
}

/**
 * Format currency amount for search item preview
 */
function formatAmount(val: number, currency: 'TK' | 'RMB' = 'TK'): string {
  const num = Number(val) || 0;
  return `${num.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Calculate match relevance score between target string and search query
 */
function calculateTextMatchScore(
  text: string | undefined | null,
  queryLower: string,
  tokens: string[]
): { score: number; isMatch: boolean } {
  if (!text) return { score: 0, isMatch: false };
  const str = String(text).toLowerCase().trim();
  if (!str) return { score: 0, isMatch: false };

  // Exact full match
  if (str === queryLower) {
    return { score: 1000, isMatch: true };
  }

  // Starts with query
  if (str.startsWith(queryLower)) {
    return { score: 600, isMatch: true };
  }

  // Contains exact phrase
  if (str.includes(queryLower)) {
    return { score: 400, isMatch: true };
  }

  // Token matching (all tokens must match somewhere)
  if (tokens.length > 1) {
    const allMatch = tokens.every((token) => str.includes(token));
    if (allMatch) {
      return { score: 250, isMatch: true };
    }
  }

  return { score: 0, isMatch: false };
}

/**
 * Global search engine across all database sheets.
 * Accurately finds invoices, supplier names, tracking IDs, shipping marks, flight numbers,
 * mobile contacts, and line items.
 */
export function searchAllRecords(
  query: string,
  data: GlobalSearchDataset,
  options: SearchOptions = {}
): GlobalSearchResultSummary {
  const rawQuery = (query || '').trim();
  const limit = options.limit ?? 50;
  const filterModule = options.filterModule ?? 'all';

  const emptyCounts = {
    all: 0,
    purchase: 0,
    packing: 0,
    payment: 0,
    other_cost: 0,
    supplier_credit: 0,
  };

  if (!rawQuery) {
    return {
      items: [],
      totalMatches: 0,
      countsByModule: emptyCounts,
    };
  }

  const queryLower = rawQuery.toLowerCase();
  const tokens = queryLower.split(/\s+/).filter(Boolean);

  const matchedItems: SearchResultItem[] = [];

  // 1. Search Purchases
  (data.purchases || []).forEach((pur) => {
    let bestScore = 0;
    const matches: string[] = [];

    // Check Invoice Number
    const invMatch = calculateTextMatchScore(pur.invoiceNumber, queryLower, tokens);
    if (invMatch.isMatch) {
      bestScore = Math.max(bestScore, invMatch.score + 200); // Prioritize invoice numbers
      matches.push(`Invoice #${pur.invoiceNumber}`);
    }

    // Check Supplier Name (description)
    const supMatch = calculateTextMatchScore(pur.description, queryLower, tokens);
    if (supMatch.isMatch) {
      bestScore = Math.max(bestScore, supMatch.score + 100);
      matches.push(`Supplier: ${pur.description}`);
    }

    // Check Contact Number
    const contactMatch = calculateTextMatchScore(pur.contactNumber, queryLower, tokens);
    if (contactMatch.isMatch) {
      bestScore = Math.max(bestScore, contactMatch.score + 50);
      matches.push(`Contact: ${pur.contactNumber}`);
    }

    // Check Line Items
    if (Array.isArray(pur.items)) {
      const matchedItemNames = pur.items
        .map((it) => it.item)
        .filter((itName) => calculateTextMatchScore(itName, queryLower, tokens).isMatch);
      if (matchedItemNames.length > 0) {
        bestScore = Math.max(bestScore, 150);
        matches.push(`Item: ${matchedItemNames.slice(0, 2).join(', ')}`);
      }
    }

    // Check Remarks
    if (pur.remarks) {
      const remMatch = calculateTextMatchScore(pur.remarks, queryLower, tokens);
      if (remMatch.isMatch) {
        bestScore = Math.max(bestScore, 80);
        matches.push(`Remarks`);
      }
    }

    if (bestScore > 0) {
      const itemsSummary = (pur.items || [])
        .map((i) => `${i.item || 'Item'} (${i.quantity} kg)`)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

      matchedItems.push({
        id: pur.id,
        module: 'purchase',
        moduleLabel: 'Purchase Challan',
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        primaryTitle: pur.invoiceNumber || 'PUR-RECORD',
        secondaryTitle: pur.description || 'Unknown Supplier',
        subtitle: itemsSummary || `Qty: ${pur.totalQty} KG · Total: ${formatAmount(pur.totalAmount)}`,
        date: pur.date || '',
        amountFormatted: formatAmount(pur.totalAmount, 'TK'),
        details: [
          `Qty: ${pur.totalQty} KG`,
          pur.paidAmount ? `Paid: ${formatAmount(pur.paidAmount)}` : '',
          pur.balance ? `Due: ${formatAmount(pur.balance)}` : '',
        ].filter(Boolean),
        matchedFields: matches,
        targetTab: 'purchase_db',
        rawRecord: pur,
        score: bestScore,
      });
    }
  });

  // 2. Search Packings (Export Packing & Flight Return Bill)
  (data.packings || []).forEach((pkg) => {
    let bestScore = 0;
    const matches: string[] = [];

    // Invoice #
    const invMatch = calculateTextMatchScore(pkg.invoiceNumber, queryLower, tokens);
    if (invMatch.isMatch) {
      bestScore = Math.max(bestScore, invMatch.score + 200);
      matches.push(`Packing #${pkg.invoiceNumber}`);
    }

    // Shipping Mark (Tracking Mark)
    const markMatch = calculateTextMatchScore(pkg.shippingMark, queryLower, tokens);
    if (markMatch.isMatch) {
      bestScore = Math.max(bestScore, markMatch.score + 180);
      matches.push(`Mark: ${pkg.shippingMark}`);
    }

    // Flight Number / Waybill (Tracking ID)
    const flightMatch = calculateTextMatchScore(pkg.flight, queryLower, tokens);
    if (flightMatch.isMatch) {
      bestScore = Math.max(bestScore, flightMatch.score + 170);
      matches.push(`Flight: ${pkg.flight}`);
    }

    // Destination
    const destMatch = calculateTextMatchScore(pkg.destination, queryLower, tokens);
    if (destMatch.isMatch) {
      bestScore = Math.max(bestScore, destMatch.score + 90);
      matches.push(`Dest: ${pkg.destination}`);
    }

    // Shipper
    const shipperMatch = calculateTextMatchScore(pkg.shipper, queryLower, tokens);
    if (shipperMatch.isMatch) {
      bestScore = Math.max(bestScore, shipperMatch.score + 90);
      matches.push(`Shipper: ${pkg.shipper}`);
    }

    // Items
    if (Array.isArray(pkg.items)) {
      const matchedItemNames = pkg.items
        .map((it) => it.item)
        .filter((itName) => calculateTextMatchScore(itName, queryLower, tokens).isMatch);
      if (matchedItemNames.length > 0) {
        bestScore = Math.max(bestScore, 150);
        matches.push(`Item: ${matchedItemNames.slice(0, 2).join(', ')}`);
      }
    }

    if (bestScore > 0) {
      matchedItems.push({
        id: pkg.id,
        module: 'packing',
        moduleLabel: 'Export Packing',
        badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
        primaryTitle: pkg.invoiceNumber || 'PKG-RECORD',
        secondaryTitle: `Mark: ${pkg.shippingMark || 'N/A'} · Flight: ${pkg.flight || 'N/A'}`,
        subtitle: `${pkg.destination || 'Export'} · Shipper: ${pkg.shipper || 'ZSB AQUATICS'}`,
        date: pkg.packingDate || '',
        amountFormatted: formatAmount(pkg.totalAmount, 'RMB'),
        details: [
          `${pkg.totalBox || 0} Boxes`,
          `${pkg.totalWeight || 0} KG`,
          pkg.rmbAmount ? `${formatAmount(pkg.rmbAmount, 'RMB')}` : '',
        ].filter(Boolean),
        matchedFields: matches,
        targetTab: 'packing_db',
        rawRecord: pkg,
        score: bestScore,
      });
    }
  });

  // 3. Search Payments
  (data.payments || []).forEach((pay) => {
    let bestScore = 0;
    const matches: string[] = [];

    // Invoice Number
    const invMatch = calculateTextMatchScore(pay.invoiceNumber, queryLower, tokens);
    if (invMatch.isMatch) {
      bestScore = Math.max(bestScore, invMatch.score + 200);
      matches.push(`Voucher #${pay.invoiceNumber}`);
    }

    // Supplier / Description
    const supMatch = calculateTextMatchScore(pay.description, queryLower, tokens);
    if (supMatch.isMatch) {
      bestScore = Math.max(bestScore, supMatch.score + 100);
      matches.push(`Payee: ${pay.description}`);
    }

    // Shipping Mark
    if (pay.shippingMark) {
      const markMatch = calculateTextMatchScore(pay.shippingMark, queryLower, tokens);
      if (markMatch.isMatch) {
        bestScore = Math.max(bestScore, markMatch.score + 150);
        matches.push(`Mark: ${pay.shippingMark}`);
      }
    }

    // Export Goods Ref
    if (pay.exportGoodsRef) {
      const refMatch = calculateTextMatchScore(pay.exportGoodsRef, queryLower, tokens);
      if (refMatch.isMatch) {
        bestScore = Math.max(bestScore, refMatch.score + 140);
        matches.push(`Ref: ${pay.exportGoodsRef}`);
      }
    }

    // Contact
    if (pay.contactNumber) {
      const contactMatch = calculateTextMatchScore(pay.contactNumber, queryLower, tokens);
      if (contactMatch.isMatch) {
        bestScore = Math.max(bestScore, contactMatch.score + 50);
        matches.push(`Contact: ${pay.contactNumber}`);
      }
    }

    // Line items
    if (Array.isArray(pay.items)) {
      pay.items.forEach((item) => {
        if (item.invoiceNumber && calculateTextMatchScore(item.invoiceNumber, queryLower, tokens).isMatch) {
          bestScore = Math.max(bestScore, 180);
          matches.push(`Ref Inv: ${item.invoiceNumber}`);
        }
        if (item.shippingMark && calculateTextMatchScore(item.shippingMark, queryLower, tokens).isMatch) {
          bestScore = Math.max(bestScore, 180);
          matches.push(`Line Mark: ${item.shippingMark}`);
        }
        if (item.flight && calculateTextMatchScore(item.flight, queryLower, tokens).isMatch) {
          bestScore = Math.max(bestScore, 180);
          matches.push(`Line Flight: ${item.flight}`);
        }
      });
    }

    if (bestScore > 0) {
      matchedItems.push({
        id: pay.id,
        module: 'payment',
        moduleLabel: 'Payment Voucher',
        badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
        primaryTitle: pay.invoiceNumber || 'PAY-RECORD',
        secondaryTitle: pay.description || 'Supplier Payment',
        subtitle: pay.exportGoodsRef
          ? `Goods Ref: ${pay.exportGoodsRef}`
          : pay.shippingMark
          ? `Mark: ${pay.shippingMark}`
          : 'Payment Settlement',
        date: pay.date || '',
        amountFormatted: formatAmount(pay.paidAmount || pay.totalAmount, 'TK'),
        details: [
          `Paid: ${formatAmount(pay.paidAmount || 0)}`,
          pay.balance ? `Due: ${formatAmount(pay.balance)}` : '',
          pay.status ? `Status: ${pay.status}` : '',
        ].filter(Boolean),
        matchedFields: Array.from(new Set(matches)),
        targetTab: 'payment_db',
        rawRecord: pay,
        score: bestScore,
      });
    }
  });

  // 4. Search Other Costs
  (data.otherCosts || []).forEach((cost) => {
    let bestScore = 0;
    const matches: string[] = [];

    const catMatch = calculateTextMatchScore(cost.category, queryLower, tokens);
    if (catMatch.isMatch) {
      bestScore = Math.max(bestScore, catMatch.score + 80);
      matches.push(`Category: ${cost.category}`);
    }

    const descMatch = calculateTextMatchScore(cost.description, queryLower, tokens);
    if (descMatch.isMatch) {
      bestScore = Math.max(bestScore, descMatch.score + 70);
      matches.push(`Description: ${cost.description}`);
    }

    if (cost.refInvoice) {
      const refMatch = calculateTextMatchScore(cost.refInvoice, queryLower, tokens);
      if (refMatch.isMatch) {
        bestScore = Math.max(bestScore, refMatch.score + 160);
        matches.push(`Ref: ${cost.refInvoice}`);
      }
    }

    if (bestScore > 0) {
      matchedItems.push({
        id: cost.id,
        module: 'other_cost',
        moduleLabel: 'Expense / Cost',
        badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        primaryTitle: cost.refInvoice || `EXP-${cost.id.slice(0, 6)}`,
        secondaryTitle: cost.category || 'Other Cost',
        subtitle: cost.description || 'Expense entry',
        date: cost.date || '',
        amountFormatted: formatAmount(cost.amount, 'TK'),
        details: [`Expense: ${cost.category}`],
        matchedFields: matches,
        targetTab: 'profit_loss',
        rawRecord: cost,
        score: bestScore,
      });
    }
  });

  // 5. Search Supplier Credits
  (data.supplierCredits || []).forEach((credit) => {
    let bestScore = 0;
    const matches: string[] = [];

    const credNumMatch = calculateTextMatchScore(credit.creditNoteNumber, queryLower, tokens);
    if (credNumMatch.isMatch) {
      bestScore = Math.max(bestScore, credNumMatch.score + 200);
      matches.push(`Credit Note #${credit.creditNoteNumber}`);
    }

    const supMatch = calculateTextMatchScore(credit.supplierName, queryLower, tokens);
    if (supMatch.isMatch) {
      bestScore = Math.max(bestScore, supMatch.score + 100);
      matches.push(`Supplier: ${credit.supplierName}`);
    }

    if (credit.refPurchaseInvoice) {
      const refMatch = calculateTextMatchScore(credit.refPurchaseInvoice, queryLower, tokens);
      if (refMatch.isMatch) {
        bestScore = Math.max(bestScore, refMatch.score + 160);
        matches.push(`Ref Purchase: ${credit.refPurchaseInvoice}`);
      }
    }

    if (credit.reason) {
      const reasonMatch = calculateTextMatchScore(credit.reason, queryLower, tokens);
      if (reasonMatch.isMatch) {
        bestScore = Math.max(bestScore, reasonMatch.score + 60);
        matches.push(`Reason: ${credit.reason}`);
      }
    }

    if (bestScore > 0) {
      matchedItems.push({
        id: credit.id,
        module: 'supplier_credit',
        moduleLabel: 'Supplier Credit',
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        primaryTitle: credit.creditNoteNumber,
        secondaryTitle: credit.supplierName,
        subtitle: `${credit.reason} (Ref: ${credit.refPurchaseInvoice || 'N/A'})`,
        date: credit.date || '',
        amountFormatted: formatAmount(credit.amount, 'TK'),
        details: [
          `Applied: ${formatAmount(credit.appliedAmount)}`,
          `Remaining: ${formatAmount(credit.remainingAmount)}`,
          `Status: ${credit.status}`,
        ],
        matchedFields: matches,
        targetTab: 'payment_form',
        rawRecord: credit,
        score: bestScore,
      });
    }
  });

  // Calculate counts by module
  const countsByModule = {
    all: matchedItems.length,
    purchase: matchedItems.filter((i) => i.module === 'purchase').length,
    packing: matchedItems.filter((i) => i.module === 'packing').length,
    payment: matchedItems.filter((i) => i.module === 'payment').length,
    other_cost: matchedItems.filter((i) => i.module === 'other_cost').length,
    supplier_credit: matchedItems.filter((i) => i.module === 'supplier_credit').length,
  };

  // Filter if specific module selected
  let filtered = matchedItems;
  if (filterModule !== 'all') {
    filtered = matchedItems.filter((i) => i.module === filterModule);
  }

  // Sort by score descending, then by date descending
  filtered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.date.localeCompare(a.date);
  });

  return {
    items: filtered.slice(0, limit),
    totalMatches: filtered.length,
    countsByModule,
  };
}
