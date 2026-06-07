import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
    Printer as PrinterIcon, 
    TrendingUp, 
    Banknote, 
    CreditCard, 
    Percent, 
    ShoppingBag, 
    Loader2, 
    RefreshCw, 
    CheckCircle2, 
    FileText 
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import SlipModal from '../components/shared/SlipModal';

export default function POSReportsPanel() {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeReprintBooking, setActiveReprintBooking] = useState(null);

    // Filter Date (Defaults to Today in Asia/Bangkok)
    const getBangkokDate = () => {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    };
    const [filterDate, setFilterDate] = useState(getBangkokDate());

    useEffect(() => {
        fetchReportData();
    }, [filterDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const startOfDay = `${filterDate}T00:00:00`;
            const endOfDay = `${filterDate}T23:59:59`;

            // 1. Fetch Bookings for the day (completed, seated, confirmed)
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select(`
                    *,
                    tables_layout (table_name),
                    order_items (
                        id,
                        quantity,
                        price_at_time,
                        menu_item_id,
                        menu_items (
                            name,
                            category_id
                        )
                    ),
                    promotion_codes (code)
                `)
                .gte('booking_time', startOfDay)
                .lte('booking_time', endOfDay)
                .order('booking_time', { ascending: false });

            if (bookingsError) throw bookingsError;
            setBookings(bookingsData || []);

            // 2. Fetch Menu Categories for name mapping
            const { data: categoriesData } = await supabase
                .from('menu_categories')
                .select('id, name');
            setCategories(categoriesData || []);

        } catch (err) {
            console.error("Error fetching report data:", err);
        } finally {
            setLoading(false);
        }
    };

    // --- DERIVED METRICS ---
    const categoryMap = categories.reduce((acc, cat) => ({ ...acc, [cat.id]: cat.name }), {});

    const completedBookings = bookings.filter(b => b.status === 'completed');
    const activeBookings = bookings.filter(b => b.status === 'seated' || b.status === 'confirmed');

    // Completed Sales Total
    const totalSales = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalDiscounts = completedBookings.reduce((sum, b) => sum + (b.discount_amount || 0), 0);

    // Active Tables Total (Estimated Unpaid)
    const activeUnpaid = activeBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // Cash vs QR breakdown
    const isCashBooking = (b) => {
        if (b.payment_slip_url) return false;
        const remark = (b.staff_remark || '').toLowerCase();
        if (remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน')) return false;
        return true; // Default to cash if no slip and not explicitly qr
    };

    const cashSales = completedBookings
        .filter(b => isCashBooking(b))
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    const qrSales = completedBookings
        .filter(b => !isCashBooking(b))
        .reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // Category sales compile
    const categorySales = {};
    completedBookings.forEach(b => {
        b.order_items?.forEach(item => {
            const catId = item.menu_items?.category_id || 'uncategorized';
            const catName = categoryMap[catId] || 'Uncategorized';
            const itemTotal = (item.price_at_time || 0) * (item.quantity || 0);
            
            if (!categorySales[catId]) {
                categorySales[catId] = {
                    name: catName,
                    quantity: 0,
                    amount: 0
                };
            }
            categorySales[catId].quantity += item.quantity || 0;
            categorySales[catId].amount += itemTotal;
        });
    });

    const categoryList = Object.values(categorySales).sort((a, b) => b.amount - a.amount);

    // Print Shift Report HTML
    const handlePrintShiftReport = async () => {
        const printDateStr = new Date().toLocaleString('th-TH');

        const catHtml = categoryList.map(c => `
            <div class="row">
                <span>${c.name} (x${c.quantity})</span>
                <span>${c.amount.toLocaleString()}.-</span>
            </div>
        `).join('') || '<div class="empty">No Category Sales</div>';

        const htmlContent = `
            <html>
                <head>
                    <title>Shift Report - ${filterDate}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                        body { 
                            font-family: 'Courier Prime', 'Courier New', monospace; 
                            background: white; 
                            color: black; 
                            font-size: 11px; 
                            padding: 20px 10px;
                            width: 280px;
                        }
                        .header { text-align: center; margin-bottom: 15px; }
                        .title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                        .date { font-size: 9px; color: #555; }
                        
                        .section { border-top: 2px dashed black; padding: 10px 0; margin-top: 10px; }
                        .section-title { font-[9px]; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
                        
                        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
                        .total-row { font-size: 14px; font-weight: bold; border-top: 1px dashed black; padding-top: 5px; margin-top: 5px; }
                        
                        .signature { margin-top: 40px; text-align: center; font-size: 9px; }
                        .sig-line { border-bottom: 1px solid black; width: 150px; margin: 30px auto 5px auto; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="title">IN THE HAUS</div>
                        <div class="title" style="font-size:11px;">SHIFT CLOSURE REPORT</div>
                        <div class="date">Report Date: ${filterDate}</div>
                        <div class="date">Printed: ${printDateStr}</div>
                    </div>

                    <div class="section">
                        <div class="section-title">Sales Summary</div>
                        <div class="row"><span>Total Completed Bills</span> <span>${completedBookings.length}</span></div>
                        <div class="row"><span>Total Discounts</span> <span>-${totalDiscounts.toLocaleString()}.-</span></div>
                        <div class="row"><span>Cash Sales</span> <span>${cashSales.toLocaleString()}.-</span></div>
                        <div class="row"><span>QR Transfer Sales</span> <span>${qrSales.toLocaleString()}.-</span></div>
                        <div class="row total-row"><span>NET REVENUE</span> <span>${totalSales.toLocaleString()}.-</span></div>
                    </div>

                    <div class="section">
                        <div class="section-title">Sales By Category</div>
                        ${catHtml}
                    </div>

                    <div class="section">
                        <div class="section-title">Active Registry</div>
                        <div class="row"><span>Active Tables (Unpaid)</span> <span>${activeBookings.length}</span></div>
                        <div class="row"><span>Pending Active Value</span> <span>${activeUnpaid.toLocaleString()}.-</span></div>
                    </div>

                    <div class="signature">
                        <div class="sig-line"></div>
                        <span>Cashier / Verifier Signature</span>
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `;

        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Printer')) {
            try {
                await Printer.printHtml({
                    name: `Shift-Report-${filterDate}`,
                    html: htmlContent
                });
            } catch (err) {
                console.error("Native print failed, falling back to browser print:", err);
                fallbackBrowserPrint(htmlContent);
            }
        } else {
            fallbackBrowserPrint(htmlContent);
        }
    };

    const fallbackBrowserPrint = (htmlContent) => {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } else {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
            
            iframe.contentDocument.write(htmlContent);
            iframe.contentDocument.close();
            iframe.onload = () => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            };
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-[#121212] overflow-y-auto">
            {/* Header controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-6">
                <div>
                    <h3 className="text-xl font-bold">Daily Sales & Shift Report</h3>
                    <p className="text-xs text-gray-500 font-medium">Verify daily collections, payments, and print reports</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <input 
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm outline-none text-white focus:border-orange-500 font-mono"
                    />
                    <button 
                        onClick={fetchReportData} 
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
                        title="Reload"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                     <Loader2 className="animate-spin w-8 h-8 text-orange-500" />
                     <p className="text-xs text-gray-400 font-bold">Generating Report...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        
                        {/* Net Revenue */}
                        <div className="bg-[#1A1A1A] border border-white/5 p-5 rounded-2xl relative overflow-hidden shadow-xl shadow-orange-500/5">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-yellow-500"></div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold mb-3">
                                <TrendingUp size={14} className="text-orange-500" /> Net Sales
                            </div>
                            <p className="text-2xl font-black font-mono">฿{totalSales.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{completedBookings.length} Completed Bills</p>
                        </div>

                        {/* Cash Sales */}
                        <div className="bg-[#1A1A1A] border border-white/5 p-5 rounded-2xl relative overflow-hidden shadow-lg">
                            <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold mb-3">
                                <Banknote size={14} className="text-green-400" /> Cash
                            </div>
                            <p className="text-2xl font-black font-mono text-green-400">฿{cashSales.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Physical Cash Drawer</p>
                        </div>

                        {/* QR Sales */}
                        <div className="bg-[#1A1A1A] border border-white/5 p-5 rounded-2xl relative overflow-hidden shadow-lg">
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold mb-3">
                                <CreditCard size={14} className="text-blue-400" /> QR Transfer
                            </div>
                            <p className="text-2xl font-black font-mono text-blue-400">฿{qrSales.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Bank Account Transfer</p>
                        </div>

                        {/* Discounts */}
                        <div className="bg-[#1A1A1A] border border-white/5 p-5 rounded-2xl relative overflow-hidden shadow-lg">
                            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500"></div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold mb-3">
                                <Percent size={14} className="text-yellow-500" /> Discounts
                            </div>
                            <p className="text-2xl font-black font-mono text-gray-300">฿{totalDiscounts.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Promotion Applied</p>
                        </div>

                        {/* Active Tables value */}
                        <div className="bg-[#1A1A1A] border border-white/5 p-5 rounded-2xl relative overflow-hidden shadow-lg col-span-2 md:col-span-1">
                            <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-bold mb-3">
                                <ShoppingBag size={14} className="text-purple-400" /> Active Tables
                            </div>
                            <p className="text-2xl font-black font-mono text-purple-400">฿{activeUnpaid.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{activeBookings.length} Tables Occupied</p>
                        </div>

                    </div>

                    {/* Bottom Split Layout: Categories & Log */}
                    <div className="grid md:grid-cols-3 gap-6">
                        
                        {/* Categories Sales Card */}
                        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 flex flex-col">
                            <h4 className="font-bold text-sm text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-orange-500" /> Sales By Category
                            </h4>
                            <div className="flex-1 space-y-4">
                                {categoryList.map((c, i) => (
                                    <div key={i} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-xs font-bold">{c.name}</p>
                                            <p className="text-[10px] text-gray-500">{c.quantity} items sold</p>
                                        </div>
                                        <p className="font-mono font-bold text-sm">฿{c.amount.toLocaleString()}</p>
                                    </div>
                                ))}
                                {categoryList.length === 0 && (
                                    <div className="text-center text-xs text-gray-500 py-10 italic">
                                        No sales logged today
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                onClick={handlePrintShiftReport}
                                className="w-full mt-6 bg-white text-black py-3 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <PrinterIcon size={14} /> Print Shift Summary
                            </button>
                        </div>

                        {/* Completed Bills Log */}
                        <div className="md:col-span-2 bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 flex flex-col">
                            <h4 className="font-bold text-sm text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FileText size={16} className="text-orange-500" /> Today's Completed Bills
                            </h4>
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 text-gray-500 uppercase tracking-wider font-bold text-[10px]">
                                            <th className="pb-3 w-16">Bill No</th>
                                            <th className="pb-3 w-20">Time</th>
                                            <th className="pb-3 w-16 text-center">Table</th>
                                            <th className="pb-3 w-32">Guest</th>
                                            <th className="pb-3 w-24">Pay Method</th>
                                            <th className="pb-3 text-right">Amount</th>
                                            <th className="pb-3 text-right w-16">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {completedBookings.map((b) => {
                                            const timeStr = new Date(b.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            const isCash = isCashBooking(b);
                                            const guestName = b.profiles?.display_name || b.pickup_contact_name || 'Walk-in';

                                            return (
                                                <tr key={b.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="py-3 font-mono font-bold text-gray-400">
                                                        #{b.tracking_token ? b.tracking_token.slice(-4).toUpperCase() : b.id.slice(0, 4)}
                                                    </td>
                                                    <td className="py-3 font-medium text-gray-400">{timeStr}</td>
                                                    <td className="py-3 font-bold text-center text-orange-500">
                                                        {b.tables_layout?.table_name || 'PICK'}
                                                    </td>
                                                    <td className="py-3 font-bold truncate max-w-[120px]">{guestName}</td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCash ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                            {isCash ? 'Cash' : 'QR Transfer'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-right font-bold font-mono">
                                                        ฿{b.total_amount?.toLocaleString()}
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        <button 
                                                            onClick={() => setActiveReprintBooking(b)}
                                                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                            title="Reprint Bill / Receipt"
                                                        >
                                                            <PrinterIcon size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {completedBookings.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="py-10 text-center text-xs text-gray-500 italic">
                                                    No completed bills logged for this day
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Reprint Slip Modal integration */}
            {activeReprintBooking && (
                <SlipModal 
                    booking={activeReprintBooking}
                    type="customer"
                    onClose={() => setActiveReprintBooking(null)}
                />
            )}
        </div>
    );
}
