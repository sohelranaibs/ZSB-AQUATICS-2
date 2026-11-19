export type InvoiceAttachmentModule = 'purchase' | 'packing' | 'payment';

export type AttachmentProofCategory =
  | 'Supplier Challan'
  | 'Air Waybill (AWB)'
  | 'Quarantine / Health Cert'
  | 'WeChat / Bank Receipt'
  | 'Other Proof';

export interface InvoiceAttachmentRecord {
  id: string;
  module: InvoiceAttachmentModule;
  recordId: string;
  invoiceNumber: string;
  category: AttachmentProofCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  notes?: string;
  uploadedAt: string;
}

export const INVOICE_ATTACHMENTS_STORAGE_KEY = 'zsb_invoice_attachments_v1';
export const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB per file for local storage safety
export const MAX_ATTACHMENTS_PER_INVOICE = 6;

const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function validateAttachmentUpload(
  fileMeta: { name: string; type: string; size: number },
  existingForRecordCount: number
): { valid: boolean; error?: string } {
  if (existingForRecordCount >= MAX_ATTACHMENTS_PER_INVOICE) {
    return {
      valid: false,
      error: `Maximum ${MAX_ATTACHMENTS_PER_INVOICE} attachments allowed per invoice to preserve local storage speed.`,
    };
  }
  const cleanName = (fileMeta.name || '').trim();
  if (!cleanName) {
    return { valid: false, error: 'Attachment filename is required.' };
  }
  const mime = (fileMeta.type || '').toLowerCase();
  const isAllowed =
    ALLOWED_MIME_PREFIXES.includes(mime) ||
    /\.(jpg|jpeg|png|webp|pdf)$/i.test(cleanName);
  if (!isAllowed) {
    return {
      valid: false,
      error: 'Unsupported file type. Upload JPG, PNG, WEBP, or PDF documents.',
    };
  }
  if ((Number(fileMeta.size) || 0) <= 0) {
    return { valid: false, error: 'Uploaded file is empty.' };
  }
  if (Number(fileMeta.size) > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File exceeds the 2 MB per-file limit. Please compress the photo or PDF first.',
    };
  }
  return { valid: true };
}

export function loadAllInvoiceAttachments(): InvoiceAttachmentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(INVOICE_ATTACHMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllInvoiceAttachments(records: InvoiceAttachmentRecord[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(INVOICE_ATTACHMENTS_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export function getAttachmentsForRecord(
  allRecords: InvoiceAttachmentRecord[],
  module: InvoiceAttachmentModule,
  recordId: string
): InvoiceAttachmentRecord[] {
  return (allRecords || []).filter(
    (item) => item.module === module && item.recordId === recordId
  );
}

export function addAttachmentToList(
  allRecords: InvoiceAttachmentRecord[],
  newRecord: Omit<InvoiceAttachmentRecord, 'id' | 'uploadedAt'> & {
    id?: string;
    uploadedAt?: string;
  }
): {
  valid: boolean;
  error?: string;
  updatedList: InvoiceAttachmentRecord[];
  created?: InvoiceAttachmentRecord;
} {
  const existingCount = getAttachmentsForRecord(
    allRecords,
    newRecord.module,
    newRecord.recordId
  ).length;

  const check = validateAttachmentUpload(
    {
      name: newRecord.fileName,
      type: newRecord.mimeType,
      size: newRecord.sizeBytes,
    },
    existingCount
  );

  if (!check.valid) {
    return { valid: false, error: check.error, updatedList: allRecords };
  }

  const created: InvoiceAttachmentRecord = {
    ...newRecord,
    id:
      newRecord.id ||
      `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    uploadedAt: newRecord.uploadedAt || new Date().toISOString(),
  };

  return {
    valid: true,
    updatedList: [created, ...allRecords],
    created,
  };
}

export function removeAttachmentFromList(
  allRecords: InvoiceAttachmentRecord[],
  attachmentId: string
): InvoiceAttachmentRecord[] {
  return (allRecords || []).filter((item) => item.id !== attachmentId);
}

export function countAttachmentsByRecordKey(
  allRecords: InvoiceAttachmentRecord[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of allRecords || []) {
    const key = `${item.module}:${item.recordId}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
