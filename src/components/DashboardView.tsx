import React from 'react';
import {
  ArrowRight,
  Banknote,
  Camera,
  CheckCircle2,
  Clock,
  Mic,
  Plus,
  Receipt,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { AccountingSummaries, CompanySettings, Expense, Payout, User } from '../types';
import type { DevicePermissions } from '../hooks/usePWAInstall';

interface DashboardViewProps {
  user: User;
  company: CompanySettings;
  expenses: Expense[];
  payouts: Payout[];
  summaries: AccountingSummaries;
  permissions: DevicePermissions;
  onOpenNewExpense: (mode: 'manual' | 'scan' | 'voice') => void;
  onNavigate: (tab: 'expenses' | 'reports' | 'settings') => void;
}

const formatTry = (val: number) =>
  val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  company,
  expenses,
  payouts,
  summaries,
  permissions,
  onOpenNewExpense,
  onNavigate,
}) => {
  const budgetLimit =
    user.role === 'admin'
      ? company.monthlyCompanyBudget || 120000
      : user.monthlyBudgetLimit || 15000;

  const budgetUsagePct = Math.min(100, Math.round((summaries.totalGross / Math.max(1, budgetLimit)) * 100));
  const missingPermsCount = [permissions.location, permissions.camera, permissions.microphone].filter(
    (p) => p !== 'granted'
  ).length;

  const myBalanceRow = summaries.userBalances.find((b) => b.userId === user.id);
  const displayReceivable =
    user.role === 'admin'
      ? summaries.pendingReimbursementAmount
      : myBalanceRow?.netReceivableBalance ?? 0;
  const displayReimbursableExpenses =
    user.role === 'admin'
      ? summaries.totalReimbursableUnsettled
      : myBalanceRow?.reimbursablePending ?? 0;
  const displayPayoutsTotal =
    user.role === 'admin' ? summaries.totalPayouts : myBalanceRow?.payoutsTotal ?? 0;

  return (
    <div className="space-y-6">
      {/* Prominent Welcome Receivable Balance Card (Visible immediately on home screen for all users) */}
      <section
        aria-label="Alacak Bakiyesi Özeti"
        className="rounded-3xl bg-slate-900 text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
      >
        <div className="space-y-1.5">
          <div className="text-xs text-slate-300 font-medium">
            Hoş geldiniz, {user.fullName} ·{' '}
            {user.role === 'admin'
              ? 'Toplam Ödenecek Şirket Alacak Bakiyesi'
              : 'Mevcut Alacak Bakiyem'}
          </div>
          <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-white">
            {formatTry(displayReceivable)}
          </div>
          <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span>
              Alacak Oluşturan Harcama:{' '}
              <strong className="font-mono text-white tabular-nums">
                {formatTry(displayReimbursableExpenses)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Yapılan Toplu Ödeme:{' '}
              <strong className="font-mono text-teal-300 tabular-nums">
                {displayPayoutsTotal > 0 ? `-${formatTry(displayPayoutsTotal)}` : formatTry(0)}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {user.role === 'admin' ? (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="min-h-[44px] rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Banknote className="h-4 w-4" />
              <span>Toplu Ödeme &amp; Rapor</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="min-h-[44px] rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Receipt className="h-4 w-4" />
              <span>Raporlarım</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenNewExpense('scan')}
            className="min-h-[44px] rounded-xl bg-white text-slate-900 px-4 py-2 text-xs font-semibold hover:bg-slate-100 inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Camera className="h-4 w-4 text-teal-700" />
            <span>Hızlı Fiş Okut</span>
          </button>
        </div>
      </section>

      {/* Primary Action Strip */}
      <section aria-label="Hızlı Masraf Girişi" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onOpenNewExpense('scan')}
          className="min-h-[56px] rounded-2xl bg-teal-700 text-white px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-teal-800 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-display text-sm font-semibold">Fiş / Fatura Okut</div>
              <div className="text-[11px] text-teal-100">Kamera ile dip toplamı otomatik al</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onOpenNewExpense('voice')}
          className="min-h-[56px] rounded-2xl bg-white border border-slate-200 text-slate-900 px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Mic className="h-5 w-5 text-teal-700 shrink-0" />
            <div>
              <div className="font-display text-sm font-semibold">Sesli Masraf Ekle</div>
              <div className="text-[11px] text-slate-500">Mikrofonla hızlı kayıt</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onOpenNewExpense('manual')}
          className="min-h-[56px] rounded-2xl bg-white border border-slate-200 text-slate-900 px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-slate-700 shrink-0" />
            <div>
              <div className="font-display text-sm font-semibold">Manuel Masraf Gir</div>
              <div className="text-[11px] text-slate-500">Fişsiz veya form girişi</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
        </button>
      </section>

      {/* KPI Metrics Grid */}
      <section aria-label="Masraf Özeti" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>{user.role === 'admin' ? 'Toplam Şirket Masrafı' : 'Toplam Masrafım'}</span>
            <Wallet className="h-4 w-4 text-slate-400" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatTry(summaries.totalGross)}
          </div>
          <div className="text-[11px] text-slate-500">
            {expenses.length} kayıtlı masraf
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Alacak Oluşturan Harcama</span>
            <Receipt className="h-4 w-4 text-teal-700" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatTry(displayReimbursableExpenses)}
          </div>
          <div className="text-[11px] text-slate-500">
            Kişisel / ortak ödemeleri
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>{user.role === 'admin' ? 'Yapılan Toplu Ödemeler' : 'Tahsil Ettiğim Ödemeler'}</span>
            <CheckCircle2 className="h-4 w-4 text-teal-700" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-teal-700 tabular-nums">
            {formatTry(displayPayoutsTotal)}
          </div>
          <div className="text-[11px] text-slate-500">
            {payouts.length} ödeme hareketi
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-1.5">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Kalan Alacak Bakiyesi</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatTry(displayReceivable)}
          </div>
          <div className="text-[11px] text-slate-500">
            Güncel net durum
          </div>
        </div>
      </section>

      {/* Budget Progress Bar */}
      <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">
            {user.role === 'admin' ? 'Aylık Şirket Bütçe Kullanımı' : 'Aylık Kişisel Bütçe Limitim'}
          </span>
          <span className="font-mono text-slate-700 tabular-nums">
            {formatTry(summaries.totalGross)} / {formatTry(budgetLimit)} (%{budgetUsagePct})
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              budgetUsagePct >= 90 ? 'bg-rose-600' : budgetUsagePct >= 70 ? 'bg-amber-500' : 'bg-teal-700'
            }`}
            style={{ width: `${budgetUsagePct}%` }}
          />
        </div>
      </section>

      {/* Two-column Recent Expenses + Recent Payouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">Son Masraf Hareketleri</h2>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 min-h-[36px] px-2"
            >
              Tümünü Gör
            </button>
          </div>

          {expenses.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Henüz kayıtlı masraf hareketi bulunmuyor.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenses.slice(0, 5).map((item) => (
                <li key={item.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">{item.merchant}</div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.expenseDate}</span>
                      {user.role === 'admin' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.userName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {formatTry(item.amount)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {user.role === 'admin' ? 'Son Yapılan Ödemeler' : 'Tarafıma Yapılan Ödemeler'}
            </h2>
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 min-h-[36px] px-2"
              >
                Ödeme Gir
              </button>
            )}
          </div>

          {payouts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Henüz kaydedilmiş toplu ödeme bulunmuyor.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payouts.slice(0, 5).map((p) => (
                <li key={p.id} className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {user.role === 'admin' ? p.userName : p.description || 'Toplu Alacak Ödemesi'}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5">
                      <span className="font-mono">{p.payoutDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {p.paymentChannel === 'havale_eft'
                          ? 'Havale/EFT'
                          : p.paymentChannel === 'nakit'
                          ? 'Nakit'
                          : 'Çek'}
                      </span>
                      {p.referenceNo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">#{p.referenceNo}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold text-teal-700 shrink-0 tabular-nums">
                    -{formatTry(p.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(missingPermsCount > 0 || (user.role === 'admin' && !company.setupCompleted)) && (
        <section
          aria-label="Sistem ve İzin Durumu"
          className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs text-slate-700">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {user.role === 'admin' && !company.setupCompleted
                ? 'Şirket logosu / PWA mobil ikonu kurulumu tamamlanmadı.'
                : `${missingPermsCount} cihaz izni (konum, kamera, mikrofon) bekliyor.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 shrink-0 self-start sm:self-auto"
          >
            Kurulum &amp; İzinleri Aç
          </button>
        </section>
      )}
    </div>
  );
};
