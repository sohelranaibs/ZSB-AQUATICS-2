import {
  PurchaseRecord,
  PackingRecord,
  PaymentRecord,
  OtherCostRecord,
  PurchaseItemRow,
  PackingItemRow,
} from '../types/index.ts';
import {
  generateInvoiceNumber,
  calculatePurchaseTotals,
  calculatePackingTotals,
} from './calculations.ts';
import {
  buildPurchaseSupplierGroupKey,
  buildPackingShipmentGroupKey,
} from './csvParser.ts';

export interface UpsertBatchResult<T> {
  records: T[];
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
}

function stableNormalizeString(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function stableRawValues(rawValues?: Record<string, string>): Record<string, string> {
  if (!rawValues) return {};
  const entries = Object.entries(rawValues)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

function purchaseContentSignature(
  rec: Omit<PurchaseRecord, 'id' | 'createdAt'> | PurchaseRecord
): string {
  return JSON.stringify({
    date: String(rec.date || '').trim(),
    description: stableNormalizeString(rec.description),
    contactNumber: String(rec.contactNumber || '').trim(),
    totalQty: Number(rec.totalQty) || 0,
    totalAmount: Number(rec.totalAmount) || 0,
    previousAmount: Number(rec.previousAmount) || 0,
    paidAmount: Number(rec.paidAmount) || 0,
    balance: Number(rec.balance) || 0,
    remarks: String(rec.remarks || '').trim(),
    calculationPending: Boolean(rec.calculationPending),
    pendingFields: [...(rec.pendingFields || [])].sort(),
    rawValues: stableRawValues(rec.rawValues),
    items: (rec.items || []).map((it) => ({
      item: String(it.item || '').trim(),
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      totalAmount: Number(it.totalAmount) || 0,
    })),
  });
}

function packingContentSignature(
  rec: Omit<PackingRecord, 'id' | 'createdAt'> | PackingRecord
): string {
  return JSON.stringify({
    shippingMark: stableNormalizeString(rec.shippingMark),
    flight: stableNormalizeString(rec.flight),
    destination: stableNormalizeString(rec.destination),
    shipper: stableNormalizeString(rec.shipper),
    packingDate: String(rec.packingDate || '').trim(),
    totalBox: Number(rec.totalBox) || 0,
    totalWeight: Number(rec.totalWeight) || 0,
    totalAmount: Number(rec.totalAmount) || 0,
    rmbRate: rec.rmbRate ?? null,
    totalAmountBDT: rec.totalAmountBDT ?? null,
    paymentStatus: String(rec.paymentStatus || rec.exporterStatus || '').trim(),
    remarks: String(rec.remarks || '').trim(),
    calculationPending: Boolean(rec.calculationPending),
    pendingFields: [...(rec.pendingFields || [])].sort(),
    rawValues: stableRawValues(rec.rawValues),
    items: (rec.items || []).map((it) => ({
      item: String(it.item || '').trim(),
      box: Number(it.box) || 0,
      weight: Number(it.weight) || 0,
      totalWeight: Number(it.totalWeight) || 0,
      unit: String(it.unit || 'KG').trim(),
      rate: Number(it.rate) || 0,
      amount: Number(it.amount) || 0,
    })),
  });
}

function paymentContentSignature(
  rec: Omit<PaymentRecord, 'id' | 'createdAt'> | PaymentRecord
): string {
  return JSON.stringify({
    invoiceNumber: stableNormalizeString(rec.invoiceNumber),
    date: String(rec.date || '').trim(),
    description: stableNormalizeString(rec.description),
    contactNumber: String(rec.contactNumber || '').trim(),
    totalAmount: Number(rec.totalAmount) || 0,
    previousAmount: Number(rec.previousAmount) || 0,
    paidAmount: Number(rec.paidAmount) || 0,
    balance: Number(rec.balance) || 0,
    status: stableNormalizeString(rec.status),
    returnRMB: Number(rec.returnRMB) || 0,
    exportGoodsRef: String(rec.exportGoodsRef || '').trim(),
    paymentCategory: rec.paymentCategory || (Number(rec.returnRMB) > 0 ? 'exporter' : 'supplier'),
    shippingMark: String(rec.shippingMark || '').trim(),
    remarks: String(rec.remarks || '').trim(),
    calculationPending: Boolean(rec.calculationPending),
    pendingFields: [...(rec.pendingFields || [])].sort(),
    rawValues: stableRawValues(rec.rawValues),
    items: (rec.items || []).map((it) => ({
      description: String(it.description || '').trim(),
      debitAmount: Number(it.debitAmount) || 0,
      creditAmount: Number(it.creditAmount) || 0,
      balance: Number(it.balance) || 0,
    })),
  });
}

function otherCostContentSignature(
  rec: Omit<OtherCostRecord, 'id' | 'createdAt'> | OtherCostRecord
): string {
  return JSON.stringify({
    date: String(rec.date || '').trim(),
    category: stableNormalizeString(rec.category),
    amount: Number(rec.amount) || 0,
    description: String(rec.description || '').trim(),
    paymentMethod: String(rec.paymentMethod || '').trim(),
    paidBy: String(rec.paidBy || '').trim(),
    refInvoice: String(rec.refInvoice || '').trim(),
    calculationPending: Boolean(rec.calculationPending),
    pendingFields: [...(rec.pendingFields || [])].sort(),
    rawValues: stableRawValues(rec.rawValues),
  });
}

/**
 * Upserts Purchase records in-place:
 * - Matches existing by explicit Invoice Number OR normalized Supplier + Date key
 * - Identical invoices remain completely unchanged
 * - Modified existing invoices update in place (preserving id, createdAt, invoiceNumber)
 * - Missing invoice references receive an INV-YYYY-XXXX number
 */
export function upsertPurchasesInPlace(
  existing: PurchaseRecord[],
  incoming: Omit<PurchaseRecord, 'id' | 'createdAt'>[],
  makeId: (prefix: string) => string,
  nowIso: string = new Date().toISOString()
): UpsertBatchResult<PurchaseRecord> {
  const nextExisting = [...existing];
  const indexByInvoice = new Map<string, number>();
  const indexBySupplierDate = new Map<string, number>();

  nextExisting.forEach((p, idx) => {
    const inv = stableNormalizeString(p.invoiceNumber);
    if (inv) indexByInvoice.set(inv, idx);
    indexBySupplierDate.set(
      buildPurchaseSupplierGroupKey({ description: p.description, date: p.date }),
      idx
    );
  });

  const newlyCreated: PurchaseRecord[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let seq = existing.length;

  for (const inc of incoming) {
    const incInvNorm = stableNormalizeString(inc.invoiceNumber);
    const incGroupKey = buildPurchaseSupplierGroupKey({
      description: inc.description,
      date: inc.date,
    });

    let matchIdx: number | undefined = undefined;
    if (incInvNorm && indexByInvoice.has(incInvNorm)) {
      matchIdx = indexByInvoice.get(incInvNorm);
    } else if (indexBySupplierDate.has(incGroupKey)) {
      matchIdx = indexBySupplierDate.get(incGroupKey);
    }

    if (matchIdx !== undefined) {
      const target = nextExisting[matchIdx];
      if (purchaseContentSignature(target) === purchaseContentSignature(inc)) {
        unchangedCount++;
        continue;
      }

      const normalizedItems: PurchaseItemRow[] = (inc.items || []).map((it, idx) => ({
        ...it,
        id: it.id || `pi-upd-${Date.now()}-${idx}`,
      }));

      const nextTotals = calculatePurchaseTotals(
        normalizedItems,
        inc.previousAmount,
        inc.paidAmount
      );

      const resolvedInvoice =
        inc.invoiceNumber && String(inc.invoiceNumber).trim() !== ''
          ? String(inc.invoiceNumber).trim()
          : target.invoiceNumber;

      nextExisting[matchIdx] = {
        ...target,
        ...inc,
        id: target.id,
        createdAt: target.createdAt,
        invoiceNumber: resolvedInvoice,
        contactNumber: inc.contactNumber || target.contactNumber,
        items: normalizedItems,
        totalQty: inc.calculationPending ? inc.totalQty : nextTotals.totalQty,
        totalAmount: inc.calculationPending ? inc.totalAmount : nextTotals.totalAmount,
        previousAmount: inc.previousAmount,
        paidAmount: inc.paidAmount,
        balance: inc.calculationPending ? inc.balance : nextTotals.balance,
      };
      updatedCount++;
    } else {
      const assignedInvoice =
        inc.invoiceNumber && String(inc.invoiceNumber).trim() !== ''
          ? String(inc.invoiceNumber).trim()
          : generateInvoiceNumber('INV', seq);
      seq++;
      newlyCreated.push({
        ...inc,
        invoiceNumber: assignedInvoice,
        id: makeId('pur'),
        createdAt: nowIso,
      });
      insertedCount++;
    }
  }

  return {
    records: [...newlyCreated, ...nextExisting],
    insertedCount,
    updatedCount,
    unchangedCount,
  };
}

/**
 * Upserts Packing records in-place:
 * - Matches existing by explicit Invoice Number OR ShippingMark+Flight+Destination+Shipper+PackingDate
 * - Identical invoices remain completely unchanged
 * - Existing invoice numbers update in place
 */
export function upsertPackingsInPlace(
  existing: PackingRecord[],
  incoming: Omit<PackingRecord, 'id' | 'createdAt'>[],
  makeId: (prefix: string) => string,
  nowIso: string = new Date().toISOString()
): UpsertBatchResult<PackingRecord> {
  const nextExisting = [...existing];
  const indexByInvoice = new Map<string, number>();
  const indexByShipment = new Map<string, number>();

  nextExisting.forEach((p, idx) => {
    const inv = stableNormalizeString(p.invoiceNumber);
    if (inv) indexByInvoice.set(inv, idx);
    indexByShipment.set(
      buildPackingShipmentGroupKey({
        shippingMark: p.shippingMark,
        flight: p.flight,
        destination: p.destination,
        shipper: p.shipper,
        packingDate: p.packingDate,
      }),
      idx
    );
  });

  const newlyCreated: PackingRecord[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let seq = existing.length;

  for (const inc of incoming) {
    const incInvNorm = stableNormalizeString(inc.invoiceNumber);
    const incGroupKey = buildPackingShipmentGroupKey({
      shippingMark: inc.shippingMark,
      flight: inc.flight,
      destination: inc.destination,
      shipper: inc.shipper,
      packingDate: inc.packingDate,
    });

    let matchIdx: number | undefined = undefined;
    if (incInvNorm && indexByInvoice.has(incInvNorm)) {
      matchIdx = indexByInvoice.get(incInvNorm);
    } else if (indexByShipment.has(incGroupKey)) {
      matchIdx = indexByShipment.get(incGroupKey);
    }

    if (matchIdx !== undefined) {
      const target = nextExisting[matchIdx];
      if (packingContentSignature(target) === packingContentSignature(inc)) {
        unchangedCount++;
        continue;
      }

      const normalizedItems: PackingItemRow[] = (inc.items || []).map((it, idx) => ({
        ...it,
        id: it.id || `pki-upd-${Date.now()}-${idx}`,
      }));

      const totals = calculatePackingTotals(normalizedItems);
      const rmbRate =
        inc.rmbRate !== undefined
          ? inc.rmbRate
          : target.rmbRate;
      const totalAmountBDT =
        rmbRate && rmbRate > 0
          ? Math.round(totals.totalAmount * rmbRate * 100) / 100
          : inc.totalAmountBDT;
      const rmbAmount =
        totals.totalWeight > 0
          ? Math.round((totals.totalAmount / totals.totalWeight) * 100) / 100
          : 0;

      const resolvedInvoice =
        inc.invoiceNumber && String(inc.invoiceNumber).trim() !== ''
          ? String(inc.invoiceNumber).trim()
          : target.invoiceNumber;

      nextExisting[matchIdx] = {
        ...target,
        ...inc,
        id: target.id,
        createdAt: target.createdAt,
        invoiceNumber: resolvedInvoice,
        items: normalizedItems,
        totalBox: inc.calculationPending ? inc.totalBox : totals.totalBox,
        totalWeight: inc.calculationPending ? inc.totalWeight : totals.totalWeight,
        totalAmount: inc.calculationPending ? inc.totalAmount : totals.totalAmount,
        rmbRate,
        totalAmountBDT,
        rmbAmount,
        settledAmount: inc.calculationPending ? inc.totalAmount : totals.totalAmount,
      };
      updatedCount++;
    } else {
      const assignedInvoice =
        inc.invoiceNumber && String(inc.invoiceNumber).trim() !== ''
          ? String(inc.invoiceNumber).trim()
          : generateInvoiceNumber('PKG', seq);
      seq++;
      newlyCreated.push({
        ...inc,
        invoiceNumber: assignedInvoice,
        id: makeId('pkg'),
        createdAt: nowIso,
      });
      insertedCount++;
    }
  }

  return {
    records: [...newlyCreated, ...nextExisting],
    insertedCount,
    updatedCount,
    unchangedCount,
  };
}

/**
 * Upserts Payment records in-place:
 * - Matches existing by normalized Invoice Number
 * - Identical invoices remain completely unchanged
 * - Modified existing invoice numbers update in place
 */
export function upsertPaymentsInPlace(
  existing: PaymentRecord[],
  incoming: Omit<PaymentRecord, 'id' | 'createdAt'>[],
  makeId: (prefix: string) => string,
  nowIso: string = new Date().toISOString()
): UpsertBatchResult<PaymentRecord> {
  const nextExisting = [...existing];
  const indexByInvoice = new Map<string, number>();

  nextExisting.forEach((p, idx) => {
    const inv = stableNormalizeString(p.invoiceNumber);
    if (inv) indexByInvoice.set(inv, idx);
  });

  const newlyCreated: PaymentRecord[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let seq = existing.length;

  for (const inc of incoming) {
    const incInvNorm = stableNormalizeString(inc.invoiceNumber);
    const matchIdx = incInvNorm ? indexByInvoice.get(incInvNorm) : undefined;

    if (matchIdx !== undefined) {
      const target = nextExisting[matchIdx];
      if (paymentContentSignature(target) === paymentContentSignature(inc)) {
        unchangedCount++;
        continue;
      }

      nextExisting[matchIdx] = {
        ...target,
        ...inc,
        id: target.id,
        createdAt: target.createdAt,
        invoiceNumber: inc.invoiceNumber || target.invoiceNumber,
      };
      updatedCount++;
    } else {
      const assignedInvoice =
        inc.invoiceNumber && String(inc.invoiceNumber).trim() !== ''
          ? String(inc.invoiceNumber).trim()
          : generateInvoiceNumber('PAY', seq);
      seq++;
      newlyCreated.push({
        ...inc,
        invoiceNumber: assignedInvoice,
        id: makeId('pay'),
        createdAt: nowIso,
      });
      insertedCount++;
    }
  }

  return {
    records: [...newlyCreated, ...nextExisting],
    insertedCount,
    updatedCount,
    unchangedCount,
  };
}

/**
 * Upserts OtherCost records in-place:
 * - Matches by refInvoice (if non-empty) or normalized date+category+description
 * - Identical entries remain unchanged
 */
export function upsertOtherCostsInPlace(
  existing: OtherCostRecord[],
  incoming: Omit<OtherCostRecord, 'id' | 'createdAt'>[],
  makeId: (prefix: string) => string,
  nowIso: string = new Date().toISOString()
): UpsertBatchResult<OtherCostRecord> {
  const nextExisting = [...existing];
  const indexByComposite = new Map<string, number>();

  nextExisting.forEach((c, idx) => {
    const key = [
      String(c.date || '').trim(),
      stableNormalizeString(c.category),
      stableNormalizeString(c.refInvoice || c.description),
    ].join('||');
    indexByComposite.set(key, idx);
  });

  const newlyCreated: OtherCostRecord[] = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const inc of incoming) {
    const key = [
      String(inc.date || '').trim(),
      stableNormalizeString(inc.category),
      stableNormalizeString(inc.refInvoice || inc.description),
    ].join('||');

    const matchIdx = indexByComposite.get(key);
    if (matchIdx !== undefined) {
      const target = nextExisting[matchIdx];
      if (otherCostContentSignature(target) === otherCostContentSignature(inc)) {
        unchangedCount++;
        continue;
      }
      nextExisting[matchIdx] = {
        ...target,
        ...inc,
        id: target.id,
        createdAt: target.createdAt,
      };
      updatedCount++;
    } else {
      newlyCreated.push({
        ...inc,
        id: makeId('cost'),
        createdAt: nowIso,
      });
      insertedCount++;
    }
  }

  return {
    records: [...newlyCreated, ...nextExisting],
    insertedCount,
    updatedCount,
    unchangedCount,
  };
}
