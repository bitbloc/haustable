/* Hallmark · genre: modern-minimal · macrostructure: Catalogue · theme: custom · designed-as-app */
import React, { useState, useEffect, useRef } from 'react';
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
import StockListItem from './components/stock/StockListItem';
import AdjustmentModal from './components/stock/AdjustmentModal';
import BarcodeScanner from './components/stock/BarcodeScanner';
import TransactionHistory from './components/stock/TransactionHistory'; // Added
import StockUsageReport from './components/stock/StockUsageReport'; // Added
import CategoryManager from './components/stock/CategoryManager';
import StockItemForm from './components/stock/StockItemForm'; // Added
import RecipeBuilder from './components/recipes/RecipeBuilder'; // Added
import { toast } from 'sonner';
import './StockPage.css';

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
    const [quickCountMode, setQuickCountMode] = useState(false); // Added
    
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

    // Track items currently being adjusted to prevent realtime flicker
    const pendingAdjustIds = useRef(new Set());

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
        fetchItems();
    }, []);

    // --- Fetching Items ---
    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('stock_items')
                .select('*')
                .order('name', { ascending: true });
            
            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load stock');
        } finally {
            setLoading(false);
        }
    };

    // Real-time Subscriptions (Full Event Lifecycle: INSERT, UPDATE, DELETE & Category sync)
    useEffect(() => {
        const channelId = `stock-realtime-${Date.now()}`;
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setItems(currentItems => {
                        if (currentItems.some(i => i.id === payload.new.id)) return currentItems;
                        return [...currentItems, payload.new].sort((a, b) => a.name.localeCompare(b.name, 'th'));
                    });
                } else if (payload.eventType === 'UPDATE') {
                    // Skip if this item has a pending adjustment in flight
                    if (pendingAdjustIds.current.has(payload.new.id)) return;
                    setItems(currentItems => 
                        currentItems.map(item => 
                            item.id === payload.new.id ? { ...item, ...payload.new } : item
                        )
                    );
                } else if (payload.eventType === 'DELETE') {
                    setItems(currentItems => currentItems.filter(item => item.id !== payload.old.id));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_categories' }, () => {
                fetchCategories();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleAdjustment = async (itemId, changeAmount, type, meta = {}) => {
        const roundedChange = Number(Number(changeAmount).toFixed(4));

        // Mark this item as pending (realtime subscription will skip it)
        pendingAdjustIds.current.add(itemId);

        try {
            const performedBy = currentUser?.user_metadata?.full_name || currentUser?.email || 'Staff';
            const diagNote = (meta.note || 'Adjustment');
            
            if (type === 'set') {
                 // ── Absolute Update (Audit/Count) ──
                 // FIX: Bypass trigger entirely to prevent double-count.
                 // 1. Direct UPDATE on stock_items (no trigger involvement)
                 // 2. Audit log with quantity_change=0 (trigger adds 0 = safe)

                 // Get old quantity for audit note
                 const oldItem = items.find(i => i.id === itemId);
                 const oldQty = oldItem?.current_quantity || 0;
                 const diff = roundedChange - oldQty;

                 const { error: updateError } = await supabase
                     .from('stock_items')
                     .update({ 
                         current_quantity: roundedChange, 
                         updated_at: new Date().toISOString() 
                     })
                     .eq('id', itemId);
                 if (updateError) throw updateError;

                 // Audit log — quantity_change=0 prevents trigger double-count
                 // even if trigger doesn't skip 'set' type
                 try {
                     await supabase.from('stock_transactions').insert({
                         stock_item_id: itemId,
                         transaction_type: 'set',
                         quantity_change: 0,
                         performed_by: performedBy,
                         note: `${diagNote} | ${oldQty} → ${roundedChange} (Δ${diff >= 0 ? '+' : ''}${diff})`
                     });
                 } catch (e) {
                     // fire-and-forget audit log
                 }

            } else {
                 // Relative Update (In/Out)
                 const { error } = await supabase.from('stock_transactions').insert({
                    stock_item_id: itemId,
                    transaction_type: type,
                    quantity_change: roundedChange,
                    performed_by: performedBy, 
                    note: diagNote
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
            toast.error('Sync failed: ' + (err.message || 'Unknown error'));
            console.error(err);
            fetchItems(); // Full Revert on error
        } finally {
            // Release the pending lock so realtime can resume for this item
            pendingAdjustIds.current.delete(itemId);
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
                    stock_items ( name, unit, current_quantity, min_stock_threshold, reorder_point, usage_unit, conversion_factor )
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
            const flexItems = [];
            const filteredStaff = Array.from(performers).filter(name => 
                !name.toLowerCase().includes('antigravity') && 
                !name.toLowerCase().includes('debug')
            );
            const staffNames = filteredStaff.length > 0 ? filteredStaff.join(', ') : 'Staff';
            
            let index = 1;
            Object.values(itemMap).forEach(({ item, types }) => {
                // Determine Status (Logic should match StockCard and Dashboard)
                const qty = Number(Number(item.current_quantity).toFixed(4)) || 0;
                const minThreshold = Number(Number(item.min_stock_threshold).toFixed(4)) || 0;
                const reorderPoint = Number(Number(item.reorder_point).toFixed(4)) || 0;
                const EPSILON = 0.0001;
                
                let statusEmoji = '🟢';
                let statusText = 'OK';
                let statusColor = '#1C6C38'; // Muted Braun Green

                if (qty <= EPSILON) {
                    statusEmoji = '⚫ หมด';
                    statusText = 'OUT';
                    statusColor = '#1C1C1C'; // Dark gray/black
                } else if ((minThreshold > 0 && qty <= minThreshold + EPSILON) || qty <= minThreshold) {
                    statusEmoji = '🔴 วิกฤต';
                    statusText = 'CRITICAL';
                    statusColor = '#B71C1C'; // Braun Accent Red
                } else if (reorderPoint > 0 && qty <= reorderPoint + EPSILON) {
                    statusEmoji = '🟠 ต้องเติม';
                    statusText = 'REORDER';
                    statusColor = '#D05D00'; // Braun Clock Orange
                }
                
                // Compact format for quantities (Unopened + Opened) to fit the Flex row width perfectly
                const { fullUnits, percent, hasOpen, remainderUsage } = formatStockDisplay(
                    qty, 
                    item.unit,
                    item.usage_unit,
                    item.conversion_factor
                );

                let qtyDisplay = '';
                if (fullUnits > 0) {
                    qtyDisplay = `${fullUnits} ${item.unit || ''}`;
                    if (hasOpen) {
                        const openText = remainderUsage !== null 
                            ? `${remainderUsage} ${item.usage_unit}`
                            : `${percent}%`;
                        qtyDisplay += ` + เปิดแล้ว ${openText}`;
                    }
                } else if (hasOpen) {
                    const openText = remainderUsage !== null 
                        ? `${remainderUsage} ${item.usage_unit}`
                        : `${percent}%`;
                    qtyDisplay = `เปิดแล้ว ${openText}`;
                } else {
                    qtyDisplay = 'หมด';
                }
                
                // Map Action Types
                const actionLabels = Array.from(types).map(t => {
                    if (t === 'in') return 'รับเข้า';
                    if (t === 'out') return 'เบิกออก';
                    if (t === 'set') return 'ปรับยอด';
                    return t;
                }).join(', ');

                message += `${index}. ${item.name}\n   (ทำรายการ: ${actionLabels})\n   สถานะล่าสุด: ${qtyDisplay} ${statusEmoji} (Critical: ${minThreshold} / Reorder: ${reorderPoint})\n\n`;
                
                const displayIndex = String(index).padStart(2, '0');
                
                flexItems.push({
                    type: "box",
                    layout: "horizontal",
                    margin: "md",
                    contents: [
                        {
                            type: "box",
                            layout: "vertical",
                            flex: 6,
                            contents: [
                                {
                                    type: "text",
                                    text: `${displayIndex} // ${item.name}`,
                                    weight: "bold",
                                    size: "sm",
                                    color: "#1C1C1C",
                                    wrap: true
                                },
                                {
                                    type: "text",
                                    text: `ACTION: ${actionLabels.toUpperCase()}`,
                                    size: "xxs",
                                    color: "#8C8C8C",
                                    margin: "xs"
                                }
                            ]
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            flex: 5,
                            alignItems: "flex-end",
                            contents: [
                                {
                                    type: "text",
                                    text: qtyDisplay,
                                    size: "sm",
                                    weight: "bold",
                                    color: "#1C1C1C",
                                    align: "end",
                                    wrap: true
                                },
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    spacing: "xs",
                                    alignItems: "center",
                                    margin: "xs",
                                    contents: [
                                        {
                                            type: "text",
                                            text: "●",
                                            color: statusColor,
                                            size: "xxs",
                                            flex: 0
                                        },
                                        {
                                            type: "text",
                                            text: statusText,
                                            size: "xxs",
                                            color: "#8C8C8C",
                                            weight: "bold",
                                            flex: 0
                                        }
                                    ]
                                },
                                {
                                    type: "text",
                                    text: `Critical: ${minThreshold} | Reorder: ${reorderPoint}`,
                                    size: "xxs",
                                    color: "#8C8C8C",
                                    align: "end",
                                    margin: "xs"
                                }
                            ]
                        }
                    ]
                });
                
                index++;
            });

            message += `โดย: ${staffNames}`;

            const bubbles = [];
            const chunkSize = 8;
            for (let i = 0; i < flexItems.length; i += chunkSize) {
                const chunk = flexItems.slice(i, i + chunkSize);
                
                // Add elegant separators between elements in the chunk
                const chunkContents = [];
                chunk.forEach((itemBox, itemIdx) => {
                    if (itemIdx > 0) {
                        chunkContents.push({
                            type: "separator",
                            color: "#EAEAEA",
                            margin: "md"
                        });
                    }
                    chunkContents.push(itemBox);
                });

                bubbles.push({
                    type: "bubble",
                    size: "mega",
                    styles: {
                        body: {
                            backgroundColor: "#F4F4F4"
                        },
                        footer: {
                            backgroundColor: "#F4F4F4",
                            separator: true,
                            separatorColor: "#EAEAEA"
                        }
                    },
                    body: {
                        type: "box",
                        layout: "vertical",
                        paddingAll: "xl",
                        spacing: "md",
                        contents: [
                            {
                                type: "text",
                                text: "SYSTEM // STOCK UPDATE",
                                size: "xxs",
                                color: "#8C8C8C",
                                weight: "bold"
                            },
                            {
                                type: "text",
                                text: `1 ชั่วโมงล่าสุด (หน้า ${bubbles.length + 1})`,
                                size: "xl",
                                weight: "bold",
                                color: "#1C1C1C"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                spacing: "xs",
                                alignItems: "center",
                                contents: [
                                    {
                                        type: "text",
                                        text: "●",
                                        color: "#1C6C38",
                                        size: "xs",
                                        flex: 0
                                    },
                                    {
                                        type: "text",
                                        text: "REPORT GENERATED",
                                        size: "xs",
                                        weight: "bold",
                                        color: "#1C1C1C",
                                        flex: 1
                                    }
                                ]
                            },
                            {
                                type: "separator",
                                color: "#EAEAEA",
                                margin: "md"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                spacing: "md",
                                contents: chunkContents
                            }
                        ]
                    },
                    footer: {
                        type: "box",
                        layout: "vertical",
                        paddingAll: "md",
                        contents: [
                            {
                                type: "text",
                                text: "ONHAUS SYSTEM ©",
                                size: "xxs",
                                color: "#A5A5A5",
                                weight: "bold",
                                align: "center"
                            }
                        ]
                    }
                });
            }

            if (bubbles.length > 5) {
                bubbles.length = 5;
            }

            const flexPayload = {
                type: "flex",
                altText: "📦 สรุปอัพเดทสต็อก (1 ชม. ล่าสุด)",
                contents: bubbles.length === 1 ? bubbles[0] : {
                    type: "carousel",
                    contents: bubbles
                }
            };

            // 4. Send
            const { error: sendError } = await supabase.functions.invoke('send-line-notify', {
                body: { message, flexPayload }
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
        .filter(item => {
            // Global Search if search query is entered
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                return (
                    item.name.toLowerCase().includes(query) || 
                    item.barcode?.includes(query)
                );
            }

            // Otherwise, filter by selected category tab
            if (activeCategory === 'all') return true;
            if (activeCategory === 'restock') {
                const qty = Number(item.current_quantity) || 0;
                const reorder = Number(item.reorder_point) || 0;
                const min = Number(item.min_stock_threshold) || 0;
                return (reorder > 0 && qty <= reorder + 0.0001) || (min > 0 && qty <= min + 0.0001) || (qty <= 0);
            }
            return item.category === activeCategory;
        })
        .sort((a, b) => {
            if (sortMode === 'low_stock') {
                return (Number(a.current_quantity) || 0) - (Number(b.current_quantity) || 0);
            }
            return a.name.localeCompare(b.name, 'th');
        });

    return (
        <div className="stock-page">
            {/* Header */}
            <header className="sp-header">
                <div className="sp-header__top">
                    <button 
                        onClick={() => navigate('/staff')}
                        className="sp-header__back"
                        title="ย้อนกลับ"
                        aria-label="ย้อนกลับ"
                    >
                        <ArrowLeft />
                    </button>
                    
                    <div className="sp-header__logo-wrap">
                        <img 
                            src="/logo-staff-light.png" 
                            alt="ในบ้าน Staff" 
                            className="sp-header__logo"
                        />
                        <p className="sp-header__user">
                            {currentUser?.user_metadata?.full_name || 'Staff Member'}
                        </p>
                    </div>
                    
                    <div className="sp-header__actions">
                        {/* Update Stock Button (Manual Push) */}
                         <button 
                            onClick={handleManualUpdate}
                            disabled={loading}
                            className="sp-header__btn sp-header__btn--line"
                            title="ส่งสรุปเข้า LINE"
                            aria-label="ส่งสรุปเข้า LINE"
                         >
                            <Send />
                         </button>

                        {/* Report Button */}
                         <button 
                            onClick={() => setShowReport(true)}
                            className="sp-header__btn"
                            title="รายงานการใช้"
                            aria-label="รายงานการใช้"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                        </button>
                         <button 
                            onClick={() => setShowHistory(true)}
                            className="sp-header__btn"
                            title="ประวัติรายการ"
                            aria-label="ประวัติรายการ"
                         >
                            <History />
                        </button>
                         <button 
                            onClick={() => setShowCategoryManager(true)}
                            className="sp-header__btn"
                            title="จัดการหมวดหมู่"
                            aria-label="จัดการหมวดหมู่"
                         >
                            <Settings />
                        </button>
                        <button 
                            onClick={() => { setEditingItem(null); setShowItemForm(true); }}
                            className="sp-header__btn sp-header__btn--accent"
                            title="เพิ่มวัตถุดิบ"
                            aria-label="เพิ่มวัตถุดิบ"
                         >
                            <Plus />
                        </button>
                         <button 
                            onClick={fetchItems} 
                            className="sp-header__btn"
                            title="โหลดข้อมูลใหม่"
                            aria-label="โหลดข้อมูลใหม่"
                         >
                            <RefreshCw className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Search & Scan Bar */}
                <div className="sp-search-bar">
                    <div className="sp-search-bar__input-wrap">
                        <Search className="sp-search-bar__icon" />
                        <input 
                            type="text"
                            placeholder="ค้นหาวัตถุดิบ (ชื่อ/บาร์โค้ด)..."
                            className="sp-search-bar__input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => setShowScanner(true)}
                        className="sp-search-bar__scan"
                        title="สแกนบาร์โค้ด"
                        aria-label="สแกนบาร์โค้ด"
                    >
                        <Scan />
                    </button>
                </div>

                {/* View & Sort Controls */}
                <div className="sp-controls">
                    <div className="sp-controls__left">
                        {/* Grid / List View Selector */}
                        <div className="sp-controls__toggle-group">
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`sp-controls__toggle-btn ${viewMode === 'grid' ? 'sp-controls__toggle-btn--active' : ''}`}
                                title="มุมมองการ์ด"
                                aria-label="มุมมองการ์ด"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`sp-controls__toggle-btn ${viewMode === 'list' ? 'sp-controls__toggle-btn--active' : ''}`}
                                title="มุมมองรายการ"
                                aria-label="มุมมองรายการ"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                            </button>
                        </div>
                        
                        {/* Quick Count Mode Toggle */}
                        <button 
                            onClick={() => setQuickCountMode(!quickCountMode)}
                            className={`sp-controls__quick-count ${quickCountMode ? 'sp-controls__quick-count--active' : ''}`}
                            title="โหมดตรวจนับสต็อกด่วน (Quick Count Mode)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-square"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
                            <span>ตรวจนับด่วน</span>
                        </button>
                    </div>

                    {/* Sort Controls */}
                    <div className="sp-controls__sort">
                        <button 
                            onClick={() => setSortMode('name')}
                            className={`sp-controls__sort-btn ${sortMode === 'name' ? 'sp-controls__sort-btn--active' : ''}`}
                        >
                            A-Z
                        </button>
                        <button 
                            onClick={() => setSortMode('low_stock')}
                            className={`sp-controls__sort-btn sp-controls__sort-btn--low ${sortMode === 'low_stock' ? 'sp-controls__sort-btn--low-active' : ''}`}
                        >
                            LOW STOCK
                        </button>
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="sp-tabs">
                    {categories.map(cat => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <button 
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`sp-tab ${isActive ? 'sp-tab--active' : ''}`}
                            >
                                <span className="sp-tab__icon" aria-hidden="true">{cat.icon}</span>
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Main Content Info */}
            <main className="sp-content">
                {loading && items.length === 0 ? (
                    <div className="sp-loading">
                        <Package className="sp-loading__icon" />
                        <span className="sp-loading__title">กำลังโหลดระบบสต็อก...</span>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="sp-empty">
                        <Package className="sp-empty__icon" />
                        <span className="sp-empty__title">ไม่พบสินค้าในหมวดหมู่: {activeCategory}</span>
                    </div>
                ) : (
                    viewMode === 'grid' ? (
                        <div className="sp-grid">
                             {filteredItems.map(item => (
                                 <StockCard 
                                    key={item.id} 
                                    item={item} 
                                    onClick={(i) => setSelectedItem(i)} 
                                    onRecipe={handleOpenRecipe}
                                    quickCountMode={quickCountMode}
                                    onUpdate={handleAdjustment}
                                    searchActive={searchQuery.trim() !== ''}
                                    categories={categories}
                                 />
                             ))}
                        </div>
                    ) : (
                        <div className="sp-list">
                            {filteredItems.map(item => (
                                <StockListItem 
                                    key={item.id}
                                    item={item}
                                    onClick={(i) => setSelectedItem(i)}
                                    onRecipe={handleOpenRecipe}
                                    quickCountMode={quickCountMode}
                                    onUpdate={handleAdjustment}
                                    searchActive={searchQuery.trim() !== ''}
                                    categories={categories}
                                />
                            ))}
                        </div>
                    )
                )}
            </main>
            
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
                    initialPrice={0}
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
