import { useState, useEffect, useCallback, useRef } from 'react';

export const useWakeLock = ({ onRequest, onRelease, onError } = {}) => {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef(null);
  const wantsLockRef = useRef(false);

  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const request = useCallback(async () => {
    if (!isSupported) {
      return;
    }
    wantsLockRef.current = true;

    // Guard against redundant duplicate lock requests
    if (wakeLockRef.current && !wakeLockRef.current.released) {
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
      console.error('WakeLock request error:', err);
    }
  }, [isSupported, onRequest, onRelease, onError]);

  const release = useCallback(async () => {
    wantsLockRef.current = false;
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err) {
        console.warn('WakeLock release error:', err);
      }
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, []);

  // Re-request lock if visibility changes and app wants lock active
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wantsLockRef.current) {
        await request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [request]);

  return { isSupported, isLocked, request, release };
};
