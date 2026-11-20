import type {
  AccountingSummaries,
  AuditLog,
  CompanySettings,
  DateRangeStatement,
  Expense,
  Payout,
  User,
} from '../types';
import type { UserRole } from '../utils/accounting';

let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
  if (typeof window !== 'undefined') {
    if (token && token.startsWith('app.')) {
      sessionStorage.setItem('masraf_session_token', token);
    } else if (!token) {
      sessionStorage.removeItem('masraf_session_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('masraf_session_token');
    if (saved) {
      memoryToken = saved;
      return saved;
    }
  }
  return null;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const err = new Error(
      typeof data === 'object' && data && 'error' in data ? String((data as { error: string }).error) : 'İstek başarısız oldu.'
    ) as Error & { status?: number; payload?: unknown };
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

export const api = {
  getPublicCompany: () => apiFetch<CompanySettings>('/api/company/public'),

  loginWithPassword: (email: string, password: string) =>
    apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  demoLogin: (role: UserRole) =>
    apiFetch<{ token: string; user: User }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  getMe: () => apiFetch<{ user: User; company: CompanySettings }>('/api/me'),

  updateProfile: (payload: {
    fullName?: string;
    department?: string;
    phone?: string;
    iban?: string;
    currentPassword?: string;
    newPassword?: string;
  }) =>
    apiFetch<{ user: User }>('/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateCompanySettings: (payload: Partial<CompanySettings>) =>
    apiFetch<{ company: CompanySettings }>('/api/company/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  listUsers: () => apiFetch<{ users: User[] }>('/api/users'),

  createUser: (payload: {
    email: string;
    fullName: string;
    role: UserRole;
    department: string;
    phone: string;
    iban: string;
    monthlyBudgetLimit: number;
    password: string;
  }) =>
    apiFetch<{ user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (id: number, payload: Partial<User> & { newPassword?: string }) =>
    apiFetch<{ user: User }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listExpenses: () =>
    apiFetch<{ expenses: Expense[]; payouts: Payout[]; summaries: AccountingSummaries }>('/api/expenses'),

  createExpense: (payload: Record<string, unknown>) =>
    apiFetch<{ expense: Expense }>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateExpense: (id: number, payload: Record<string, unknown>) =>
    apiFetch<{ expense: Expense }>(`/api/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteExpense: (id: number, reason: string) =>
    apiFetch<{ ok: boolean }>(`/api/expenses/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  listPayouts: () => apiFetch<{ payouts: Payout[] }>('/api/payouts'),

  createPayout: (payload: {
    userId: number;
    amount: number;
    payoutDate: string;
    paymentChannel: 'havale_eft' | 'nakit' | 'cek';
    referenceNo?: string;
    description?: string;
  }) =>
    apiFetch<{ payout: Payout }>('/api/payouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePayout: (id: number) =>
    apiFetch<{ ok: boolean }>(`/api/payouts/${id}`, {
      method: 'DELETE',
    }),

  getStatement: (
    startDate: string,
    endDate: string,
    userId: number | 'all' = 'all',
    category: string = 'all'
  ) =>
    apiFetch<{ statement: DateRangeStatement }>(
      `/api/reports/statement?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&userId=${encodeURIComponent(String(userId))}&category=${encodeURIComponent(category)}`
    ),

  listAuditLogs: (onlyDeleted = false) =>
    apiFetch<{ logs: AuditLog[] }>(`/api/audit-logs?onlyDeleted=${onlyDeleted}`),

  scanReceipt: (imageDataUrl: string) =>
    apiFetch<{
      parsed: {
        merchant: string;
        merchantTaxId: string;
        receiptNumber: string;
        documentType: string;
        category: string;
        expenseDate: string;
        amount: number;
        vatRate: number;
        description: string;
      };
    }>('/api/ai/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ imageDataUrl }),
    }),

  parseVoice: (payload: { audioDataUrl?: string; transcriptText?: string }) =>
    apiFetch<{
      parsed: {
        merchant: string;
        category: string;
        expenseDate: string;
        amount: number;
        vatRate: number;
        description: string;
        transcript: string;
      };
    }>('/api/ai/parse-voice', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  downloadCsv: async () => {
    const token = getAuthToken();
    const res = await fetch('/api/expenses/export.csv', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('CSV indirilemedi.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masraf-dokumu-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
