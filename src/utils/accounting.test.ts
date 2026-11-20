import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDateRangeStatement,
  calculateVatBreakdown,
  computeAccountingSummaries,
  findPotentialDuplicate,
  formatExpensesCsv,
  sanitizeExpenseForViewer,
} from './accounting';

test('calculateVatBreakdown computes 20% and 10% Turkish VAT accurately', () => {
  const b20 = calculateVatBreakdown(2460, 20);
  assert.equal(b20.netAmount, 2050);
  assert.equal(b20.vatAmount, 410);
  assert.equal(b20.grossAmount, 2460);

  const b10 = calculateVatBreakdown(1100, 10);
  assert.equal(b10.netAmount, 1000);
  assert.equal(b10.vatAmount, 100);

  const b0 = calculateVatBreakdown(500, 0);
  assert.equal(b0.netAmount, 500);
  assert.equal(b0.vatAmount, 0);
});

test('findPotentialDuplicate detects matching receipt number or merchant+date+amount on non-deleted expenses', () => {
  const existing = [
    { id: 1, merchant: 'Anadolu Akaryakıt A.Ş.', receiptNumber: '0482', amount: 2460, expenseDate: '2026-11-18', isDeleted: false },
    { id: 2, merchant: 'Silinen Firma', receiptNumber: '9999', amount: 100, expenseDate: '2026-11-18', isDeleted: true },
  ];

  const dupByReceipt = findPotentialDuplicate(
    { merchant: 'Anadolu Akaryakıt', receiptNumber: '0482', amount: 2460, expenseDate: '2026-11-18' },
    existing
  );
  assert.equal(dupByReceipt?.id, 1);

  const noDupForDeleted = findPotentialDuplicate(
    { merchant: 'Silinen Firma', receiptNumber: '9999', amount: 100, expenseDate: '2026-11-18' },
    existing
  );
  assert.equal(noDupForDeleted, null);
});

test('sanitizeExpenseForViewer strips GPS coordinates for ortak and calisan but keeps them for admin', () => {
  const sample = { id: 10, merchant: 'Test', latitude: 41.0082, longitude: 28.9784, locationAccuracy: 12 };

  const adminView = sanitizeExpenseForViewer(sample, 'admin');
  assert.equal(adminView.latitude, 41.0082);
  assert.equal(adminView.longitude, 28.9784);

  const ortakView = sanitizeExpenseForViewer(sample, 'ortak');
  assert.equal(ortakView.latitude, null);
  assert.equal(ortakView.longitude, null);

  const calisanView = sanitizeExpenseForViewer(sample, 'calisan');
  assert.equal(calisanView.latitude, null);
  assert.equal(calisanView.longitude, null);
});

test('computeAccountingSummaries deducts bulk payouts from receivable balances', () => {
  const summary = computeAccountingSummaries(
    [
      {
        id: 1,
        userId: 1,
        userName: 'Mehmet Kaya',
        userRole: 'calisan',
        merchant: 'Shell',
        amount: 2400,
        vatRate: 20,
        vatAmount: 400,
        netAmount: 2000,
        expenseDate: '2026-11-18',
        paymentMethod: 'kisisel_kart',
        status: 'onaylandi',
        isDeleted: false,
      },
      {
        id: 2,
        userId: 2,
        userName: 'Ayşe Demir',
        userRole: 'ortak',
        merchant: 'THY',
        amount: 3300,
        vatRate: 10,
        vatAmount: 300,
        netAmount: 3000,
        expenseDate: '2026-11-18',
        paymentMethod: 'sirket_karti',
        status: 'onaylandi',
        isDeleted: false,
      },
    ],
    [
      {
        id: 1,
        userId: 1,
        userName: 'Mehmet Kaya',
        userRole: 'calisan',
        amount: 1000,
        payoutDate: '2026-11-18',
        paymentChannel: 'havale_eft',
      },
    ]
  );

  assert.equal(summary.totalGross, 5700);
  assert.equal(summary.totalPayouts, 1000);
  assert.equal(summary.pendingReimbursementAmount, 1400);
  const mehmet = summary.userBalances.find((u) => u.userId === 1);
  assert.equal(mehmet?.netReceivableBalance, 1400);
});

test('buildDateRangeStatement calculates opening balance, period movements, and closing balance', () => {
  const expenses = [
    {
      id: 1,
      userId: 1,
      userName: 'Mehmet Kaya',
      userRole: 'calisan',
      merchant: 'Önceki Ay Fişi',
      amount: 1000,
      vatRate: 20,
      vatAmount: 166.67,
      netAmount: 833.33,
      expenseDate: '2026-10-25',
      paymentMethod: 'kisisel_kart',
      status: 'onaylandi',
      isDeleted: false,
    },
    {
      id: 2,
      userId: 1,
      userName: 'Mehmet Kaya',
      userRole: 'calisan',
      merchant: 'Dönem İçi Yakıt',
      amount: 2400,
      vatRate: 20,
      vatAmount: 400,
      netAmount: 2000,
      expenseDate: '2026-11-10',
      paymentMethod: 'kisisel_kart',
      status: 'onaylandi',
      isDeleted: false,
    },
  ];
  const payouts = [
    {
      id: 1,
      userId: 1,
      userName: 'Mehmet Kaya',
      userRole: 'calisan',
      amount: 1500,
      payoutDate: '2026-11-15',
      paymentChannel: 'havale_eft',
      referenceNo: 'EFT-901',
    },
  ];

  const stmt = buildDateRangeStatement(expenses, payouts, '2026-11-01', '2026-11-30', 1);
  assert.equal(stmt.openingBalance, 1000);
  assert.equal(stmt.periodExpenseTotal, 2400);
  assert.equal(stmt.periodPayoutTotal, 1500);
  assert.equal(stmt.closingBalance, 1900);
  assert.equal(stmt.movements.length, 2);
  assert.equal(stmt.movements[0].runningBalance, 3400);
  assert.equal(stmt.movements[1].runningBalance, 1900);

  const filteredStmt = buildDateRangeStatement(
    [{ ...expenses[1], category: 'Akaryakıt & Ulaşım' }],
    payouts,
    '2026-11-01',
    '2026-11-30',
    1,
    'Yemek & Temsil'
  );
  assert.equal(filteredStmt.movements.length, 0);
  assert.equal(filteredStmt.periodExpenseTotal, 0);
});

test('formatExpensesCsv omits coordinate columns and KDV/TDHP columns cleanly', () => {
  const rows = [
    {
      id: 1,
      expenseDate: '2026-11-18',
      userName: 'Ali',
      userRole: 'calisan',
      merchant: 'Kafe',
      receiptNumber: '12',
      category: 'Yemek & Temsil',
      paymentMethod: 'kisisel_kart',
      amount: 110,
      description: 'Öğle yemeği',
      latitude: 41.01,
      longitude: 28.97,
    },
  ];
  const nonAdminCsv = formatExpensesCsv(rows, false);
  assert.equal(nonAdminCsv.includes('Enlem'), false);
  assert.equal(nonAdminCsv.includes('KDV'), false);
  assert.equal(nonAdminCsv.includes('41.01'), false);

  const adminCsv = formatExpensesCsv(rows, true);
  assert.equal(adminCsv.includes('Enlem'), true);
  assert.equal(adminCsv.includes('41.01'), true);
  assert.equal(adminCsv.includes('110.00'), true);
});
