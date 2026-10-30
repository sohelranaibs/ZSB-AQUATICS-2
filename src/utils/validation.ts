import { PurchaseItemRow, PackingItemRow, PaymentItemRow } from '../types/index.ts';

export interface RowValidationError {
  item?: boolean;
  quantity?: boolean;
  rate?: boolean;
  box?: boolean;
  weight?: boolean;
  description?: boolean;
  debitAmount?: boolean;
  creditAmount?: boolean;
  message: string;
}

export interface FormValidationResult<T> {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
  rowErrors: Record<string, RowValidationError>;
  validItems: T[];
}

export interface PurchaseFormInput {
  invoiceNumber: string;
  date: string;
  supplierName: string;
  overallPreviousAmount: number;
  overallPaidAmount: number;
  rows: PurchaseItemRow[];
}

export interface PackingFormInput {
  invoiceNumber: string;
  packingDate: string;
  shippingMark: string;
  flight: string;
  destination: string;
  shipper: string;
  paymentStatus?: string;
  customRmbAmount?: string;
  rows: PackingItemRow[];
}

export interface SupplierPaymentFormInput {
  invoiceNumber: string;
  date: string;
  supplierName: string;
  overallPreviousAmount: number;
  overallPaidAmount: number;
  rows: PaymentItemRow[];
}

export interface ExporterPaymentFormInput {
  invoiceNumber: string;
  date: string;
  shippingMark: string;
  exporterStatus: string;
  returnRMB?: number;
  overallPreviousAmount: number;
  overallPaidAmount: number;
  rows: PaymentItemRow[];
}

const isValidNumber = (val: unknown): val is number =>
  typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);

const isValidDateString = (val: string): boolean => {
  const trimmed = val.trim();
  if (!trimmed) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(Date.parse(trimmed));
};

export function validatePurchaseForm(
  input: PurchaseFormInput
): FormValidationResult<PurchaseItemRow> {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const rowErrors: Record<string, RowValidationError> = {};
  const validItems: PurchaseItemRow[] = [];

  if (!input.invoiceNumber || !input.invoiceNumber.trim()) {
    const msg = 'Invoice Number is required.';
    fieldErrors.invoiceNumber = msg;
    errors.push(msg);
  }

  if (!isValidDateString(input.date || '')) {
    const msg = 'A valid Bill Date is required.';
    fieldErrors.date = msg;
    errors.push(msg);
  }

  if (!input.supplierName || !input.supplierName.trim()) {
    const msg = 'Supplier selection is required.';
    fieldErrors.supplierName = msg;
    errors.push(msg);
  }

  if (!isValidNumber(input.overallPreviousAmount) || input.overallPreviousAmount < 0) {
    const msg = 'Previous Amount must be a valid non-negative number (≥ 0).';
    fieldErrors.overallPreviousAmount = msg;
    errors.push(msg);
  }

  if (!isValidNumber(input.overallPaidAmount) || input.overallPaidAmount < 0) {
    const msg = 'Paid Amount must be a valid non-negative number (≥ 0).';
    fieldErrors.overallPaidAmount = msg;
    errors.push(msg);
  }

  const touchedRows = input.rows
    .map((row, idx) => ({ row, rowNumber: idx + 1 }))
    .filter(
      ({ row }) =>
        row.item.trim() !== '' || row.quantity !== 0 || row.rate !== 0
    );

  if (touchedRows.length === 0) {
    const msg =
      'At least one purchase item row must be filled with Item/Grade, Quantity (> 0), and Rate (> 0).';
    fieldErrors.rows = msg;
    errors.push(msg);
  } else {
    for (const { row, rowNumber } of touchedRows) {
      const rowIssues: string[] = [];
      const rErr: RowValidationError = { message: '' };

      if (!row.item || !row.item.trim()) {
        rErr.item = true;
        rowIssues.push('select an Item/Grade');
      }

      if (!isValidNumber(row.quantity) || row.quantity <= 0) {
        rErr.quantity = true;
        rowIssues.push('enter a valid Quantity (> 0)');
      }

      if (!isValidNumber(row.rate) || row.rate <= 0) {
        rErr.rate = true;
        rowIssues.push('enter a valid Unit Rate (> 0)');
      }

      if (rowIssues.length > 0) {
        rErr.message = `Row #${String(rowNumber).padStart(2, '0')}: Please ${rowIssues.join(', ')}.`;
        rowErrors[row.id] = rErr;
        errors.push(rErr.message);
      } else {
        validItems.push(row);
      }
    }
  }

  return {
    isValid: errors.length === 0 && validItems.length > 0,
    errors,
    fieldErrors,
    rowErrors,
    validItems,
  };
}

