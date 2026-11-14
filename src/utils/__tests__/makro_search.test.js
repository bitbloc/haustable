import { describe, it, expect } from 'vitest';
import { parseMakroSearch, extractNextData, makroSearchUrl } from '../../../supabase/functions/search-api/makro.ts';

// Trimmed from a real makro.pro search page for "มะนาว" (2026-11-14)
const page = (hits) => `<!DOCTYPE html><html><body><div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialSearchResult: { found: 434, hits } } } })}</script></body></html>`;

const hits = [
    { document: { id: '6976617971907', sku: 'kmqdk-n6', title: 'มะนาวแป้น จัมโบ้ 10 ลูก', titleEn: 'Lime Jumbo 10 pcs', brand: 'แม็คโคร', displayPrice: 79, originalPrice: 79, unitSize: '10 unit(s)', inStock: 1, images: ['https://images.mango-prod.siammakro.cloud/product-images/6976617971907.jpeg'] } },
    { document: { id: '843146351499281', title: 'มะนาวเหลือง 4 ลูก', titleEn: 'Lemon Pack 4 pcs', brand: 'แม็คโคร', displayPrice: 69, originalPrice: 79, unitSize: '1 unit(s)', inStock: 0, images: [] } },
    { document: { id: 'x', title: 'ไม่มีราคา', displayPrice: 0 } },
    { document: { id: 'y', displayPrice: 10 } }
];

describe('makro.pro search parsing', () => {
    it('reads priced products from __NEXT_DATA__', () => {
        const r = parseMakroSearch(page(hits));
        expect(r).toHaveLength(2);
        expect(r[0]).toMatchObject({
            id: '6976617971907', title: 'มะนาวแป้น จัมโบ้ 10 ลูก', brand: 'แม็คโคร',
            price: 79, originalPrice: null, unitSize: '10 ชิ้น', inStock: true
        });
        expect(r[0].image).toContain('6976617971907');
        expect(r[0].url).toBe(makroSearchUrl('มะนาวแป้น จัมโบ้ 10 ลูก'));
        // discounted item keeps the normal price; out of stock and no image are kept as flags
        expect(r[1]).toMatchObject({ price: 69, originalPrice: 79, inStock: false, image: null });
    });

    it('respects the limit', () => {
        expect(parseMakroSearch(page(hits), 1)).toHaveLength(1);
    });

    it('returns nothing for pages without search data', () => {
        expect(parseMakroSearch('<html>blocked</html>')).toEqual([]);
        expect(extractNextData('<script id="__NEXT_DATA__">{broken</script>')).toBeNull();
        expect(parseMakroSearch(page(undefined))).toEqual([]);
    });
});
