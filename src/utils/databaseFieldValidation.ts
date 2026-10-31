export type DatabaseTableType = 'purchase' | 'packing' | 'payment';

export type ExpectedFieldType =
  | 'currency'
  | 'optional_currency'
  | 'signed_currency'
  | 'number'
  | 'integer'
  | 'date'
  | 'phone'
  | 'required_text'
  | 'optional_text';

export interface ColumnValidationSchema {
  fieldKey: string;
  label: string;
  expectedType: ExpectedFieldType;
  expectedFormatLabel: string;
}

export interface FieldValidationResult {
  isValid: boolean;
  fieldKey: string;
  label: string;
  expectedType: ExpectedFieldType;
  expectedFormatLabel: string;
  rawValue: string;
  parsedValue?: string | number | undefined;
  errorMessage?: string;
}

export interface TableValidationSummary {
  totalRecordsChecked: number;
  invalidRecordCount: number;
  invalidCellCount: number;
  invalidRecordIds: string[];
  resultsByRecordId: Record<string, Record<string, FieldValidationResult>>;
}

const PURCHASE_SCHEMA: Record<string, ColumnValidationSchema> = {
  invoiceNumber: {
    fieldKey: 'invoiceNumber',
    label: 'Invoice No',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Document ID (e.g. INV-2026-0001)',
  },
  date: {
    fieldKey: 'date',
    label: 'Date',
    expectedType: 'date',
    expectedFormatLabel: 'Date YYYY-MM-DD',
  },
  description: {
    fieldKey: 'description',
    label: 'Supplier / Description',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Supplier Name',
  },
  contactNumber: {
    fieldKey: 'contactNumber',
    label: 'Contact',
    expectedType: 'phone',
    expectedFormatLabel: 'Phone digits (e.g. 01711-000000)',
  },
  totalQty: {
    fieldKey: 'totalQty',
    label: 'Total Qty',
    expectedType: 'number',
    expectedFormatLabel: 'Numeric quantity >= 0',
  },
  totalAmount: {
    fieldKey: 'totalAmount',
    label: 'Total Amount (Price)',
    expectedType: 'currency',
    expectedFormatLabel: 'Numeric price/amount >= 0 (e.g. 25000)',
  },
  paidAmount: {
    fieldKey: 'paidAmount',
    label: 'Paid Amount',
    expectedType: 'currency',
    expectedFormatLabel: 'Numeric price/amount >= 0 (e.g. 15000)',
  },
  balance: {
    fieldKey: 'balance',
    label: 'Balance',
    expectedType: 'signed_currency',
    expectedFormatLabel: 'Numeric amount (e.g. 10000)',
  },
};

const PACKING_SCHEMA: Record<string, ColumnValidationSchema> = {
  invoiceNumber: {
    fieldKey: 'invoiceNumber',
    label: 'Packing No',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Manifest ID (e.g. PKG-2026-0001)',
  },
  packingDate: {
    fieldKey: 'packingDate',
    label: 'Packing Date',
    expectedType: 'date',
    expectedFormatLabel: 'Date YYYY-MM-DD',
  },
  shippingMark: {
    fieldKey: 'shippingMark',
    label: 'Shipping Mark',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Shipping Mark',
  },
  flight: {
    fieldKey: 'flight',
    label: 'Flight',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Flight Code',
  },
  destination: {
    fieldKey: 'destination',
    label: 'Destination',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Destination',
  },
  shipper: {
    fieldKey: 'shipper',
    label: 'Shipper',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Shipper Name',
  },
  totalBox: {
    fieldKey: 'totalBox',
    label: 'Total Box',
    expectedType: 'integer',
    expectedFormatLabel: 'Whole integer >= 0',
  },
  totalWeight: {
    fieldKey: 'totalWeight',
    label: 'Total Weight (KG)',
    expectedType: 'number',
    expectedFormatLabel: 'Numeric weight >= 0',
  },
  totalAmount: {
    fieldKey: 'totalAmount',
    label: 'Total Value (RMB Price)',
    expectedType: 'currency',
    expectedFormatLabel: 'Numeric price/value >= 0',
  },
  rmbRate: {
    fieldKey: 'rmbRate',
    label: 'RMB Rate',
    expectedType: 'optional_currency',
    expectedFormatLabel: 'Numeric rate >= 0 (e.g. 16.85)',
  },
};

