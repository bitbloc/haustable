import { useState, useEffect, useCallback } from 'react';

export const useWakeLock = ({ onRequest, onRelease, onError }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [wakeLock, setWakeLock] = useState(null);

  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const request = useCallback(async () => {
    if (!isSupported) {
      return;
    }
    try {
      const lock = await navigator.wakeLock.request('screen');
      setWakeLock(lock);
      setIsLocked(true);
      if (onRequest) onRequest();

      lock.addEventListener('release', () => {
        setIsLocked(false);
        setWakeLock(null);
        if (onRelease) onRelease();
      });
    } catch (err) {
      if (onError) onError(err);
      console.error(err);
    }
  }, [isSupported, onRequest, onRelease, onError]);

  const release = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      setIsLocked(false);
    }
  }, [wakeLock]);

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
