import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import POSLayout from './POSLayout';
import POSTableGrid from './POSTableGrid';
import POSMenuGrid from './POSMenuGrid';
import POSOrderPanel from './POSOrderPanel';
import { usePOSOrder } from '../hooks/usePOSOrder';
import { Toaster, toast } from 'sonner';

export default function POSDashboard() {
    const [view, setView] = useState('tables'); // 'tables' or 'menu'
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeBooking, setActiveBooking] = useState(null);
    const [currentOrder, setCurrentOrder] = useState({
        items: [],
        customer: null,
        table: null
    });

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

    const handleCheckout = async (paymentMethod) => {
        if (currentOrder.items.length === 0) return;

        let bookingId = activeBooking?.id;

        // 1. Create walk-in if no active booking
        if (!bookingId) {
            const newBooking = await createWalkIn(selectedTable);
            if (!newBooking) return;
            bookingId = newBooking.id;
        }

        // 2. Submit items (In a more robust system, we should diff vs database)
        // For POC, we'll just submit the new ones or re-submit?
        // Let's assume for now any item in currentOrder that doesn't have db_id is new
        const newItems = currentOrder.items.filter(i => !i.db_id);
        if (newItems.length > 0) {
            const success = await submitOrderItems(bookingId, newItems);
            if (!success) return;
        }

        // 3. Complete Checkout
        const subtotal = currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        // In a real app, we'd pass the includeTax state or recalculate.
        // For now, let's assume the UI total is what we want.
        // To be precise, let's just use the subtotal if VAT is off, or subtotal * 1.07 if on.
        // We can pass the total from the UI or just recalculate here.
        const finalTotal = subtotal * 1.07; // Default to including tax for now or add a param

        const success = await completeCheckout(bookingId, finalTotal, paymentMethod);
        if (success) {
            handleBackToTables();
        }
    };

    return (
        <div className="h-screen w-full bg-[#121212] text-white overflow-hidden flex flex-col font-sans">
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
                        ) : (
                            <POSMenuGrid onAddItem={handleAddToOrder} />
                        )}
                    </div>

                    {/* Order Panel Sidebar */}
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
                    />
                </div>
            </POSLayout>
        </div>
    );
}
