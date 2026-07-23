import { Capacitor } from '@capacitor/core';

export const PUBLIC_DOMAIN = 'https://haustable.vercel.app';

/**
 * Returns the public domain origin for QR codes, links, shareable URLs, and redirects.
 * When running inside a native app (Capacitor) or local dev environment,
 * localhost is replaced with the public domain so scanned QR codes point to the live site.
 */
export function getAppOrigin() {
  if (
    typeof window !== 'undefined' &&
    (Capacitor.isNativePlatform() ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'capacitor:' ||
      (window.location.origin && window.location.origin.includes('localhost')))
  ) {
    return PUBLIC_DOMAIN;
  }
  return typeof window !== 'undefined' ? window.location.origin : PUBLIC_DOMAIN;
}
