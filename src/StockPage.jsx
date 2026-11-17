/* Hallmark · genre: modern-minimal · macrostructure: Catalogue · theme: custom · designed-as-app */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { stockStatus, STOCK_STATUS_LABEL, packCapacity } from './utils/stockUtils';
import { qtyInWords, displayUnit } from './utils/stockCount';
import { logStaffActivity } from './utils/auditLogger';
import { postStockMovement, recordSpotCount, STOCK_REASONS } from './utils/stockLedger';

// Per-glass recipes and templates live in stock_items for costing but are never counted.
// Only hidden once the database marks them explicitly, so nothing disappears before that.
const isShelfItem = (item) => item?.item_type !== 'recipe';
import { useNavigate, useLocation } from 'react-router-dom';
import StockCard from './components/stock/StockCard';
import StockListItem from './components/stock/StockListItem';
import AdjustmentModal from './components/stock/AdjustmentModal';
import BarcodeScanner from './components/stock/BarcodeScanner';
import { normalizeBarcode, parseShopLabel } from './utils/stockBarcode';
import TransactionHistory from './components/stock/TransactionHistory'; // Added
import StockUsageReport from './components/stock/StockUsageReport'; // Added
import CategoryManager from './components/stock/CategoryManager';
import StockItemForm from './components/stock/StockItemForm'; // Added
import RecipeBuilder from './components/recipes/RecipeBuilder'; // Added
import { toast } from 'sonner';
import './StockPage.css';