const PAYMENT_SCHEMA: Record<string, ColumnValidationSchema> = {
  invoiceNumber: {
    fieldKey: 'invoiceNumber',
    label: 'Payment No',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Voucher ID (e.g. PAY-2026-0001)',
  },
  date: {
    fieldKey: 'date',
    label: 'Date',
    expectedType: 'date',
    expectedFormatLabel: 'Date YYYY-MM-DD',
  },
  description: {
    fieldKey: 'description',
    label: 'Party / Mark',
    expectedType: 'required_text',
    expectedFormatLabel: 'Non-empty Party or Mark',
  },
  paidAmount: {
    fieldKey: 'paidAmount',
    label: 'Paid Amount (Price)',
    expectedType: 'currency',
    expectedFormatLabel: 'Numeric amount >= 0',
  },
  balance: {
    fieldKey: 'balance',
    label: 'Balance',
    expectedType: 'signed_currency',
    expectedFormatLabel: 'Numeric balance amount',
  },
  exportGoodsRef: {
    fieldKey: 'exportGoodsRef',
    label: 'Export Ref',
    expectedType: 'optional_text',
    expectedFormatLabel: 'Optional text reference',
  },
};

export function getDatabaseTableSchema(
  dbType: DatabaseTableType
): Record<string, ColumnValidationSchema> {
  if (dbType === 'purchase') return PURCHASE_SCHEMA;
  if (dbType === 'packing') return PACKING_SCHEMA;
  return PAYMENT_SCHEMA;
}

const STRICT_NUMERIC_REGEX = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const STRICT_INTEGER_REGEX = /^[+-]?\d+$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const PHONE_REGEX = /^[0-9+\-().,/\s]+$/;

