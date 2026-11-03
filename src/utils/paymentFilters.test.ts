import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchesPaymentSearch, filterPaymentRecords } from './paymentFilters.ts';
import { PaymentRecord } from '../types/index.ts';

describe('paymentFilters real-time search logic', () => {
  const samplePayments: PaymentRecord[] = [
    {
      id: 'pay-101',
      invoiceNumber: 'PAY-2026-0001',
      date: '2026-10-15',
      description: 'AL-MADINA FISH TRADERS',
      contactNumber: '01711122233',
      totalAmount: 50000,
      previousAmount: 0,
      paidAmount: 50000,
      balance: 0,
      status: 'PAID',
      returnRMB: 0,
      exportGoodsRef: 'PUR-CHALLAN-889',
      paymentCategory: 'supplier',
      remarks: 'Paid via Dutch Bangla Bank online transfer',
      items: [
        {
          id: '1',
          date: '2026-10-15',
          description: 'Payment to AL-MADINA via DBBL',
          debitAmount: 0,
          creditAmount: 50000,
          balance: 0,
          status: 'PAID',
        },
      ],
      createdAt: '2026-10-15T10:00:00Z',
    },
    {
      id: 'pay-102',
      invoiceNumber: 'PAY-2026-0002',
      date: '2026-10-18',
      description: 'HASAN VAI LOCAL FISH',
      contactNumber: '01822233344',
      totalAmount: 35000,
      previousAmount: 15000,
      paidAmount: 20000,
      balance: 15000,
      status: 'REPORT',
      returnRMB: 0,
      exportGoodsRef: 'INV-2026-0042',
      paymentCategory: 'supplier',
      remarks: 'Cash advance against Lot 4 Eel fish',
      items: [
        {
          id: '1',
          date: '2026-10-18',
          description: 'Cash advance for Eel Lot 4',
          debitAmount: 0,
          creditAmount: 20000,
          balance: 15000,
          status: 'REPORT',
        },
      ],
      createdAt: '2026-10-18T12:00:00Z',
    },
    {
      id: 'exp-201',
      invoiceNumber: 'EXP-PAY-0085',
      date: '2026-10-20',
      description: 'GUANGZHOU AQUA IMPORTS',
      shippingMark: 'GZ-SEA-09',
      contactNumber: '+861380000000',
      totalAmount: 120000,
      previousAmount: 0,
      paidAmount: 120000,
      balance: 0,
      status: 'PAID',
      returnRMB: 7500,
      exportGoodsRef: 'PKG-2026-0099',
      paymentCategory: 'exporter',
      remarks: 'WeChat Pay RMB settled full consignment',
      items: [
        {
          id: '1',
          date: '2026-10-20',
          description: 'Air shipment full clearance',
          debitAmount: 0,
          creditAmount: 120000,
          balance: 0,
          status: 'PAID',
        },
      ],
      createdAt: '2026-10-20T15:00:00Z',
    },
  ];

  it('matches all records when search query is empty or whitespace', () => {
    assert.equal(matchesPaymentSearch(samplePayments[0], ''), true);
    assert.equal(matchesPaymentSearch(samplePayments[0], '   '), true);
    const results = filterPaymentRecords(samplePayments, { searchQuery: '' });
    assert.equal(results.length, 3);
  });

  it('filters visible rows in real-time by supplier name', () => {
    // Exact or partial name match
    const madinaResults = filterPaymentRecords(samplePayments, { searchQuery: 'Madina' });
    assert.equal(madinaResults.length, 1);
    assert.equal(madinaResults[0].invoiceNumber, 'PAY-2026-0001');

    const hasanResults = filterPaymentRecords(samplePayments, { searchQuery: 'hasan' });
    assert.equal(hasanResults.length, 1);
    assert.equal(hasanResults[0].invoiceNumber, 'PAY-2026-0002');

    const guangzhouResults = filterPaymentRecords(samplePayments, { searchQuery: 'GUANGZHOU' });
    assert.equal(guangzhouResults.length, 1);
    assert.equal(guangzhouResults[0].invoiceNumber, 'EXP-PAY-0085');
  });

  it('filters visible rows in real-time by reference ID (voucher number or exportGoodsRef)', () => {
    // Voucher invoice number search
    const voucherResults = filterPaymentRecords(samplePayments, { searchQuery: 'PAY-2026-0002' });
    assert.equal(voucherResults.length, 1);
    assert.equal(voucherResults[0].description, 'HASAN VAI LOCAL FISH');

    // Partial voucher suffix
    const suffixResults = filterPaymentRecords(samplePayments, { searchQuery: '0085' });
    assert.equal(suffixResults.length, 1);
    assert.equal(suffixResults[0].invoiceNumber, 'EXP-PAY-0085');

    // Linked purchase invoice / challan reference ID
    const refResults = filterPaymentRecords(samplePayments, { searchQuery: 'PUR-CHALLAN-889' });
    assert.equal(refResults.length, 1);
    assert.equal(refResults[0].invoiceNumber, 'PAY-2026-0001');

    const pkgRefResults = filterPaymentRecords(samplePayments, { searchQuery: 'PKG-2026-0099' });
    assert.equal(pkgRefResults.length, 1);
    assert.equal(pkgRefResults[0].invoiceNumber, 'EXP-PAY-0085');
  });

  it('filters visible rows in real-time by payment remarks', () => {
    // Remarks: DBBL / Dutch Bangla Bank
    const bankResults = filterPaymentRecords(samplePayments, { searchQuery: 'Dutch Bangla' });
    assert.equal(bankResults.length, 1);
    assert.equal(bankResults[0].invoiceNumber, 'PAY-2026-0001');

    // Remarks: Cash advance / Eel Lot 4
    const cashResults = filterPaymentRecords(samplePayments, { searchQuery: 'cash advance' });
    assert.equal(cashResults.length, 1);
    assert.equal(cashResults[0].invoiceNumber, 'PAY-2026-0002');

    // Remarks: WeChat Pay
    const wechatResults = filterPaymentRecords(samplePayments, { searchQuery: 'WeChat Pay' });
    assert.equal(wechatResults.length, 1);
    assert.equal(wechatResults[0].invoiceNumber, 'EXP-PAY-0085');
  });

  it('supports multi-token queries combining supplier name, reference ID, and remarks', () => {
    // Supplier name + remarks keyword
    const multiResults = filterPaymentRecords(samplePayments, { searchQuery: 'Hasan cash' });
    assert.equal(multiResults.length, 1);
    assert.equal(multiResults[0].invoiceNumber, 'PAY-2026-0002');

    // Reference ID + remarks
    const multiResults2 = filterPaymentRecords(samplePayments, { searchQuery: '889 transfer' });
    assert.equal(multiResults2.length, 1);
    assert.equal(multiResults2[0].invoiceNumber, 'PAY-2026-0001');
  });

  it('returns empty array when no payment records match the query', () => {
    const noMatch = filterPaymentRecords(samplePayments, { searchQuery: 'NonExistentSupplierXYZ' });
    assert.equal(noMatch.length, 0);
  });
});
