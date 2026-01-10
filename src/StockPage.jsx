import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { 
    Package, 
    Scan, 
    Search, 
    ArrowLeft, 
    History,
    RefreshCw,
    Settings,
    Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StockCard from './components/stock/StockCard';
import AdjustmentModal from './components/stock/AdjustmentModal';
import BarcodeScanner from './components/stock/BarcodeScanner';
import TransactionHistory from './components/stock/TransactionHistory'; // Added
import StockUsageReport from './components/stock/StockUsageReport'; // Added
import CategoryManager from './components/stock/CategoryManager';
import StockItemForm from './components/stock/StockItemForm'; // Added
import { toast } from 'sonner';

export default function StockPage() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('restock'); // Default to Restock for utility? Or 'veg'? Let's keep 'veg' or switch to 'restock' if urgent.
    // User probably wants to see problems first. Let's try 'restock' as default? 
    // Or keep 'veg'. Let's stick to 'veg' for stability, user can click Restock.
    // actually, let's make "veg" default but let's change code line below.
    // I will keep 'veg' as default to match old state, unless requested.
    const [searchQuery, setSearchQuery] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [showHistory, setShowHistory] = useState(false); // Added
    const [showReport, setShowReport] = useState(false); // Added
    const [showCategoryManager, setShowCategoryManager] = useState(false); // Added
    const [showItemForm, setShowItemForm] = useState(false); // Added
    const [editingItem, setEditingItem] = useState(null); // Added
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [sortMode, setSortMode] = useState('name'); // 'name' | 'low_stock'
    
    // Data State
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]); // Dynamic
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null); // For Adjustment Modal

    const fetchCategories = async () => {
         const { data, error } = await supabase.from('stock_categories').select('*').order('sort_order');
         if (data && data.length > 0) {
             setCategories(data);
         } else {
             // Fallback default
             // Fallback default
             setCategories([
                { id: 'restock', label: 'ต้องเติม (Restock)', icon: '⚠️' },
                { id: 'bar', label: 'บาร์ (Bar)', icon: '🍸' },
                { id: 'meat', label: 'เนื้อสัตว์ (Meat)', icon: '🥩' },
                { id: 'veg', label: 'ผัก (Veg)', icon: '🥬' },
                { id: 'sauce', label: 'ซอส (Sauce)', icon: '🧂' },
                { id: 'dry', label: 'ของแห้ง (Dry)', icon: '🥫' },
                { id: 'curry', label: 'พริกแกง', icon: '🥘' },
                { id: 'frozen', label: 'แช่แข็ง', icon: '❄️' },
                { id: 'oil', label: 'น้ำมัน', icon: '🛢️' },
                { id: 'soup', label: 'ซุป', icon: '🍲' },
                { id: 'preserved', label: 'ของดอง', icon: '🏺' },
                { id: 'packaging', label: 'แพ็คเกจ', icon: '📦' },
                { id: 'supplies', label: 'ของใช้', icon: '🧽' },
                { id: 'other', label: 'อื่นๆ', icon: '🔖' }
            ]);
         }
    };

    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        // Fetch User for Logging
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUser(data?.user);
        });
        fetchCategories();
    }, []);

    // --- Fetching Items ---
    const fetchItems = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('stock_items')
                .select('*')
                .order('display_order', { ascending: true })
                .order('name', { ascending: true });

            // If 'restock' tab, we fetch ALL to filter client-side (easier than complex SQL logic for column comparison)
            // Or if specific category, filter by it.
            if (activeCategory !== 'restock' && activeCategory) {
                query = query.eq('category', activeCategory);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            let result = data || [];
            
            // Client-side filtering for Restock Tab
            if (activeCategory === 'restock') {
                result = result.filter(item => item.current_quantity <= item.reorder_point);
            }
            
            setItems(result);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load stock');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [activeCategory]);

    // Real-time Subscription
    useEffect(() => {
        const channel = supabase
            .channel('public:stock_items')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_items' }, (payload) => {
                setItems(currentItems => 
                    currentItems.map(item => 
                        item.id === payload.new.id ? { ...item, ...payload.new } : item
                    )
                );
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // --- Logic ---
    const handleAdjustment = async (itemId, changeAmount, type, meta = {}) => {
        // Optimistic Update
        // Optimistic Update
        setItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const newQty = type === 'set' 
                    ? changeAmount 
                    : (item.current_quantity || 0) + changeAmount;
                return { ...item, current_quantity: newQty };
            }
            return item;
        }));

        try {
            // 1. Update stock_items
            let updateError;
            
            if (type === 'set') {
                 // Absolute Update (Audit/Count)
                 const performedBy = currentUser?.user_metadata?.full_name || currentUser?.email || 'Staff';
                 const { error } = await supabase.rpc('set_stock_quantity', {
                     p_item_id: itemId,
                     p_new_quantity: changeAmount, // In this case changeAmount IS the new quantity
                     p_reason: meta.note || 'Audit',
                     p_performed_by: performedBy
                 });
                 updateError = error;
                 
                 // Fallback if RPC fails? (Try direct update)
                 if (updateError) {
                      const { error: directError } = await supabase
                        .from('stock_items')
                        .update({ current_quantity: changeAmount })
                        .eq('id', itemId);
                      if (directError) throw directError;
                      updateError = null; // Clear error if fallback succeeded
                 }
                 
            } else {
                 // Relative Update (In/Out)
                 const { error } = await supabase.rpc('update_stock_quantity', {
                     p_item_id: itemId,
                     p_quantity_change: changeAmount
                 });
                 updateError = error;
                 
                 // Fallback
                 if (updateError) {
                     const item = items.find(i => i.id === itemId);
                     const newQty = (item.current_quantity || 0) + changeAmount;
                     const { error: directError } = await supabase.from('stock_items').update({ current_quantity: newQty }).eq('id', itemId);
                     if (directError) throw directError;
                     updateError = null;
                 }
            }

            if (updateError) throw updateError;

            // 2. Transaction Log (Handled by RPC for 'set' usually, but our RPC log logic might be minimal or we want client-side consistency)
            // Actually my RPC for 'set' DOES log. 
            // My RPC for 'update' DOES NOT log? Let's check. 
            // 'update_stock_quantity' (previous step) did NOT include logging inside RPC.
            // So we log here for 'update', but 'set' RPC logs inside itself?
            // Let's check 'set_stock_quantity' RPC content from previous step.
            // Yes, 'set_stock_quantity' performs INSERT into stock_transactions.
            // But 'update_stock_quantity' does not.
            
            if (type !== 'set') {
                 const performedBy = currentUser?.user_metadata?.full_name || currentUser?.email || 'Staff';
                 const { error: logError } = await supabase.from('stock_transactions').insert({
                    stock_item_id: itemId,
                    transaction_type: type,
                    quantity_change: changeAmount,
                    performed_by: performedBy, 
                    note: meta.note
                });
                if (logError) console.error("Log error", logError);
            }

            toast.success(type === 'set' ? `Stock Set to: ${changeAmount}` : `Updated stock: ${changeAmount > 0 ? '+' : ''}${changeAmount}`);
            
        } catch (err) {
            toast.error('Sync failed');
            console.error(err);
            fetchItems(); // Revert
        }
    };

    const handleCodeScan = async (code) => {
        // Find item by barcode ACROSS ALL CATEGORIES
        // So we need to query DB, or better, if we only loaded one category, we might miss it.
        // We should query DB for the specific barcode.
        
        try {
            const { data, error } = await supabase
                .from('stock_items')
                .select('*')
                .eq('barcode', code)
                .single();

            if (data) {
                // Determine if we need to switch category tab to show it in background? 
                // Not strictly necessary, but helpful.
                if (data.category !== activeCategory) {
                    setActiveCategory(data.category);
                }
                
                setSelectedItem(data);
                setShowScanner(false);
                toast.success(`Found: ${data.name}`);
            } else {
                toast.error('Product not found');
                if (confirm('Product not found. Add new item?')) {
                     setEditingItem(null); // Ensure new mode
                     // Pre-fill barcode in new item form
                     // But we need to pass this state.
                     // Let's modify setEditingItem or use a separate state?
                     // Actually, we can just pass a partial object to editingItem for "New" mode.
                     setEditingItem({ barcode: code }); // Hack: pass partial for pre-fill
                     setShowItemForm(true);
                     setShowScanner(false);
                }
            }
        } catch (err) {
            console.error(err);
            toast.error('Search error');
        }
    };

    // Filter & Sort Items
    const filteredItems = items
        .filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            item.barcode?.includes(searchQuery)
        )
        .sort((a, b) => {
            if (sortMode === 'low_stock') {
                return (a.current_quantity || 0) - (b.current_quantity || 0);
            }
            return a.name.localeCompare(b.name, 'th');
        });

    // Helper for List View Colors
    const getStatusColor = (qty, reorder, min) => {
        if (qty <= (min || 0)) return 'bg-red-100 text-red-600'; // Critical
        if (qty <= (reorder || 0)) return 'bg-orange-100 text-orange-700'; // Warning
        return 'bg-green-50 text-green-700'; // Safe
    };

    return (
        <div className="min-h-screen bg-[#F4F4F4] text-[#1A1A1A] safe-area-inset-bottom font-sans">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm transition-all duration-300">
                <div className="p-4 safe-area-inset-top">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-4">
                        <button 
                            onClick={() => navigate('/staff')}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        
                        <h1 className="text-xl font-bold flex-1 text-center mr-10">ระบบสต็อก</h1>
                        
                        <div className="flex gap-2">
                            {/* Report Button */}
                             <button 
                                onClick={() => setShowReport(true)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pie-chart w-5 h-5 text-gray-600"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                            </button>
                             <button 
                                onClick={() => setShowHistory(true)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                             >
                                <History className="w-5 h-5 text-gray-600" />
                            </button>
                             <button 
                                onClick={() => setShowCategoryManager(true)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                             >
                                <Settings className="w-5 h-5 text-gray-600" />
                            </button>
                            <button 
                                onClick={() => { setEditingItem(null); setShowItemForm(true); }}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] hover:bg-black transition-colors"
                             >
                                <Plus className="w-5 h-5 text-white" />
                            </button>
                             <button onClick={fetchItems} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                                <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Search & Scan Bar */}
                    <div className="flex gap-3 mb-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="ค้นหาวัตถุดิบ (ชื่อ/บาร์โค้ด)..."
                                className="w-full bg-gray-100 border-none rounded-xl py-3 pl-10 pr-4 font-medium focus:ring-2 focus:ring-[#1A1A1A] transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => setShowScanner(true)}
                            className="w-12 h-12 flex-shrink-0 bg-[#1A1A1A] text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        >
                            <Scan className="w-6 h-6" />
                        </button>
                    </div>

                    {/* View & Sort Controls */}
                    <div className="flex justify-between items-center px-1">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-200 text-black' : 'text-gray-400'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-200 text-black' : 'text-gray-400'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                            </button>
                        </div>

                        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setSortMode('name')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${sortMode === 'name' ? 'bg-white shadow text-black' : 'text-gray-400'}`}
                            >
                                A-Z
                            </button>
                            <button 
                                onClick={() => setSortMode('low_stock')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${sortMode === 'low_stock' ? 'bg-white shadow text-red-600' : 'text-gray-400'}`}
                            >
                                Low Stock
                            </button>
                        </div>
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex overflow-x-auto px-4 pb-0 hide-scrollbar gap-6 border-b border-gray-100">
                    {categories.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`pb-3 whitespace-nowrap font-bold text-sm transition-all border-b-[3px] select-none ${
                                activeCategory === cat.id 
                                ? 'border-[#1A1A1A] text-[#1A1A1A] scale-105' 
                                : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <span className="mr-2 text-lg filter grayscale-[0.3]">{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Info */}
            <div className="p-4 pb-20 safe-area-inset-bottom">
                
                {loading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-pulse">
                        <Package className="w-12 h-12 mb-4 opacity-50" />
                        <p>กำลังโหลด...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Package className="w-12 h-12 mb-4 opacity-50" />
                        <p>ไม่พบสินค้าในหมวด {activeCategory}</p>
                        <button onClick={() => navigate('/admin/items')} className="mt-4 text-sm text-blue-600 font-bold hidden">
                            + Add New Item
                        </button>
                    </div>
                ) : (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                             {filteredItems.map(item => (
                                 <StockCard 
                                    key={item.id} 
                                    item={item} 
                                    onClick={(i) => setSelectedItem(i)} 
                                 />
                             ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col divide-y divide-gray-100">
                            {filteredItems.map(item => {
                                return (
                                    <div 
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors active:bg-gray-100"
                                    >
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <Package className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-[#1A1A1A] truncate">{item.name}</h3>
                                            <p className="text-xs text-gray-500">คงเหลือ {item.current_quantity} {item.unit}</p>
                                        </div>
                                        <div className={`text-right px-3 py-1 rounded-full text-xs font-bold ${
                                            getStatusColor(item.current_quantity, item.reorder_point, item.min_stock_threshold)
                                        }`}>
                                            {item.current_quantity?.toLocaleString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>
            
            {/* Modals */}
            {selectedItem && (
                <AdjustmentModal 
                    item={selectedItem} 
                    onClose={() => setSelectedItem(null)}
                    onUpdate={handleAdjustment}
                    onEdit={() => {
                        setSelectedItem(null); // Close adjustment
                        setEditingItem(selectedItem);
                        setShowItemForm(true);
                    }}
                />
            )}

            {showItemForm && (
                <StockItemForm
                    item={editingItem}
                    categories={categories}
                    onClose={() => setShowItemForm(false)}
                    onUpdate={() => {
                        fetchItems(); // Refresh list
                    }}
                />
            )}

            {showScanner && (
                <BarcodeScanner 
                    onScan={handleCodeScan}
                    onClose={() => setShowScanner(false)}
                />
            )}

            {showHistory && (
                <TransactionHistory 
                    onClose={() => setShowHistory(false)}
                />
            )}

            {showReport && (
                <StockUsageReport 
                    onClose={() => setShowReport(false)}
                />
            )}
            
            {showCategoryManager && (
                <CategoryManager 
                    onClose={() => setShowCategoryManager(false)}
                    onUpdate={() => {
                        fetchCategories();
                    }}
                />
            )}
        </div>
    );
}
