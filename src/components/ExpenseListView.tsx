import React, { useMemo, useState } from 'react';
import {
  ExternalLink,
  Eye,
  MapPin,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Expense, User } from '../types';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../utils/accounting';

interface ExpenseListViewProps {
  currentUser: User;
  expenses: Expense[];
  allUsers?: User[];
  onEditExpense: (expense: Expense) => void;
  onRefresh: () => void;
}

const formatTry = (val: number) =>
  val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

export const ExpenseListView: React.FC<ExpenseListViewProps> = ({
  currentUser,
  expenses,
  allUsers = [],
  onEditExpense,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<Expense | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (currentUser.role === 'admin' && userFilter !== 'all' && String(e.userId) !== userFilter) {
        return false;
      }
      if (!q) return true;
      return (
        e.merchant.toLocaleLowerCase('tr-TR').includes(q) ||
        e.category.toLocaleLowerCase('tr-TR').includes(q) ||
        e.userName.toLocaleLowerCase('tr-TR').includes(q) ||
        e.receiptNumber.toLocaleLowerCase('tr-TR').includes(q) ||
        e.description.toLocaleLowerCase('tr-TR').includes(q)
      );
    });
  }, [expenses, search, categoryFilter, userFilter, currentUser.role]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.deleteExpense(deleteTarget.id, deleteReason || 'Kullanıcı tarafından silindi');
      setDeleteTarget(null);
      setDeleteReason('');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Masraf silinemedi.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Masraflarda ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Yer, fiş no, kategori veya açıklama ara..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <select
            aria-label="Kategoriye göre filtrele"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
          >
            <option value="all">Tüm Kategoriler</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>

          {currentUser.role === 'admin' && allUsers.length > 0 && (
            <select
              aria-label="Kullanıcıya göre filtrele"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
            >
              <option value="all">Tüm Kullanıcılar</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-800">
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
          Seçili filtreye uygun masraf kaydı bulunamadı.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const canModify = currentUser.role === 'admin' || item.userId === currentUser.id;
            const hasCoords =
              currentUser.role === 'admin' &&
              typeof item.latitude === 'number' &&
              typeof item.longitude === 'number';

            return (
              <article
                key={item.id}
                className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                        {item.merchant}
                      </h3>
                      {item.receiptNumber && (
                        <span className="text-xs font-mono text-slate-500">
                          Fiş #{item.receiptNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.expenseDate}</span>
                      {currentUser.role === 'admin' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">
                            {item.userName} ({item.userRole === 'ortak' ? 'Ortak' : item.userRole === 'admin' ? 'Admin' : 'Çalışan'})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatTry(item.amount)}
                    </div>
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                )}

                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-slate-600">
                      {PAYMENT_METHODS[item.paymentMethod]?.label || item.paymentMethod}
                    </span>

                    {/* GPS Coordinates visible ONLY to Admin */}
                    {hasCoords && (
                      <a
                        href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-teal-700 hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {item.latitude!.toFixed(5)}, {item.longitude!.toFixed(5)}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.receiptImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewReceipt(item)}
                        className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Fiş</span>
                      </button>
                    )}

                    {canModify && (
                      <button
                        type="button"
                        aria-label={`${item.merchant} masrafını düzenle`}
                        onClick={() => onEditExpense(item)}
                        className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Düzenle</span>
                      </button>
                    )}

                    {canModify && (
                      <button
                        type="button"
                        aria-label={`${item.merchant} masrafını sil`}
                        onClick={() => {
                          setDeleteTarget(item);
                          setDeleteReason('');
                        }}
                        className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Sil</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Soft Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 id="delete-modal-title" className="font-display text-lg font-bold text-slate-900">
              Masraf Kaydını Sil
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>{deleteTarget.merchant}</strong> ({formatTry(deleteTarget.amount)}) kaydını silmek üzeresiniz. Yapılan silme hareketi Admin hareket günlüğüne kaydedilecektir.
            </p>
            <div>
              <label htmlFor="delete-reason" className="block text-xs font-medium text-slate-700 mb-1.5">
                Silme Nedeni
              </label>
              <input
                id="delete-reason"
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Örn: Tutar hatalı girildi, mükerrer fiş..."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="min-h-[44px] rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Image Preview */}
      {previewReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">{previewReceipt.merchant}</div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                aria-label="Önizlemeyi kapat"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {previewReceipt.receiptImageDataUrl && (
              <img
                src={previewReceipt.receiptImageDataUrl}
                alt={`${previewReceipt.merchant} fiş görseli`}
                referrerPolicy="no-referrer"
                className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-100"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
