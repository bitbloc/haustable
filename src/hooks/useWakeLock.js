import { useState, useEffect, useCallback, useRef } from 'react';

export const useWakeLock = ({ onRequest, onRelease, onError } = {}) => {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef(null);

  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const request = useCallback(async () => {
    if (!isSupported) {
      return;
    }
    try {
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      setIsLocked(true);
      if (onRequest) onRequest();

      lock.addEventListener('release', () => {
        setIsLocked(false);
        wakeLockRef.current = null;
        if (onRelease) onRelease();
      });
    } catch (err) {
      if (onError) onError(err);
      console.error(err);
    }
  }, [isSupported, onRequest, onRelease, onError]);

  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, []);

  // Re-request lock if visibility changes (e.g. user switches tabs and comes back)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isLocked) {
        await request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLocked, request]);

  return { isSupported, isLocked, request, release };
};
