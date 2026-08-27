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

/**
 * Appends a cache-busting timestamp to HTTP/HTTPS or relative URLs,
 * but safely ignores Base64 Data URLs and Blob URLs to prevent malformed URL errors.
 */
export function safeTimestampUrl(url, timestamp = Date.now()) {
  if (!url || typeof url !== 'string') return url || '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  const hasParams = trimmed.includes('?');
  return `${trimmed}${hasParams ? '&' : '?'}t=${timestamp}`;
}

/**
 * Safely optimizes an image URL via wsrv.nl image proxy for fast loading and reduced bandwidth.
 */
export function optimizeImageUrl(url, width = 600, quality = 80) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('/') || !trimmed.startsWith('http')) {
    return trimmed;
  }
  try {
    const cleanUrl = trimmed.split('?')[0];
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp`;
  } catch {
    return trimmed;
  }
}

/**
 * Safely formats a URL for CSS backgroundImage with surrounding double quotes.
 * This prevents CSS parsers from breaking data: URLs at commas, which would otherwise
 * cause secondary background layer relative URL fetches and HTTP 414 URI Too Large errors.
 */
export function safeCssUrl(url) {
  if (!url || typeof url !== 'string') return undefined;
  const clean = url.trim().replace(/"/g, '\\"');
  return `url("${clean}")`;
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks if a value is a valid UUID string, rejecting 'null', 'undefined', objects, and malformed strings.
 */
export function isValidUuid(val) {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed === 'null' || trimmed === 'undefined' || trimmed === '[object Object]') return false;
  return UUID_REGEX.test(trimmed);
}

/**
 * Returns the UUID string if valid, otherwise returns null.
 */
export function safeUuid(val) {
  return isValidUuid(val) ? val.trim() : null;
}

