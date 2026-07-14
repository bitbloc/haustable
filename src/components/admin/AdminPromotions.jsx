import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Plus, Trash2, Edit2, Search, Tag, Calendar, DollarSign, Percent, Check, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getThaiDate } from '../../utils/timeUtils'

export default function AdminPromotions({ defaultTab = 'promo' }) {
    const [activeTab, setActiveTab] = useState(defaultTab) // 'promo' | 'rewards'

    useEffect(() => {
        setActiveTab(defaultTab)
    }, [defaultTab])
    const [codes, setCodes] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCode, setEditingCode] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Rewards States
    const [rewards, setRewards] = useState([])
    const [rewardsLoading, setRewardsLoading] = useState(false)
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false)
    const [editingReward, setEditingReward] = useState(null)
    const [rewardFormData, setRewardFormData] = useState({
        title: '',
        description: '',
        xhaus_cost: '',
        claim_code: '',
        usage_limit: '',
        is_active: true
    })

    const fetchRewards = async () => {
        try {
            setRewardsLoading(true)
            const { data, error } = await supabase
                .from('xhaus_rewards')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setRewards(data || [])
        } catch (err) {
            console.error('Error fetching rewards:', err)
            toast.error('Failed to load rewards')
        } finally {
            setRewardsLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'rewards') {
            fetchRewards()
        }
    }, [activeTab])

    const handleOpenRewardModal = (reward = null) => {
        if (reward) {
            setEditingReward(reward)
            setRewardFormData({
                title: reward.title,
                description: reward.description || '',
                xhaus_cost: reward.xhaus_cost,
                claim_code: reward.claim_code,
                usage_limit: reward.usage_limit || '',
                is_active: reward.is_active
            })
        } else {
            setEditingReward(null)
            setRewardFormData({
                title: '',
                description: '',
                xhaus_cost: '',
                claim_code: '',
                usage_limit: '',
                is_active: true
            })
        }
        setIsRewardModalOpen(true)
    }

    const handleRewardSubmit = async (e) => {
        e.preventDefault()
        try {
            if (!rewardFormData.title || !rewardFormData.xhaus_cost || !rewardFormData.claim_code) {
                return toast.error('Please fill in all required fields')
            }

            const payload = {
                title: rewardFormData.title,
                description: rewardFormData.description,
                xhaus_cost: parseFloat(rewardFormData.xhaus_cost),
                claim_code: rewardFormData.claim_code.toUpperCase().trim(),
                usage_limit: rewardFormData.usage_limit ? parseInt(rewardFormData.usage_limit) : null,
                is_active: rewardFormData.is_active
            }

            if (editingReward) {
                const { error } = await supabase
                    .from('xhaus_rewards')
                    .update(payload)
                    .eq('id', editingReward.id)
                if (error) throw error
                toast.success('Reward updated')
            } else {
                const { error } = await supabase
                    .from('xhaus_rewards')
                    .insert(payload)
                if (error) throw error
                toast.success('Reward created')
            }

            setIsRewardModalOpen(false)
            fetchRewards()
        } catch (err) {
            console.error('Error saving reward:', err)
            toast.error(err.message)
        }
    }

    const handleRewardDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this reward item?')) return
        try {
            const { error } = await supabase.from('xhaus_rewards').delete().eq('id', id)
            if (error) throw error
            toast.success('Reward deleted')
            fetchRewards()
        } catch (err) {
            console.error('Error deleting reward:', err)
            toast.error(err.message || 'Failed to delete reward')
        }
    }

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
            console.error('Error deleting promotion:', error)
            // Error code 23503 is foreign key violation in PostgreSQL
            if (error?.code === '23503') {
                const deactivate = confirm(
                    'This promotion code cannot be deleted because it is already used in existing bookings.\n\nWould you like to deactivate (disable) it instead?'
                )
                if (deactivate) {
                    try {
                        const { error: updateError } = await supabase
                            .from('promotion_codes')
                            .update({ is_active: false })
                            .eq('id', id)
                        if (updateError) throw updateError
                        toast.success('Promotion deactivated')
                        fetchCodes()
                    } catch (err) {
                        console.error('Error deactivating:', err)
                        toast.error('Failed to deactivate promotion')
                    }
                }
            } else {
                toast.error(error?.message || 'Failed to delete')
            }
        }
    }

    const filteredCodes = codes.filter(c => c.code.includes(searchTerm.toUpperCase()))
    const filteredRewards = rewards.filter(r => r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.claim_code.toUpperCase().includes(searchTerm.toUpperCase()))

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Tag className="w-6 h-6" /> {activeTab === 'promo' ? 'Promotions' : 'xhaus Rewards'}
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {activeTab === 'promo' ? 'Manage discount codes and coupons' : 'Manage rewards redeemable with xhaus coins'}
                    </p>
                </div>
                {activeTab === 'promo' ? (
                    <button 
                        onClick={() => handleOpenModal()} 
                        className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                        <Plus size={18} /> New Code
                    </button>
                ) : (
                    <button 
                        onClick={() => handleOpenRewardModal()} 
                        className="bg-black text-[#DFFF00] px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                        <Plus size={18} /> New Reward
                    </button>
                )}
            </div>

            {/* Tabs Header */}
            <div className="flex gap-6 border-b mb-6 text-sm font-bold">
                <button
                    onClick={() => {
                        setActiveTab('promo')
                        setSearchTerm('')
                    }}
                    className={`pb-3 px-1 border-b-2 transition-all cursor-pointer ${
                        activeTab === 'promo' 
                            ? 'border-black text-black' 
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    🎟️ โค้ดส่วนลดโปรโมชัน (Promotions)
                </button>
                <button
                    onClick={() => {
                        setActiveTab('rewards')
                        setSearchTerm('')
                    }}
                    className={`pb-3 px-1 border-b-2 transition-all cursor-pointer ${
                        activeTab === 'rewards' 
                            ? 'border-black text-black' 
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    🎁 ของรางวัลสะสมแต้ม (xhaus Rewards)
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder={activeTab === 'promo' ? "Search code..." : "Search rewards by title or code..."} 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 pl-10 pr-4 py-2 rounded-lg outline-none focus:border-black transition-colors"
                />
            </div>

            {/* Promotions Tab Render */}
            {activeTab === 'promo' && (
                <>
                    {loading ? (
                        <div className="text-center py-10 text-gray-400 animate-pulse">Loading...</div>
                    ) : filteredCodes.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No promotion codes found.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredCodes.map(code => (
                                <div key={code.id} className={`bg-white rounded-xl shadow-sm border p-4 flex flex-col justify-between relative ${!code.is_active ? 'opacity-60 grayscale' : 'border-gray-100'}`}>
                                    <div>
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
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 border-t pt-3 mt-4">
                                        <button 
                                            onClick={() => handleOpenModal(code)}
                                            className="flex-1 py-1.5 text-xs font-bold bg-gray-50 hover:bg-gray-100 rounded text-gray-700 flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(code.id)}
                                            className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-150 rounded text-red-600 cursor-pointer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* xhaus Rewards Tab Render */}
            {activeTab === 'rewards' && (
                <>
                    {rewardsLoading ? (
                        <div className="text-center py-10 text-gray-400 animate-pulse">Loading...</div>
                    ) : filteredRewards.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No reward items found.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredRewards.map(reward => (
                                <div key={reward.id} className={`bg-white rounded-xl shadow-sm border p-4 flex flex-col justify-between relative ${!reward.is_active ? 'opacity-60 grayscale' : 'border-gray-100'}`}>
                                    <div>
                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded text-xs font-mono font-bold tracking-wider">
                                                {reward.claim_code}
                                            </div>
                                            <div className={`text-xs px-2 py-1 rounded-full font-bold ${reward.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                                {reward.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                                            <h4 className="font-bold text-black text-base">{reward.title}</h4>
                                            
                                            {reward.description && (
                                                <p className="text-xs text-gray-500 line-clamp-2">{reward.description}</p>
                                            )}

                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded-lg w-max mt-2">
                                                    <span>🪙</span> Cost: {parseFloat(reward.xhaus_cost).toFixed(0)} xhaus
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-blue-750 font-bold bg-blue-50/70 border border-blue-100 px-2 py-1 rounded-lg w-max mt-2">
                                                    <AlertCircle size={12} className="text-blue-500" />
                                                    <span>
                                                        แลกแล้ว: {reward.used_count || 0} / {reward.usage_limit ? `${reward.usage_limit} ใบ` : 'ไม่จำกัด'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 border-t pt-3 mt-4">
                                        <button 
                                            onClick={() => handleOpenRewardModal(reward)}
                                            className="flex-1 py-1.5 text-xs font-bold bg-gray-50 hover:bg-gray-100 rounded text-gray-700 flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button 
                                            onClick={() => handleRewardDelete(reward.id)}
                                            className="px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-150 rounded text-red-600 cursor-pointer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Code Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900">
                        <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingCode ? 'Edit Code' : 'Create New Code'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full cursor-pointer"><X size={20} /></button>
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
                                className="w-full bg-black text-[#DFFF00] py-4 rounded-xl font-bold text-lg mt-4 hover:bg-gray-900 transition-colors cursor-pointer"
                            >
                                {editingCode ? 'Update Code' : 'Create Code'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Reward Modal */}
            {isRewardModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900">
                        <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{editingReward ? 'Edit Reward' : 'Create New Reward'}</h2>
                            <button onClick={() => setIsRewardModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full cursor-pointer"><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleRewardSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reward Title (ชื่อของรางวัล)</label>
                                <input 
                                    type="text" 
                                    value={rewardFormData.title} 
                                    onChange={e => setRewardFormData({...rewardFormData, title: e.target.value})}
                                    className="w-full text-lg font-bold border-b border-gray-200 focus:border-black outline-none py-1.5 placeholder:text-gray-300"
                                    placeholder="เช่น ของที่ระลึก: แก้วเซรามิค In The Haus"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description (รายละเอียด)</label>
                                <textarea 
                                    value={rewardFormData.description} 
                                    onChange={e => setRewardFormData({...rewardFormData, description: e.target.value})}
                                    className="w-full bg-gray-50 p-2.5 rounded-lg border border-gray-200 outline-none focus:border-black text-sm h-20 resize-none"
                                    placeholder="คำอธิบายของรางวัลและวิธีรับ"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Coins Cost (แต้มสะสม)</label>
                                    <input 
                                        type="number"
                                        value={rewardFormData.xhaus_cost}
                                        onChange={e => setRewardFormData({...rewardFormData, xhaus_cost: e.target.value})}
                                        className="w-full bg-gray-50 p-2.5 rounded border outline-none focus:border-black"
                                        placeholder="50"
                                        required
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Redemption Code</label>
                                    <input 
                                        type="text"
                                        value={rewardFormData.claim_code}
                                        onChange={e => setRewardFormData({...rewardFormData, claim_code: e.target.value.toUpperCase()})}
                                        className="w-full bg-gray-50 p-2.5 rounded border outline-none focus:border-black font-mono font-bold uppercase"
                                        placeholder="IHGLASS50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usage Limit (จำกัดสิทธิ์)</label>
                                    <input 
                                        type="number"
                                        value={rewardFormData.usage_limit}
                                        onChange={e => setRewardFormData({...rewardFormData, usage_limit: e.target.value})}
                                        className="w-full bg-gray-50 p-2.5 rounded border outline-none focus:border-black"
                                        placeholder="ไม่จำกัด"
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <span className="text-sm font-bold">Status:</span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={rewardFormData.is_active} 
                                        onChange={e => setRewardFormData({...rewardFormData, is_active: e.target.checked})}
                                        className="w-5 h-5 accent-black" 
                                    />
                                    <span className="text-sm text-gray-600">{rewardFormData.is_active ? 'Active' : 'Inactive'}</span>
                                </label>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full bg-black text-[#DFFF00] py-4 rounded-xl font-bold text-lg mt-4 hover:bg-gray-900 transition-colors cursor-pointer"
                            >
                                {editingReward ? 'Update Reward' : 'Create Reward'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
