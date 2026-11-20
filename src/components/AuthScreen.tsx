import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Camera, CheckCircle2, Lock, Mail, MapPin, Mic, ShieldCheck } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { api, setAuthToken } from '../lib/api';
import type { CompanySettings, User } from '../types';
import type { UserRole } from '../utils/accounting';
import type { DevicePermissions } from '../hooks/usePWAInstall';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthScreenProps {
  company: CompanySettings;
  permissions: DevicePermissions;
  onRequestAllPermissions: () => Promise<void>;
  onAuthenticated: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  company,
  permissions,
  onRequestAllPermissions,
  onAuthenticated,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Lütfen e-posta ve şifrenizi girin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.loginWithPassword(email.trim(), password);
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      const me = await api.getMe();
      onAuthenticated(me.user);
    } catch (err: any) {
      setError(err.message || 'Google ile giriş tamamlanamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoRoleLogin = async (role: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.demoLogin(role);
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Demo oturumu açılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPerms = async () => {
    setPermLoading(true);
    try {
      await onRequestAllPermissions();
    } finally {
      setPermLoading(false);
    }
  };

  const permCount = [permissions.location, permissions.camera, permissions.microphone].filter(
    (s) => s === 'granted'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-5xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {company.logoDataUrl ? (
            <img
              src={company.logoDataUrl}
              alt={company.companyName}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-display font-bold text-lg shrink-0">
              {(company.shortName || 'M').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-display font-bold text-slate-900 text-lg truncate">
            {company.companyName}
          </span>
        </div>
        <PWAInstallButton compact />
      </div>

      <main className="mx-auto w-full max-w-5xl my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <section className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-teal-700 tracking-wide">
              Kurumsal Mobil Masraf Takip Platformu
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight text-balance">
              Fiş okutun, masrafları kaydedin, ekibi tek yerden yönetin.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Çalışan, Ortak ve Admin rolleri için tasarlanmış Android PWA uyumlu sade masraf takip sistemi. Fişinizin dip toplamı otomatik okunur; düzeltme ve silme hareketleri Admin günlüğüne işlenir.
            </p>
          </div>

          {/* Initial Loading / Setup Permissions Card */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Cihaz İzinleri Kurulumu ({permCount}/3 Hazır)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fiş çekimi, sesli masraf girişi ve saha konum doğrulaması için gereklidir.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRequestPerms}
                disabled={permLoading}
                className="min-h-[44px] rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {permLoading ? 'İsteniyor...' : 'İzinleri Etkinleştir'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 text-slate-700 py-1">
                <MapPin className={`h-4 w-4 shrink-0 ${permissions.location === 'granted' ? 'text-teal-700' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">Konum</div>
                  <div className="text-[11px] text-slate-500">
                    {permissions.location === 'granted' ? 'Aktif' : permissions.location === 'denied' ? 'Engelli' : 'Bekliyor'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-700 py-1">
                <Camera className={`h-4 w-4 shrink-0 ${permissions.camera === 'granted' ? 'text-teal-700' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">Kamera</div>
                  <div className="text-[11px] text-slate-500">
                    {permissions.camera === 'granted' ? 'Aktif' : permissions.camera === 'denied' ? 'Engelli' : 'Bekliyor'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-700 py-1">
                <Mic className={`h-4 w-4 shrink-0 ${permissions.microphone === 'granted' ? 'text-teal-700' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">Ses</div>
                  <div className="text-[11px] text-slate-500">
                    {permissions.microphone === 'granted' ? 'Aktif' : permissions.microphone === 'denied' ? 'Engelli' : 'Bekliyor'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6">
          <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Hesabınıza Giriş Yapın</h2>
              <p className="text-xs text-slate-500 mt-1">
                Kurumsal şifrenizle veya Google hesabınızla devam edin.
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-800">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Kurumsal E-posta
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="adiniz@firma.com"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors disabled:opacity-60"
              >
                {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-xs text-slate-400 whitespace-nowrap">veya</span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2.5"
            >
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              <span>Google Hesabı ile Giriş Yap</span>
            </button>

            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Hızlı Rol Testi (Demo Hesapları)</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoRoleLogin('admin')}
                  disabled={loading}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  Admin Girişi
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoRoleLogin('ortak')}
                  disabled={loading}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  Ortak Girişi
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoRoleLogin('calisan')}
                  disabled={loading}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                >
                  Çalışan Girişi
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-slate-400">
        {company.companyName} · Mobil Masraf Takip Sistemi
      </footer>
    </div>
  );
};
