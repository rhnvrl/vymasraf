import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" />
        <span>{compact ? 'Yükle' : 'Android Uygulamasını Yükle'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
      >
        <Smartphone className="h-4 w-4 text-teal-700" />
        <span>{compact ? 'PWA Yükle' : isIOS ? 'iPhone’a Ekle' : 'Uygulamayı Kur'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-lg font-semibold text-slate-900">
                Ana Ekrana Ekle (PWA)
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Kapat"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {isIOS ? (
              <ol className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
                <li>1. Safari alt menüsündeki <strong>Paylaş</strong> simgesine dokunun.</li>
                <li>2. Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> seçeneğini seçin.</li>
                <li>3. Sağ üstten <strong>Ekle</strong> butonuna basın.</li>
              </ol>
            ) : (
              <ol className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
                <li>1. Android Chrome sağ üst menüsünü (<strong>⋮</strong>) açın.</li>
                <li>2. <strong>Ana ekrana ekle</strong> veya <strong>Uygulamayı yükle</strong> seçeneğine dokunun.</li>
                <li>3. Kurum simgesiyle tam ekran uygulama olarak açılacaktır.</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:w-auto flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Çevrimdışı Mod · Bağlantı geri geldiğinde senkronize edilir.</span>
    </div>
  );
};