export function validatePackingForm(
  input: PackingFormInput
): FormValidationResult<PackingItemRow> {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const rowErrors: Record<string, RowValidationError> = {};
  const validItems: PackingItemRow[] = [];

  if (!input.invoiceNumber || !input.invoiceNumber.trim()) {
    const msg = 'Packing No. is required.';
    fieldErrors.invoiceNumber = msg;
    errors.push(msg);
  }

  if (!isValidDateString(input.packingDate || '')) {
    const msg = 'A valid Packing Date is required.';
    fieldErrors.packingDate = msg;
    errors.push(msg);
  }

  if (!input.shippingMark || !input.shippingMark.trim()) {
    const msg = 'Shipping Mark is required.';
    fieldErrors.shippingMark = msg;
    errors.push(msg);
  }

  if (!input.flight || !input.flight.trim()) {
    const msg = 'Flight code is required.';
    fieldErrors.flight = msg;
    errors.push(msg);
  }

  if (!input.destination || !input.destination.trim()) {
    const msg = 'Destination is required.';
    fieldErrors.destination = msg;
    errors.push(msg);
  }

  if (!input.shipper || !input.shipper.trim()) {
    const msg = 'Shipper is required.';
    fieldErrors.shipper = msg;
    errors.push(msg);
  }

  if (input.customRmbAmount && input.customRmbAmount.trim() !== '') {
    const parsedRmb = Number(input.customRmbAmount);
    if (!isValidNumber(parsedRmb) || parsedRmb < 0) {
      const msg = 'Estimated RMB (¥) must be a valid non-negative number (≥ 0).';
      fieldErrors.customRmbAmount = msg;
      errors.push(msg);
    }
  }

  const touchedRows = input.rows
    .map((row, idx) => ({ row, rowNumber: idx + 1 }))
    .filter(
      ({ row }) =>
        row.item.trim() !== '' ||
        row.box !== 0 ||
        row.weight !== 0 ||
        row.rate !== 0
    );

  const isNoReport =
    input.paymentStatus === 'NO REPORT' || input.paymentStatus === 'UNPAID';

  if (touchedRows.length === 0) {
    const msg = isNoReport
      ? 'At least one packing manifest row must be filled with Item/Size, Box count (> 0), Weight/Box (> 0), and Rate (≥ 0).'
      : 'At least one packing manifest row must be filled with Item/Size, Box count (> 0), Weight/Box (> 0), and Rate (> 0).';
    fieldErrors.rows = msg;
    errors.push(msg);
  } else {
    for (const { row, rowNumber } of touchedRows) {
      const rowIssues: string[] = [];
      const rErr: RowValidationError = { message: '' };

      if (!row.item || !row.item.trim()) {
        rErr.item = true;
        rowIssues.push('select an Item/Size');
      }

      if (!isValidNumber(row.box) || row.box <= 0) {
        rErr.box = true;
        rowIssues.push('select Box count (> 0)');
      }

      if (!isValidNumber(row.weight) || row.weight <= 0) {
        rErr.weight = true;
        rowIssues.push('select Weight/Box (> 0)');
      }

      if (isNoReport) {
        // If status is "NO REPORT", Rate cell counts from 0 value (rate >= 0)
        if (!isValidNumber(row.rate) || row.rate < 0) {
          rErr.rate = true;
          rowIssues.push('enter a valid Rate (≥ 0)');
        }
      } else {
        // If status is "REPORT" or "PAID", Rate cell must be > 0
        if (!isValidNumber(row.rate) || row.rate <= 0) {
          rErr.rate = true;
          rowIssues.push(`enter a valid Rate (> 0) for ${input.paymentStatus || 'REPORT'} status`);
        }
      }

      if (rowIssues.length > 0) {
        rErr.message = `Row #${String(rowNumber).padStart(2, '0')}: Please ${rowIssues.join(', ')}.`;
        rowErrors[row.id] = rErr;
        errors.push(rErr.message);
      } else {
        validItems.push(row);
      }
    }
  }

  return {
    isValid: errors.length === 0 && validItems.length > 0,
    errors,
    fieldErrors,
    rowErrors,
    validItems,
  };
}

