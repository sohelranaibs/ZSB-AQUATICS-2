import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAttachmentUpload,
  addAttachmentToList,
  removeAttachmentFromList,
  getAttachmentsForRecord,
  countAttachmentsByRecordKey,
  MAX_ATTACHMENT_SIZE_BYTES,
  InvoiceAttachmentRecord,
} from './invoiceAttachments.ts';

test('validateAttachmentUpload enforces MIME types, file size, and per-invoice limits', () => {
  assert.equal(
    validateAttachmentUpload({ name: 'challan.jpg', type: 'image/jpeg', size: 120000 }, 0).valid,
    true
  );
  assert.equal(
    validateAttachmentUpload({ name: 'awb.pdf', type: 'application/pdf', size: 350000 }, 2).valid,
    true
  );
  assert.equal(
    validateAttachmentUpload({ name: 'script.exe', type: 'application/octet-stream', size: 1000 }, 0)
      .valid,
    false
  );
  assert.equal(
    validateAttachmentUpload(
      { name: 'huge.png', type: 'image/png', size: MAX_ATTACHMENT_SIZE_BYTES + 1 },
      0
    ).valid,
    false
  );
  assert.equal(
    validateAttachmentUpload({ name: 'ok.png', type: 'image/png', size: 1000 }, 6).valid,
    false
  );
});

test('addAttachmentToList, getAttachmentsForRecord, countAttachmentsByRecordKey, and removeAttachmentFromList work cleanly', () => {
  let list: InvoiceAttachmentRecord[] = [];

  const res1 = addAttachmentToList(list, {
    id: 'att-1',
    module: 'purchase',
    recordId: 'pur-1',
    invoiceNumber: 'PUR-001',
    category: 'Supplier Challan',
    fileName: 'challan-001.png',
    mimeType: 'image/png',
    sizeBytes: 42000,
    dataUrl: 'data:image/png;base64,AAAA',
  });
  assert.equal(res1.valid, true);
  list = res1.updatedList;

  const res2 = addAttachmentToList(list, {
    id: 'att-2',
    module: 'packing',
    recordId: 'pkg-1',
    invoiceNumber: 'PKG-001',
    category: 'Air Waybill (AWB)',
    fileName: 'awb-392.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 88000,
    dataUrl: 'data:application/pdf;base64,BBBB',
  });
  assert.equal(res2.valid, true);
  list = res2.updatedList;

  assert.equal(getAttachmentsForRecord(list, 'purchase', 'pur-1').length, 1);
  assert.equal(getAttachmentsForRecord(list, 'packing', 'pkg-1').length, 1);
  assert.deepEqual(countAttachmentsByRecordKey(list), {
    'purchase:pur-1': 1,
    'packing:pkg-1': 1,
  });

  list = removeAttachmentFromList(list, 'att-1');
  assert.equal(getAttachmentsForRecord(list, 'purchase', 'pur-1').length, 0);
  assert.equal(list.length, 1);
});
