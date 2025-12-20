import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Trash2, Edit2, Search, Tag, Calendar, DollarSign, Percent, Check, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getThaiDate } from '../../utils/timeUtils'

export default function AdminPromotions() {
    const [codes, setCodes] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCode, setEditingCode] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        discount_type: 'percent', // percent | fixed
        discount_value: '',
        min_spend: 0,
        start_date: '',
        end_date: '',
        applicable_to: 'both', // booking | ordering | both
        usage_limit: '',
        is_active: true
    })

    useEffect(() => {
        fetchCodes()
    }, [])

    const fetchCodes = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('promotion_codes')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            setCodes(data || [])
        } catch (error) {
            console.error('Error fetching codes:', error)
            toast.error('Failed to load promotion codes')
        } finally {
            setLoading(false)
        }
    }

    const handleOpenModal = (codeToEdit = null) => {
        if (codeToEdit) {
            setEditingCode(codeToEdit)
            // Convert timestamptz to input datetime-local format (YYYY-MM-DDTHH:mm)
            const fmtDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().slice(0, 16) : ''
            
            setFormData({
                code: codeToEdit.code,
                discount_type: codeToEdit.discount_type,
                discount_value: codeToEdit.discount_value,
                min_spend: codeToEdit.min_spend,
                start_date: fmtDate(codeToEdit.start_date),
                end_date: fmtDate(codeToEdit.end_date),
                applicable_to: codeToEdit.applicable_to,
                usage_limit: codeToEdit.usage_limit || '',
                is_active: codeToEdit.is_active
            })
        } else {
            setEditingCode(null)
            // Default: Start Now, End in 30 days
            const now = new Date()
            const nextMonth = new Date()
            nextMonth.setDate(now.getDate() + 30)
            
            setFormData({
                code: '',
                discount_type: 'percent',
                discount_value: '',
                min_spend: 0,
                start_date: now.toISOString().slice(0, 16),
                end_date: nextMonth.toISOString().slice(0, 16),
                applicable_to: 'both',
                usage_limit: '',
                is_active: true
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            // Validation
            if (!formData.code || !formData.discount_value || !formData.start_date || !formData.end_date) {
                return toast.error('Please fill in all required fields')
            }

            const payload = {
                code: formData.code.toUpperCase(), // FORCE UPPERCASE
                discount_type: formData.discount_type,
                discount_value: parseFloat(formData.discount_value),
                min_spend: parseFloat(formData.min_spend) || 0,
                start_date: new Date(formData.start_date).toISOString(),
                end_date: new Date(formData.end_date).toISOString(),
                applicable_to: formData.applicable_to,
                usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
                is_active: formData.is_active
            }

            if (editingCode) {
                const { error } = await supabase
                    .from('promotion_codes')
                    .update(payload)
                    .eq('id', editingCode.id)
                if (error) throw error
                toast.success('Promotion updated')
            } else {
                const { error } = await supabase
                    .from('promotion_codes')
                    .insert(payload)
                if (error) throw error
                toast.success('Promotion created')
            }

            setIsModalOpen(false)
            fetchCodes()
        } catch (error) {
            console.error('Error saving:', error)
            toast.error(error.message)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this code?')) return
        try {
            const { error } = await supabase.from('promotion_codes').delete().eq('id', id)
            if (error) throw error
            toast.success('Promotion deleted')
            fetchCodes()
        } catch (error) {
            toast.error('Failed to delete')
        }
    }

    const filteredCodes = codes.filter(c => c.code.includes(searchTerm.toUpperCase()))

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Tag className="w-6 h-6" /> Promotions
                    </h1>
                    <p className="text-gray-500 text-sm">Manage discount codes and coupons</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()} 
                    className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors"
                >
                    <Plus size={18} /> New Code
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="Search code..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 pl-10 pr-4 py-2 rounded-lg outline-none focus:border-black transition-colors"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-10 text-gray-400">Loading...</div>
            ) : filteredCodes.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">No promotion codes found.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredCodes.map(code => (
                        <div key={code.id} className={`bg-white rounded-xl shadow-sm border p-4 relative ${!code.is_active ? 'opacity-60 grayscale' : 'border-gray-100'}`}>
                            
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-gray-100 px-3 py-1 rounded text-lg font-mono font-bold tracking-wider">
                                    {code.code}
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full font-bold ${code.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                    {code.is_active ? 'ACTIVE' : 'INACTIVE'}
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-2 text-black font-bold text-lg">
                                    {code.discount_type === 'percent' ? <Percent size={18} /> : <span className="text-xs">฿</span>}
                                    {code.discount_value} {code.discount_type === 'percent' ? '% OFF' : 'BAHT OFF'}
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs">
                                    <Calendar size={14} />
                                    <span>{new Date(code.start_date).toLocaleDateString('en-GB')} - {new Date(code.end_date).toLocaleDateString('en-GB')}</span>
                                </div>

                                <div className="flex items-center gap-2 text-xs">
                                    <DollarSign size={14} />
                                    <span>Min Spend: {code.min_spend > 0 ? `${code.min_spend}.-` : 'None'}</span>
                                </div>

                                <div className="flex items-center gap-2 text-xs">
                                    <Tag size={14} />
                                    <span className="capitalize">For: {code.applicable_to === 'both' ? 'All' : code.applicable_to}</span>
                                </div>

                                {code.usage_limit && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <AlertCircle size={14} />
                                        <span>Used: {code.used_count} / {code.usage_limit}</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 border-t pt-3 mt-auto">
                                <button 
                                    onClick={() => handleOpenModal(code)}
                                    className="flex-1 py-1.5 text-xs font-bold bg-gray-50 hover:bg-gray-100 rounded text-gray-700 flex items-center justify-center gap-1"
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button 
                                    onClick={() => handleDelete(code.id)}
                                    className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 rounded text-red-600"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingCode ? 'Edit Code' : 'Create New Code'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Code (Auto Uppercase)</label>
                                <input 
                                    type="text" 
                                    value={formData.code} 
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    className="w-full text-2xl font-mono font-bold border-b-2 border-gray-200 focus:border-black outline-none py-2 uppercase placeholder:text-gray-300"
                                    placeholder="SUMMER2025"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Discount Type</label>
                                    <select 
                                        value={formData.discount_type}
                                        onChange={e => setFormData({...formData, discount_type: e.target.value})}
                                        className="w-full bg-gray-50 p-2 rounded border outline-none focus:border-black"
                                    >
                                        <option value="percent">Percentage (%)</option>
                                        <option value="fixed">Fixed Amount (฿)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Value</label>
                                    <input 
                                        type="number"
                                        value={formData.discount_value}
                                        onChange={e => setFormData({...formData, discount_value: e.target.value})}
                                        className="w-full bg-gray-50 p-2 rounded border outline-none focus:border-black"
                                        placeholder={formData.discount_type === 'percent' ? '10' : '100'}
                                        required
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
                                    <input 
                                        type="datetime-local"
                                        value={formData.start_date}
                                        onChange={e => setFormData({...formData, start_date: e.target.value})}
                                        className="w-full bg-gray-50 p-2 rounded border outline-none focus:border-black"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date</label>
                                    <input 
                                        type="datetime-local"
                                        value={formData.end_date}
                                        onChange={e => setFormData({...formData, end_date: e.target.value})}
                                        className="w-full bg-gray-50 p-2 rounded border outline-none focus:border-black"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Min Spend (฿)</label>
                                    <input 
                                        type="number"
                                        value={formData.min_spend}
                                        onChange={e => setFormData({...formData, min_spend: e.target.value})}
                                        className="w-full bg-gray-50 p-2 rounded border outline-none focus:border-black"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usage Limit (Optional)</label>
                                    <input 
                                        type="number"
                                        value={formData.usage_limit}
                                        onChange={e => setFormData({...formData, usage_limit: e.target.value})}
                                        className="w-full bg-gray-50 p-2 rounded border outline-none focus:border-black"
                                        placeholder="Unlimited"
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Applicable To</label>
                                <div className="flex gap-2">
                                    {['both', 'booking', 'ordering'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({...formData, applicable_to: type})}
                                            className={`flex-1 py-2 text-sm font-bold rounded capitalize border ${formData.applicable_to === type ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <span className="text-sm font-bold">Status:</span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.is_active} 
                                        onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                        className="w-5 h-5 accent-black" 
                                    />
                                    <span className="text-sm text-gray-600">{formData.is_active ? 'Active' : 'Inactive'}</span>
                                </label>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full bg-black text-[#DFFF00] py-4 rounded-xl font-bold text-lg mt-4 hover:bg-gray-900 transition-colors"
                            >
                                {editingCode ? 'Update Code' : 'Create Code'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