export default function StockPage() {
    const navigate = useNavigate();
    // Opened from the backoffice: "กลับ" returns there instead of the staff dashboard.
    const backTo = useLocation().state?.from || '/staff';
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

    // Track items currently being adjusted to prevent realtime flicker
    const pendingAdjustIds = useRef(new Set());

     const fetchCategories = async () => {
         const { data, error } = await supabase.from('stock_categories').select('*').order('sort_order');
         
         const defaultTabs = [
             { id: 'restock', label: 'ต้องสั่งซื้อ' },
             { id: 'all', label: 'ทั้งหมด' }
         ];

         if (data && data.length > 0) {
             const userCats = data.filter(c => c.id !== 'restock' && c.id !== 'all');
             setCategories([...defaultTabs, ...userCats]);
         } else {
             // Fallback default
             setCategories([
                ...defaultTabs,
                { id: 'homemade', label: 'ซอสในบ้าน Homemade' },
                { id: 'egg', label: 'ไข่ และข้าวสาร' },
                { id: 'bar', label: 'บาร์ (Bar)' },
                { id: 'meat', label: 'เนื้อสัตว์ (Meat)' },
                { id: 'veg', label: 'ผัก (Veg)' },
                { id: 'sauce', label: 'ซอส/เครื่องปรุง (Sauce)' },
                { id: 'dry', label: 'ของแห้ง (Dry)' },
                { id: 'curry', label: 'พริกแกง (Curry)' },
                { id: 'frozen', label: 'อาหารแช่แข็ง (Frozen)' },
                { id: 'oil', label: 'น้ำมัน (Oil)' },
                { id: 'soup', label: 'ซุป/สต๊อก (Soup)' },
                { id: 'preserved', label: 'ของดอง' },
                { id: 'packaging', label: 'แพ็คเกจ' },
                { id: 'supplies', label: 'ของใช้' },
                { id: 'other', label: 'อื่นๆ' }
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
            setItems((data || []).filter(isShelfItem));
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
                    if (!isShelfItem(payload.new)) return;
                    setItems(currentItems => {
                        if (currentItems.some(i => i.id === payload.new.id)) return currentItems;
                        return [...currentItems, payload.new].sort((a, b) => a.name.localeCompare(b.name, 'th'));
                    });
                } else if (payload.eventType === 'UPDATE') {
                    // Skip if this item has a pending adjustment in flight
                    if (pendingAdjustIds.current.has(payload.new.id)) return;
                    setItems(currentItems =>
                        currentItems
                            .map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item)
                            .filter(isShelfItem)
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

            // Ledger RPC: locks the row, applies the change and records the real
            // difference + balance in one transaction. The branches below are only the
            // fallback for a database that does not have the RPC yet.
            // A count of one item is recorded as a mid-day count session so the daily
            // reconciliation sees it; receipts and withdrawals go straight to the ledger.
            let ledger = type === 'set'
                ? await recordSpotCount({ itemId, countedQty: roundedChange, performedBy, note: diagNote })
                : { ok: false, rpcMissing: true };
            if (!ledger.ok && ledger.rpcMissing) {
                ledger = await postStockMovement({
                    itemId,
                    mode: type === 'set' ? 'set' : 'delta',
                    quantity: roundedChange,
                    reason: type === 'set' ? STOCK_REASONS.COUNT_ADJUST : (type === 'in' ? STOCK_REASONS.PURCHASE : (meta.reason || STOCK_REASONS.ADJUST)),
                    performedBy,
                    note: diagNote
                });
            }
            if (!ledger.ok && !ledger.rpcMissing) throw ledger.error;

            if (ledger.ok) {
                 const targetItem = items.find(i => i.id === itemId);
                 const oldQty = Number(ledger.data?.old_quantity ?? targetItem?.current_quantity ?? 0);
                 const newQty = Number(ledger.data?.new_quantity ?? roundedChange);
                 const diff = Number(ledger.data?.quantity_change ?? (newQty - oldQty));
                 if (type === 'set') {
                     logStaffActivity('stock', 'stock_audit', {
                         staffName: performedBy,
                         amount: Math.abs(diff),
                         reason: `ตรวจนับสต็อก: ${targetItem?.name || 'วัตถุดิบ'} (${oldQty} → ${newQty} ${targetItem?.unit || ''}) | โน้ต: ${diagNote}`,
                         metadata: {
                             module: 'stock',
                             item_id: itemId,
                             item_name: targetItem?.name,
                             unit: targetItem?.unit,
                             old_quantity: oldQty,
                             new_quantity: newQty,
                             diff,
                             note: diagNote
                         }
                     });
                 } else {
                     logStaffActivity('stock', type === 'in' || roundedChange > 0 ? 'stock_in' : 'stock_out', {
                         staffName: performedBy,
                         amount: Math.abs(roundedChange),
                         reason: `${type === 'in' ? 'รับเข้าสต็อก' : 'เบิกใช้/ตัดสต็อก'}: ${targetItem?.name || 'วัตถุดิบ'} (${roundedChange >= 0 ? '+' : ''}${roundedChange} ${targetItem?.unit || ''}) | โน้ต: ${diagNote}`,
                         metadata: {
                             module: 'stock',
                             item_id: itemId,
                             item_name: targetItem?.name,
                             unit: targetItem?.unit,
                             quantity_change: roundedChange,
                             type,
                             stock_reason: meta.reason || null,
                             note: diagNote
                         }
                     });
                 }
            } else if (type === 'set') {
                 // ── Fallback: Absolute Update (Audit/Count) without the ledger RPC ──
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

                 // Centralized Staff Activity Trail
                 logStaffActivity('stock', 'stock_audit', {
                     staffName: performedBy,
                     amount: Math.abs(diff),
                     reason: `ตรวจนับสต็อก: ${oldItem?.name || 'วัตถุดิบ'} (${oldQty} → ${roundedChange} ${oldItem?.unit || ''}) | โน้ต: ${diagNote}`,
                     metadata: {
                         module: 'stock',
                         item_id: itemId,
                         item_name: oldItem?.name,
                         unit: oldItem?.unit,
                         old_quantity: oldQty,
                         new_quantity: roundedChange,
                         diff,
                         note: diagNote
                     }
                 });

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

                 const targetItem = items.find(i => i.id === itemId);
                 logStaffActivity('stock', type === 'in' || roundedChange > 0 ? 'stock_in' : 'stock_out', {
                     staffName: performedBy,
                     amount: Math.abs(roundedChange),
                     reason: `${type === 'in' ? 'รับเข้าสต็อก' : 'เบิกใช้/ตัดสต็อก'}: ${targetItem?.name || 'วัตถุดิบ'} (${roundedChange >= 0 ? '+' : ''}${roundedChange} ${targetItem?.unit || ''}) | โน้ต: ${diagNote}`,
                     metadata: {
                         module: 'stock',
                         item_id: itemId,
                         item_name: targetItem?.name,
                         unit: targetItem?.unit,
                         quantity_change: roundedChange,
                         type,
                         note: diagNote
                     }
                 });
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
                    stock_items ( name, unit, pack_unit, pack_size, item_type, current_quantity, min_stock_threshold, reorder_point, usage_unit, conversion_factor )
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
                
                // Same words as the stock card and count sheet: "1 ลัง + เปิดอยู่ 1 เหลือ 5 ขวด", Thai units
                const qtyDisplay = qty <= EPSILON ? 'หมด' : qtyInWords(item, qty, packCapacity(item));

                // Map Action Types
                const actionLabels = Array.from(types).map(t => {
                    if (t === 'in') return 'รับเข้า';
                    if (t === 'out') return 'เบิกออก';
                    if (t === 'set') return 'ปรับยอด';
                    return t;
                }).join(', ');

                message += `${index}. ${item.name}\n   (ทำรายการ: ${actionLabels})\n   สถานะล่าสุด: ${qtyDisplay} ${statusEmoji} (จุดวิกฤต ${minThreshold} / จุดสั่งซื้อ ${reorderPoint} ${displayUnit(item.unit)})\n\n`;
                
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

    const handleCodeScan = async (scanned) => {
        // The scanner hands back { barcode, ...productInfo }; older callers pass the text.
        const rawCode = typeof scanned === 'object' && scanned !== null ? scanned.barcode : scanned;
        const code = normalizeBarcode(rawCode);
        if (!code) return;

        try {
            // Main barcode (also the 13-digit form of a 12-digit UPC), then extra codes.
            let { data } = await supabase
                .from('stock_items')
                .select('*')
                .in('barcode', [code, '0' + code, String(rawCode).trim()])
                .limit(1)
                .maybeSingle();
            if (!data) {
                const { data: extra } = await supabase
                    .from('stock_item_barcodes')
                    .select('stock_items (*)')
                    .eq('barcode', code)
                    .maybeSingle();
                data = extra?.stock_items || null;
            }
            if (!data) {
                const labelId = parseShopLabel(rawCode);
                if (labelId) {
                    ({ data } = await supabase.from('stock_items').select('*').eq('id', labelId).maybeSingle());
                }
            }

            if (data) {
                // Determine if we need to switch category tab to show it in background? 
                // Not strictly necessary, but helpful.
                if (data.category !== activeCategory) {
                    setActiveCategory(data.category);
                }
                
                setSelectedItem(data);
                setShowScanner(false);
                toast.success(`เจอ: ${data.name}`);
            } else {
                if (confirm(`ไม่พบบาร์โค้ด ${code} ในคลัง
เพิ่มเป็นวัตถุดิบใหม่ไหม? (ถ้าเป็นของที่มีอยู่แล้ว ให้ผูกบาร์โค้ดในหน้านับสต๊อกแทน)`)) {
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
            toast.error('ค้นหาบาร์โค้ดไม่สำเร็จ');
        }
    };

    // How many need a look, across the whole store (not just the open tab)
    const statusCounts = { out: 0, low: 0, reorder: 0, ok: 0 };
    for (const item of items) statusCounts[stockStatus(item)] += 1;
    const restockCount = statusCounts.out + statusCounts.low + statusCounts.reorder;

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
            if (activeCategory === 'restock') return stockStatus(item) !== 'ok';
            if (activeCategory.startsWith('status:')) return stockStatus(item) === activeCategory.slice(7);
            return item.category === activeCategory;
        })
        .sort((a, b) => {
            if (sortMode === 'low_stock') {
                return (Number(a.current_quantity) || 0) - (Number(b.current_quantity) || 0);
            }
            return a.name.localeCompare(b.name, 'th');
        });

    const statusFilter = activeCategory.startsWith('status:') ? activeCategory.slice(7) : null;
    const pickStatus = (s) => setActiveCategory(statusFilter === s ? 'restock' : `status:${s}`);
    const searching = searchQuery.trim() !== '';

    return (
        <div className="stock-page">
            <header className="sp-header">
                <div className="sp-wrap sp-header__top">
                    <button type="button" onClick={() => navigate(backTo)} className="sp-btn sp-btn--quiet">กลับ</button>
                    <div className="sp-header__title">
                        <h1>คลังวัตถุดิบ</h1>
                        <p>{currentUser?.user_metadata?.full_name || 'พนักงาน'}</p>
                    </div>
                    <button type="button" onClick={() => { setEditingItem(null); setShowItemForm(true); }} className="sp-btn sp-btn--outline">
                        เพิ่มวัตถุดิบ
                    </button>
                </div>
                <nav className="sp-wrap sp-tools" aria-label="เครื่องมือคลัง">
                    <button type="button" onClick={handleManualUpdate} disabled={loading} title="ส่งสรุป 1 ชั่วโมงล่าสุดเข้า LINE">ส่ง LINE</button>
                    <button type="button" onClick={() => setShowReport(true)} title="สรุปการเบิกออก 7 / 30 วัน">สรุปเบิก</button>
                    <button type="button" onClick={() => setShowHistory(true)}>ประวัติ</button>
                    <button type="button" onClick={() => setShowCategoryManager(true)}>หมวดหมู่</button>
                    <button type="button" onClick={() => navigate('/staff/stock/check')} title="หน่วยที่ตั้งผิด ต้นทุนที่ยังไม่ใส่ และรายการซ้ำ">ตรวจหน่วย</button>
                    <button type="button" onClick={fetchItems}>{loading ? 'กำลังโหลด' : 'โหลดใหม่'}</button>
                </nav>
            </header>

            {/* What needs a look, and the two jobs done every day */}
            <section className="sp-wrap sp-board" aria-label="ต้องดู">
                <div className="sp-status-grid" role="group" aria-label="สถานะสต๊อก">
                    {['out', 'low', 'reorder'].map(s => (
                        <button key={s} type="button" onClick={() => pickStatus(s)} aria-pressed={statusFilter === s}
                            className={`sp-stat sp-stat--${s} ${statusCounts[s] > 0 ? 'is-hot' : ''} ${statusFilter === s ? 'is-active' : ''}`}>
                            <span className="sp-stat__n">{loading && !items.length ? '–' : statusCounts[s]}</span>
                            <span className="sp-stat__label">{STOCK_STATUS_LABEL[s]}</span>
                        </button>
                    ))}
                </div>
                <div className="sp-cta-grid">
                    <button type="button" onClick={() => navigate('/staff/stock/count')} className="sp-cta sp-cta--ink">
                        <span className="sp-cta__label">นับสต๊อก</span>
                        <span className="sp-cta__hint">กรอก หรือกด + −</span>
                    </button>
                    <button type="button" onClick={() => navigate('/staff/stock/receive')} className="sp-cta">
                        <span className="sp-cta__label">รับของ</span>
                        <span className="sp-cta__hint">ตามบิล พร้อมค่าใช้จ่าย</span>
                    </button>
                </div>
            </section>

            <div className="sp-filters">
                <div className="sp-wrap">
                    <div className="sp-search-bar">
                        <input
                            type="search"
                            placeholder="ค้นหาชื่อหรือบาร์โค้ด"
                            aria-label="ค้นหาวัตถุดิบ"
                            className="sp-search-bar__input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="button" onClick={() => setShowScanner(true)} className="sp-btn sp-btn--outline">สแกน</button>
                    </div>
                    <div className="sp-tabs" role="tablist" aria-label="หมวดหมู่">
                        {categories.map(cat => (
                            <button key={cat.id} type="button" role="tab" aria-selected={activeCategory === cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`sp-tab ${activeCategory === cat.id ? 'sp-tab--active' : ''} ${cat.id === 'restock' ? 'sp-tab--restock' : ''}`}>
                                {cat.label}
                                {cat.id === 'restock' && restockCount > 0 && <span className="sp-tab__n">{restockCount}</span>}
                            </button>
                        ))}
                    </div>
                    <div className="sp-controls">
                        <span className="sp-controls__count">
                            {filteredItems.length.toLocaleString('th-TH')} รายการ
                        </span>
                        <div className="sp-seg" role="group" aria-label="เรียง">
                            <button type="button" onClick={() => setSortMode('name')} aria-pressed={sortMode === 'name'}>ชื่อ ก–ฮ</button>
                            <button type="button" onClick={() => setSortMode('low_stock')} aria-pressed={sortMode === 'low_stock'}>น้อยก่อน</button>
                        </div>
                        <div className="sp-seg" role="group" aria-label="มุมมอง">
                            <button type="button" onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}>การ์ด</button>
                            <button type="button" onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}>รายการ</button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="sp-wrap sp-content">
                {loading && items.length === 0 ? (
                    <div className="sp-grid" aria-busy="true" aria-label="กำลังโหลดสต๊อก">
                        {Array.from({ length: 10 }, (_, i) => (
                            <div key={i} className="sc-card sc-card--skeleton" aria-hidden="true">
                                <span className="sk" style={{ width: 40, height: 24 }} />
                                <span className="sk" style={{ width: 64, height: 64, margin: '8px auto 12px', borderRadius: 6 }} />
                                <span className="sk" style={{ width: '80%', height: 14, margin: '4px 0 18px' }} />
                                <span className="sk" style={{ width: 56, height: 24, marginTop: 8 }} />
                            </div>
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <p className="sp-empty">
                        {statusFilter ? `ไม่มีรายการที่${STOCK_STATUS_LABEL[statusFilter]}` : searching ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีรายการในหมวดนี้'}
                    </p>
                ) : (
                    <div key={`${viewMode}:${activeCategory}`} className={viewMode === 'grid' ? 'sp-grid sp-fade' : 'sp-list sp-fade'}>
                        {filteredItems.map(item => viewMode === 'grid' ? (
                            <StockCard key={item.id} item={item} onClick={(i) => setSelectedItem(i)} onRecipe={handleOpenRecipe}
                                searchActive={searching} categories={categories} />
                        ) : (
                            <StockListItem key={item.id} item={item} onClick={(i) => setSelectedItem(i)} onRecipe={handleOpenRecipe}
                                searchActive={searching} categories={categories} />
                        ))}
                    </div>
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
