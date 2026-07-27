import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, Plus, Layers } from 'lucide-react';
import OptionSelectionModal from '../components/shared/OptionSelectionModal';

export default function POSMenuGrid({ onAddItem }) {
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedItemForModal, setSelectedItemForModal] = useState(null);

    useEffect(() => {
        // Stale-While-Revalidate: Read local cache immediately if valid
        try {
            const cachedCats = JSON.parse(localStorage.getItem('pos_cache_menu_categories')) || [];
            const cachedItems = JSON.parse(localStorage.getItem('pos_cache_menu_items')) || [];
            // Validate that cached items have menu_item_options property
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
    }, []);

    const fetchData = async () => {
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_item_options(*, option_groups(*, option_choices(*)))').eq('is_available', true).order('name')
            ]);

            const cats = catRes.data || [];
            const items = itemRes.data || [];

            setCategories(cats);
            setMenuItems(items);

            // Cache data in localStorage
            localStorage.setItem('pos_cache_menu_categories', JSON.stringify(cats));
            localStorage.setItem('pos_cache_menu_items', JSON.stringify(items));

            setActiveCategory(prev => prev || cats[0]?.id || 'all');
        } catch (err) {
            console.warn('[Offline Mode] Failed to fetch menu items online, keeping existing cache state:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleItemClick = async (item) => {
        let opts = item.menu_item_options;

        // If options are missing or empty in state, attempt an on-demand direct query
        if (!opts || !Array.isArray(opts) || opts.length === 0) {
            try {
                const { data } = await supabase
                    .from('menu_item_options')
                    .select('*, option_groups(*, option_choices(*)))')
                    .eq('menu_item_id', item.id);
                if (data && data.length > 0) {
                    opts = data;
                    // Update state and cache for future clicks
                    setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, menu_item_options: opts } : i));
                }
            } catch (e) {
                console.warn('On-demand options fetch failed:', e);
            }
        }

        if (opts && opts.length > 0) {
            setSelectedItemForModal({ ...item, menu_item_options: opts });
        } else {
            onAddItem(item);
        }
    };

    const filteredItems = menuItems.filter(item => {
        const matchesCat = activeCategory === 'all' || item.category_id === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        return matchesCat && matchesSearch;
    });

    if (loading) return (
        <div className="flex h-full items-center justify-center bg-[#ECECE9]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff0000]"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#ECECE9] text-[#1A1A1A] font-sans select-none relative">
            {/* Menu Header with Search and Categories */}
            <div className="p-4 bg-[#F5F5F2] border-b border-[#D1D1CD] space-y-3 shadow-sm shrink-0">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767673]" size={16} />
                    <input 
                        type="search" 
                        placeholder="Search menu items..." 
                        className="w-full bg-white border border-[#D1D1CD] rounded-lg py-2 pl-10 pr-4 text-xs text-[#1A1A1A] placeholder-[#767673] focus:outline-none focus:border-[#ff0000] font-medium transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none font-mono text-[10px] font-bold uppercase tracking-wider">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredItems.map(item => {
                        const hasOptions = item.menu_item_options && item.menu_item_options.length > 0;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                className="bg-white rounded-xl border border-[#D1D1CD] p-3 flex flex-col gap-3 text-left group hover:border-[#B0B0AC] active:scale-[0.98] active:translate-y-[1px] hover:-translate-y-[1px] transition-all cursor-pointer shadow-sm duration-100 relative"
                            >
                                <div className="aspect-square rounded-lg bg-[#ECECE9] overflow-hidden relative border border-[#D1D1CD] shrink-0">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-300" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#767673] font-mono font-bold text-xl uppercase">
                                            {item.name.charAt(0)}
                                        </div>
                                    )}
                                    {hasOptions && (
                                        <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <span>มีตัวเลือก</span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-white border border-[#D1D1CD] flex items-center justify-center shadow-sm group-hover:bg-[#ff0000] group-hover:text-white group-hover:border-[#d00000] transition-all">
                                        <Plus size={14} />
                                    </div>
                                </div>
                                
                                <div className="flex flex-col flex-1 min-h-[60px]">
                                    <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-2 leading-tight py-0.5 uppercase tracking-tight">{item.name}</h4>
                                    <div className="mt-auto pt-2 flex items-center justify-between border-t border-black/5 text-[10px] font-mono font-bold uppercase tracking-wider">
                                        <span className="text-[#1A1A1A]">฿{item.price}{hasOptions ? '+' : ''}</span>
                                        {item.stock_quantity !== null && (
                                            <span className="text-[#767673] tracking-normal font-medium">QTY: {item.stock_quantity}</span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
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
        </div>
    );
}

function CategoryButton({ label, active, onClick }) {
    return (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                active 
                ? 'bg-[#E0E0DC] text-[#1A1A1A] border-[#B0B0AC] shadow-inner font-black' 
                : 'bg-white text-[#767673] border-[#D1D1CD] hover:text-[#1A1A1A] hover:bg-[#FDFDFD] shadow-sm'
            }`}
        >
            {label}
        </button>
    );
}
