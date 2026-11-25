import { PackingRecord } from '../types/index.ts';

/**
 * Checks whether a Packing List record matches a real-time search query
 * against its Shipper or Exporter identifiers (`shipper`, `shippingMark`,
 * and `documentsHolder`, plus any rawValues overrides).
 * Supports case-insensitive partial and multi-token queries.
 */
export function matchesPackingShipperOrExporter(
  record: PackingRecord,
  searchQuery: string
): boolean {
  const trimmed = (searchQuery || '').trim().toLowerCase();
  if (!trimmed) return true;

  const shipper = (record.shipper || '').toLowerCase();
  const exporterMark = (record.shippingMark || '').toLowerCase();
  const documentsHolder = (record.documentsHolder || '').toLowerCase();
  const rawShipper = (record.rawValues?.shipper || '').toLowerCase();
  const rawMark = (record.rawValues?.shippingMark || '').toLowerCase();
  const rawHolder = (record.rawValues?.documentsHolder || '').toLowerCase();

  const combined = `${shipper} ${exporterMark} ${documentsHolder} ${rawShipper} ${rawMark} ${rawHolder}`;
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  return tokens.every((tok) => combined.includes(tok));
}

/**
 * Filters Packing List records in real time by Shipper or Exporter name.
 */
export function filterPackingRecordsByShipperOrExporter(
  records: readonly PackingRecord[],
  searchQuery: string
): PackingRecord[] {
  if (!searchQuery || !searchQuery.trim()) {
    return [...records];
  }
  return records.filter((rec) => matchesPackingShipperOrExporter(rec, searchQuery));
}
