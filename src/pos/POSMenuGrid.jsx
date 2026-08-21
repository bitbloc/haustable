import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, Plus, Layers, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import OptionSelectionModal from '../components/shared/OptionSelectionModal';
import POSEmergencyItemModal from './POSEmergencyItemModal';
import { getAllCachedImages, syncAllMenuImages } from '../utils/imageStore';
import { posCache } from '../utils/offlineHelper';

const POSMenuGrid = memo(function POSMenuGrid({ onAddItem }) {
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
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
            if (cachedItems.length > 0 && Array.isArray(cachedItems[0]?.menu_item_options)) {
                setCategories(cachedCats);
                setMenuItems(cachedItems);
                setActiveCategory(cachedCats[0]?.id || 'all');
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

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(menuChangesSub);
        };
    }, []);

    const fetchData = async (showLoading = true) => {
        if (showLoading && menuItems.length === 0) setLoading(true);
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('name')
            ]);

            const cats = catRes.data || [];
            const items = itemRes.data || [];

            setCategories(cats);
            setMenuItems(items);

            posCache.setCategories(cats);
            posCache.setMenuItems(items);

            // Broadcast menu update event so POS active carts can auto-sync prices immediately
            window.dispatchEvent(new CustomEvent('pos-menu-updated', { detail: { items, categories: cats } }));

            setActiveCategory(prev => prev || cats[0]?.id || 'all');

            // Background sync images to IndexedDB on initial online fetch (non-blocking)
            syncAllMenuImages(items).then(result => {
                if (result.map && Object.keys(result.map).length > 0) {
                    setLocalImageMap(prev => ({ ...prev, ...result.map }));
                }
            }).catch(() => {});
        } catch (err) {
            console.warn('[Offline Mode] Failed to fetch menu items online, keeping existing cache state:', err);
        } finally {
            setLoading(false);
        }
    };

    // Manual Refresh / Sync Button handler (loads from DB & caches images to local IndexedDB)
    const handleManualSync = useCallback(async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncProgress({ completed: 0, total: 0 });

        if (!navigator.onLine) {
            toast.error('⚠️ ไม่มีสัญญาณอินเทอร์เน็ต ใช้ข้อมูลและรูปภาพที่บันทึกไว้ล่าสุด');
            setIsSyncing(false);
            return;
        }

        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('name')
            ]);

            if (catRes.error) throw catRes.error;
            if (itemRes.error) throw itemRes.error;

            const cats = catRes.data || [];
            const items = itemRes.data || [];

            setCategories(cats);
            setMenuItems(items);
            localStorage.setItem('pos_cache_menu_categories', JSON.stringify(cats));
            localStorage.setItem('pos_cache_menu_items', JSON.stringify(items));

            // Broadcast menu update event to POSDashboard
            window.dispatchEvent(new CustomEvent('pos-menu-updated', { detail: { items, categories: cats } }));

            // Sync images locally into IndexedDB with progress callback
            const { map } = await syncAllMenuImages(items, (completed, total) => {
                setSyncProgress({ completed, total });
            });

            if (map && Object.keys(map).length > 0) {
                setLocalImageMap(prev => ({ ...prev, ...map }));
            }

            toast.success(`✅ อัพเดทข้อมูลและบันทึกรูปภาพเมนูเรียบร้อยแล้ว (${items.length} รายการ)`);
        } catch (err) {
            console.error('Failed manual sync:', err);
            toast.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ใช้ข้อมูลเมนูในเครื่องล่าสุด');
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

    // O(1) Filtered items lookup
    const filteredItems = useMemo(() => {
        const catItems = itemsByCategoryMap.get(activeCategory) || itemsByCategoryMap.get('all') || [];
        const query = search.trim().toLowerCase();
        if (!query) return catItems;
        return catItems.filter(item => item.name.toLowerCase().includes(query));
    }, [itemsByCategoryMap, activeCategory, search]);

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[#ECECE9]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[oklch(52%_0.16_28)]"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#ECECE9] text-[#1A1A1A] font-sans select-none relative touch-manipulation">
            {/* Menu Header with Search, Categories & Update Button */}
            <div className="p-4 bg-[#F5F5F2] border-b border-[#D1D1CD] space-y-3 shadow-sm shrink-0">
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={18} />
                        <input 
                            type="search" 
                            placeholder="Search menu items (ค้นหารายการอาหาร/เครื่องดื่ม)..." 
                            className="w-full bg-white border border-[#D1D1CD] rounded-xl py-3 pl-11 pr-4 text-sm text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[oklch(52%_0.16_28)] font-medium transition-colors touch-manipulation shadow-2xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowEmergencyModal(true)}
                        className="h-[46px] px-3.5 bg-[oklch(18%_0.012_28)] hover:bg-black active:scale-[0.97] text-[oklch(97%_0.008_28)] rounded-xl flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 touch-manipulation shadow-sm"
                    >
                        <Plus size={16} className="shrink-0" />
                        <span>+ เมนูเพิ่มเติม</span>
                    </button>

                    <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        title="อัพเดทรายการเมนูและรูปภาพจากฐานข้อมูลลงเครื่อง"
                        className="h-[46px] px-3.5 bg-white hover:bg-[#F0F0ED] active:scale-[0.97] disabled:opacity-70 border border-[#D1D1CD] rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-[#1A1A1A] uppercase tracking-wider transition-all cursor-pointer shrink-0 touch-manipulation shadow-xs"
                    >
                        <RotateCw className={`shrink-0 ${isSyncing ? 'animate-spin text-[oklch(52%_0.16_28)]' : 'text-[#767673]'}`} size={16} />
                        <span className="hidden sm:inline">
                            {isSyncing 
                                ? (syncProgress.total > 0 ? `กำลังอัพเดท (${syncProgress.completed}/${syncProgress.total})` : 'กำลังโหลด...') 
                                : 'อัพเดทเมนู'}
                        </span>
                        <span className="sm:hidden">
                            {isSyncing ? `${syncProgress.completed}/${syncProgress.total}` : 'อัพเดท'}
                        </span>
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none font-mono text-xs font-bold uppercase tracking-wider touch-manipulation">
                    <CategoryButton 
                        label="ALL ITEMS" 
                        active={activeCategory === 'all'} 
                        onClick={() => setActiveCategory('all')} 
                    />
                    {categories.map(cat => (
                        <CategoryButton 
                            key={cat.id} 
                            label={cat.name} 
                            active={activeCategory === cat.id} 
                            onClick={() => setActiveCategory(cat.id)} 
                        />
                    ))}
                </div>
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-none">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
                    {filteredItems.map(item => (
                        <MenuItemCard 
                            key={item.id}
                            item={item}
                            cachedImg={(item.image_url && localImageMap[item.image_url]) || item.image_url}
                            onClick={handleItemClick}
                        />
                    ))}
                </div>
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
    
    return (
        <button
            type="button"
            onClick={() => onClick(item)}
            className="bg-white rounded-xl border border-[#D1D1CD] p-3 flex flex-col gap-3 text-left group hover:border-[#B0B0AC] active:scale-[0.97] transition-transform duration-75 cursor-pointer shadow-sm relative select-none touch-manipulation"
            style={{ contain: 'content' }}
        >
            <div className="aspect-square rounded-lg bg-[#ECECE9] overflow-hidden relative border border-[#D1D1CD] shrink-0">
                {cachedImg ? (
                    <img src={cachedImg} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#767673] font-mono font-bold text-2xl uppercase">
                        {item.name.charAt(0)}
                    </div>
                )}
                {hasOptions && (
                    <div className="absolute top-2 left-2 bg-black/85 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>มีตัวเลือก</span>
                    </div>
                )}
                <div className="absolute bottom-2 right-2 w-10 h-10 rounded-xl bg-white border border-[#D1D1CD] flex items-center justify-center shadow-md group-hover:bg-[oklch(52%_0.16_28)] group-hover:text-white group-hover:border-[oklch(45%_0.16_28)] transition-colors">
                    <Plus size={20} />
                </div>
            </div>
            
            <div className="flex flex-col flex-1 min-h-[64px]">
                <h4 className="font-bold text-base text-[#1A1A1A] line-clamp-2 leading-tight py-0.5 uppercase tracking-tight">{item.name}</h4>
                <div className="mt-auto pt-2 flex items-center justify-between border-t border-black/5 text-sm font-mono font-bold uppercase tracking-wider">
                    <span className="text-[oklch(52%_0.16_28)]">฿{item.price}</span>
                    {item.stock_quantity !== null && (
                        <span className="text-[#767673] text-xs tracking-normal font-medium">QTY: {item.stock_quantity}</span>
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
            className={`px-4.5 py-2.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap text-xs font-bold uppercase select-none touch-manipulation ${
                active 
                ? 'bg-[#E0E0DC] text-[#1A1A1A] border-[#B0B0AC] shadow-inner font-black' 
                : 'bg-white text-[#767673] border-[#D1D1CD] hover:text-[#1A1A1A] hover:bg-[#FDFDFD] shadow-sm'
            }`}
        >
            {label}
        </button>
    );
});
