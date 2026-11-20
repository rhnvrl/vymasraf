export type UserRole = 'admin' | 'ortak' | 'calisan';
export type ExpenseStatus = 'beklemede' | 'onaylandi' | 'odendi' | 'reddedildi';
export type PaymentMethod = 'sirket_karti' | 'sirket_nakit' | 'kisisel_kart' | 'ortak_cari';
export type DocumentType = 'fis' | 'fatura' | 'e-fatura' | 'diger';

export interface VatBreakdown {
  grossAmount: number;
  vatRate: number;
  vatAmount: number;
  netAmount: number;
}

export const EXPENSE_CATEGORIES = [
  { label: 'Yemek & Temsil', accountCode: '770', defaultVatRate: 10 },
  { label: 'Akaryakıt & Ulaşım', accountCode: '760', defaultVatRate: 20 },
  { label: 'Konaklama', accountCode: '760', defaultVatRate: 10 },
  { label: 'Ofis & Kırtasiye', accountCode: '770', defaultVatRate: 20 },
  { label: 'Yazılım & İletişim', accountCode: '770', defaultVatRate: 20 },
  { label: 'Bakım & Onarım', accountCode: '740', defaultVatRate: 20 },
  { label: 'Diğer', accountCode: '770', defaultVatRate: 20 },
] as const;

export const TDHP_ACCOUNTS: Record<string, string> = {
  '730': '730 · Genel Üretim Giderleri',
  '740': '740 · Hizmet Üretim Maliyeti',
  '760': '760 · Pazarlama Satış ve Dağıtım',
  '770': '770 · Genel Yönetim Giderleri',
};

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; tdhpCounterAccount: string; requiresReimbursement: boolean }> = {
  sirket_karti: { label: 'Şirket Kredi Kartı', tdhpCounterAccount: '309', requiresReimbursement: false },
  sirket_nakit: { label: 'Şirket Kasası (Nakit)', tdhpCounterAccount: '100', requiresReimbursement: false },
  kisisel_kart: { label: 'Kişisel Ödeme (Alacak)', tdhpCounterAccount: '335', requiresReimbursement: true },
  ortak_cari: { label: 'Ortak Ödemesi (Alacak)', tdhpCounterAccount: '331', requiresReimbursement: true },
};

