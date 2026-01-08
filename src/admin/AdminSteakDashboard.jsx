import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Package, ChefHat, Calendar, AlertTriangle, Edit2, X, Save } from 'lucide-react'

// Modal Component for Editing Steak
const EditSteakModal = ({ isOpen, onClose, steak, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '', // This covers 'Details' and potentially 'Quantity' (e.g. 200g)
        image_url: ''
    })

    useEffect(() => {
        if (steak) {
            setFormData({
                name: steak.name || '',
                price: steak.price || '',
                description: steak.description || '',
                image_url: steak.image_url || ''
            })
        }
    }, [steak])

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave({ ...steak, ...formData })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h2 className="font-bold text-lg">Edit Steak Details</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Name</label>
                        <input 
                            type="text" 
                            className="w-full bg-black border border-white/20 rounded-lg p-3 outline-none focus:border-[#DFFF00]"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Price (THB)</label>
                        <input 
                            type="number" 
                            className="w-full bg-black border border-white/20 rounded-lg p-3 outline-none focus:border-[#DFFF00]"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Description / Details / Weight</label>
                        <textarea 
                            className="w-full bg-black border border-white/20 rounded-lg p-3 outline-none focus:border-[#DFFF00] h-24 resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder="e.g. 300g, Intense marbling..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Image URL (Optional)</label>
                        <input 
                            type="text" 
                            className="w-full bg-black border border-white/20 rounded-lg p-3 outline-none focus:border-[#DFFF00]"
                            value={formData.image_url}
                            onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                            placeholder="https://..."
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                         <button type="button" onClick={onClose} className="flex-1 bg-white/5 py-3 rounded-xl font-bold hover:bg-white/10 transition-colors">Cancel</button>
                         <button type="submit" className="flex-1 bg-[#DFFF00] text-black py-3 rounded-xl font-bold hover:bg-[#cce600] transition-colors flex items-center justify-center gap-2">
                            <Save size={18} /> Save Changes
                         </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default function AdminSteakDashboard() {
    const [steaks, setSteaks] = useState([])
    const [prepList, setPrepList] = useState([])
    const [activeTab, setActiveTab] = useState('stock') 
    const [loading, setLoading] = useState(true)
    
    // Edit Modal State
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)

    const fetchSteaks = async () => {
        const { data } = await supabase.from('menu_items')
            .select('*')
            .eq('category', 'Steak Pre-order')
            .order('name')
        setSteaks(data || [])
    }

    const fetchPrepList = async () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dateStr = tomorrow.toISOString().split('T')[0]
        const start = `${dateStr}T00:00:00+07:00`
        const end = `${dateStr}T23:59:59+07:00`

        const { data: bookings } = await supabase
            .from('bookings')
            .select('*, order_items(*, menu_items(*))')
            .gte('booking_time', start)
            .lte('booking_time', end)
            .neq('status', 'cancelled')
        
        const list = (bookings || []).filter(b => 
            b.order_items.some(oi => oi.menu_items?.category === 'Steak Pre-order')
        ).map(b => ({
            ...b,
            steak_items: b.order_items.filter(oi => oi.menu_items?.category === 'Steak Pre-order')
        }))

        setPrepList(list)
    }

    useEffect(() => {
        Promise.all([fetchSteaks(), fetchPrepList()]).then(() => setLoading(false))
    }, [])

    const toggleStock = async (id, currentStatus) => {
        const { error } = await supabase.from('menu_items')
            .update({ is_sold_out: !currentStatus })
            .eq('id', id)
        
        if (!error) {
            setSteaks(prev => prev.map(s => s.id === id ? { ...s, is_sold_out: !currentStatus } : s))
        }
    }

    const openEdit = (item) => {
        setEditingItem(item)
        setIsEditOpen(true)
    }

    const handleSaveEdit = async (updatedItem) => {
        const { error } = await supabase.from('menu_items')
            .update({
                name: updatedItem.name,
                price: parseFloat(updatedItem.price),
                description: updatedItem.description,
                image_url: updatedItem.image_url
            })
            .eq('id', updatedItem.id)

        if (!error) {
            setSteaks(prev => prev.map(s => s.id === updatedItem.id ? updatedItem : s))
            setIsEditOpen(false)
            setEditingItem(null)
        } else {
            alert('Error updating item: ' + error.message)
        }
    }

    return (
        <div className="min-h-screen bg-black pb-20 text-white font-sans">
             <header className="bg-[#111] border-b border-white/10 sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="text-gray-400 hover:text-white transition-colors">← Dashboard</Link>
                    <h1 className="text-xl font-bold">Steak Manager</h1>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6">
                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <button 
                        onClick={() => setActiveTab('stock')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'stock' ? 'bg-[#DFFF00] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
                    >
                        <Package size={20} /> Stock Management
                    </button>
                     <button 
                        onClick={() => setActiveTab('prep')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'prep' ? 'bg-[#DFFF00] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
                    >
                        <ChefHat size={20} /> Prep List (Tomorrow)
                    </button>
                </div>

                {loading ? <div className="text-gray-500">Loading...</div> : (
                    <>
                        {activeTab === 'stock' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {steaks.map(steak => (
                                    <div key={steak.id} className={`bg-[#1a1a1a] rounded-xl p-4 border transition-all relative group ${steak.is_sold_out ? 'border-red-900 opacity-60' : 'border-white/10'}`}>
                                        
                                        {/* Edit Button (Visible on Hover/Always on Mobile) */}
                                        <button 
                                            onClick={() => openEdit(steak)}
                                            className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-[#DFFF00] hover:text-black rounded-full transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 z-10"
                                            title="Edit Details"
                                        >
                                            <Edit2 size={14} />
                                        </button>

                                        <div className="flex justify-between items-start mb-4 pr-8">
                                            <h3 className="font-bold text-lg leading-tight">{steak.name}</h3>
                                        </div>
                                        
                                        {/* Optional Image Preview */}
                                        {steak.image_url && (
                                            <div className="h-32 w-full bg-gray-900 rounded-lg mb-4 overflow-hidden">
                                                <img src={steak.image_url} alt={steak.name} className="w-full h-full object-cover opacity-80" />
                                            </div>
                                        )}

                                        <p className="text-xs text-gray-500 mb-4 line-clamp-2">{steak.description}</p>

                                        <div className="flex items-center justify-between mt-auto">
                                            <span className="font-mono text-gray-400">฿{steak.price.toLocaleString()}</span>
                                            <button 
                                                onClick={() => toggleStock(steak.id, steak.is_sold_out)}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold ${steak.is_sold_out ? 'bg-red-500 text-white' : 'bg-green-900 text-green-100 hover:bg-green-800'}`}
                                            >
                                                {steak.is_sold_out ? 'SOLD OUT' : 'Available'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {steaks.length === 0 && <div className="text-gray-500">No steak items found.</div>}
                            </div>
                        )}

                        {activeTab === 'prep' && (
                            <div className="space-y-4">
                                <h2 className="text-gray-400 text-sm uppercase font-bold mb-4 flex items-center gap-2">
                                    <Calendar size={16} /> Pre-orders for Tomorrow
                                </h2>
                                {prepList.length === 0 ? (
                                    <div className="p-8 bg-[#1a1a1a] rounded-xl text-center text-gray-500">No Pre-orders for tomorrow.</div>
                                ) : (
                                    prepList.map(booking => (
                                        <div key={booking.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
                                            <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-4">
                                                <div>
                                                    <div className="font-bold text-lg text-[#DFFF00]">{booking.pickup_contact_name}</div>
                                                    <div className="text-sm text-gray-400">{booking.booking_time ? new Date(booking.booking_time).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : '-'} • {booking.pax} Pax</div>
                                                </div>
                                                <div className="px-3 py-1 bg-white/10 rounded text-xs">
                                                    Zone: {booking.table_id ? 'Table Allocated' : 'Unknown'}
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                {booking.steak_items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded-lg">
                                                        <div className="flex items-center gap-3">
                                                            <div className="font-bold text-white bg-white/10 w-8 h-8 flex items-center justify-center rounded-lg">{item.quantity}</div>
                                                            <div>
                                                                <div className="font-bold">{item.menu_items?.name}</div>
                                                                <div className="text-xs text-gray-400">
                                                                    Doneness: <span className="text-[#DFFF00] uppercase font-bold">{item.selected_options?.Doneness || 'Standard'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {booking.customer_note && (
                                                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-lg text-yellow-200 text-sm whitespace-pre-wrap">
                                                    <AlertTriangle size={14} className="inline mr-2" />
                                                    {booking.customer_note}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal Portal */}
            <EditSteakModal 
                isOpen={isEditOpen} 
                onClose={() => setIsEditOpen(false)} 
                steak={editingItem}
                onSave={handleSaveEdit}
            />
        </div>
    )
}
