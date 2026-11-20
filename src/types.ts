import type { DocumentType, ExpenseStatus, PaymentMethod, UserRole } from './utils/accounting';

export interface User {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string;
  phone: string;
  iban: string;
  monthlyBudgetLimit: number;
  isActive: boolean;
  createdAt?: string;
}

export interface CompanySettings {
  id?: number;
  companyName: string;
  shortName: string;
  taxNumber?: string;
  taxOffice?: string;
  logoDataUrl?: string | null;
  pwaIconDataUrl?: string | null;
  monthlyCompanyBudget?: number;
  requireReceiptAboveAmount?: number;
  setupCompleted: boolean;
}

export interface Expense {
  id: number;
  userId: number;
  userName: string;
  userRole: UserRole;
  userDepartment?: string;
  userIban?: string;
  merchant: string;
  merchantTaxId: string;
  receiptNumber: string;
  documentType: DocumentType;
  category: string;
  accountCode: string;
  costCenter: string;
  paymentMethod: PaymentMethod;
  amount: number;
  vatRate: number;
  vatAmount: number;
  netAmount: number;
  currency: string;
  expenseDate: string;
  description: string;
  receiptImageDataUrl?: string | null;
  voiceNoteDataUrl?: string | null;
  voiceTranscript?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracy?: number | null;
  status: ExpenseStatus;
  rejectionReason?: string;
  createdAt?: string;
}

export interface Payout {
  id: number;
  userId: number;
  userName: string;
  userRole: UserRole;
  userIban?: string;
  amount: number;
  payoutDate: string;
  paymentChannel: 'havale_eft' | 'nakit' | 'cek';
  referenceNo: string;
  description: string;
  createdAt?: string;
}

export interface AuditLog {
  id: number;
  expenseId: number;
  action: string;
  actorUserId: number;
  actorName: string;
  actorRole: string;
  ownerUserId: number;
  ownerName: string;
  merchant: string;
  amount: number;
  expenseDate: string;
  reason: string;
  latitude?: number | null;
  longitude?: number | null;
  snapshotJson: string;
  createdAt: string;
}

export interface AccountingSummaries {
  totalGross: number;
  totalNet: number;
  totalVat: number;
  pendingApprovalCount: number;
  pendingApprovalAmount: number;
  totalPayouts: number;
  totalReimbursableUnsettled: number;
  pendingReimbursementAmount: number;
  vatBreakdownByRate: Array<{
    rate: number;
    net: number;
    vat: number;
    gross: number;
    count: number;
  }>;
  userBalances: Array<{
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
  }>;
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