export function calculateVatBreakdown(grossAmount: number, vatRate: number): VatBreakdown {
  const safeGross = Math.max(0, Number.isFinite(grossAmount) ? grossAmount : 0);
  const safeRate = Math.max(0, Number.isFinite(vatRate) ? vatRate : 0);
  if (safeGross === 0) {
    return { grossAmount: 0, vatRate: safeRate, vatAmount: 0, netAmount: 0 };
  }
  if (safeRate === 0) {
    const rounded = roundCurrency(safeGross);
    return { grossAmount: rounded, vatRate: 0, vatAmount: 0, netAmount: rounded };
  }
  const netAmount = roundCurrency(safeGross / (1 + safeRate / 100));
  const vatAmount = roundCurrency(safeGross - netAmount);
  return {
    grossAmount: roundCurrency(safeGross),
    vatRate: safeRate,
    vatAmount,
    netAmount,
  };
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function suggestAccountCodeForCategory(category: string): string {
  const found = EXPENSE_CATEGORIES.find((c) => c.label === category);
  return found ? found.accountCode : '770';
}

export interface ExpenseLike {
  id?: number;
  merchant: string;
  receiptNumber?: string | null;
  amount: number;
  vatAmount?: number | null;
  netAmount?: number | null;
  vatRate?: number | null;
  expenseDate: string;
  paymentMethod?: string | null;
  status?: string | null;
  isDeleted?: boolean | null;
  userId?: number;
  userName?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
}

export function findPotentialDuplicate(
  candidate: { merchant: string; receiptNumber?: string; amount: number; expenseDate: string },
  existing: ExpenseLike[]
): ExpenseLike | null {
  const normMerchant = candidate.merchant.trim().toLocaleLowerCase('tr-TR');
  const normReceipt = (candidate.receiptNumber || '').trim().toLowerCase();

  for (const item of existing) {
    if (item.isDeleted) continue;
    const itemMerchant = item.merchant.trim().toLocaleLowerCase('tr-TR');
    const itemReceipt = (item.receiptNumber || '').trim().toLowerCase();

    if (
      normReceipt.length >= 2 &&
      itemReceipt === normReceipt &&
      item.expenseDate === candidate.expenseDate &&
      Math.abs(item.amount - candidate.amount) < 0.01
    ) {
      return item;
    }

    if (
      itemMerchant === normMerchant &&
      item.expenseDate === candidate.expenseDate &&
      Math.abs(item.amount - candidate.amount) < 0.01
    ) {
      return item;
    }
  }
  return null;
}

export interface PayoutLike {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  amount: number;
  payoutDate: string;
  paymentChannel: string;
  referenceNo?: string | null;
  description?: string | null;
}

export interface ReimbursementSummaryRow {
  userId: number;
  userName: string;
  role: string;
  totalSpent: number;
  reimbursablePending: number;
  reimbursablePaid: number;
  payoutsTotal: number;
  netReceivableBalance: number;
  companyCardTotal: number;
  totalVatDeductible: number;
}

export function computeAccountingSummaries(
  items: Array<ExpenseLike & { userId: number; userName: string; userRole: string }>,
  payoutList: PayoutLike[] = []
) {
  let totalGross = 0;
  let totalNet = 0;
  let totalVat = 0;
  let pendingApprovalCount = 0;
  let pendingApprovalAmount = 0;
  let totalPayouts = 0;
  let totalReimbursableUnsettled = 0;

  const byVatRate: Record<number, { rate: number; net: number; vat: number; gross: number; count: number }> = {};
  const byUserMap = new Map<number, ReimbursementSummaryRow>();

  const ensureUserRow = (userId: number, userName: string, role: string) => {
    if (!byUserMap.has(userId)) {
      byUserMap.set(userId, {
        userId,
        userName,
        role,
        totalSpent: 0,
        reimbursablePending: 0,
        reimbursablePaid: 0,
        payoutsTotal: 0,
        netReceivableBalance: 0,
        companyCardTotal: 0,
        totalVatDeductible: 0,
      });
    }
    return byUserMap.get(userId)!;
  };

  for (const item of items) {
    if (item.isDeleted) continue;
    const gross = roundCurrency(item.amount || 0);
    const rate = item.vatRate ?? 0;
    const vat = item.vatAmount != null ? roundCurrency(item.vatAmount) : calculateVatBreakdown(gross, rate).vatAmount;
    const net = item.netAmount != null ? roundCurrency(item.netAmount) : roundCurrency(gross - vat);

    if (item.status !== 'reddedildi') {
      totalGross = roundCurrency(totalGross + gross);
      totalNet = roundCurrency(totalNet + net);
      totalVat = roundCurrency(totalVat + vat);

      if (!byVatRate[rate]) {
        byVatRate[rate] = { rate, net: 0, vat: 0, gross: 0, count: 0 };
      }
      byVatRate[rate].net = roundCurrency(byVatRate[rate].net + net);
      byVatRate[rate].vat = roundCurrency(byVatRate[rate].vat + vat);
      byVatRate[rate].gross = roundCurrency(byVatRate[rate].gross + gross);
      byVatRate[rate].count += 1;
    }

    if (item.status === 'beklemede') {
      pendingApprovalCount += 1;
      pendingApprovalAmount = roundCurrency(pendingApprovalAmount + gross);
    }

    const row = ensureUserRow(item.userId, item.userName, item.userRole);
    if (item.status !== 'reddedildi') {
      row.totalSpent = roundCurrency(row.totalSpent + gross);
      row.totalVatDeductible = roundCurrency(row.totalVatDeductible + vat);

      const method = (item.paymentMethod || 'kisisel_kart') as PaymentMethod;
      const isReimbursable = PAYMENT_METHODS[method]?.requiresReimbursement ?? true;
      if (isReimbursable) {
        if (item.status === 'odendi') {
          row.reimbursablePaid = roundCurrency(row.reimbursablePaid + gross);
        } else {
          row.reimbursablePending = roundCurrency(row.reimbursablePending + gross);
          totalReimbursableUnsettled = roundCurrency(totalReimbursableUnsettled + gross);
        }
      } else {
        row.companyCardTotal = roundCurrency(row.companyCardTotal + gross);
      }
    }
  }

  for (const payout of payoutList) {
    const amt = roundCurrency(payout.amount || 0);
    totalPayouts = roundCurrency(totalPayouts + amt);
    const row = ensureUserRow(payout.userId, payout.userName, payout.userRole);
    row.payoutsTotal = roundCurrency(row.payoutsTotal + amt);
  }

  let pendingReimbursementAmount = 0;
  for (const row of byUserMap.values()) {
    row.netReceivableBalance = roundCurrency(row.reimbursablePending - row.payoutsTotal);
    pendingReimbursementAmount = roundCurrency(pendingReimbursementAmount + row.netReceivableBalance);
  }

  return {
    totalGross,
    totalNet,
    totalVat,
    pendingApprovalCount,
    pendingApprovalAmount,
    totalPayouts,
    totalReimbursableUnsettled,
    pendingReimbursementAmount,
    vatBreakdownByRate: Object.values(byVatRate).sort((a, b) => a.rate - b.rate),
    userBalances: Array.from(byUserMap.values()).sort((a, b) => b.netReceivableBalance - a.netReceivableBalance),
  };
}

export interface StatementMovement {
  id: string;
  date: string;
  type: 'masraf' | 'odeme';
  userName: string;
  userRole: string;
  title: string;
  detail: string;
  accountCode: string;
  vatAmount: number;
  grossAmount: number;
  receivableEffect: number;
  runningBalance: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DateRangeStatement {
  startDate: string;
  endDate: string;
  filterUserId: number | 'all';
  filterCategory?: string;
  openingBalance: number;
  periodExpenseTotal: number;
  periodReimbursableTotal: number;
  periodVatTotal: number;
  periodPayoutTotal: number;
  closingBalance: number;
  movements: StatementMovement[];
}

export function buildDateRangeStatement(
  items: Array<ExpenseLike & { id: number; userId: number; userName: string; userRole: string; accountCode?: string; category?: string }>,
  payoutList: PayoutLike[],
  startDate: string,
  endDate: string,
  filterUserId: number | 'all' = 'all',
  filterCategory: string = 'all'
): DateRangeStatement {
  const matchesUser = (uid: number) => filterUserId === 'all' || uid === filterUserId;
  const matchesCategory = (cat?: string) => !filterCategory || filterCategory === 'all' || cat === filterCategory;

  let openingBalance = 0;
  let periodExpenseTotal = 0;
  let periodReimbursableTotal = 0;
  let periodVatTotal = 0;
  let periodPayoutTotal = 0;

  const rawMovements: Array<Omit<StatementMovement, 'runningBalance'>> = [];

  for (const item of items) {
    if (item.isDeleted || item.status === 'reddedildi' || !matchesUser(item.userId) || !matchesCategory(item.category)) {
      continue;
    }
    const gross = roundCurrency(item.amount || 0);
    const rate = item.vatRate ?? 0;
    const vat = item.vatAmount != null ? roundCurrency(item.vatAmount) : calculateVatBreakdown(gross, rate).vatAmount;
    const method = (item.paymentMethod || 'kisisel_kart') as PaymentMethod;
    const isReimbursable = (PAYMENT_METHODS[method]?.requiresReimbursement ?? true) && item.status !== 'odendi';
    const effect = isReimbursable ? gross : 0;

    if (item.expenseDate < startDate) {
      openingBalance = roundCurrency(openingBalance + effect);
    } else if (item.expenseDate <= endDate) {
      periodExpenseTotal = roundCurrency(periodExpenseTotal + gross);
      periodVatTotal = roundCurrency(periodVatTotal + vat);
      if (isReimbursable) {
        periodReimbursableTotal = roundCurrency(periodReimbursableTotal + gross);
      }
      rawMovements.push({
        id: `exp-${item.id}`,
        date: item.expenseDate,
        type: 'masraf',
        userName: item.userName,
        userRole: item.userRole,
        title: item.merchant,
        detail: `${item.category || 'Masraf'} · ${PAYMENT_METHODS[method]?.label || method}${item.receiptNumber ? ` · Fiş #${item.receiptNumber}` : ''}`,
        accountCode: item.accountCode || '770',
        vatAmount: vat,
        grossAmount: gross,
        receivableEffect: effect,
        status: item.status || 'onaylandi',
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
      });
    }
  }

  for (const p of payoutList) {
    if (!matchesUser(p.userId) || (filterCategory && filterCategory !== 'all')) continue;
    const amt = roundCurrency(p.amount || 0);
    if (p.payoutDate < startDate) {
      openingBalance = roundCurrency(openingBalance - amt);
    } else if (p.payoutDate <= endDate) {
      periodPayoutTotal = roundCurrency(periodPayoutTotal + amt);
      rawMovements.push({
        id: `pay-${p.id}`,
        date: p.payoutDate,
        type: 'odeme',
        userName: p.userName,
        userRole: p.userRole,
        title: `Ödeme (${p.paymentChannel === 'havale_eft' ? 'Havale/EFT' : p.paymentChannel === 'nakit' ? 'Nakit' : 'Çek'})`,
        detail: `${p.referenceNo ? `Dekont #${p.referenceNo} · ` : ''}${p.description || 'Masraf ödemesi'}`,
        accountCode: p.userRole === 'ortak' ? '331' : '335',
        vatAmount: 0,
        grossAmount: amt,
        receivableEffect: -amt,
        status: 'odendi',
      });
    }
  }

  rawMovements.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let running = openingBalance;
  const movements: StatementMovement[] = rawMovements.map((m) => {
    running = roundCurrency(running + m.receivableEffect);
    return { ...m, runningBalance: running };
  });

  const closingBalance = roundCurrency(openingBalance + periodReimbursableTotal - periodPayoutTotal);

  return {
    startDate,
    endDate,
    filterUserId,
    filterCategory,
    openingBalance,
    periodExpenseTotal,
    periodReimbursableTotal,
    periodVatTotal,
    periodPayoutTotal,
    closingBalance,
    movements,
  };
}

export function sanitizeExpenseForViewer<T extends { latitude?: number | null; longitude?: number | null; locationAccuracy?: number | null }>(
  expense: T,
  viewerRole: UserRole
): T {
  if (viewerRole === 'admin') {
    return expense;
  }
  return {
    ...expense,
    latitude: null,
    longitude: null,
    locationAccuracy: null,
  };
}

export function formatExpensesCsv(
  items: Array<{
    id: number;
    expenseDate: string;
    userName: string;
    userRole: string;
    merchant: string;
    receiptNumber: string;
    category: string;
    accountCode?: string;
    paymentMethod: string;
    netAmount?: number;
    vatRate?: number;
    vatAmount?: number;
    amount: number;
    status?: string;
    description?: string;
    latitude?: number | null;
    longitude?: number | null;
  }>,
  includeCoordinates: boolean
): string {
  const headers = [
    'ID',
    'Tarih',
    'Kullanıcı',
    'Rol',
    'Yer / Satıcı',
    'Fiş / Fatura No',
    'Kategori',
    'Ödeme Şekli',
    'Tutar (TRY)',
    'Açıklama',
  ];
  if (includeCoordinates) {
    headers.push('Enlem', 'Boylam');
  }

  const escapeCsv = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = items.map((e) => {
    const methodLabel = PAYMENT_METHODS[e.paymentMethod as PaymentMethod]?.label || e.paymentMethod;
    const base = [
      e.id,
      e.expenseDate,
      e.userName,
      e.userRole,
      e.merchant,
      e.receiptNumber,
      e.category,
      methodLabel,
      e.amount.toFixed(2),
      e.description || '',
    ];
    if (includeCoordinates) {
      base.push(e.latitude ?? '', e.longitude ?? '');
    }
    return base.map(escapeCsv).join(',');
  });

  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
}
