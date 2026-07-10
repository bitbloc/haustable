import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import POSLayout from './POSLayout';
import POSTableGrid from './POSTableGrid';
import POSMenuGrid from './POSMenuGrid';
import POSOrderPanel from './POSOrderPanel';
import { usePOSOrder } from '../hooks/usePOSOrder';
import { Toaster, toast } from 'sonner';
import POSReportsPanel from './POSReportsPanel';
import POSCRMPanel from './POSCRMPanel';
import SlipModal from '../components/shared/SlipModal';

export default function POSDashboard() {
    const [view, setView] = useState('tables'); // 'tables' or 'menu'
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeBooking, setActiveBooking] = useState(null);
    const [currentOrder, setCurrentOrder] = useState({
        items: [],
        customer: null,
        table: null
    });
    const [activeSlipBooking, setActiveSlipBooking] = useState(null);
    const [activeSlipType, setActiveSlipType] = useState('billing');

    const playSystemAlertSound = async () => {
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'alert_sound_url')
                .single();
            if (data && data.value) {
                const audio = new Audio(data.value);
                await audio.play();
                return;
            }
        } catch (e) {
            console.warn("Custom audio play failed, using synth beep:", e);
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.frequency.value = 880;
            gain1.gain.setValueAtTime(0.3, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.15);
            
            const delay = 0.12;
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1100;
            gain2.gain.setValueAtTime(0.3, ctx.currentTime + delay);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.25);
            osc2.start(ctx.currentTime + delay);
            osc2.stop(ctx.currentTime + delay + 0.25);
        } catch (err) {
            console.error("Web Audio API failed:", err);
        }
    };

    useEffect(() => {
        let tablesMap = {};
        const loadTablesMap = async () => {
            const { data } = await supabase.from('tables_layout').select('id, table_name');
            if (data) {
                data.forEach(t => {
                    tablesMap[t.id] = t.table_name;
                });
            }
        };
        loadTablesMap();

        const notifyChannel = supabase.channel('pos-realtime-notifications')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'bookings' 
            }, async (payload) => {
                const { eventType, new: newRow, old: oldRow } = payload;
                const tableId = newRow?.table_id || oldRow?.table_id;
                if (!tableId) return;

                const tableName = tablesMap[tableId] || `Table #${tableId}`;

                if (eventType === 'INSERT') {
                    if (newRow.status === 'pending') {
                        toast.success(`🛎️ ออเดอร์ใหม่! โต๊ะ ${tableName} สั่งอาหารเข้าห้องครัวแล้ว`, {
                            duration: 10000,
                            action: {
                                label: 'ดูรายการ',
                                onClick: () => {
                                    supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                        if (data) handleSelectTable(data);
                                    });
                                }
                            }
                        });
                        playSystemAlertSound();
                    }
                } else if (eventType === 'UPDATE') {
                    const oldRemark = oldRow?.staff_remark || '';
                    const newRemark = newRow?.staff_remark || '';
                    if (newRemark.includes('[CALL_BILL]') && !oldRemark.includes('[CALL_BILL]')) {
                        toast.warning(`💵 โต๊ะ ${tableName} เรียกเช็คบิล!`, {
                            duration: 10000,
                            action: {
                                label: 'เช็คบิล',
                                onClick: () => {
                                    supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                        if (data) handleSelectTable(data);
                                    });
                                }
                            }
                        });
                        playSystemAlertSound();
                    }

                    const oldSlip = oldRow?.payment_slip_url || '';
                    const newSlip = newRow?.payment_slip_url || '';
                    if (newSlip && !oldSlip) {
                        toast.success(`📸 โต๊ะ ${tableName} ส่งหลักฐานโอนเงินแล้ว!`, {
                            duration: 10000,
                            action: {
                                label: 'ตรวจสลิป',
                                onClick: () => {
                                    supabase.from('tables_layout').select('*').eq('id', tableId).single().then(({ data }) => {
                                        if (data) handleSelectTable(data);
                                    });
                                }
                            }
                        });
                        playSystemAlertSound();
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(notifyChannel);
        };
    }, []);

    const handleSaveAndOpenSlip = async (type) => {
        if (currentOrder.items.length === 0 && !activeBooking) {
            toast.error("No items in order to print");
            return;
        }

        let bookingId = activeBooking?.id;
        let currentBooking = activeBooking;

        // 1. Create walk-in if no active booking
        if (!bookingId) {
            const newBooking = await createWalkIn(selectedTable);
            if (!newBooking) return;
            bookingId = newBooking.id;
            currentBooking = newBooking;
        }

        // 2. Submit items
        const newItems = currentOrder.items.filter(i => !i.db_id);
        if (newItems.length > 0) {
            const success = await submitOrderItems(bookingId, newItems);
            if (!success) return;
        }

        // 3. Reload the booking to get updated order_items and references
        const updatedBooking = await getActiveBooking(selectedTable.id);
        if (updatedBooking) {
            setActiveBooking(updatedBooking);
            // Update currentOrder item db_ids so they don't get re-submitted
            const updatedItems = updatedBooking.order_items.map(oi => ({
                id: oi.menu_item_id,
                name: oi.menu_items?.name || oi.name || 'Item',
                price: oi.price_at_time,
                quantity: oi.quantity,
                db_id: oi.id,
                selected_options: oi.selected_options
            }));
            setCurrentOrder(prev => ({
                ...prev,
                items: updatedItems
            }));
            
            // 4. Open the Slip Modal
            setActiveSlipBooking(updatedBooking);
            setActiveSlipType(type);
        } else {
            setActiveSlipBooking(currentBooking);
            setActiveSlipType(type);
        }
    };

    const { getActiveBooking, createWalkIn, completeCheckout, submitOrderItems, acceptOrder } = usePOSOrder();

    const handleSelectTable = async (table) => {
        setSelectedTable(table);
        
        // 1. Check for active booking
        const booking = await getActiveBooking(table.id);
        
        if (booking) {
            setActiveBooking(booking);
            // Load existing items if any
            const existingItems = booking.order_items.map(oi => ({
                id: oi.menu_item_id,
                name: oi.menu_items?.name || oi.name || 'Item',
                price: oi.price_at_time,
                quantity: oi.quantity,
                db_id: oi.id,
                selected_options: oi.selected_options
            }));
            setCurrentOrder({
                items: existingItems,
                customer: booking.customer_name || 'Customer',
                table: table
            });
        } else {
            setActiveBooking(null);
            setCurrentOrder({
                items: [],
                customer: 'Walk-in Guest',
                table: table
            });
        }
        
        setView('menu');
    };

    const handleBackToTables = () => {
        setView('tables');
        setSelectedTable(null);
        setActiveBooking(null);
        setCurrentOrder({ items: [], customer: null, table: null });
    };

    const handleAddToOrder = (item) => {
        setCurrentOrder(prev => {
            const existing = prev.items.find(i => i.id === item.id);
            if (existing) {
                return {
                    ...prev,
                    items: prev.items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
                };
            }
            return {
                ...prev,
                items: [...prev.items, { ...item, quantity: 1 }]
            };
        });
    };

    const handleUpdateQuantity = (itemId, delta) => {
        setCurrentOrder(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === itemId) {
                    const newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0)
        }));
    };

    const handleCheckout = async (paymentMethod, includeTax) => {
        if (currentOrder.items.length === 0) return;

        let bookingId = activeBooking?.id;
        let currentBooking = activeBooking;

        // 1. Create walk-in if no active booking
        if (!bookingId) {
            const newBooking = await createWalkIn(selectedTable);
            if (!newBooking) return;
            bookingId = newBooking.id;
            currentBooking = newBooking;
        }

        // 2. Submit items
        const newItems = currentOrder.items.filter(i => !i.db_id);
        if (newItems.length > 0) {
            const success = await submitOrderItems(bookingId, newItems);
            if (!success) return;
        }

        // 3. Complete Checkout
        const subtotal = currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const finalTotal = includeTax ? subtotal * 1.07 : subtotal;

        const success = await completeCheckout(bookingId, finalTotal, paymentMethod);
        if (success) {
            const updatedBooking = await getActiveBooking(selectedTable.id);
            if (updatedBooking) {
                setActiveSlipBooking(updatedBooking);
                setActiveSlipType('receipt');
            } else {
                setActiveSlipBooking(currentBooking);
                setActiveSlipType('receipt');
            }
        }
    };

    return (
        <div className="h-screen w-full bg-[#ECECE9] text-[#1A1A1A] overflow-hidden flex flex-col font-sans select-none">
            <Toaster position="top-right" richColors />
            
            <POSLayout 
                activeView={view} 
                onViewChange={setView}
                selectedTable={selectedTable}
                onBack={handleBackToTables}
            >
                <div className="flex h-full w-full overflow-hidden">
                    {/* Main Content Area */}
                    <div className="flex-1 h-full overflow-hidden relative">
                        {view === 'tables' ? (
                            <POSTableGrid onSelectTable={handleSelectTable} />
                        ) : view === 'menu' ? (
                            <POSMenuGrid onAddItem={handleAddToOrder} />
                        ) : view === 'crm' ? (
                            <POSCRMPanel />
                        ) : (
                            <POSReportsPanel />
                        )}
                    </div>

                    {/* Order Panel Sidebar */}
                    {view !== 'reports' && view !== 'crm' && (
                        <POSOrderPanel 
                            order={currentOrder} 
                            booking={activeBooking}
                            onUpdateQuantity={handleUpdateQuantity}
                            onClear={() => setCurrentOrder({ items: [], customer: null, table: selectedTable })}
                            onCheckout={handleCheckout}
                            onAcceptOrder={async () => {
                                if (activeBooking) {
                                    const success = await acceptOrder(activeBooking.id);
                                    if (success) {
                                        handleBackToTables();
                                    }
                                }
                            }}
                            onOpenSlip={handleSaveAndOpenSlip}
                        />
                    )}
                </div>
            </POSLayout>

            {activeSlipBooking && (
                <SlipModal 
                    booking={activeSlipBooking}
                    type={activeSlipType}
                    onClose={() => {
                        setActiveSlipBooking(null);
                        if (activeSlipType === 'receipt') {
                            handleBackToTables();
                        }
                    }}
                />
            )}
        </div>
    );
}
