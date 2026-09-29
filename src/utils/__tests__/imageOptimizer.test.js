import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageFile } from '../imageOptimizer';

describe('imageOptimizer (Client-side pre-compression)', () => {
    it('returns null/undefined/non-objects safely without throwing', async () => {
        expect(await compressImageFile(null)).toBe(null);
        expect(await compressImageFile(undefined)).toBe(undefined);
        expect(await compressImageFile('some-string')).toBe('some-string');
    });

    it('bypasses non-image files such as pdf or txt', async () => {
        const dummyPdf = new File(['%PDF-1.4'], 'invoice.pdf', { type: 'application/pdf' });
        const result = await compressImageFile(dummyPdf);
        expect(result).toBe(dummyPdf);
    });

    it('bypasses svg and gif files to prevent flattening animations or vectors', async () => {
        const svgFile = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' });
        const gifFile = new File(['GIF89a'], 'animation.gif', { type: 'image/gif' });

        expect(await compressImageFile(svgFile)).toBe(svgFile);
        expect(await compressImageFile(gifFile)).toBe(gifFile);
    });

    it('resizes and converts image to WebP when canvas pipeline succeeds', async () => {
        // Mock canvas and FileReader
        const originalFileReader = global.FileReader;
        const originalImage = global.Image;

        class MockFileReader {
            readAsDataURL() {
                setTimeout(() => {
                    if (this.onload) this.onload({ target: { result: 'data:image/jpeg;base64,mock' } });
                }, 10);
            }
        }

        class MockImage {
            constructor() {
                this.width = 2000;
                this.height = 1000;
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 20);
            }
        }

        const mockCanvas = {
            width: 0,
            height: 0,
            getContext: () => ({
                drawImage: vi.fn(),
                imageSmoothingEnabled: false,
                imageSmoothingQuality: 'low'
            }),
            toDataURL: (type) => `data:${type};base64,mock`,
            toBlob: (cb, type) => {
                cb(new Blob(['mock-webp-data'], { type: 'image/webp' }));
            }
        };

        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'canvas') return mockCanvas;
            return originalCreateElement(tag);
        });

        global.FileReader = MockFileReader;
        global.Image = MockImage;

        try {
            const rawFile = new File(['fake-jpg-bytes'], 'dish-photo.jpg', { type: 'image/jpeg' });
            const compressed = await compressImageFile(rawFile, 1000, 1000, 0.82);

            expect(compressed).toBeDefined();
            expect(compressed.name).toBe('dish-photo.webp');
            expect(compressed.type).toBe('image/webp');
            expect(mockCanvas.width).toBe(1000);
            expect(mockCanvas.height).toBe(500); // 2000x1000 scaled down maintains 2:1 aspect ratio
        } finally {
            global.FileReader = originalFileReader;
            global.Image = originalImage;
            vi.restoreAllMocks();
        }
    });
});