export function validateSupplierPaymentForm(
  input: SupplierPaymentFormInput
): FormValidationResult<PaymentItemRow> {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const rowErrors: Record<string, RowValidationError> = {};
  const validItems: PaymentItemRow[] = [];

  if (!input.invoiceNumber || !input.invoiceNumber.trim()) {
    const msg = 'Invoice Number is required.';
    fieldErrors.invoiceNumber = msg;
    errors.push(msg);
  }

  if (!isValidDateString(input.date || '')) {
    const msg = 'A valid Payment Date is required.';
    fieldErrors.date = msg;
    errors.push(msg);
  }

  if (!input.supplierName || !input.supplierName.trim()) {
    const msg = 'Supplier Name is required.';
    fieldErrors.supplierName = msg;
    errors.push(msg);
  }

  if (!isValidNumber(input.overallPreviousAmount) || input.overallPreviousAmount < 0) {
    const msg = 'Previous Amount must be a valid non-negative number (≥ 0).';
    fieldErrors.overallPreviousAmount = msg;
    errors.push(msg);
  }

  if (!isValidNumber(input.overallPaidAmount) || input.overallPaidAmount < 0) {
    const msg = 'Paid Amount must be a valid non-negative number (≥ 0).';
    fieldErrors.overallPaidAmount = msg;
    errors.push(msg);
  }

  const touchedRows = input.rows
    .map((row, idx) => ({ row, rowNumber: idx + 1 }))
    .filter(
      ({ row }) =>
        row.description.trim() !== '' ||
        row.debitAmount !== 0 ||
        row.creditAmount !== 0
    );

  if (touchedRows.length === 0) {
    const msg =
      'At least one supplier payment row must be filled with Particulars/Description and a Debit or Credit amount (> 0).';
    fieldErrors.rows = msg;
    errors.push(msg);
  } else {
    for (const { row, rowNumber } of touchedRows) {
      const rowIssues: string[] = [];
      const rErr: RowValidationError = { message: '' };

      if (!row.description || !row.description.trim()) {
        rErr.description = true;
        rowIssues.push('enter Payment Particulars/Description');
      }

      if (!isValidNumber(row.debitAmount) || row.debitAmount < 0) {
        rErr.debitAmount = true;
        rowIssues.push('enter a non-negative Debit Amount');
      }

      if (!isValidNumber(row.creditAmount) || row.creditAmount < 0) {
        rErr.creditAmount = true;
        rowIssues.push('enter a non-negative Credit Amount');
      }

      if (
        isValidNumber(row.debitAmount) &&
        isValidNumber(row.creditAmount) &&
        row.debitAmount === 0 &&
        row.creditAmount === 0
      ) {
        rErr.debitAmount = true;
        rErr.creditAmount = true;
        rowIssues.push('enter a Debit or Credit amount greater than 0');
      }

      if (rowIssues.length > 0) {
        rErr.message = `Row #${String(rowNumber).padStart(2, '0')}: Please ${rowIssues.join(', ')}.`;
        rowErrors[row.id] = rErr;
        errors.push(rErr.message);
      } else {
        validItems.push(row);
      }
    }
  }

  return {
    isValid: errors.length === 0 && validItems.length > 0,
    errors,
    fieldErrors,
    rowErrors,
    validItems,
  };
}

