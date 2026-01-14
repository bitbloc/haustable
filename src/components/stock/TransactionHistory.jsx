import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { X, ArrowRight, ArrowLeft, RotateCcw, Clock } from 'lucide-react';
import { formatThaiDateLong, formatThaiTime } from '../../utils/timeUtils';

export default function TransactionHistory({ onClose }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('stock_transactions')
                .select(`
                    *,
                    stock_items (name, unit)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setTransactions(data);
            setLoading(false);
        };
        fetchHistory();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4 sm:p-6">
            <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                             <Clock className="w-4 h-4 text-gray-600" />
                         </div>
                         <h2 className="text-lg font-bold">Transaction History</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-0">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading history...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No transactions found</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                                <tr>
                                    <th className="p-3 pl-4">Time</th>
                                    <th className="p-3">Item</th>
                                    <th className="p-3">Action</th>
                                    <th className="p-3">User</th>
                                    <th className="p-3 text-right pr-4">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transactions.map(tx => {
                                    const isIn = tx.transaction_type === 'in';
                                    const isOut = tx.transaction_type === 'out';
                                    return (
                                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3 pl-4 whitespace-nowrap text-gray-500">
                                                <div className="font-bold text-[#1A1A1A]">
                                                    {formatThaiTime(tx.created_at)}
                                                </div>
                                                <div className="text-xs">
                                                    {new Date(tx.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-[#1A1A1A]">{tx.stock_items?.name || 'Unknown Item'}</div>
                                                {tx.note && <div className="text-xs text-gray-400 whitespace-normal">{tx.note}</div>}
                                            </td>
                                            <td className="p-3">
                                                <span className={`
                                                    inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide
                                                    ${isIn ? 'bg-green-100 text-green-700' : isOut ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}
                                                `}>
                                                    {isIn ? <ArrowLeft className="w-3 h-3 rotate-[-45deg]" /> : <ArrowRight className="w-3 h-3 rotate-[-45deg]" />}
                                                    {tx.transaction_type}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-gray-600">
                                                {tx.performed_by || '-'}
                                            </td>
                                            <td className={`p-3 text-right pr-4 font-bold font-mono ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                                                {isIn ? '+' : ''}{tx.quantity_change}
                                                <span className="text-[10px] text-gray-400 ml-1 font-sans font-normal">{tx.stock_items?.unit}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
