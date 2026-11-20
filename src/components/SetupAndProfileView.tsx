import React, { useEffect, useState } from 'react';
import {
  Building2,
  Camera,
  Check,
  KeyRound,
  MapPin,
  Mic,
  Smartphone,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import type { CompanySettings, User } from '../types';
import type { UserRole } from '../utils/accounting';
import type { DevicePermissions } from '../hooks/usePWAInstall';
import { PWAInstallButton } from './PWAInstallButton';

interface SetupAndProfileViewProps {
  currentUser: User;
  company: CompanySettings;
  permissions: DevicePermissions;
  onRequestLocation: () => Promise<unknown>;
  onRequestCamera: () => Promise<boolean>;
  onRequestMicrophone: () => Promise<boolean>;
  onRequestAllPermissions: () => Promise<void>;
  onProfileUpdated: (user: User) => void;
  onCompanyUpdated: (company: CompanySettings) => void;
}

export const SetupAndProfileView: React.FC<SetupAndProfileViewProps> = ({
  currentUser,
  company,
  permissions,
  onRequestLocation,
  onRequestCamera,
  onRequestMicrophone,
  onRequestAllPermissions,
  onProfileUpdated,
  onCompanyUpdated,
}) => {
  // Profile state
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [department, setDepartment] = useState(currentUser.department);
  const [phone, setPhone] = useState(currentUser.phone);
  const [iban, setIban] = useState(currentUser.iban);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin Company Setup state
  const [companyName, setCompanyName] = useState(company.companyName);
  const [shortName, setShortName] = useState(company.shortName);
  const [taxNumber, setTaxNumber] = useState(company.taxNumber || '');
  const [taxOffice, setTaxOffice] = useState(company.taxOffice || '');
  const [monthlyCompanyBudget, setMonthlyCompanyBudget] = useState(
    String(company.monthlyCompanyBudget ?? 120000)
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(company.logoDataUrl || null);
  const [pwaIconDataUrl, setPwaIconDataUrl] = useState<string | null>(company.pwaIconDataUrl || null);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMsg, setCompanyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin Team Management state
  const [team, setTeam] = useState<User[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('calisan');
  const [newUserDept, setNewUserDept] = useState('Saha');
  const [newUserBudget, setNewUserBudget] = useState('15000');
  const [newUserPass, setNewUserPass] = useState('');
  const [teamMsg, setTeamMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setFullName(currentUser.fullName);
    setDepartment(currentUser.department);
    setPhone(currentUser.phone);
    setIban(currentUser.iban);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser.role !== 'admin') return;
    api
      .listUsers()
      .then((res) => setTeam(res.users))
      .catch(() => {});
  }, [currentUser.role]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await api.updateProfile({
        fullName,
        department,
        phone,
        iban,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      onProfileUpdated(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setProfileMsg({ type: 'ok', text: 'Profil ve şifre bilgileriniz güncellendi.' });
    } catch (err: any) {
      setProfileMsg({ type: 'err', text: err.message || 'Profil kaydedilemedi.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleImagePick = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logo' | 'pwaIcon'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (target === 'logo') setLogoDataUrl(reader.result);
        else setPwaIconDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySaving(true);
    setCompanyMsg(null);
    try {
      const res = await api.updateCompanySettings({
        companyName,
        shortName: shortName.slice(0, 12),
        taxNumber,
        taxOffice,
        logoDataUrl,
        pwaIconDataUrl,
        monthlyCompanyBudget: Number(monthlyCompanyBudget) || 120000,
        setupCompleted: true,
      });
      onCompanyUpdated(res.company);
      setCompanyMsg({
        type: 'ok',
        text: 'Firma bilgileri, logo ve Android PWA mobil sembolü kaydedildi.',
      });
    } catch (err: any) {
      setCompanyMsg({ type: 'err', text: err.message || 'Kurulum kaydedilemedi.' });
    } finally {
      setCompanySaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamMsg(null);
    try {
      const res = await api.createUser({
        email: newUserEmail,
        fullName: newUserName,
        role: newUserRole,
        department: newUserDept,
        phone: '',
        iban: '',
        monthlyBudgetLimit: Number(newUserBudget) || 15000,
        password: newUserPass,
      });
      setTeam((prev) => [...prev, res.user]);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPass('');
      setTeamMsg({ type: 'ok', text: `${res.user.fullName} ekibe eklendi.` });
    } catch (err: any) {
      setTeamMsg({ type: 'err', text: err.message || 'Kullanıcı eklenemedi.' });
    }
  };

  const handleRoleChange = async (userId: number, role: UserRole) => {
    try {
      const res = await api.updateUser(userId, { role });
      setTeam((prev) => prev.map((u) => (u.id === userId ? res.user : u)));
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Device Permissions & Android PWA Install */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Android PWA Kurulumu ve Cihaz İzinleri
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Konum koordinatları, fiş kamerası ve sesli giriş izinlerini buradan yönetebilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PWAInstallButton />
            <button
              type="button"
              onClick={onRequestAllPermissions}
              className="min-h-[44px] rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              Tüm İzinleri İste
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-teal-700 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Konum (GPS)</div>
                <div className="text-[11px] text-slate-500">
                  {permissions.location === 'granted' ? 'İzin Verildi' : permissions.location === 'denied' ? 'Engelli' : 'Bekliyor'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRequestLocation()}
              className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              İzin Al
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Camera className="h-4 w-4 text-teal-700 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Kamera</div>
                <div className="text-[11px] text-slate-500">
                  {permissions.camera === 'granted' ? 'İzin Verildi' : permissions.camera === 'denied' ? 'Engelli' : 'Bekliyor'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRequestCamera()}
              className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              İzin Al
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mic className="h-4 w-4 text-teal-700 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Mikrofon (Ses)</div>
                <div className="text-[11px] text-slate-500">
                  {permissions.microphone === 'granted' ? 'İzin Verildi' : permissions.microphone === 'denied' ? 'Engelli' : 'Bekliyor'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRequestMicrophone()}
              className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              İzin Al
            </button>
          </div>
        </div>
      </section>

      {/* Profile & Password Settings (All Roles) */}
      <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-teal-700" />
          <h2 className="font-display text-base font-bold text-slate-900">
            Profil Bilgileri ve Şifre Güncelleme
          </h2>
        </div>

        {profileMsg && (
          <div
            role="status"
            className={`rounded-xl px-4 py-3 text-xs font-medium border ${
              profileMsg.type === 'ok'
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {profileMsg.text}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700 mb-1.5">
              Ad Soyad
            </label>
            <input
              id="prof-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="prof-dept" className="block text-xs font-medium text-slate-700 mb-1.5">
              Departman / Görev
            </label>
            <input
              id="prof-dept"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="prof-phone" className="block text-xs font-medium text-slate-700 mb-1.5">
              Telefon
            </label>
            <input
              id="prof-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="prof-iban" className="block text-xs font-medium text-slate-700 mb-1.5">
              Geri Ödeme IBAN Numarası
            </label>
            <input
              id="prof-iban"
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="prof-cur-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
              Mevcut Şifre (Şifre değişecekse)
            </label>
            <input
              id="prof-cur-pass"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="prof-new-pass" className="block text-xs font-medium text-slate-700 mb-1.5">
              Yeni Şifre (En az 6 karakter)
            </label>
            <input
              id="prof-new-pass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="min-h-[44px] rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 inline-flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              <span>{profileSaving ? 'Kaydediliyor...' : 'Profili Güncelle'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Admin-Only Company Initial Setup (Logo & Android PWA Mobile Icon) */}
      {currentUser.role === 'admin' && (
        <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-700" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Kurum Kurulumu, Logo ve PWA Mobil Uygulama Sembolü
              </h2>
              <p className="text-xs text-slate-500">
                Yüklediğiniz Android PWA ikonu uygulama manifestine otomatik işlenir.
              </p>
            </div>
          </div>

          {companyMsg && (
            <div
              role="status"
              className={`rounded-xl px-4 py-3 text-xs font-medium border ${
                companyMsg.type === 'ok'
                  ? 'bg-teal-50 border-teal-200 text-teal-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {companyMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="comp-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Firma Unvanı
                </label>
                <input
                  id="comp-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="comp-short" className="block text-xs font-medium text-slate-700 mb-1.5">
                  PWA Kısa Ad (En fazla 12 karakter)
                </label>
                <input
                  id="comp-short"
                  type="text"
                  maxLength={12}
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="comp-vkn" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Vergi Numarası (VKN)
                </label>
                <input
                  id="comp-vkn"
                  type="text"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="comp-budget" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Aylık Firma Masraf Bütçesi (TRY)
                </label>
                <input
                  id="comp-budget"
                  type="number"
                  value={monthlyCompanyBudget}
                  onChange={(e) => setMonthlyCompanyBudget(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {logoDataUrl ? (
                    <img
                      src={logoDataUrl}
                      alt="Firma Logosu"
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-xl object-contain border border-slate-200 p-1 bg-white shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">Firma Logosu</div>
                    <div className="text-[11px] text-slate-500">Üst menü ve rapor başlığı</div>
                  </div>
                </div>
                <label className="min-h-[40px] rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Logo Seç</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImagePick(e, 'logo')}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {pwaIconDataUrl ? (
                    <img
                      src={pwaIconDataUrl}
                      alt="PWA Mobil İkon"
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-2xl object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                      <Smartphone className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900">PWA Mobil Sembol</div>
                    <div className="text-[11px] text-slate-500">Android ana ekran ikonu (PNG)</div>
                  </div>
                </div>
                <label className="min-h-[40px] rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  <span>İkon Seç</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleImagePick(e, 'pwaIcon')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={companySaving}
                className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 inline-flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>{companySaving ? 'Kaydediliyor...' : 'Kurumsal Ayarları Kaydet'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Admin-Only Team & Role Management */}
      {currentUser.role === 'admin' && (
        <section className="rounded-2xl bg-white border border-slate-200 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-700" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Ekip, Ortak ve Çalışan Yönetimi
            </h2>
          </div>

          {teamMsg && (
            <div
              role="status"
              className={`rounded-xl px-4 py-3 text-xs font-medium border ${
                teamMsg.type === 'ok'
                  ? 'bg-teal-50 border-teal-200 text-teal-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {teamMsg.text}
            </div>
          )}

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {team.map((member) => (
              <div key={member.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{member.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {member.email} · {member.department} · Limit:{' '}
                    <span className="font-mono">{member.monthlyBudgetLimit.toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    aria-label={`${member.fullName} rolü`}
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                    className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
                  >
                    <option value="admin">Admin</option>
                    <option value="ortak">Ortak</option>
                    <option value="calisan">Çalışan</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddUser} className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-teal-700" />
              <span>Yeni Ortak veya Çalışan Ekle</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                aria-label="Yeni kullanıcı adı soyadı"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Ad Soyad"
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs"
              />
              <input
                type="email"
                required
                aria-label="Yeni kullanıcı e-posta"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="eposta@firma.com"
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs"
              />
              <input
                type="password"
                required
                aria-label="Başlangıç şifresi"
                value={newUserPass}
                onChange={(e) => setNewUserPass(e.target.value)}
                placeholder="Başlangıç Şifresi"
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs"
              />
              <select
                aria-label="Rol seçimi"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs"
              >
                <option value="calisan">Çalışan</option>
                <option value="ortak">Ortak</option>
                <option value="admin">Admin</option>
              </select>
              <input
                type="text"
                aria-label="Departman"
                value={newUserDept}
                onChange={(e) => setNewUserDept(e.target.value)}
                placeholder="Departman"
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs"
              />
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800"
              >
                Kullanıcı Ekle
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};
