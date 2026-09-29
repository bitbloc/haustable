/**
 * Universal Client-Side Image Pre-Compression Utility
 * 
 * Compresses images in the browser before uploading to Supabase Storage:
 * 1. Resizes high-resolution photos (e.g. 4000x3000 from mobile phones) down to max 1000px
 * 2. Converts to modern WebP format (with JPEG fallback)
 * 3. Drastically reduces file sizes from 5MB-10MB down to ~80KB-150KB (90-98% savings)
 * 4. Preserves Supabase storage capacity, egress bandwidth, and speeds up customer page loads
 */

export async function compressImageFile(file, maxWidth = 1000, maxHeight = 1000, quality = 0.82) {
    if (!file || typeof file !== 'object') {
        return file;
    }

    // SSR or Node/Vitest environment safety check
    if (typeof window === 'undefined' || typeof document === 'undefined' || !window.FileReader) {
        return file;
    }

    // Check if the file is an image
    const mime = file.type || '';
    if (mime && !mime.startsWith('image/')) {
        return file;
    }

    // SVG, GIF (animations), or text/vector files should not be flattened via canvas
    if (mime.includes('svg') || mime.includes('gif')) {
        return file;
    }

    return new Promise((resolve) => {
        // Safety timeout in case image loading hangs or in headless environments without full image decoders
        const timer = setTimeout(() => resolve(file), 2000);

        try {
            const reader = new FileReader();
            reader.onerror = () => {
                clearTimeout(timer);
                resolve(file);
            };
            reader.onload = (event) => {
                const img = new Image();
                img.onerror = () => {
                    clearTimeout(timer);
                    resolve(file);
                };
                img.onload = () => {
                    clearTimeout(timer);
                    try {
                        let { width, height } = img;
                        if (!width || !height) {
                            return resolve(file);
                        }

                        // Maintain aspect ratio
                        if (width > height) {
                            if (width > maxWidth) {
                                height = Math.round((height * maxWidth) / width);
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width = Math.round((width * maxHeight) / height);
                                height = maxHeight;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            return resolve(file);
                        }

                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, width, height);

                        // Determine best supported format (WebP with JPEG fallback)
                        let targetMime = 'image/webp';
                        let targetExt = '.webp';

                        try {
                            const testUrl = canvas.toDataURL('image/webp');
                            if (!testUrl.startsWith('data:image/webp')) {
                                targetMime = 'image/jpeg';
                                targetExt = '.jpg';
                            }
                        } catch {
                            targetMime = 'image/jpeg';
                            targetExt = '.jpg';
                        }

                        canvas.toBlob(
                            (blob) => {
                                if (!blob) {
                                    return resolve(file);
                                }

                                const originalName = file.name || 'image';
                                const cleanBaseName = originalName.replace(/\.[^/.]+$/, '');
                                const finalName = `${cleanBaseName}${targetExt}`;

                                const compressedFile = new File([blob], finalName, {
                                    type: targetMime,
                                    lastModified: Date.now()
                                });

                                resolve(compressedFile);
                            },
                            targetMime,
                            quality
                        );
                    } catch (err) {
                        console.warn('[imageOptimizer] Canvas processing failed, falling back to original:', err);
                        resolve(file);
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.warn('[imageOptimizer] FileReader initialization failed:', err);
            resolve(file);
        }
    });
}
