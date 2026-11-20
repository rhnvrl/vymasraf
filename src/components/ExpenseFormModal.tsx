import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  FileText,
  Loader2,
  MapPin,
  Mic,
  Square,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Expense, User } from '../types';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type PaymentMethod,
  type UserRole,
} from '../utils/accounting';

interface ExpenseFormModalProps {
  open: boolean;
  initialMode?: 'manual' | 'scan' | 'voice';
  userRole: UserRole;
  currentUserId: number;
  allUsers?: User[];
  editingExpense?: Expense | null;
  requestLocation: () => Promise<{ latitude: number; longitude: number; accuracy: number } | null>;
  onClose: () => void;
  onSaved: () => void;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  open,
  initialMode = 'manual',
  userRole,
  currentUserId,
  allUsers = [],
  editingExpense = null,
  requestLocation,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(editingExpense);
  const [targetUserId, setTargetUserId] = useState<string>(String(currentUserId));
  const [merchant, setMerchant] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].label);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    userRole === 'ortak' ? 'ortak_cari' : 'kisisel_kart'
  );
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [editReason, setEditReason] = useState('');
  const [receiptImageDataUrl, setReceiptImageDataUrl] = useState<string | null>(null);
  const [voiceNoteDataUrl, setVoiceNoteDataUrl] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceInputText, setVoiceInputText] = useState('');

  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locStatus, setLocStatus] = useState<'fetching' | 'captured' | 'unavailable'>('fetching');

  const [scanning, setScanning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [parsingVoice, setParsingVoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ merchant: string; amount: number; expenseDate: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDuplicateInfo(null);
    setEditReason('');
    setVoiceInputText('');

    if (editingExpense) {
      setTargetUserId(String(editingExpense.userId));
      setMerchant(editingExpense.merchant);
      setReceiptNumber(editingExpense.receiptNumber || '');
      setCategory(editingExpense.category || EXPENSE_CATEGORIES[0].label);
      setPaymentMethod(editingExpense.paymentMethod || 'kisisel_kart');
      setAmount(String(editingExpense.amount));
      setExpenseDate(editingExpense.expenseDate);
      setDescription(editingExpense.description || '');
      setReceiptImageDataUrl(editingExpense.receiptImageDataUrl || null);
      setVoiceNoteDataUrl(editingExpense.voiceNoteDataUrl || null);
      setVoiceTranscript(editingExpense.voiceTranscript || '');
    } else {
      setTargetUserId(String(currentUserId));
      setMerchant('');
      setReceiptNumber('');
      setCategory(EXPENSE_CATEGORIES[0].label);
      setPaymentMethod(userRole === 'ortak' ? 'ortak_cari' : 'kisisel_kart');
      setAmount('');
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setDescription('');
      setReceiptImageDataUrl(null);
      setVoiceNoteDataUrl(null);
      setVoiceTranscript('');
      setLocStatus('fetching');
      requestLocation().then((res) => {
        if (res) {
          setCoords(res);
          setLocStatus('captured');
        } else {
          setLocStatus('unavailable');
        }
      });
    }
  }, [open, editingExpense, currentUserId, userRole, requestLocation]);

  if (!open) return null;

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0;

  const handleTargetUserChange = (uid: string) => {
    setTargetUserId(uid);
    const chosen = allUsers.find((u) => String(u.id) === uid);
    if (chosen && !isEditing) {
      setPaymentMethod(chosen.role === 'ortak' ? 'ortak_cari' : 'kisisel_kart');
    }
  };

  const runReceiptScan = async (dataUrl: string) => {
    setReceiptImageDataUrl(dataUrl);
    setScanning(true);
    setError(null);
    try {
      const { parsed } = await api.scanReceipt(dataUrl);
      setMerchant(parsed.merchant);
      setReceiptNumber(parsed.receiptNumber || '');
      setCategory(parsed.category);
      setExpenseDate(parsed.expenseDate);
      setAmount(parsed.amount ? String(parsed.amount) : '');
      setDescription(parsed.description || '');
    } catch (err: any) {
      setError(err.message || 'Fiş görseli okunamadı. Bilgileri elle girebilirsiniz.');
    } finally {
      setScanning(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        runReceiptScan(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUseSampleReceipt = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch('/src/assets/images/sample_receipt_1795020739982.jpg');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          await runReceiptScan(reader.result);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      setScanning(false);
      setError('Örnek fiş yüklenemedi.');
    }
  };

  const startVoiceRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tarayıcınız ses kaydını desteklemiyor. Aşağıya metin yazabilirsiniz.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          if (typeof reader.result === 'string') {
            setVoiceNoteDataUrl(reader.result);
            setParsingVoice(true);
            try {
              const { parsed } = await api.parseVoice({ audioDataUrl: reader.result });
              setMerchant(parsed.merchant);
              setCategory(parsed.category);
              setAmount(parsed.amount ? String(parsed.amount) : '');
              setExpenseDate(parsed.expenseDate);
              setDescription(parsed.description);
              setVoiceTranscript(parsed.transcript);
            } catch (err: any) {
              setError(err.message || 'Ses kaydı çözümlenemedi.');
            } finally {
              setParsingVoice(false);
            }
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Mikrofon izni verilmedi. Lütfen tarayıcı izinlerinden mikrofonu açın.');
    }
  };

  const stopVoiceRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleParseVoiceText = async () => {
    if (!voiceInputText.trim()) return;
    setParsingVoice(true);
    setError(null);
    try {
      const { parsed } = await api.parseVoice({ transcriptText: voiceInputText.trim() });
      setMerchant(parsed.merchant);
      setCategory(parsed.category);
      setAmount(parsed.amount ? String(parsed.amount) : '');
      setExpenseDate(parsed.expenseDate);
      setDescription(parsed.description);
      setVoiceTranscript(parsed.transcript);
    } catch (err: any) {
      setError(err.message || 'Ses metni çözümlenemedi.');
    } finally {
      setParsingVoice(false);
    }
  };

  const submitExpense = async (forceDuplicate = false) => {
    if (!merchant.trim()) {
      setError('Satıcı veya yer adı zorunludur.');
      return;
    }
    if (numericAmount <= 0) {
      setError('Geçerli bir dip toplam tutar girin.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isEditing && editingExpense) {
        await api.updateExpense(editingExpense.id, {
          targetUserId: userRole === 'admin' ? Number(targetUserId) : undefined,
          merchant: merchant.trim(),
          receiptNumber,
          category,
          paymentMethod,
          amount: numericAmount,
          expenseDate,
          description,
          receiptImageDataUrl,
          editReason: editReason.trim(),
        });
      } else {
        let finalCoords = coords;
        if (!finalCoords && locStatus === 'fetching') {
          finalCoords = await Promise.race([
            requestLocation(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
          ]);
        }

        await api.createExpense({
          targetUserId: userRole === 'admin' ? Number(targetUserId) : undefined,
          merchant: merchant.trim(),
          receiptNumber,
          category,
          paymentMethod,
          amount: numericAmount,
          expenseDate,
          description,
          receiptImageDataUrl,
          voiceNoteDataUrl,
          voiceTranscript,
          latitude: finalCoords?.latitude ?? null,
          longitude: finalCoords?.longitude ?? null,
          locationAccuracy: finalCoords?.accuracy ?? null,
          forceDuplicate,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      if (err.status === 409 && err.payload?.duplicate) {
        setDuplicateInfo(err.payload.duplicate);
      } else {
        setError(err.message || 'Masraf kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 shrink-0" />
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 id="expense-modal-title" className="font-display text-lg font-bold text-slate-900">
              {isEditing ? 'Masraf Kaydını Düzelt' : 'Yeni Masraf Kaydı'}
            </h2>
            {!isEditing ? (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                <span>
                  {locStatus === 'captured'
                    ? 'Konum bilgisi eklendi (Yalnızca Admin görebilir)'
                    : locStatus === 'fetching'
                    ? 'Konum bilgisi alınıyor...'
                    : 'Konum izni alınamadı, konumsuz kaydedilecek'}
                </span>
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                Yapılan değişiklikler Admin hareket günlüğüne kaydedilir.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Formu Kapat"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
          {/* Receipt Scan & Voice Entry Toolbar */}
          {!isEditing && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Hızlı Fiş Okutma &amp; Sesli Giriş (Dip Toplam Alınır)
                </span>
                {scanning && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Fiş okunuyor...
                  </span>
                )}
                {parsingVoice && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Ses çözümleniyor...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={scanning}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                    initialMode === 'scan'
                      ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Camera className="h-4 w-4 shrink-0" />
                  <span>Kamera Çek</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Fiş Yükle</span>
                </button>

                <button
                  type="button"
                  onClick={handleUseSampleReceipt}
                  disabled={scanning}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <FileText className="h-4 w-4 shrink-0 text-teal-700" />
                  <span>Örnek Fiş Dene</span>
                </button>

                <button
                  type="button"
                  onClick={recording ? stopVoiceRecording : startVoiceRecording}
                  disabled={parsingVoice}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    recording
                      ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
                      : initialMode === 'voice'
                      ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {recording ? <Square className="h-4 w-4 shrink-0" /> : <Mic className="h-4 w-4 shrink-0" />}
                  <span>{recording ? 'Kaydı Durdur' : 'Sesle Ekle'}</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Sesli veya hızlı metin diktesi"
                  value={voiceInputText}
                  onChange={(e) => setVoiceInputText(e.target.value)}
                  placeholder='Örn: "Shell istasyonundan 1800 TL dizel yakıt aldım"'
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-teal-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleParseVoiceText}
                  disabled={parsingVoice || !voiceInputText.trim()}
                  className="min-h-[44px] rounded-xl bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Çözümle
                </button>
              </div>

              {receiptImageDataUrl && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={receiptImageDataUrl}
                    alt="Yüklenen fiş önizlemesi"
                    referrerPolicy="no-referrer"
                    className="h-14 w-12 rounded-lg object-cover border border-slate-200"
                  />
                  <div className="text-xs text-slate-600">
                    <div className="font-medium text-slate-800">Fiş görseli eklendi</div>
                    <button
                      type="button"
                      onClick={() => setReceiptImageDataUrl(null)}
                      className="text-rose-600 hover:underline mt-0.5"
                    >
                      Görseli kaldır
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          {duplicateInfo && (
            <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-semibold">Mükerrer Fiş Uyarısı</div>
                  <p>
                    Sistemde <strong>{duplicateInfo.merchant}</strong> için{' '}
                    <strong>{duplicateInfo.expenseDate}</strong> tarihinde{' '}
                    <strong className="font-mono">{duplicateInfo.amount.toFixed(2)} TL</strong> tutarında bir kayıt zaten mevcut. Yine de kaydetmek istiyor musunuz?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDuplicateInfo(null)}
                  className="min-h-[40px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => submitExpense(true)}
                  disabled={saving}
                  className="min-h-[40px] rounded-xl bg-amber-700 px-3.5 text-xs font-medium text-white hover:bg-amber-800"
                >
                  Yine de Kaydet
                </button>
              </div>
            </div>
          )}

          {/* Admin: Enter Expense on Behalf of Any User */}
          {userRole === 'admin' && allUsers.length > 0 && (
            <div>
              <label htmlFor="exp-owner" className="block text-xs font-medium text-slate-700 mb-1.5">
                Masraf Sahibi (Kimin Adına?)
              </label>
              <select
                id="exp-owner"
                value={targetUserId}
                onChange={(e) => handleTargetUserChange(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role === 'admin' ? 'Admin' : u.role === 'ortak' ? 'Ortak' : 'Çalışan'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Simple Expense Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="exp-merchant" className="block text-xs font-medium text-slate-700 mb-1.5">
                Satıcı / Yer Adı *
              </label>
              <input
                id="exp-merchant"
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="Örn: Anadolu Akaryakıt A.Ş."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="exp-amount" className="block text-xs font-medium text-slate-700 mb-1.5">
                Toplam Tutar (Dip Toplam TL) *
              </label>
              <input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="exp-category" className="block text-xs font-medium text-slate-700 mb-1.5">
                Kategori
              </label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                Tarih
              </label>
              <input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="exp-payment" className="block text-xs font-medium text-slate-700 mb-1.5">
                Ödeme Şekli
              </label>
              <select
                id="exp-payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exp-receipt-no" className="block text-xs font-medium text-slate-700 mb-1.5">
                Fiş / Fatura No (Opsiyonel)
              </label>
              <input
                id="exp-receipt-no"
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="Örn: 0482"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="exp-desc" className="block text-xs font-medium text-slate-700 mb-1.5">
              Açıklama / Not
            </label>
            <textarea
              id="exp-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Harcama amacı veya kısa not..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {isEditing && (
            <div>
              <label htmlFor="exp-edit-reason" className="block text-xs font-medium text-slate-700 mb-1.5">
                Düzeltme Nedeni (Opsiyonel)
              </label>
              <input
                id="exp-edit-reason"
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Örn: Fiş dip toplamı düzeltildi"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => submitExpense(false)}
            disabled={saving}
            className="min-h-[44px] rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>{saving ? 'Kaydediliyor...' : isEditing ? 'Değişiklikleri Kaydet' : 'Masrafı Kaydet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
