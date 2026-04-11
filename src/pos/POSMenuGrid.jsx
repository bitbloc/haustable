import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, ChevronRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function POSMenuGrid({ onAddItem }) {
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const [catRes, itemRes] = await Promise.all([
            supabase.from('menu_categories').select('*').order('display_order'),
            supabase.from('menu_items').select('*').eq('is_available', true).order('name')
        ]);

        setCategories(catRes.data || []);
        setMenuItems(itemRes.data || []);
        if (catRes.data?.[0]) setActiveCategory(catRes.data[0].id);
        setLoading(false);
    };

    const filteredItems = menuItems.filter(item => {
        const matchesCat = activeCategory === 'all' || item.category_id === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        return matchesCat && matchesSearch;
    });

    return (
        <div className="h-full flex flex-col bg-[#121212]">
            {/* Menu Header with Search and Categories */}
            <div className="p-6 bg-[#1A1A1A] border-b border-white/5 space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input 
                        type="search" 
                        placeholder="Search items..." 
                        className="w-full bg-black/30 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <CategoryButton 
                        label="All Items" 
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
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredItems.map(item => (
                        <motion.button
                            key={item.id}
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onAddItem(item)}
                            className="bg-[#1A1A1A] rounded-2xl border border-white/5 p-4 flex flex-col gap-3 text-left group hover:border-orange-500/30 transition-all shadow-sm"
                        >
                            <div className="aspect-square rounded-xl bg-black/20 overflow-hidden relative">
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-700 font-bold text-2xl uppercase">
                                        {item.name.charAt(0)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
                                    <Plus size={18} />
                                </div>
                            </div>
                            
                            <div className="flex flex-col flex-1">
                                <h4 className="font-bold text-sm line-clamp-2 leading-tight py-1">{item.name}</h4>
                                <div className="mt-auto pt-2 flex items-center justify-between">
                                    <span className="text-orange-500 font-bold">฿{item.price}</span>
                                    {item.stock_quantity !== null && (
                                        <span className="text-[10px] text-gray-500 uppercase font-medium">Stack: {item.stock_quantity}</span>
                                    )}
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CategoryButton({ label, active, onClick }) {
    return (
        <button 
            onClick={onClick}
            className={`px-6 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                active 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
        >
            {label}
        </button>
    );
}
