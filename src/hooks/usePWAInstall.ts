import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export type PermState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface DevicePermissions {
  location: PermState;
  camera: PermState;
  microphone: PermState;
}

export function useDevicePermissions() {
  const [permissions, setPermissions] = useState<DevicePermissions>({
    location: 'prompt',
    camera: 'prompt',
    microphone: 'prompt',
  });
  const [lastCoords, setLastCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  const checkPermissions = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return;
    const next: DevicePermissions = { location: 'prompt', camera: 'prompt', microphone: 'prompt' };
    try {
      const geo = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      next.location = geo.state as PermState;
    } catch {
      next.location = 'unknown';
    }
    try {
      const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
      next.camera = cam.state as PermState;
    } catch {
      next.camera = 'unknown';
    }
    try {
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      next.microphone = mic.state as PermState;
    } catch {
      next.microphone = 'unknown';
    }
    setPermissions(next);
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const requestLocation = useCallback((): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setPermissions((p) => ({ ...p, location: 'denied' }));
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy || 0),
          };
          setLastCoords(coords);
          setPermissions((p) => ({ ...p, location: 'granted' }));
          resolve(coords);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setPermissions((p) => ({ ...p, location: 'denied' }));
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }, []);

  const requestCamera = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissions((p) => ({ ...p, camera: 'denied' }));
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions((p) => ({ ...p, camera: 'granted' }));
      return true;
    } catch {
      setPermissions((p) => ({ ...p, camera: 'denied' }));
      return false;
    }
  }, []);

  const requestMicrophone = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissions((p) => ({ ...p, microphone: 'denied' }));
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions((p) => ({ ...p, microphone: 'granted' }));
      return true;
    } catch {
      setPermissions((p) => ({ ...p, microphone: 'denied' }));
      return false;
    }
  }, []);

  const requestAll = useCallback(async () => {
    await requestLocation();
    await requestCamera();
    await requestMicrophone();
    await checkPermissions();
  }, [requestLocation, requestCamera, requestMicrophone, checkPermissions]);

  return {
    permissions,
    lastCoords,
    requestLocation,
    requestCamera,
    requestMicrophone,
    requestAll,
    refreshPermissions: checkPermissions,
  };
}