function isValidCalendarDate(raw: string): boolean {
  const match = ISO_DATE_REGEX.exec(raw.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDays;
}

export function validateDatabaseCellValue(
  dbType: DatabaseTableType,
  fieldKey: string,
  rawValue: unknown
): FieldValidationResult {
  const schemaMap = getDatabaseTableSchema(dbType);
  const schema: ColumnValidationSchema = schemaMap[fieldKey] || {
    fieldKey,
    label: fieldKey,
    expectedType: 'optional_text',
    expectedFormatLabel: 'Text',
  };

  const strValue =
    rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();

  const baseResult = {
    fieldKey: schema.fieldKey,
    label: schema.label,
    expectedType: schema.expectedType,
    expectedFormatLabel: schema.expectedFormatLabel,
    rawValue: strValue,
  };

  switch (schema.expectedType) {
    case 'currency':
    case 'number': {
      if (strValue === '') {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `${schema.label} is required (${schema.expectedFormatLabel}).`,
        };
      }
      // Allow commas in formatted numbers only if strictly digits, e.g. 12,500.50 -> strip commas
      const normalized = strValue.replace(/,/g, '');
      if (!STRICT_NUMERIC_REGEX.test(normalized)) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid format in ${schema.label}: expected numeric value, got "${strValue}".`,
        };
      }
      const num = Number(normalized);
      if (!Number.isFinite(num)) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid number in ${schema.label}.`,
        };
      }
      if (num < 0) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `${schema.label} cannot be negative (${strValue}).`,
        };
      }
      return {
        ...baseResult,
        isValid: true,
        parsedValue: num,
      };
    }

    case 'optional_currency': {
      if (strValue === '') {
        return {
          ...baseResult,
          isValid: true,
          parsedValue: undefined,
        };
      }
      const normalized = strValue.replace(/,/g, '');
      if (!STRICT_NUMERIC_REGEX.test(normalized)) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid format in ${schema.label}: expected numeric rate, got "${strValue}".`,
        };
      }
      const num = Number(normalized);
      if (!Number.isFinite(num) || num < 0) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `${schema.label} must be a non-negative number.`,
        };
      }
      return {
        ...baseResult,
        isValid: true,
        parsedValue: num,
      };
    }

    case 'signed_currency': {
      if (strValue === '') {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `${schema.label} is required (${schema.expectedFormatLabel}).`,
        };
      }
      const normalized = strValue.replace(/,/g, '');
      if (!STRICT_NUMERIC_REGEX.test(normalized)) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid format in ${schema.label}: expected numeric amount, got "${strValue}".`,
        };
      }
      const num = Number(normalized);
      if (!Number.isFinite(num)) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid number in ${schema.label}.`,
        };
      }
      return {
        ...baseResult,
        isValid: true,
        parsedValue: num,
      };
    }

    case 'integer': {
      if (strValue === '') {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `${schema.label} is required (${schema.expectedFormatLabel}).`,
        };
      }
      const normalized = strValue.replace(/,/g, '');
      if (!STRICT_INTEGER_REGEX.test(normalized)) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid format in ${schema.label}: expected whole integer, got "${strValue}".`,
        };
      }
      const num = Number(normalized);
      if (!Number.isSafeInteger(num) || num < 0) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `${schema.label} must be a whole integer >= 0.`,
        };
      }
      return {
        ...baseResult,
        isValid: true,
        parsedValue: num,
      };
    }

    case 'date': {
      if (!isValidCalendarDate(strValue)) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid date in ${schema.label}: expected YYYY-MM-DD, got "${strValue || 'empty'}".`,
        };
      }
      return {
        ...baseResult,
        isValid: true,
        parsedValue: strValue,
      };
    }

    case 'phone': {
      if (strValue === '' || strValue === '-') {
        return {
          ...baseResult,
          isValid: true,
          parsedValue: strValue,
        };
      }
      const digitCount = (strValue.match(/\d/g) || []).length;
      if (!PHONE_REGEX.test(strValue) || digitCount < 3) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `Invalid contact format in ${schema.label}: expected phone digits, got "${strValue}".`,
        };
      }
      return {
        ...baseResult,
        isValid: true,
        parsedValue: strValue,
      };
    }

    case 'required_text': {
      if (strValue.length === 0) {
        return {
          ...baseResult,
          isValid: false,
          errorMessage: `${schema.label} cannot be empty.`,
        };
      }
      return {
        ...baseResult,
        isValid: true,
        parsedValue: strValue,
      };
    }

    case 'optional_text':
    default:
      return {
        ...baseResult,
        isValid: true,
        parsedValue: strValue,
      };
  }
}

export function validateDatabaseRecord(
  dbType: DatabaseTableType,
  record: Record<string, unknown>,
  draftOverrides?: Record<string, string>
): Record<string, FieldValidationResult> {
  const schemaMap = getDatabaseTableSchema(dbType);
  const results: Record<string, FieldValidationResult> = {};

  for (const fieldKey of Object.keys(schemaMap)) {
    const hasDraft =
      draftOverrides !== undefined &&
      Object.prototype.hasOwnProperty.call(draftOverrides, fieldKey);
    const valueToValidate = hasDraft ? draftOverrides[fieldKey] : record[fieldKey];
    results[fieldKey] = validateDatabaseCellValue(dbType, fieldKey, valueToValidate);
  }

  return results;
}

export function summarizeTableValidation(
  dbType: DatabaseTableType,
  records: Array<{ id: string } & Record<string, unknown>>,
  cellDraftsByRecordId: Record<string, Record<string, string>> = {}
): TableValidationSummary {
  const resultsByRecordId: Record<string, Record<string, FieldValidationResult>> = {};
  const invalidRecordIds: string[] = [];
  let invalidCellCount = 0;

  for (const rec of records) {
    const drafts = cellDraftsByRecordId[rec.id];
    const fieldResults = validateDatabaseRecord(dbType, rec, drafts);
    resultsByRecordId[rec.id] = fieldResults;

    let recordHasInvalid = false;
    for (const res of Object.values(fieldResults)) {
      if (!res.isValid) {
        invalidCellCount += 1;
        recordHasInvalid = true;
      }
    }
    if (recordHasInvalid) {
      invalidRecordIds.push(rec.id);
    }
  }

  return {
    totalRecordsChecked: records.length,
    invalidRecordCount: invalidRecordIds.length,
    invalidCellCount,
    invalidRecordIds,
    resultsByRecordId,
  };
}
