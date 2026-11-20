import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarRange,
  Check,
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  History,
  MapPin,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  AccountingSummaries,
  AuditLog,
  CompanySettings,
  DateRangeStatement,
  Payout,
  User,
} from '../types';
import { EXPENSE_CATEGORIES } from '../utils/accounting';

interface AccountingReportsViewProps {
  currentUser: User;
  company: CompanySettings;
  summaries: AccountingSummaries;
  payouts: Payout[];
  onRefresh: () => void;
}

const formatTry = (val: number) =>
  val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

export const AccountingReportsView: React.FC<AccountingReportsViewProps> = ({
  currentUser,
  company,
  summaries,
  payouts,
  onRefresh,
}) => {
  const isAdmin = currentUser.role === 'admin';

  // Admin: Users list & Bulk Payout form state
  const [team, setTeam] = useState<User[]>([]);
  const [payoutUserId, setPayoutUserId] = useState<string>('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payoutChannel, setPayoutChannel] = useState<'havale_eft' | 'nakit' | 'cek'>('havale_eft');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutDesc, setPayoutDesc] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutFeedback, setPayoutFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Date-Range Statement state (Available for ALL roles — non-admin scoped to own records)
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statementUserId, setStatementUserId] = useState<string>(isAdmin ? 'all' : String(currentUser.id));
  const [statementCategory, setStatementCategory] = useState<string>('all');
  const [statement, setStatement] = useState<DateRangeStatement | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Admin: Audit Logs (created, updated, deleted)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState<'all' | 'updated' | 'deleted'>('all');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatementUserId(isAdmin ? 'all' : String(currentUser.id));
  }, [isAdmin, currentUser.id]);

  const loadStatement = useCallback(async () => {
    setLoadingStatement(true);
    try {
      const uid = isAdmin ? (statementUserId === 'all' ? 'all' : Number(statementUserId)) : currentUser.id;
      const res = await api.getStatement(startDate, endDate, uid, statementCategory);
      setStatement(res.statement);
    } catch (err: any) {
      setError(err.message || 'Tarih aralığı raporu yüklenemedi.');
    } finally {
      setLoadingStatement(false);
    }
  }, [isAdmin, currentUser.id, startDate, endDate, statementUserId, statementCategory]);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .listUsers()
      .then((res) => {
        setTeam(res.users);
        const firstNonAdmin = res.users.find((u) => u.role !== 'admin') || res.users[0];
        if (firstNonAdmin && !payoutUserId) {
          setPayoutUserId(String(firstNonAdmin.id));
        }
      })
      .catch(() => {});
  }, [isAdmin, payoutUserId]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingLogs(true);
    api
      .listAuditLogs(false)
      .then((res) => setAuditLogs(res.logs))
      .catch((err) => setError(err.message || 'Denetim kayıtları yüklenemedi.'))
      .finally(() => setLoadingLogs(false));
  }, [isAdmin, payouts.length, statement]);

  const filteredAuditLogs = useMemo(() => {
    if (auditFilter === 'all') return auditLogs;
    return auditLogs.filter((l) => l.action === auditFilter);
  }, [auditLogs, auditFilter]);

  const handleCreatePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(payoutAmount.replace(',', '.'));
    if (!payoutUserId || !(numAmt > 0)) {
      setPayoutFeedback({ type: 'err', text: 'Lütfen kişi seçin ve 0 TL üzerinde bir tutar girin.' });
      return;
    }
    setSavingPayout(true);
    setPayoutFeedback(null);
    try {
      await api.createPayout({
        userId: Number(payoutUserId),
        amount: numAmt,
        payoutDate,
        paymentChannel: payoutChannel,
        referenceNo: payoutRef,
        description: payoutDesc,
      });
      setPayoutAmount('');
      setPayoutRef('');
      setPayoutDesc('');
      setPayoutFeedback({ type: 'ok', text: 'Toplu ödeme kaydedildi ve alacak bakiyesinden düşüldü.' });
      onRefresh();
      loadStatement();
    } catch (err: any) {
      setPayoutFeedback({ type: 'err', text: err.message || 'Ödeme kaydedilemedi.' });
    } finally {
      setSavingPayout(false);
    }
  };

  const handleDeletePayout = async (id: number) => {
    try {
      await api.deletePayout(id);
      onRefresh();
      loadStatement();
    } catch (err: any) {
      setError(err.message || 'Ödeme silinemedi.');
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await api.downloadCsv();
    } catch (err: any) {
      setError(err.message || 'CSV indirilemedi.');
    } finally {
      setExporting(false);
    }
  };

  const userLabel = !isAdmin
    ? currentUser.fullName
    : statementUserId === 'all'
    ? 'Tüm Personel ve Ortaklar'
    : team.find((u) => String(u.id) === statementUserId)?.fullName || 'Seçili Kullanıcı';

  const selectedFilterLabel =
    statementCategory === 'all' ? userLabel : `${userLabel} · ${statementCategory}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            {isAdmin ? 'Raporlar, Ödemeler & Değişiklik Günlüğü' : 'Masraf Raporlarım & Bakiye Dökümü'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Tüm kullanıcıları tarih ve kategoriye göre filtreleyip XLSX, PDF veya görsel çıktı alın; tüm masraf hareketlerini izleyin.'
              : 'Kendi masraflarınızı ve ödemelerinizi tarih aralığı ile kategoriye göre filtreleyip XLSX, PDF veya görsel olarak indirin.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>{exporting ? 'Hazırlanıyor...' : 'Ham Masraf CSV'}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Date-Range Movement Statement & Multi-Format Export (Available to ALL roles) */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-teal-700 shrink-0" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Tarih Aralığı Hareket Dökümü &amp; Bakiye Raporu
              </h3>
              <p className="text-xs text-slate-500">
                Tarih ve kategori filtrelerini seçerek dönem özetini XLSX, PDF, PNG veya JPG formatında dışa aktarın.
              </p>
            </div>
          </div>

          {statement && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const { exportStatementToXlsx } = await import('../lib/exporters');
                  exportStatementToXlsx(statement, summaries, company, selectedFilterLabel, isAdmin);
                }}
                className="min-h-[40px] rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>XLSX İndir</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { exportStatementToPdf } = await import('../lib/exporters');
                  exportStatementToPdf(statement, company, selectedFilterLabel);
                }}
                className="min-h-[40px] rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileText className="h-4 w-4" />
                <span>PDF İndir</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { exportStatementToImage } = await import('../lib/exporters');
                  exportStatementToImage(statement, company, selectedFilterLabel, 'png');
                }}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileImage className="h-4 w-4 text-teal-700" />
                <span>PNG</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { exportStatementToImage } = await import('../lib/exporters');
                  exportStatementToImage(statement, company, selectedFilterLabel, 'jpg');
                }}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileImage className="h-4 w-4 text-slate-600" />
                <span>JPG</span>
              </button>
            </div>
          )}
        </div>

        <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200`}>
          <div>
            <label htmlFor="stmt-start" className="block text-[11px] font-medium text-slate-600 mb-1">
              Başlangıç Tarihi
            </label>
            <input
              id="stmt-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono"
            />
          </div>
          <div>
            <label htmlFor="stmt-end" className="block text-[11px] font-medium text-slate-600 mb-1">
              Bitiş Tarihi
            </label>
            <input
              id="stmt-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-mono"
            />
          </div>
          <div>
            <label htmlFor="stmt-cat" className="block text-[11px] font-medium text-slate-600 mb-1">
              Kategori Filtresi
            </label>
            <select
              id="stmt-cat"
              value={statementCategory}
              onChange={(e) => setStatementCategory(e.target.value)}
              className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs"
            >
              <option value="all">Tüm Kategoriler</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label htmlFor="stmt-user" className="block text-[11px] font-medium text-slate-600 mb-1">
                Kullanıcı Filtresi
              </label>
              <select
                id="stmt-user"
                value={statementUserId}
                onChange={(e) => setStatementUserId(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs"
              >
                <option value="all">Tüm Personel ve Ortaklar</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role === 'ortak' ? 'Ortak' : u.role === 'admin' ? 'Admin' : 'Çalışan'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loadingStatement || !statement ? (
          <div className="py-6 text-center text-xs text-slate-500">Dönem raporu hesaplanıyor...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="text-[11px] text-slate-500">Dönem Başı Devir</div>
                <div className="font-mono text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                  {formatTry(statement.openingBalance)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="text-[11px] text-slate-500">Dönem İçi Masraf</div>
                <div className="font-mono text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                  {formatTry(statement.periodExpenseTotal)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5">
                <div className="text-[11px] text-slate-500">Dönem İçi Ödemeler</div>
                <div className="font-mono text-base font-bold text-teal-700 mt-0.5 tabular-nums">
                  {statement.periodPayoutTotal > 0
                    ? `-${formatTry(statement.periodPayoutTotal)}`
                    : formatTry(0)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-[11px] text-slate-600 font-medium">Dönem Sonu Alacak Bakiye</div>
                <div className="font-mono text-base font-bold text-amber-700 mt-0.5 tabular-nums">
                  {formatTry(statement.closingBalance)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Tarih</th>
                    <th className="px-3.5 py-2.5 font-medium">Kişi</th>
                    <th className="px-3.5 py-2.5 font-medium">Yer / Açıklama</th>
                    <th className="px-3.5 py-2.5 font-medium text-right">Tutar</th>
                    <th className="px-3.5 py-2.5 font-medium text-right">Yürüyen Bakiye</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statement.movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        Seçili filtrede hareket bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    statement.movements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3.5 py-2.5 font-mono text-slate-600 whitespace-nowrap">{m.date}</td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-900 whitespace-nowrap">{m.userName}</td>
                        <td className="px-3.5 py-2.5">
                          <div className={`font-medium ${m.type === 'odeme' ? 'text-teal-700' : 'text-slate-900'}`}>
                            {m.title}
                          </div>
                          <div className="text-[11px] text-slate-500">{m.detail}</div>
                        </td>
                        <td
                          className={`px-3.5 py-2.5 font-mono text-right font-semibold whitespace-nowrap tabular-nums ${
                            m.type === 'odeme' ? 'text-teal-700' : 'text-slate-900'
                          }`}
                        >
                          {m.type === 'odeme' ? '-' : '+'}
                          {formatTry(m.grossAmount)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                          {formatTry(m.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Admin Bulk Payout Entry (Toplu Ödeme Girişi) */}
      {isAdmin && (
        <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-teal-700" />
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Kişiye Toplu Ödeme Girişi
              </h3>
              <p className="text-xs text-slate-500">
                Ortak veya personele yapılan toplu ödemeleri girin; kişinin alacak bakiyesinden otomatik düşer.
              </p>
            </div>
          </div>

          {payoutFeedback && (
            <div
              role="status"
              className={`rounded-xl px-4 py-3 text-xs font-medium border ${
                payoutFeedback.type === 'ok'
                  ? 'bg-teal-50 border-teal-200 text-teal-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {payoutFeedback.text}
            </div>
          )}

          <form onSubmit={handleCreatePayout} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="lg:col-span-2">
              <label htmlFor="payout-user" className="block text-xs font-medium text-slate-700 mb-1.5">
                Ödeme Yapılan Kişi
              </label>
              <select
                id="payout-user"
                value={payoutUserId}
                onChange={(e) => setPayoutUserId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900"
              >
                {team.map((u) => {
                  const bal = summaries.userBalances.find((b) => b.userId === u.id)?.netReceivableBalance ?? 0;
                  return (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (Alacak: {formatTry(bal)})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="payout-amount" className="block text-xs font-medium text-slate-700 mb-1.5">
                Ödeme Tutarı (TRY)
              </label>
              <input
                id="payout-amount"
                type="number"
                step="0.01"
                min="0"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="payout-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                Ödeme Tarihi
              </label>
              <input
                id="payout-date"
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="payout-channel" className="block text-xs font-medium text-slate-700 mb-1.5">
                Ödeme Kanalı
              </label>
              <select
                id="payout-channel"
                value={payoutChannel}
                onChange={(e) => setPayoutChannel(e.target.value as 'havale_eft' | 'nakit' | 'cek')}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900"
              >
                <option value="havale_eft">Havale / EFT</option>
                <option value="nakit">Kasa Nakit</option>
                <option value="cek">Çek / Senet</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={savingPayout}
                className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Check className="h-4 w-4" />
                <span>{savingPayout ? 'Kaydediliyor...' : 'Ödeme Kaydet'}</span>
              </button>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <input
                type="text"
                aria-label="Dekont veya referans numarası"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder="Dekont / Referans No (Opsiyonel)"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs font-mono text-slate-800"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <input
                type="text"
                aria-label="Ödeme açıklaması"
                value={payoutDesc}
                onChange={(e) => setPayoutDesc(e.target.value)}
                placeholder="Ödeme açıklaması (Örn: Kasım ayı masraf ödemesi)"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs text-slate-800"
              />
            </div>
          </form>

          {payouts.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-700 mb-2">Son Yapılan Toplu Ödemeler</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {payouts.slice(0, 6).map((p) => (
                  <div key={p.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900">{p.userName}</span>
                      <span className="text-slate-400"> · </span>
                      <span className="font-mono text-slate-600">{p.payoutDate}</span>
                      {p.referenceNo && (
                        <>
                          <span className="text-slate-400"> · </span>
                          <span className="font-mono text-slate-600">#{p.referenceNo}</span>
                        </>
                      )}
                      {p.description && (
                        <>
                          <span className="text-slate-400"> · </span>
                          <span className="text-slate-600">{p.description}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-teal-700 tabular-nums">
                        {formatTry(p.amount)}
                      </span>
                      <button
                        type="button"
                        aria-label={`${p.userName} ödemesini sil`}
                        onClick={() => handleDeletePayout(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Admin-Only Personnel & Partner Receivable Balances */}
      {isAdmin && (
        <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Kullanıcı Alacak Bakiyeleri
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Kişi / Rol</th>
                  <th className="px-4 py-3 font-medium text-right">Alacak Harcamaları</th>
                  <th className="px-4 py-3 font-medium text-right">Yapılan Ödemeler</th>
                  <th className="px-4 py-3 font-medium text-right">Kalan Alacak Bakiyesi</th>
                  <th className="px-4 py-3 font-medium text-right">Şirket Kartı / Kasa</th>
                  <th className="px-4 py-3 font-medium text-right">Toplam Harcama</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.userBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Henüz masraf hareketi bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  summaries.userBalances.map((row) => (
                    <tr key={row.userId}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.userName}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.role === 'ortak' ? 'Ortak' : row.role === 'admin' ? 'Admin' : 'Çalışan'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-slate-700 tabular-nums">
                        {formatTry(row.reimbursablePending)}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-teal-700 tabular-nums">
                        {row.payoutsTotal > 0 ? `-${formatTry(row.payoutsTotal)}` : formatTry(0)}
                      </td>
                      <td
                        className={`px-4 py-3 font-mono text-right font-bold tabular-nums ${
                          row.netReceivableBalance > 0
                            ? 'text-amber-700'
                            : row.netReceivableBalance < 0
                            ? 'text-rose-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatTry(row.netReceivableBalance)}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-slate-500 tabular-nums">
                        {formatTry(row.companyCardTotal)}
                      </td>
                      <td className="px-4 py-3 font-mono text-right font-semibold text-slate-900 tabular-nums">
                        {formatTry(row.totalSpent)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Admin-Only Full Audit Trail (Created, Edited, Deleted) */}
      {isAdmin && (
        <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-teal-700" />
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Masraf Değişiklik &amp; Silme Günlüğü (Yalnızca Admin)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Kullanıcıların yaptığı tüm ekleme, düzeltme ve silme işlemleri saat ve konum bilgisiyle listelenir.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setAuditFilter('all')}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg ${
                  auditFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('updated')}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg ${
                  auditFilter === 'updated' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Düzeltilenler
              </button>
              <button
                type="button"
                onClick={() => setAuditFilter('deleted')}
                className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg ${
                  auditFilter === 'deleted' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Silinenler
              </button>
            </div>
          </div>

          {loadingLogs ? (
            <div className="p-6 text-center text-xs text-slate-500">Hareket kayıtları yükleniyor...</div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              {auditFilter === 'deleted'
                ? 'Henüz silinmiş masraf kaydı bulunmuyor.'
                : auditFilter === 'updated'
                ? 'Henüz düzeltilmiş masraf kaydı bulunmuyor.'
                : 'Henüz denetim hareketi bulunmuyor.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredAuditLogs.map((log) => {
                const actionLabel =
                  log.action === 'deleted'
                    ? 'Silindi'
                    : log.action === 'updated'
                    ? 'Düzeltildi'
                    : log.action === 'created'
                    ? 'Eklendi'
                    : log.action === 'paid'
                    ? 'Ödendi'
                    : log.action;
                const actionColor =
                  log.action === 'deleted'
                    ? 'text-rose-600'
                    : log.action === 'updated'
                    ? 'text-amber-700'
                    : 'text-teal-700';

                return (
                  <li key={log.id} className="px-4 sm:px-5 py-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {log.merchant} · <span className={actionColor}>{actionLabel}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                          <span>
                            İşlemi Yapan: <strong className="text-slate-700">{log.actorName}</strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Masraf Sahibi: {log.ownerName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{new Date(log.createdAt).toLocaleString('tr-TR')}</span>
                        </div>
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-900 shrink-0 tabular-nums">
                        {formatTry(log.amount)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span>Detay / Neden: {log.reason || 'Belirtilmedi'}</span>
                      {typeof log.latitude === 'number' && typeof log.longitude === 'number' && (
                        <a
                          href={`https://maps.google.com/?q=${log.latitude},${log.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-teal-700 hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span>
                            {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                          </span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
