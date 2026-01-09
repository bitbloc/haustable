import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { X, PieChart, TrendingDown } from 'lucide-react';

export default function StockUsageReport({ onClose }) {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(7); // 7 days, 30 days

    useEffect(() => {
        const fetchUsage = async () => {
            setLoading(true);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - period);

            // Fetch OUT transactions
            const { data, error } = await supabase
                .from('stock_transactions')
                .select(`
                    quantity_change,
                    stock_items (name, unit)
                `)
                .eq('transaction_type', 'out')
                .gte('created_at', startDate.toISOString());

            if (data) {
                // Aggregate
                const usageMap = {};
                data.forEach(tx => {
                    const name = tx.stock_items?.name;
                    const unit = tx.stock_items?.unit;
                    if (!name) return;
                    
                    if (!usageMap[name]) {
                        usageMap[name] = { name, unit, total: 0, count: 0 };
                    }
                    usageMap[name].total += Math.abs(tx.quantity_change);
                    usageMap[name].count += 1;
                });
                
                // Sort by total usage descending
                const sorted = Object.values(usageMap).sort((a, b) => b.total - a.total);
                setStats(sorted);
            }
            setLoading(false);
        };
        fetchUsage();
    }, [period]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4 sm:p-6">
            <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                             <PieChart className="w-4 h-4 text-blue-600" />
                         </div>
                         <h2 className="text-lg font-bold">Usage Report (Top Consumers)</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 flex gap-2 border-b border-gray-50">
                     {[7, 30].map(d => (
                         <button
                            key={d}
                            onClick={() => setPeriod(d)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${period === d ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                         >
                             Last {d} Days
                         </button>
                     ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-0">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Calculating usage...</div>
                    ) : stats.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No usage data found for this period</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                                <tr>
                                    <th className="p-3 pl-4">Item</th>
                                    <th className="p-3 text-right">Transactions</th>
                                    <th className="p-3 text-right pr-4">Total Used</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stats.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3 pl-4 font-bold text-[#1A1A1A] flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-400 text-[10px] flex items-center justify-center font-mono">
                                                {idx + 1}
                                            </span>
                                            {item.name}
                                        </td>
                                        <td className="p-3 text-right text-gray-500">
                                            {item.count} times
                                        </td>
                                        <td className="p-3 text-right pr-4">
                                            <div className="font-bold text-red-600 flex items-center justify-end gap-1">
                                                <TrendingDown className="w-3 h-3" />
                                                {item.total.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-gray-400">{item.unit}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