export function validateExporterPaymentForm(
  input: ExporterPaymentFormInput
): FormValidationResult<PaymentItemRow> {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};
  const rowErrors: Record<string, RowValidationError> = {};
  const validItems: PaymentItemRow[] = [];

  if (!input.invoiceNumber || !input.invoiceNumber.trim()) {
    const msg = 'Voucher Number is required.';
    fieldErrors.invoiceNumber = msg;
    errors.push(msg);
  }

  if (input.date && input.date.trim() !== '' && !isValidDateString(input.date)) {
    const msg = 'A valid date is required.';
    fieldErrors.date = msg;
    errors.push(msg);
  }

  if (!input.shippingMark || !input.shippingMark.trim()) {
    const msg = 'Shipping Mark is required.';
    fieldErrors.shippingMark = msg;
    errors.push(msg);
  }

  if (!input.exporterStatus || !input.exporterStatus.trim()) {
    const msg = 'Exporter Status is required.';
    fieldErrors.exporterStatus = msg;
    errors.push(msg);
  }

  if (input.returnRMB !== undefined && (!isValidNumber(input.returnRMB) || input.returnRMB < 0)) {
    const msg = 'Return RMB must be a valid non-negative number (≥ 0).';
    fieldErrors.returnRMB = msg;
    errors.push(msg);
  }

  if (!isValidNumber(input.overallPreviousAmount) || input.overallPreviousAmount < 0) {
    const msg = 'Previous / Invoiced Amount must be a valid non-negative number (≥ 0).';
    fieldErrors.overallPreviousAmount = msg;
    errors.push(msg);
  }

  if (!isValidNumber(input.overallPaidAmount) || input.overallPaidAmount < 0) {
    const msg = 'Received / Settled Amount must be a valid non-negative number (≥ 0).';
    fieldErrors.overallPaidAmount = msg;
    errors.push(msg);
  }

  const touchedRows = input.rows
    .map((row, idx) => ({ row, rowNumber: idx + 1 }))
    .filter(
      ({ row }) =>
        row.description.trim() !== '' ||
        row.debitAmount !== 0 ||
        row.creditAmount !== 0
    );

  if (touchedRows.length === 0) {
    const msg =
      'At least one exporter settlement row must be filled with Particulars/Description and a Debit or Credit amount (> 0).';
    fieldErrors.rows = msg;
    errors.push(msg);
  } else {
    for (const { row, rowNumber } of touchedRows) {
      const rowIssues: string[] = [];
      const rErr: RowValidationError = { message: '' };

      if (!row.description || !row.description.trim()) {
        rErr.description = true;
        rowIssues.push('enter Settlement Particulars/Description');
      }

      if (!isValidNumber(row.debitAmount) || row.debitAmount < 0) {
        rErr.debitAmount = true;
        rowIssues.push('enter a non-negative Debit Amount');
      }

      if (!isValidNumber(row.creditAmount) || row.creditAmount < 0) {
        rErr.creditAmount = true;
        rowIssues.push('enter a non-negative Credit Amount');
      }

      if (
        isValidNumber(row.debitAmount) &&
        isValidNumber(row.creditAmount) &&
        row.debitAmount === 0 &&
        row.creditAmount === 0
      ) {
        rErr.debitAmount = true;
        rErr.creditAmount = true;
        rowIssues.push('enter a Debit or Credit amount greater than 0');
      }

      if (rowIssues.length > 0) {
        rErr.message = `Row #${String(rowNumber).padStart(2, '0')}: Please ${rowIssues.join(', ')}.`;
        rowErrors[row.id] = rErr;
        errors.push(rErr.message);
      } else {
        validItems.push(row);
      }
    }
  }

  return {
    isValid: errors.length === 0 && validItems.length > 0,
    errors,
    fieldErrors,
    rowErrors,
    validItems,
  };
}
