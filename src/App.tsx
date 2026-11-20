import React, { useCallback, useEffect, useState } from 'react';
import {
  FileBarChart2,
  Home,
  LogOut,
  Plus,
  ReceiptText,
  Settings,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { api, getAuthToken, setAuthToken } from './lib/api';
import type { AccountingSummaries, CompanySettings, Expense, Payout, User } from './types';
import type { UserRole } from './utils/accounting';
import { useDevicePermissions } from './hooks/usePWAInstall';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { ExpenseListView } from './components/ExpenseListView';
import { AccountingReportsView } from './components/AccountingReportsView';
import { SetupAndProfileView } from './components/SetupAndProfileView';
import { ExpenseFormModal } from './components/ExpenseFormModal';

type NavTab = 'dashboard' | 'expenses' | 'reports' | 'settings';

const EMPTY_SUMMARIES: AccountingSummaries = {
  totalGross: 0,
  totalNet: 0,
  totalVat: 0,
  pendingApprovalCount: 0,
  pendingApprovalAmount: 0,
  totalPayouts: 0,
  totalReimbursableUnsettled: 0,
  pendingReimbursementAmount: 0,
  vatBreakdownByRate: [],
  userBalances: [],
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<CompanySettings>({
    companyName: 'Anadolu Mühendislik ve Danışmanlık A.Ş.',
    shortName: 'MasrafPro',
    setupCompleted: false,
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summaries, setSummaries] = useState<AccountingSummaries>(EMPTY_SUMMARIES);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [booting, setBooting] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(getAuthToken() || params.get('autostart') === '1');
  });
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState<'manual' | 'scan' | 'voice'>('manual');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const {
    permissions,
    requestLocation,
    requestCamera,
    requestMicrophone,
    requestAll,
  } = useDevicePermissions();

  const loadWorkspace = useCallback(async () => {
    const [meRes, expRes] = await Promise.all([api.getMe(), api.listExpenses()]);
    setUser(meRes.user);
    setCompany(meRes.company);
    setExpenses(expRes.expenses);
    setPayouts(expRes.payouts || []);
    setSummaries(expRes.summaries);
    if (meRes.user.role === 'admin') {
      try {
        const usersRes = await api.listUsers();
        setAllUsers(usersRes.users);
      } catch {
        setAllUsers([]);
      }
    } else {
      setAllUsers([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        api
          .getPublicCompany()
          .then((pub) => {
            if (active) setCompany(pub);
          })
          .catch(() => {});

        const params = new URLSearchParams(window.location.search);
        const autostart = params.get('autostart') === '1';
        const requestedRole = (params.get('role') as UserRole) || 'admin';

        if (getAuthToken()) {
          await loadWorkspace();
        } else if (autostart) {
          const demo = await api.demoLogin(
            ['admin', 'ortak', 'calisan'].includes(requestedRole) ? requestedRole : 'admin'
          );
          setAuthToken(demo.token);
          await loadWorkspace();
        }
      } catch {
        setAuthToken(null);
      } finally {
        if (active) setBooting(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [loadWorkspace]);

  const handleAuthenticated = async (authedUser: User) => {
    setUser(authedUser);
    await loadWorkspace();
  };

  const handleLogout = async () => {
    setAuthToken(null);
    try {
      await signOut(auth);
    } catch {}
    setUser(null);
    setExpenses([]);
    setAllUsers([]);
    setEditingExpense(null);
    setPayouts([]);
    setSummaries(EMPTY_SUMMARIES);
    setActiveTab('dashboard');
  };

  const openNewExpense = (mode: 'manual' | 'scan' | 'voice') => {
    setEditingExpense(null);
    setExpenseModalMode(mode);
    setExpenseModalOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseModalMode('manual');
    setExpenseModalOpen(true);
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen
          company={company}
          permissions={permissions}
          onRequestAllPermissions={requestAll}
          onAuthenticated={handleAuthenticated}
        />
        <OfflineIndicator />
      </>
    );
  }

  const roleLabel =
    user.role === 'admin' ? 'Admin' : user.role === 'ortak' ? 'Ortak' : 'Çalışan';

  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Özet', icon: Home },
    { id: 'expenses', label: 'Masraflar', icon: ReceiptText },
    { id: 'reports', label: 'Raporlar', icon: FileBarChart2 },
    { id: 'settings', label: 'Kurulum', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 px-4 py-5 justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            {company.logoDataUrl ? (
              <img
                src={company.logoDataUrl}
                alt={company.companyName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-xl object-contain border border-slate-200 p-0.5 bg-white shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-display font-bold shrink-0">
                {(company.shortName || 'M').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-slate-900 truncate">
                {company.shortName || 'MasrafPro'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">{company.companyName}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openNewExpense('scan')}
            className="w-full min-h-[44px] rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Yeni Masraf Ekle</span>
          </button>

          <nav aria-label="Ana Menü" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full min-h-[44px] rounded-xl px-3 flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-100">
          <PWAInstallButton />
          <div className="px-2">
            <div className="text-xs font-semibold text-slate-900 truncate">{user.fullName}</div>
            <div className="text-[11px] text-slate-500">
              {roleLabel} · {user.department}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-[52px] bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0 lg:hidden">
            {company.logoDataUrl ? (
              <img
                src={company.logoDataUrl}
                alt={company.companyName}
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded-lg object-contain border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-lg bg-teal-700 text-white flex items-center justify-center font-display text-xs font-bold shrink-0">
                {(company.shortName || 'M').slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="font-display text-sm font-bold text-slate-900 truncate">
              {company.shortName || 'MasrafPro'}
            </span>
          </div>

          <div className="hidden lg:block font-display text-sm font-semibold text-slate-900">
            {navItems.find((n) => n.id === activeTab)?.label}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-600 hidden sm:inline">
              {user.fullName} · <strong>{roleLabel}</strong>
            </span>
            <button
              type="button"
              onClick={() => openNewExpense('scan')}
              className="lg:hidden min-h-[38px] rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Masraf</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Çıkış Yap"
              className="lg:hidden flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 pb-24 lg:pb-10">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              company={company}
              expenses={expenses}
              payouts={payouts}
              summaries={summaries}
              permissions={permissions}
              onOpenNewExpense={openNewExpense}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpenseListView
              currentUser={user}
              expenses={expenses}
              allUsers={allUsers}
              onEditExpense={openEditExpense}
              onRefresh={loadWorkspace}
            />
          )}

          {activeTab === 'reports' && (
            <AccountingReportsView
              currentUser={user}
              company={company}
              summaries={summaries}
              payouts={payouts}
              onRefresh={loadWorkspace}
            />
          )}

          {activeTab === 'settings' && (
            <SetupAndProfileView
              currentUser={user}
              company={company}
              permissions={permissions}
              onRequestLocation={requestLocation}
              onRequestCamera={requestCamera}
              onRequestMicrophone={requestMicrophone}
              onRequestAllPermissions={requestAll}
              onProfileUpdated={(updated) => setUser(updated)}
              onCompanyUpdated={(updated) => setCompany(updated)}
            />
          )}
        </main>
      </div>

      {/* Fixed Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobil Alt Menü"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-teal-700 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <ExpenseFormModal
        open={expenseModalOpen}
        initialMode={expenseModalMode}
        userRole={user.role}
        currentUserId={user.id}
        allUsers={allUsers}
        editingExpense={editingExpense}
        requestLocation={requestLocation}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSaved={loadWorkspace}
      />

      <OfflineIndicator />
    </div>
  );
}
