import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { formatStockDisplay } from './utils/stockUtils';
import { 
    Package, 
    Scan, 
    Search, 
    ArrowLeft, 
    History,
    RefreshCw,
    Settings,
    Plus,
    Bell,
    BellOff,
    Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StockCard from './components/stock/StockCard';
import AdjustmentModal from './components/stock/AdjustmentModal';
import BarcodeScanner from './components/stock/BarcodeScanner';
import TransactionHistory from './components/stock/TransactionHistory'; // Added
import StockUsageReport from './components/stock/StockUsageReport'; // Added
import CategoryManager from './components/stock/CategoryManager';
import StockItemForm from './components/stock/StockItemForm'; // Added
import RecipeBuilder from './components/recipes/RecipeBuilder'; // Added
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
    
    // Recipe Builder State
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [recipeTarget, setRecipeTarget] = useState(null);

    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [sortMode, setSortMode] = useState('name'); // 'name' | 'low_stock'
    
    // Notification Toggle Removed


    // Data State
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]); // Dynamic
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null); // For Adjustment Modal

     const fetchCategories = async () => {
         const { data, error } = await supabase.from('stock_categories').select('*').order('sort_order');
         
         const defaultTabs = [
             { id: 'restock', label: 'ต้องสั่งซื้อ (Restock)', icon: '⚠️' },
             { id: 'all', label: 'สินค้าทั้งหมด (All)', icon: '📦' }
         ];

         if (data && data.length > 0) {
             const userCats = data.filter(c => c.id !== 'restock' && c.id !== 'all');
             setCategories([...defaultTabs, ...userCats]);
         } else {
             // Fallback default
             setCategories([
                ...defaultTabs,
                { id: 'homemade', label: 'ซอสในบ้าน Homemade', icon: '🍳' },
                { id: 'egg', label: 'ไข่ และข้าวสาร', icon: '🥚' },
                { id: 'bar', label: 'บาร์ (Bar)', icon: '🍸' },
                { id: 'meat', label: 'เนื้อสัตว์ (Meat)', icon: '🥩' },
                { id: 'veg', label: 'ผัก (Veg)', icon: '🥬' },
                { id: 'sauce', label: 'ซอส/เครื่องปรุง (Sauce)', icon: '🧂' },
                { id: 'dry', label: 'ของแห้ง (Dry)', icon: '🥫' },
                { id: 'curry', label: 'พริกแกง (Curry)', icon: '🥘' },
                { id: 'frozen', label: 'อาหารแช่แข็ง (Frozen)', icon: '❄️' },
                { id: 'oil', label: 'น้ำมัน (Oil)', icon: '🛢️' },
                { id: 'soup', label: 'ซุป/สต๊อก (Soup)', icon: '🍲' },
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
                .order('name', { ascending: true });

            // If 'restock' or 'all' tab, we fetch ALL to filter client-side / just show all
            if (activeCategory !== 'restock' && activeCategory !== 'all' && activeCategory) {
                query = query.eq('category', activeCategory);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            let result = data || [];
            
            // Client-side filtering for Restock Tab
            if (activeCategory === 'restock') {
                result = result.filter(item => {
                    const qty = Number(item.current_quantity) || 0;
                    const reorder = Number(item.reorder_point) || 0;
                    const min = Number(item.min_stock_threshold) || 0;
                    
                    // Trigger if stock reaches or falls below either threshold (at least one threshold must be > 0)
                    // We use a small epsilon (0.0001) for float safety
                    return (reorder > 0 && qty <= reorder + 0.0001) || (min > 0 && qty <= min + 0.0001) || (qty <= 0);
                });
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

    const handleAdjustment = async (itemId, changeAmount, type, meta = {}) => {
        const item = items.find(i => i.id === itemId) || { current_quantity: 0 };
        const currentQty = Number(item.current_quantity || 0);
        let newQty = currentQty;

        // Optimistic Update
        setItems(prev => prev.map(i => {
            if (i.id === itemId) {
                newQty = type === 'set' 
                    ? changeAmount 
                    : Number(i.current_quantity || 0) + changeAmount;
                return { ...i, current_quantity: newQty };
            }
            return i;
        }));

        try {
            const performedBy = currentUser?.user_metadata?.full_name || currentUser?.email || 'Staff';

            if (type === 'set') {
                 // Absolute Update (Audit/Count) - Use RPC to calculate diff and log transaction
                 const { error } = await supabase.rpc('set_stock_quantity', {
                     p_item_id: itemId,
                     p_new_quantity: changeAmount,
                     p_reason: meta.note || 'Audit',
                     p_performed_by: performedBy
                 });
                 
                 // If RPC fails (e.g. function not found), fallback to direct transaction logging
                 if (error) {
                      console.warn("RPC failed, falling back to direct log:", error);
                      const { error: directError } = await supabase.from('stock_transactions').insert({
                        stock_item_id: itemId,
                        transaction_type: 'set',
                        quantity_change: changeAmount - currentQty,
                        performed_by: performedBy, 
                        note: meta.note + ' (JS Fallback)'
                      });
                      if (directError) throw directError;
                 }
            } else {
                 // Relative Update (In/Out)
                 const { error } = await supabase.from('stock_transactions').insert({
                    stock_item_id: itemId,
                    transaction_type: type,
                    quantity_change: changeAmount,
                    performed_by: performedBy, 
                    note: meta.note
                });
                if (error) throw error;
            }

            // --- FINAL VERIFICATION FETCH ---
            // Fetch the item directly from DB to confirm final quantity
            const { data: verifiedItem } = await supabase
                .from('stock_items')
                .select('*')
                .eq('id', itemId)
                .single();
            
            if (verifiedItem) {
                setItems(prev => prev.map(i => i.id === itemId ? verifiedItem : i));
            }

            toast.success(type === 'set' ? `Stock Set to: ${verifiedItem?.current_quantity || changeAmount}` : `Updated stock: ${changeAmount > 0 ? '+' : ''}${changeAmount}`);
            
        } catch (err) {
            toast.error('Sync failed');
            console.error(err);
            fetchItems(); // Full Revert
        }
    };

    const handleManualUpdate = async () => {
        if (!confirm('ยืนยันส่งสรุปการอัพเดทสต็อก (1 ชม. ล่าสุด) ลงกลุ่ม LINE?')) return;
        
        const toastId = toast.loading('กำลังสรุปและส่งข้อมูล...');
        try {
            // 1. Get transactions from last 1 hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            
            const { data: txData, error: txError } = await supabase
                .from('stock_transactions')
                .select(`
                    id, 
                    created_at, 
                    quantity_change, 
                    transaction_type,
                    performed_by,
                    stock_items ( name, unit, current_quantity, min_stock_threshold, reorder_point )
                `)
                .gt('created_at', oneHourAgo)
                .order('created_at', { ascending: true });

            if (txError) throw txError;

            if (!txData || txData.length === 0) {
                toast.dismiss(toastId);
                toast.info('ไม่พบการอัพเดทใน 1 ชม. ล่าสุด');
                return;
            }

            // 2. Group by Item to prevent duplicate lines if updated multiple times
            // However, seeing the log of actions might be good. 
            // User requirement: "สรุปการอัพเดท stock... push message ลงกลุ่มแค่รายการที่อัพเดทใน 1 ชม. นั้น"
            // Let's list the unique items that were updated, and show their CURRENT status.
            
            const itemMap = {}; 
            const performers = new Set();

            txData.forEach(tx => {
                const itemName = tx.stock_items?.name || 'Unknown';
                
                if (tx.stock_items) {
                    if (!itemMap[itemName]) {
                        itemMap[itemName] = {
                            item: tx.stock_items,
                            types: new Set()
                        };
                    }
                    if (tx.transaction_type) {
                        itemMap[itemName].types.add(tx.transaction_type);
                    }
                }
                if (tx.performed_by) performers.add(tx.performed_by);
            });

            // 3. Format Message
            let message = `📦 สรุปอัพเดทสต็อก (1 ชม. ล่าสุด)\n\n`;
            
            let index = 1;
            Object.values(itemMap).forEach(({ item, types }) => {
                // Determine Status (Logic should match StockCard and Dashboard)
                const qty = Number(item.current_quantity) || 0;
                const minThreshold = Number(item.min_stock_threshold) || 0;
                const reorderPoint = Number(item.reorder_point) || 0;
                const EPSILON = 0.0001;
                
                let statusEmoji = '🟢';
                if (qty <= EPSILON) statusEmoji = '⚫ หมด';
                else if (minThreshold > 0 && qty <= minThreshold + EPSILON) statusEmoji = '🔴 วิกฤต';
                else if (reorderPoint > 0 && qty <= reorderPoint + EPSILON) statusEmoji = '🟠 ต้องเติม';
                else if (qty <= minThreshold) statusEmoji = '🔴 วิกฤต'; // Fallback for 0 threshold if stock is somehow negative
                
                
                // Friendly Format (Unopened + Opened)
                const display = formatStockDisplay(qty, item.unit).displayString;
                
                // Map Action Types
                const actionLabels = Array.from(types).map(t => {
                    if (t === 'in') return 'รับเข้า';
                    if (t === 'out') return 'เบิกออก';
                    if (t === 'set') return 'ปรับยอด';
                    return t;
                }).join(', ');

                message += `${index}. ${item.name}\n   (ทำรายการ: ${actionLabels})\n   สถานะล่าสุด: ${display} ${statusEmoji}\n\n`;
                index++;
            });

            const staffNames = Array.from(performers).join(', ');
            message += `โดย: ${staffNames}`;

            // 4. Send
            const { error: sendError } = await supabase.functions.invoke('send-line-notify', {
                body: { message }
            });

            if (sendError) throw sendError;

            toast.dismiss(toastId);
            toast.success('ส่งสรุปเรียบร้อย');

        } catch (err) {
            console.error(err);
            toast.dismiss(toastId);
            toast.error('ส่งข้อมูลล้มเหลว');
        }
    };

    const handleOpenRecipe = (item) => {
        setRecipeTarget(item);
        setIsRecipeOpen(true);
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
                return (Number(a.current_quantity) || 0) - (Number(b.current_quantity) || 0);
            }
            return a.name.localeCompare(b.name, 'th');
        });

    // Helper for List View Colors
    const getStatusColor = (qty, reorder, min) => {
        const numQty = Number(qty) || 0;
        const numMin = Number(min) || 0;
        const numReorder = Number(reorder) || 0;
        const EPSILON = 0.0001;

        if ((numMin > 0 && numQty <= numMin + EPSILON) || numQty <= EPSILON) return 'bg-red-100 text-red-600'; // Critical
        if (numReorder > 0 && numQty <= numReorder + EPSILON) return 'bg-orange-100 text-orange-700'; // Warning
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
                        
                        <div className="flex-1 flex flex-col items-center justify-center mx-2">
                            <h1 className="text-lg font-bold leading-tight">ระบบสต็อก</h1>
                            <p className="text-[10px] text-gray-500 font-medium leading-none">
                                {currentUser?.user_metadata?.full_name || 'Staff Member'}
                            </p>
                        </div>
                        
                        <div className="flex gap-2">
                            {/* Update Stock Button (Manual Push) */}
                             <button 
                                onClick={handleManualUpdate}
                                disabled={loading}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                             >
                                <Send className="w-5 h-5" />
                             </button>

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
                                    onRecipe={handleOpenRecipe}
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
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-[#1A1A1A] truncate">{item.name}</h3>
                                                {item.is_base_recipe && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenRecipe(item);
                                                        }}
                                                        className="p-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-scroll"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/></svg>
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {formatStockDisplay(item.current_quantity, item.unit || item.pack_unit, item.usage_unit, item.conversion_factor).displayString}
                                            </p>
                                        </div>
                                        <div className={`text-right px-3 py-1 rounded-full text-xs font-bold ${
                                            getStatusColor(item.current_quantity, item.reorder_point, item.min_stock_threshold)
                                        }`}>
                                            {formatStockDisplay(item.current_quantity).fullUnits}
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
                    currentUser={currentUser}
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

            {isRecipeOpen && recipeTarget && (
                <RecipeBuilder 
                    parentId={recipeTarget.id}
                    parentType="stock"
                    initialPrice={0} // Costing for Base Recipe doesn't have a Selling Price usually, or maybe we don't need simulator? 
                    // But simulator is inside RecipeBuilder. We can ignore it or let user see cost.
                    onClose={() => setIsRecipeOpen(false)}
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
