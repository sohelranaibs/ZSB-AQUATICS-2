import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPartnerAlertEmailContent,
  collectValidPartnerRecipients,
  escapeNotificationHtml,
  isValidEmailAddress,
  resolvePartnerEmailDirectory,
  setPartnerEmailInMap,
  validatePartnerAlertPayload,
  validatePartnerEmailAddress,
} from './partnerNotifications.ts';

describe('partnerNotifications utilities', () => {
  it('validates email addresses cleanly while allowing empty optional values', () => {
    assert.equal(isValidEmailAddress('partner@zsbaquatics.com'), true);
    assert.equal(isValidEmailAddress('bad-email'), false);

    const empty = validatePartnerEmailAddress('   ');
    assert.equal(empty.valid, true);
    assert.equal(empty.cleanEmail, '');

    const bad = validatePartnerEmailAddress('not-an-email');
    assert.equal(bad.valid, false);
    assert.ok(bad.error);

    const ok = validatePartnerEmailAddress('  Tariqul@ZSBAquatics.COM ');
    assert.equal(ok.valid, true);
    assert.equal(ok.cleanEmail, 'tariqul@zsbaquatics.com');
  });

  it('updates and removes entries in the partner email map using normalized keys', () => {
    const map1 = setPartnerEmailInMap(undefined, 'Tariqul Islam', 'Tariqul@ZSBAquatics.com');
    assert.deepEqual(map1, { 'tariqul islam': 'tariqul@zsbaquatics.com' });

    const map2 = setPartnerEmailInMap(map1, 'Md. Mizanur Rahman', 'mizan@zsbaquatics.com');
    assert.deepEqual(map2, {
      'tariqul islam': 'tariqul@zsbaquatics.com',
      'md. mizanur rahman': 'mizan@zsbaquatics.com',
    });

    const map3 = setPartnerEmailInMap(map2, 'Tariqul Islam', '');
    assert.deepEqual(map3, { 'md. mizanur rahman': 'mizan@zsbaquatics.com' });
  });

  it('resolves partner email directory with profile overrides taking precedence over active team members', () => {
    const resolved = resolvePartnerEmailDirectory(
      ['Md. Mizanur Rahman', 'Md. Sohel Rana', 'Tariqul Islam', 'Suspended Partner'],
      {
        'md. mizanur rahman': 'custom.mizan@zsbaquatics.com',
      },
      [
        { displayName: 'Md. Mizanur Rahman', email: 'managing.partner@zsbaquatics.com', status: 'active' },
        { displayName: 'Md. Sohel Rana', email: 'sohelranaibs@gmail.com', status: 'active' },
        { displayName: 'Suspended Partner', email: 'suspended@zsbaquatics.com', status: 'suspended' },
      ]
    );

    assert.equal(resolved.length, 4);
    assert.deepEqual(resolved[0], {
      partnerKey: 'md. mizanur rahman',
      partnerName: 'Md. Mizanur Rahman',
      email: 'custom.mizan@zsbaquatics.com',
      source: 'profile',
    });
    assert.deepEqual(resolved[1], {
      partnerKey: 'md. sohel rana',
      partnerName: 'Md. Sohel Rana',
      email: 'sohelranaibs@gmail.com',
      source: 'team_member',
    });
    assert.deepEqual(resolved[2], {
      partnerKey: 'tariqul islam',
      partnerName: 'Tariqul Islam',
      email: '',
      source: 'missing',
    });
    assert.deepEqual(resolved[3], {
      partnerKey: 'suspended partner',
      partnerName: 'Suspended Partner',
      email: '',
      source: 'missing',
    });

    const recipients = collectValidPartnerRecipients([
      ...resolved,
      {
        partnerKey: 'duplicate',
        partnerName: 'Duplicate Sohel',
        email: 'SOHELRANAIBS@GMAIL.COM',
        source: 'profile',
      },
    ]);
    assert.equal(recipients.length, 2);
    assert.deepEqual(
      recipients.map((r) => r.email),
      ['custom.mizan@zsbaquatics.com', 'sohelranaibs@gmail.com']
    );
  });

  it('validates server alert payloads and rejects malformed requests', () => {
    const missingBody = validatePartnerAlertPayload(null);
    assert.equal(missingBody.valid, false);

    const badEvent = validatePartnerAlertPayload({
      eventType: 'unknown',
      recipients: [{ partnerName: 'A', email: 'a@example.com' }],
    });
    assert.equal(badEvent.valid, false);

    const noRecipients = validatePartnerAlertPayload({
      eventType: 'partner_withdrawal',
      recipients: [{ partnerName: 'A', email: 'invalid-email' }],
      withdrawal: { id: 'w1', date: '2026-11-14', partnerName: 'A', amount: 5000, updatedTotalBalance: 10000, partnerShares: [] },
    });
    assert.equal(noRecipients.valid, false);

    const validWithdrawal = validatePartnerAlertPayload({
      eventType: 'partner_withdrawal',
      recipients: [
        { partnerName: 'Mizanur', email: 'mizan@zsbaquatics.com' },
        { partnerName: 'Mizanur Dup', email: 'MIZAN@zsbaquatics.com' },
        { partnerName: 'Sohel', email: 'sohel@zsbaquatics.com' },
      ],
      withdrawal: {
        id: 'pwdr-1',
        date: '2026-11-14',
        partnerName: 'Md. Mizanur Rahman',
        amount: 100000,
        updatedTotalBalance: 900000,
        partnerShares: [],
      },
    });
    assert.equal(validWithdrawal.valid, true);
    assert.equal(validWithdrawal.cleanRecipients.length, 2);

    const zeroDistribution = validatePartnerAlertPayload({
      eventType: 'profit_distribution',
      recipients: [{ partnerName: 'Sohel', email: 'sohel@zsbaquatics.com' }],
      profitDistribution: {
        id: 'pdist-1',
        targetYearMonth: '2026-11',
        payoutDate: '2026-11-14',
        calculatedNetProfit: 50000,
        distributedAmount: 0,
        retainedAmount: 50000,
        updatedTotalBalance: 1000000,
        allocations: [],
      },
    });
    assert.equal(zeroDistribution.valid, false);
  });

  it('escapes HTML and renders complete withdrawal alert email subject, HTML, and plain text', () => {
    assert.equal(
      escapeNotificationHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );

    const email = buildPartnerAlertEmailContent({
      eventType: 'partner_withdrawal',
      companyName: 'ZSB AQUATICS',
      currency: 'TK',
      triggeredBy: 'Md. Sohel Rana (Super Admin)',
      recipients: [
        { partnerName: 'Md. Mizanur Rahman', email: 'managing.partner@zsbaquatics.com' },
        { partnerName: 'Md. Sohel Rana', email: 'sohelranaibs@gmail.com' },
      ],
      withdrawal: {
        id: 'pwdr-101',
        date: '2026-11-14',
        partnerName: 'Md. Mizanur Rahman',
        amount: 100000,
        paymentMethod: 'Bank Transfer',
        referenceNo: 'WDR-009',
        notes: 'Draw <test>',
        updatedTotalBalance: 1150000,
        partnerShares: [
          { partnerName: 'Md. Mizanur Rahman', equityPercent: 44.44, netCapital: 400000 },
          { partnerName: 'Md. Sohel Rana', equityPercent: 33.33, netCapital: 300000 },
          { partnerName: 'Tariqul Islam', equityPercent: 22.22, netCapital: 200000 },
        ],
      },
    });

    assert.match(email.subject, /Partner Withdrawal Alert: Md\. Mizanur Rahman/);
    assert.match(email.subject, /TK 100,000\.00/);
    assert.match(email.html, /Automated Treasury Alert &middot; Partner Withdrawal Issued|Partner Withdrawal Issued/);
    assert.match(email.html, /Draw &lt;test&gt;/);
    assert.match(email.html, /44\.44%/);
    assert.match(email.html, /TK 1,150,000\.00/);
    assert.match(email.text, /Amount Deducted: -TK 100,000\.00/);
    assert.match(email.text, /Updated Total Balance: TK 1,150,000\.00/);
  });

  it('renders complete profit distribution alert email content with partner allocations', () => {
    const email = buildPartnerAlertEmailContent({
      eventType: 'profit_distribution',
      companyName: 'ZSB AQUATICS',
      currency: 'TK',
      triggeredBy: 'Md. Sohel Rana (Super Admin)',
      recipients: [
        { partnerName: 'Md. Mizanur Rahman', email: 'managing.partner@zsbaquatics.com' },
        { partnerName: 'Md. Sohel Rana', email: 'sohelranaibs@gmail.com' },
        { partnerName: 'Tariqul Islam', email: 'tariqul@zsbaquatics.com' },
      ],
      profitDistribution: {
        id: 'pdist-202',
        targetYearMonth: '2026-11',
        payoutDate: '2026-11-14',
        calculatedNetProfit: 250000,
        distributedAmount: 250000,
        retainedAmount: 0,
        paymentMethod: 'Bank Transfer',
        referenceNo: 'DIV-2026-11',
        notes: 'November settlement',
        updatedTotalBalance: 900000,
        allocations: [
          { partnerName: 'Md. Mizanur Rahman', equityPercent: 44.44, payoutAmount: 111111.11 },
          { partnerName: 'Md. Sohel Rana', equityPercent: 33.33, payoutAmount: 83333.33 },
          { partnerName: 'Tariqul Islam', equityPercent: 22.22, payoutAmount: 55555.56 },
        ],
      },
    });

    assert.match(email.subject, /Profit Distribution Issued: 2026-11/);
    assert.match(email.subject, /TK 250,000\.00/);
    assert.match(email.html, /Partner Payout Allocation/);
    assert.match(email.html, /TK 111,111\.11/);
    assert.match(email.html, /TK 55,555\.56/);
    assert.match(email.html, /TK 900,000\.00/);
    assert.match(email.text, /Calculated Net Profit: TK 250,000\.00/);
    assert.match(email.text, /Tariqul Islam \(22\.22%\): TK 55,555\.56/);
  });
});
