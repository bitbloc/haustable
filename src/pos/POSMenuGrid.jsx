import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, Plus, Layers, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import OptionSelectionModal from '../components/shared/OptionSelectionModal';
import POSEmergencyItemModal from './POSEmergencyItemModal';
import { getAllCachedImages, syncAllMenuImages } from '../utils/imageStore';
import { posCache } from '../utils/offlineHelper';

const POSMenuGrid = memo(function POSMenuGrid({ onAddItem, isActive = true, refreshKey = 0 }) {
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [menuItems, setMenuItems] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 120);
        return () => clearTimeout(handler);
    }, [searchInput]);
    const [selectedItemForModal, setSelectedItemForModal] = useState(null);
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);
    const [localImageMap, setLocalImageMap] = useState({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ completed: 0, total: 0 });

    useEffect(() => {
        // Load IndexedDB cached blob URLs immediately
        getAllCachedImages().then(cachedMap => {
            if (cachedMap && Object.keys(cachedMap).length > 0) {
                setLocalImageMap(cachedMap);
            }
        });

        // Stale-While-Revalidate: Read in-memory / local cache immediately if valid
        try {
            const cachedCats = posCache.getCategories() || [];
            const cachedItems = posCache.getMenuItems() || [];
            if (cachedItems.length > 0) {
                setCategories(cachedCats);
                setMenuItems(cachedItems);
                setLoading(false);
            }
        } catch (e) {
            console.warn('Failed to parse local menu cache:', e);
        }

        fetchData();

        let debounceTimer = null;
        const triggerDebouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(false);
            }, 300);
        };

        // Realtime Subscription: Listen for immediate updates to menu items, options & categories
        const menuChangesSub = supabase.channel('pos-menu-realtime-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, triggerDebouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_item_options' }, triggerDebouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, triggerDebouncedFetch)
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[Realtime POS Menu] Channel status: ${status}`, err || '');
                }
            });

        const handleOnline = () => {
            console.log('⚡ [POS Menu] Network restored online. Re-fetching menu catalog...');
            fetchData(false);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchData(false);
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(menuChangesSub);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    // Re-fetch when panel becomes active if items are missing
    useEffect(() => {
        if (isActive && menuItems.length === 0) {
            fetchData(true);
        }
    }, [isActive]);

    // Re-fetch on global POS refreshKey trigger
    useEffect(() => {
        if (refreshKey > 0) {
            fetchData(false);
        }
    }, [refreshKey]);

    const fetchData = async (showLoading = true) => {
        if (showLoading && menuItems.length === 0) setLoading(true);
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout (12s)')), 12000)
        );

        try {
            const queryPromise = Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('name')
            ]);

            const [catRes, itemRes] = await Promise.race([queryPromise, timeoutPromise]);

            if (catRes?.error) {
                console.warn('[POS Menu] Category fetch error:', catRes.error);
            }
            if (itemRes?.error) {
                console.warn('[POS Menu] Item fetch error:', itemRes.error);
            }

            const cats = catRes?.data;
            const items = itemRes?.data;

            // Strict safety: DO NOT wipe local cache if query returns null/error!
            if (Array.isArray(cats) && cats.length > 0) {
                setCategories(cats);
                posCache.setCategories(cats);
            } else if (categories.length === 0) {
                const cachedC = posCache.getCategories() || [];
                if (cachedC.length > 0) setCategories(cachedC);
            }

            if (Array.isArray(items) && items.length > 0) {
                setMenuItems(items);
                posCache.setMenuItems(items);

                // Broadcast menu update event so POS active carts can auto-sync prices immediately
                window.dispatchEvent(new CustomEvent('pos-menu-updated', { detail: { items, categories: cats || categories } }));

                // Instant non-blocking image load from IndexedDB using single cursor (<20ms)
                getAllCachedImages().then(map => {
                    if (map && Object.keys(map).length > 0) {
                        setLocalImageMap(prev => ({ ...prev, ...map }));
                    }
                }).catch(() => {});
            } else if (menuItems.length === 0) {
                const cachedI = posCache.getMenuItems() || [];
                if (cachedI.length > 0) setMenuItems(cachedI);
            }
        } catch (err) {
            console.warn('[Offline Mode] Failed to fetch menu items online, keeping existing cache state:', err);
            // Fallback to local cache if state is currently empty
            if (menuItems.length === 0) {
                const cachedItems = posCache.getMenuItems() || [];
                if (cachedItems.length > 0) setMenuItems(cachedItems);
            }
            if (categories.length === 0) {
                const cachedCats = posCache.getCategories() || [];
                if (cachedCats.length > 0) setCategories(cachedCats);
            }
        } finally {
            setLoading(false);
        }
    };

    // Manual Refresh / Sync Button handler (loads from DB & caches images to local IndexedDB)
    const handleManualSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncProgress({ completed: 0, total: 0 });

        const toastId = toast.loading('กำลังดึงข้อมูลเมนูล่าสุดจากระบบ...');

        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout (12s)')), 12000)
            );
            const queryPromise = Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('name')
            ]);

            const [catRes, itemRes] = await Promise.race([queryPromise, timeoutPromise]);

            if (catRes?.error) throw catRes.error;
            if (itemRes?.error) throw itemRes.error;

            const cats = catRes?.data || [];
            const items = itemRes?.data || [];

            if (cats.length > 0) {
                setCategories(cats);
                posCache.setCategories(cats);
                localStorage.setItem('pos_cache_menu_categories', JSON.stringify(cats));
            }
            if (items.length > 0) {
                setMenuItems(items);
                posCache.setMenuItems(items);
                localStorage.setItem('pos_cache_menu_items', JSON.stringify(items));
                window.dispatchEvent(new CustomEvent('pos-menu-updated', { detail: { items, categories: cats } }));

                // Sync images locally into IndexedDB with progress callback
                const { map } = await syncAllMenuImages(items, (completed, total) => {
                    setSyncProgress({ completed, total });
                });

                if (map && Object.keys(map).length > 0) {
                    setLocalImageMap(prev => ({ ...prev, ...map }));
                }

                toast.success(`อัพเดทข้อมูลเมนูเรียบร้อยแล้ว (${items.length} รายการ)`, { id: toastId });
            } else {
                toast.info('ไม่พบรายการเมนูเพิ่มเติมในระบบ', { id: toastId });
            }
        } catch (err) {
            console.error('Failed manual sync:', err);
            toast.error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ใช้ข้อมูลเมนูในเครื่องล่าสุด', { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    const handleItemClick = useCallback((item) => {
        const opts = item.menu_item_options;
        const cachedImg = (item.image_url && localImageMap[item.image_url]) || item.image_url;
        if (opts && Array.isArray(opts) && opts.length > 0) {
            setSelectedItemForModal({ ...item, image_url: cachedImg, menu_item_options: opts });
        } else {
            onAddItem({ ...item, image_url: cachedImg });
        }
    }, [localImageMap, onAddItem]);

    // Pre-index items by Category ID in O(1) Hash Map
    const itemsByCategoryMap = useMemo(() => {
        const map = new Map();
        map.set('all', menuItems);
        for (let i = 0; i < menuItems.length; i++) {
            const item = menuItems[i];
            const catId = item.category_id;
            if (!map.has(catId)) {
                map.set(catId, []);
            }
            map.get(catId).push(item);
        }
        return map;
    }, [menuItems]);

    // O(1) Filtered items lookup: Global search across all items when user types
    const filteredItems = useMemo(() => {
        const query = debouncedSearch.trim().toLowerCase();
        if (query) {
            const allItems = itemsByCategoryMap.get('all') || menuItems;
            return allItems.filter(item => (item.name || '').toLowerCase().includes(query));
        }
        const catItems = itemsByCategoryMap.get(activeCategory) || itemsByCategoryMap.get('all') || [];
        return catItems;
    }, [itemsByCategoryMap, activeCategory, debouncedSearch, menuItems]);

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[var(--color-paper)]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[var(--color-paper)] text-[var(--color-ink)] font-sans select-none relative touch-manipulation">
            {/* Menu Header with Search, Categories & Update Button */}
            <div className="p-4 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] space-y-3 shadow-xs shrink-0">
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={17} />
                        <input 
                            type="search" 
                            placeholder="ค้นหารายการอาหาร / เครื่องดื่ม..." 
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md py-2.5 pl-10 pr-4 text-sm text-[var(--color-ink)] placeholder-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] font-medium transition-colors touch-manipulation shadow-xs min-h-[44px]"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowEmergencyModal(true)}
                        className="h-[44px] min-h-[44px] px-3.5 bg-[var(--color-ink)] hover:opacity-90 active:scale-[0.97] text-[var(--color-paper)] rounded-md flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 touch-manipulation shadow-xs"
                    >
                        <Plus size={15} className="shrink-0" />
                        <span>+ เมนูพิเศษ</span>
                    </button>

                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        title="อัพเดทรายการเมนูและรูปภาพจากฐานข้อมูลลงเครื่อง"
                        className="h-[44px] min-h-[44px] px-3.5 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] active:scale-[0.97] disabled:opacity-70 border border-[var(--color-rule)] rounded-md flex items-center gap-2 text-xs font-mono font-bold text-[var(--color-ink)] uppercase tracking-wider transition-all cursor-pointer shrink-0 touch-manipulation shadow-xs"
                    >
                        <RotateCw className={`shrink-0 ${isSyncing ? 'animate-spin text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`} size={15} />
                        <span className="hidden sm:inline">
                            {isSyncing 
                                ? (syncProgress.total > 0 ? `กำลังโหลด (${syncProgress.completed}/${syncProgress.total})` : 'กำลังโหลด...') 
                                : 'อัพเดท'}
                        </span>
                        <span className="sm:hidden">
                            {isSyncing ? `${syncProgress.completed}/${syncProgress.total}` : 'อัพเดท'}
                        </span>
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs font-bold uppercase tracking-wider touch-manipulation">
                    <CategoryButton 
                        label={`ALL ITEMS (${menuItems.length})`} 
                        active={activeCategory === 'all'} 
                        onClick={() => setActiveCategory('all')} 
                    />
                    {categories.map(cat => {
                        const count = (itemsByCategoryMap.get(cat.id) || []).length;
                        return (
                            <CategoryButton 
                                key={cat.id} 
                                label={`${cat.name} (${count})`} 
                                active={activeCategory === cat.id} 
                                onClick={() => setActiveCategory(cat.id)} 
                            />
                        );
                    })}
                </div>
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-none pos-menu-grid-scroll">
                {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                        {filteredItems.map(item => (
                            <MenuItemCard 
                                key={item.id}
                                item={item}
                                cachedImg={(item.image_url && localImageMap[item.image_url]) || item.image_url}
                                onClick={handleItemClick}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        {debouncedSearch.trim() ? (
                            <div className="space-y-3">
                                <p className="text-sm font-bold text-[var(--color-ink)]">
                                    ไม่พบเมนูที่ค้นหา "{debouncedSearch}"
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSearchInput('')}
                                    className="px-4 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-md text-xs font-mono font-bold text-[var(--color-ink)] hover:bg-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ล้างคำค้นหา
                                </button>
                            </div>
                        ) : menuItems.length === 0 ? (
                            <div className="space-y-3 max-w-xs">
                                <p className="text-sm font-bold text-[var(--color-ink)]">
                                    ยังไม่พบข้อมูลเมนูอาหารในเครื่อง
                                </p>
                                <p className="text-xs text-[var(--color-muted)] font-mono">
                                    แตะปุ่มด้านล่างเพื่อดึงข้อมูลเมนูล่าสุดจากระบบ
                                </p>
                                <button
                                    type="button"
                                    onClick={() => fetchData(true)}
                                    className="px-5 py-2.5 bg-[var(--color-ink)] text-[var(--color-paper)] rounded-md text-xs font-mono font-bold tracking-wider uppercase hover:opacity-90 transition-all cursor-pointer shadow-xs active:scale-95"
                                >
                                    🔄 ดึงข้อมูลเมนูใหม่ (REFETCH)
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm font-bold text-[var(--color-ink)]">
                                    ไม่มีรายการเมนูในหมวดหมู่นี้
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setActiveCategory('all')}
                                    className="px-4 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-md text-xs font-mono font-bold text-[var(--color-ink)] hover:bg-[var(--color-rule)] transition-colors cursor-pointer"
                                >
                                    ดูเมนูทั้งหมด (ALL ITEMS)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for selecting option groups */}
            {selectedItemForModal && (
                <OptionSelectionModal 
                    item={selectedItemForModal}
                    onClose={() => setSelectedItemForModal(null)}
                    onConfirm={(confirmedItem) => {
                        onAddItem(confirmedItem);
                        setSelectedItemForModal(null);
                    }}
                />
            )}

            {/* Emergency / Custom Item Modal */}
            <POSEmergencyItemModal
                isOpen={showEmergencyModal}
                onClose={() => setShowEmergencyModal(false)}
                onConfirm={(customItem) => {
                    onAddItem(customItem);
                    toast.success(`เพิ่มเมนูเพิ่มเติม: ${customItem.name} (฿${customItem.price})`);
                }}
            />
        </div>
    );
});

export default POSMenuGrid;

const MenuItemCard = memo(function MenuItemCard({ item, cachedImg, onClick }) {
    const hasOptions = item.menu_item_options && item.menu_item_options.length > 0;
    const [imgError, setImgError] = useState(false);
    const targetImg = cachedImg || item.image_url;

    const handleImageError = () => {
        setImgError(true);
    };
    
    return (
        <button
            type="button"
            onClick={() => onClick(item)}
            className="bg-[var(--color-paper)] rounded-md border border-[var(--color-rule)] p-3 flex flex-col gap-2.5 text-left group hover:border-[var(--color-accent)] active:scale-[0.98] transition-transform duration-75 cursor-pointer shadow-xs relative select-none touch-manipulation min-h-[140px]"
        >
            <div className="aspect-square rounded-sm bg-[var(--color-paper-2)] overflow-hidden relative border border-[var(--color-rule)] shrink-0">
                {targetImg && !imgError ? (
                    <img 
                        src={targetImg} 
                        alt={item.name} 
                        loading="lazy"
                        decoding="async"
                        onError={handleImageError}
                        className="w-full h-full object-cover block" 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-muted)] font-mono font-bold text-2xl uppercase">
                        {item.name.charAt(0)}
                    </div>
                )}
                {hasOptions && (
                    <div className="absolute top-1.5 left-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs flex items-center gap-1">
                        <span>OPTION</span>
                    </div>
                )}
                <div className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-sm bg-[var(--color-paper)] border border-[var(--color-rule)] flex items-center justify-center shadow-xs group-hover:bg-[var(--color-accent)] group-hover:text-white group-hover:border-[var(--color-accent)] transition-colors">
                    <Plus size={16} />
                </div>
            </div>
            
            <div className="flex flex-col flex-1 min-h-[56px] justify-between">
                <h4 className="font-bold text-sm text-[var(--color-ink)] line-clamp-2 leading-tight py-0.5 tracking-tight">{item.name}</h4>
                <div className="mt-1 pt-1.5 flex items-center justify-between border-t border-[var(--color-rule)] text-xs font-mono font-bold uppercase tracking-wider">
                    <span className="text-[var(--color-accent)]">฿{item.price}</span>
                    {item.stock_quantity !== null && (
                        <span className="text-[var(--color-muted)] text-[10px] tracking-normal font-normal">QTY: {item.stock_quantity}</span>
                    )}
                </div>
            </div>
        </button>
    );
});

const CategoryButton = memo(function CategoryButton({ label, active, onClick }) {
    return (
        <button 
            onClick={onClick}
            className={`min-h-[40px] px-3.5 py-2 rounded-md border transition-all cursor-pointer whitespace-nowrap text-xs font-mono font-bold uppercase select-none touch-manipulation ${
                active 
                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] shadow-xs' 
                : 'bg-[var(--color-paper)] text-[var(--color-neutral)] border-[var(--color-rule)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] shadow-xs'
            }`}
        >
            {label}
        </button>
    );
});
