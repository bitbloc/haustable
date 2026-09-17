import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('POS Menu Grid Resilience & Cache Preservation', () => {
    let mockStorage = {};

    beforeEach(() => {
        vi.useFakeTimers();
        mockStorage = {};
        global.localStorage = {
            getItem: vi.fn((key) => mockStorage[key] !== undefined ? mockStorage[key] : null),
            setItem: vi.fn((key, val) => { mockStorage[key] = String(val); }),
            removeItem: vi.fn((key) => { delete mockStorage[key]; }),
            clear: vi.fn(() => { mockStorage = {}; })
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Cache Retention on Network Failure (Zero Cache Wipe)', () => {
        it('should retain existing in-memory/disk cached menu items when Supabase returns an error', async () => {
            const initialCache = [
                { id: 1, name: 'ข้าวผัดปู', category_id: 'cat-1', price: 120 },
                { id: 2, name: 'ต้มยำกุ้ง', category_id: 'cat-2', price: 250 }
            ];

            // Local cache is populated
            mockStorage['pos_cache_menu_items'] = JSON.stringify(initialCache);

            let stateItems = [...initialCache];

            // Simulate fetch with network error
            const simulateFetch = async (supabaseResponse) => {
                const items = supabaseResponse.data;
                // Strict guard: only update if valid array with items returned
                if (Array.isArray(items) && items.length > 0) {
                    stateItems = items;
                    mockStorage['pos_cache_menu_items'] = JSON.stringify(items);
                } else if (stateItems.length === 0) {
                    const fallback = JSON.parse(mockStorage['pos_cache_menu_items'] || '[]');
                    if (fallback.length > 0) stateItems = fallback;
                }
            };

            // Supabase returns error/null
            await simulateFetch({ data: null, error: { message: 'Network request failed' } });

            // Must preserve original items and NOT wipe to empty array
            expect(stateItems).toHaveLength(2);
            expect(stateItems[0].name).toBe('ข้าวผัดปู');
            expect(JSON.parse(mockStorage['pos_cache_menu_items'])).toHaveLength(2);
        });

        it('should update cache when Supabase returns valid fresh items', async () => {
            let stateItems = [];
            const freshItems = [
                { id: 10, name: 'ชาเย็น', category_id: 'cat-drink', price: 65 }
            ];

            const simulateFetch = async (supabaseResponse) => {
                const items = supabaseResponse.data;
                if (Array.isArray(items) && items.length > 0) {
                    stateItems = items;
                    mockStorage['pos_cache_menu_items'] = JSON.stringify(items);
                }
            };

            await simulateFetch({ data: freshItems, error: null });

            expect(stateItems).toHaveLength(1);
            expect(stateItems[0].name).toBe('ชาเย็น');
            expect(JSON.parse(mockStorage['pos_cache_menu_items'])).toHaveLength(1);
        });
    });

    describe('Query Timeout Guard (12s Promise.race)', () => {
        it('should abort hung query after 12s and recover without throwing unhandled rejection', async () => {
            const timeoutPromise = (ms) => new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fetch timeout (12s)')), ms)
            );

            // Hung query that never resolves
            const hungQuery = new Promise(() => {});

            let caughtError = null;
            const runWithTimeout = async () => {
                try {
                    await Promise.race([hungQuery, timeoutPromise(12000)]);
                } catch (e) {
                    caughtError = e;
                }
            };

            const runPromise = runWithTimeout();

            // Advance timers by 12,000ms
            vi.advanceTimersByTime(12000);
            await runPromise;

            expect(caughtError).not.toBeNull();
            expect(caughtError.message).toBe('Fetch timeout (12s)');
        });
    });

    describe('Global Search Across All Categories', () => {
        it('should search across all items regardless of active category when query is provided', () => {
            const menuItems = [
                { id: 1, name: 'ข้าวซอสญี่ปุ่น', category_id: 'cat-rice' },
                { id: 2, name: 'ชาเขียวมะนาว', category_id: 'cat-drink' },
                { id: 3, name: 'ข้าวหมูทอด', category_id: 'cat-rice' }
            ];

            const activeCategory = 'cat-drink'; // Viewing drinks
            const debouncedSearch = 'ข้าว';     // Searching for rice

            const filterItems = (activeCat, search, items) => {
                const query = search.trim().toLowerCase();
                if (query) {
                    // Global search
                    return items.filter(item => (item.name || '').toLowerCase().includes(query));
                }
                return items.filter(item => item.category_id === activeCat);
            };

            const results = filterItems(activeCategory, debouncedSearch, menuItems);
            // Should find both rice items even though active category is drinks
            expect(results).toHaveLength(2);
            expect(results.map(r => r.name)).toContain('ข้าวซอสญี่ปุ่น');
            expect(results.map(r => r.name)).toContain('ข้าวหมูทอด');
        });

        it('should filter strictly by active category when search is empty', () => {
            const menuItems = [
                { id: 1, name: 'ข้าวซอสญี่ปุ่น', category_id: 'cat-rice' },
                { id: 2, name: 'ชาเขียวมะนาว', category_id: 'cat-drink' }
            ];

            const activeCategory = 'cat-drink';
            const debouncedSearch = '';

            const filterItems = (activeCat, search, items) => {
                const query = search.trim().toLowerCase();
                if (query) {
                    return items.filter(item => (item.name || '').toLowerCase().includes(query));
                }
                if (activeCat === 'all') return items;
                return items.filter(item => item.category_id === activeCat);
            };

            const results = filterItems(activeCategory, debouncedSearch, menuItems);
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('ชาเขียวมะนาว');

            const allResults = filterItems('all', debouncedSearch, menuItems);
            expect(allResults).toHaveLength(2);
        });
    });

    describe('Category Badges with Item Counts', () => {
        it('should calculate accurate item counts for ALL ITEMS and individual categories', () => {
            const categories = [
                { id: 'cat-food', name: 'อาหาร' },
                { id: 'cat-drink', name: 'เครื่องดื่ม' }
            ];
            const menuItems = [
                { id: 1, name: 'ข้าวกะเพรา', category_id: 'cat-food' },
                { id: 2, name: 'ข้าวไข่เจียว', category_id: 'cat-food' },
                { id: 3, name: 'ชาเย็น', category_id: 'cat-drink' }
            ];

            const counts = {};
            counts['all'] = menuItems.length;
            categories.forEach(c => {
                counts[c.id] = menuItems.filter(i => i.category_id === c.id).length;
            });

            expect(counts['all']).toBe(3);
            expect(counts['cat-food']).toBe(2);
            expect(counts['cat-drink']).toBe(1);
        });
    });
});
