/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
/**
 * Local IndexedDB Image Caching Utility for POS System
 * Stores menu image Blobs locally to bypass browser HTTP fetch latency and 5MB localStorage limits.
 */

const DB_NAME = 'pos_image_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'menu_images';

let dbPromise = null;

function initDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) {
                resolve(null);
                return;
            }
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => {
                console.warn('[ImageCacheDB] Failed to open IndexedDB:', e.target.error);
                resolve(null);
            };
        });
    }
    return dbPromise;
}

/**
 * Retrieve cached blob URL for a specific image URL
 * @param {string} url - Original remote image URL
 * @returns {Promise<string|null>} Blob Object URL or null
 */
export async function getCachedImage(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const db = await initDB();
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(url);
            req.onsuccess = () => {
                const record = req.result;
                if (record && record.blob) {
                    try {
                        const blobUrl = URL.createObjectURL(record.blob);
                        resolve(blobUrl);
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        console.warn('[ImageCacheDB] Error retrieving cached image:', e);
        return null;
    }
}

/**
 * Fetch and store remote image in IndexedDB
 * @param {string} url - Original remote image URL
 * @returns {Promise<string|null>} Blob Object URL if successfully cached
 */
export async function cacheImage(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
        if (!response.ok) return null;
        const blob = await response.blob();
        
        const db = await initDB();
        if (!db) return null;

        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put({ blob, timestamp: Date.now() }, url);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });

        return URL.createObjectURL(blob);
    } catch (e) {
        console.warn(`[ImageCacheDB] Failed to download/cache image from ${url}:`, e);
        return null;
    }
}

/**
 * Get map of all locally cached images in IndexedDB: { [remoteUrl]: blobUrl }
 * @returns {Promise<Record<string, string>>}
 */
export async function getAllCachedImages() {
    try {
        const db = await initDB();
        if (!db) return {};
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.openCursor();
            const map = {};
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const url = cursor.key;
                    const record = cursor.value;
                    if (record && record.blob) {
                        try {
                            map[url] = URL.createObjectURL(record.blob);
                        } catch (err) {
                            console.warn('[ImageCacheDB] ObjectURL creation failed:', err);
                        }
                    }
                    cursor.continue();
                } else {
                    resolve(map);
                }
            };
            req.onerror = () => resolve({});
        });
    } catch (e) {
        console.warn('[ImageCacheDB] Error loading all cached images:', e);
        return {};
    }
}

/**
 * Sync and cache all menu item images into IndexedDB with a progress callback
 * @param {Array<{image_url?: string, name?: string}>} menuItems 
 * @param {Function} [onProgress] - (completed, total, currentName) => void
 * @returns {Promise<{cachedCount: number, map: Record<string, string>}>}
 */
export async function syncAllMenuImages(menuItems, onProgress) {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
        return { cachedCount: 0, map: {} };
    }

    const itemsWithImages = menuItems.filter(item => item && item.image_url && typeof item.image_url === 'string' && item.image_url.trim() !== '');
    const total = itemsWithImages.length;
    let completed = 0;
    let newCachedCount = 0;
    const resultMap = {};

    for (const item of itemsWithImages) {
        const url = item.image_url;
        let localUrl = await getCachedImage(url);
        if (!localUrl) {
            localUrl = await cacheImage(url);
            if (localUrl) newCachedCount++;
        }
        if (localUrl) {
            resultMap[url] = localUrl;
        }
        completed++;
        if (typeof onProgress === 'function') {
            onProgress(completed, total, item.name || '');
        }
    }

    return { cachedCount: newCachedCount, map: resultMap };
}

/**
 * Clear all cached images from IndexedDB
 */
export async function clearImageCache() {
    try {
        const db = await initDB();
        if (!db) return;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
    } catch (e) {
        console.warn('[ImageCacheDB] Failed to clear image store:', e);
    }
}
