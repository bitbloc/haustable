import { supabase } from '../lib/supabaseClient';

/**
 * Parses raw receipt_image_url field into an array of clean, valid image URLs / Base64 data strings.
 * Handles:
 * - Single Base64 Data URL (e.g. data:image/jpeg;base64,/9j/...) without splitting the base64 comma
 * - Delimited Base64 strings (joined with |||, \n, or legacy commas)
 * - Single Supabase Storage HTTP URL
 * - Comma-delimited Supabase Storage HTTP URLs
 * - JSON Array string
 * 
 * @param {string|string[]|null} raw 
 * @returns {string[]} Array of valid image URLs
 */
export function parseReceiptUrls(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw !== 'string') return [];

    const trimmed = raw.trim();
    if (!trimmed) return [];

    // 1. JSON Array format: '["url1", "url2"]'
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.filter(Boolean);
            }
        } catch {
            // Ignore and proceed to text delimiters
        }
    }

    // 2. Custom delimiter |||
    if (trimmed.includes('|||')) {
        return trimmed.split('|||').map(s => s.trim()).filter(Boolean);
    }

    // 3. Newline delimiter
    if (trimmed.includes('\n')) {
        return trimmed.split('\n').map(s => s.trim()).filter(Boolean);
    }

    // 4. Base64 Data URLs (May contain single data URL or multiple joined data URLs)
    if (trimmed.includes('data:image/')) {
        // Use positive lookahead for data:image/ to avoid splitting within a base64 payload
        const parts = trimmed
            .split(/(?=data:image\/)/g)
            .map(s => s.replace(/^,+|,+$/g, '').trim())
            .filter(s => s.startsWith('data:image/'));

        if (parts.length > 0) {
            return parts;
        }
    }

    // 5. Standard Comma-separated HTTP/HTTPS URLs (e.g. Supabase Storage)
    if (trimmed.includes(',')) {
        return trimmed
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }

    // 6. Single URL
    return [trimmed];
}

/**
 * Safely joins an array of receipt URLs into a string suitable for storage.
 * @param {string[]} urls 
 * @returns {string|null}
 */
export function joinReceiptUrls(urls = []) {
    if (!urls || urls.length === 0) return null;
    const cleanList = urls.filter(Boolean);
    if (cleanList.length === 0) return null;
    if (cleanList.length === 1) return cleanList[0];

    // If any item is a Data URL, join with '|||' to prevent comma collisions
    const hasDataUrl = cleanList.some(u => typeof u === 'string' && u.startsWith('data:'));
    if (hasDataUrl) {
        return cleanList.join('|||');
    }

    return cleanList.join(',');
}

/**
 * Converts an image file or canvas blob to a compressed Base64 Data URL
 * @param {File|Blob} file 
 * @param {number} maxDimension 
 * @param {number} quality 
 * @returns {Promise<{ base64: string, blob: Blob }>}
 */
export function compressImageFile(file, maxDimension = 1800, quality = 0.90) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round(height * (maxDimension / width));
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round(width * (maxDimension / height));
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const base64 = canvas.toDataURL('image/jpeg', quality);
                canvas.toBlob((blob) => {
                    resolve({ base64, blob: blob || file });
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/**
 * Uploads an image blob or file to Supabase Storage 'receipts' bucket.
 * @param {Blob|File} fileOrBlob 
 * @param {string} [customFileName] 
 * @returns {Promise<string|null>} Public URL of uploaded receipt or null on failure
 */
export async function uploadReceiptToStorage(fileOrBlob, customFileName = null) {
    if (!fileOrBlob) return null;

    try {
        const now = new Date();
        const thNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const folder = thNow.toISOString().slice(0, 7);
        const randId = Math.random().toString(36).substring(2, 8);
        const fileName = customFileName || `${folder}/web_${Date.now()}_${randId}.jpg`;

        const { data, error } = await supabase.storage
            .from('receipts')
            .upload(fileName, fileOrBlob, {
                contentType: fileOrBlob.type || 'image/jpeg',
                upsert: true
            });

        if (error) {
            console.warn('Supabase storage upload error:', error);
            return null;
        }

        if (data) {
            const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
            return urlData?.publicUrl || null;
        }
    } catch (err) {
        console.warn('Storage upload exception (falling back to Base64):', err);
    }

    return null;
}

/**
 * Converts an HTTP image URL to a Base64 data URL with CORS support
 * @param {string} url 
 * @returns {Promise<string>}
 */
export async function urlToBase64(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('data:')) return url;

    try {
        const res = await fetch(url, { mode: 'cors' });
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn('Failed to fetch image URL for base64 conversion:', err);
        return url;
    }
}
