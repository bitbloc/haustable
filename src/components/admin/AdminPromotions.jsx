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
    const [menuItems, setMenuItems] = useState([])
    const [rewardsLoading, setRewardsLoading] = useState(false)
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false)
    const [editingReward, setEditingReward] = useState(null)
    const [rewardFormData, setRewardFormData] = useState({
        title: '',
        description: '',
        xhaus_cost: '',
        claim_code: '',
        usage_limit: '',
        is_active: true,
        linked_menu_item_id: ''
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
            
            // Also fetch menu items for the dropdown
            const { data: menuData, error: menuErr } = await supabase
                .from('menu_items')
                .select('id, name')
                .eq('is_available', true)
                .order('name')
            if (!menuErr && menuData) {
                setMenuItems(menuData)
            }
        } catch (err) {
            console.error('Error fetching rewards:', err)
            toast.error('Failed to load rewards')
        } finally {
            setRewardsLoading(false)
        }
    }

    // Drink Stamp States
    const [categoriesList, setCategoriesList] = useState([])
    const [allItemsList, setAllItemsList] = useState([])
    const [initialCategoriesList, setInitialCategoriesList] = useState([])
    const [initialAllItemsList, setInitialAllItemsList] = useState([])
    const [stampsLoading, setStampsLoading] = useState(false)
    const [hasUnsavedStampChanges, setHasUnsavedStampChanges] = useState(false)
    const [isSavingStamps, setIsSavingStamps] = useState(false)

    const fetchStampSettings = async () => {
        setStampsLoading(true)
        try {
            const [catRes, itemRes] = await Promise.all([
                supabase.from('menu_categories').select('*').order('display_order'),
                supabase.from('menu_items').select('*, menu_categories(name)').order('name')
            ])
            if (catRes.data) {
                setCategoriesList(catRes.data)
                setInitialCategoriesList(JSON.parse(JSON.stringify(catRes.data)))
            }
            if (itemRes.data) {
                setAllItemsList(itemRes.data)
                setInitialAllItemsList(JSON.parse(JSON.stringify(itemRes.data)))
            }
            setHasUnsavedStampChanges(false)
        } catch (err) {
            console.error('Error fetching stamp settings:', err)
        } finally {
            setStampsLoading(false)
        }
    }

    const toggleCategoryEligibility = (category) => {
        const newStatus = !category.is_drink_stamp_eligible
        setCategoriesList(prev => prev.map(c => c.id === category.id ? { ...c, is_drink_stamp_eligible: newStatus } : c))
        setAllItemsList(prev => prev.map(i => i.category_id === category.id ? { ...i, is_drink_stamp_eligible: newStatus } : i))
        setHasUnsavedStampChanges(true)
    }

    const toggleItemEligibility = (item) => {
        const newStatus = !item.is_drink_stamp_eligible
        setAllItemsList(prev => prev.map(i => i.id === item.id ? { ...i, is_drink_stamp_eligible: newStatus } : i))
        setHasUnsavedStampChanges(true)
    }

    const handleSaveStampSettings = async () => {
        if (!hasUnsavedStampChanges) return;
        setIsSavingStamps(true);
        try {
            const changedCats = categoriesList.filter((c) => c.is_drink_stamp_eligible !== initialCategoriesList.find(ic => ic.id === c.id)?.is_drink_stamp_eligible);
            const changedItems = allItemsList.filter((c) => c.is_drink_stamp_eligible !== initialAllItemsList.find(ic => ic.id === c.id)?.is_drink_stamp_eligible);

            for (const cat of changedCats) {
                await supabase.from('menu_categories').update({ is_drink_stamp_eligible: cat.is_drink_stamp_eligible }).eq('id', cat.id);
            }
            for (const item of changedItems) {
                await supabase.from('menu_items').update({ is_drink_stamp_eligible: item.is_drink_stamp_eligible }).eq('id', item.id);
            }
            
            setInitialCategoriesList(JSON.parse(JSON.stringify(categoriesList)));
            setInitialAllItemsList(JSON.parse(JSON.stringify(allItemsList)));
            toast.success('บันทึกการตั้งค่า 10 แถม 1 เรียบร้อยแล้ว (Saved Successfully)');
            setHasUnsavedStampChanges(false);
        } catch (err) {
            console.error('Failed to save stamp settings:', err);
            toast.error('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่');
            fetchStampSettings();
        } finally {
            setIsSavingStamps(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'rewards') {
            fetchRewards()
        } else if (activeTab === 'stamps') {
            fetchStampSettings()
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
                is_active: reward.is_active,
                linked_menu_item_id: reward.linked_menu_item_id || ''
            })
        } else {
            setEditingReward(null)
            setRewardFormData({
                title: '',
                description: '',
                xhaus_cost: '',
                claim_code: '',
                usage_limit: '',
                is_active: true,
                linked_menu_item_id: ''
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
                is_active: rewardFormData.is_active,
                linked_menu_item_id: rewardFormData.linked_menu_item_id ? parseInt(rewardFormData.linked_menu_item_id) : null
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
    const filteredStampItems = allItemsList.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.menu_categories?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Tag className="w-6 h-6" /> {activeTab === 'promo' ? 'Promotions' : activeTab === 'rewards' ? 'xhaus Rewards' : 'Drink Stamps (10 FREE 1)'}
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {activeTab === 'promo' ? 'Manage discount codes and coupons' : activeTab === 'rewards' ? 'Manage rewards redeemable with xhaus coins' : 'ตั้งค่าหมวดหมู่และเครื่องดื่มสำหรับสะสมแต้ม 10 แก้ว ฟรี 1 แก้ว'}
                    </p>
                </div>
                {activeTab === 'promo' ? (
                    <button 
                        onClick={() => handleOpenModal()} 
                        className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                        <Plus size={18} /> New Code
                    </button>
                ) : activeTab === 'rewards' ? (
                    <button 
                        onClick={() => handleOpenRewardModal()} 
                        className="bg-black text-[#DFFF00] px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                        <Plus size={18} /> New Reward
                    </button>
                ) : (
                    <div className="px-3.5 py-2 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-xs">
                        <span className="px-1.5 py-0.5 bg-[#1A1A1A] text-white rounded text-[10px]">10+1</span>
                        <span>Drink Stamp Punchcard</span>
                    </div>
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
                            ? 'border-black text-black font-bold' 
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    [PROMOTIONS] โค้ดส่วนลด
                </button>
                <button
                    onClick={() => {
                        setActiveTab('rewards')
                        setSearchTerm('')
                    }}
                    className={`pb-3 px-1 border-b-2 transition-all cursor-pointer ${
                        activeTab === 'rewards' 
                            ? 'border-black text-black font-bold' 
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    [REWARDS] ของรางวัลสะสมแต้ม
                </button>
                <button
                    onClick={() => {
                        setActiveTab('stamps')
                        setSearchTerm('')
                    }}
                    className={`pb-3 px-1 border-b-2 transition-all cursor-pointer ${
                        activeTab === 'stamps' 
                            ? 'border-black text-black font-bold' 
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    [10 FREE 1] เครื่องดื่ม 10 แถม 1
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder={activeTab === 'promo' ? "Search code..." : activeTab === 'rewards' ? "Search rewards by title or code..." : "Search menu item or category..."} 
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

            {/* Drink Stamps (10 FREE 1) Tab Render */}
            {activeTab === 'stamps' && (
                <div className="space-y-6">
                    {/* Info Card */}
                    <div className="bg-[#FFFDF5] border border-amber-300/80 rounded-xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 bg-[#1A1A1A] text-amber-400 font-mono text-sm font-bold rounded-lg border border-amber-500/20 shrink-0">
                                10+1
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-950 text-base">ระบบสะสมแก้ว 10 แถม 1 (Drink Stamp Punchcard)</h3>
                                <p className="text-xs text-amber-900/80 mt-0.5 font-medium">
                                    เปิด/ปิดสิทธิ์สำหรับหมวดหมู่หรือเมนูเครื่องดื่มที่เข้าร่วมรายการสะสมแต้ม เมื่อลูกค้าสั่งซื้อครบ 10 แก้ว จะได้รับสิทธิ์แลกเครื่องดื่มฟรี 1 แก้ว
                                </p>
                            </div>
                        </div>
                    </div>

                    {stampsLoading ? (
                        <div className="text-center py-10 text-gray-400 font-mono text-xs uppercase animate-pulse">กำลังโหลดข้อมูลตั้งค่าสะสมแต้ม...</div>
                    ) : (
                        <>
                            {/* Save Actions Bar */}
                            <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                                hasUnsavedStampChanges 
                                    ? 'bg-amber-50 border-amber-300 shadow-sm' 
                                    : 'bg-gray-50 border-gray-200'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {hasUnsavedStampChanges ? (
                                        <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                            <AlertCircle size={18} />
                                            <span>มีข้อมูลตั้งค่าที่ยังไม่ได้บันทึก (Unsaved Changes)</span>
                                        </div>
                                    ) : (
                                        <div className="text-gray-500 text-sm font-medium">
                                            <span>ตั้งค่าทั้งหมดเป็นปัจจุบันแล้ว</span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleSaveStampSettings}
                                    disabled={!hasUnsavedStampChanges || isSavingStamps}
                                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                                        hasUnsavedStampChanges 
                                            ? 'bg-black hover:bg-gray-800 text-white shadow-md cursor-pointer active:scale-95' 
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    {isSavingStamps ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-b-white"></div>
                                    ) : (
                                        <Tag size={16} />
                                    )}
                                    {isSavingStamps ? 'SAVING...' : 'SAVE CHANGES'}
                                </button>
                            </div>

                            {/* Category Master Toggles */}
                            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1 flex items-center gap-2 font-mono">
                                    📁 เปิด/ปิดสิทธิ์ระดับหมวดหมู่ (Category Master Toggles)
                                </h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    คลิกปุ่มเพื่อเปิดหรือปิดสิทธิ์ 10 แถม 1 สำหรับทุกเมนูในหมวดหมู่นั้นๆ
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {categoriesList.map(cat => {
                                        const isCatEligible = cat.is_drink_stamp_eligible;
                                        const itemCount = allItemsList.filter(i => i.category_id === cat.id).length;
                                        const eligibleItemCount = allItemsList.filter(i => i.category_id === cat.id && i.is_drink_stamp_eligible).length;

                                        return (
                                            <div 
                                                key={cat.id} 
                                                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                                    isCatEligible 
                                                        ? 'bg-amber-50/60 border-amber-300/80 text-amber-950' 
                                                        : 'bg-gray-50 border-gray-200 text-gray-600'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm truncate">{cat.name}</p>
                                                    <p className="text-[11px] font-mono text-gray-500 mt-0.5">
                                                        {eligibleItemCount} / {itemCount} เมนูร่วมรายการ
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => toggleCategoryEligibility(cat)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                                                        isCatEligible 
                                                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs' 
                                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                                    }`}
                                                >
                                                    {isCatEligible ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Individual Item Toggles */}
                            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1 flex items-center gap-2 font-mono">
                                            ☕ สิทธิ์รายเมนู (Individual Item Eligibility)
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            คลิกเปิด/ปิดสิทธิ์รายเมนูได้ตามต้องการ
                                        </p>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500">
                                        พบ {filteredStampItems.length} รายการ
                                    </span>
                                </div>

                                {filteredStampItems.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-xs font-mono text-gray-400">
                                        ไม่พบรายการเมนูที่ตรงกับคำค้นหา
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {filteredStampItems.map(item => {
                                            const isEligible = item.is_drink_stamp_eligible;
                                            return (
                                                <div 
                                                    key={item.id} 
                                                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                                        isEligible 
                                                            ? 'bg-white border-amber-300 shadow-xs' 
                                                            : 'bg-gray-50/70 border-gray-200 opacity-75'
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 truncate max-w-[120px]">
                                                                {item.menu_categories?.name || 'Category'}
                                                            </span>
                                                            {isEligible && (
                                                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                                                    10+1
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="font-bold text-sm text-gray-900 truncate">{item.name}</p>
                                                        <p className="text-xs font-mono text-gray-500 mt-0.5">฿{parseFloat(item.price || 0).toLocaleString()}</p>
                                                    </div>

                                                    <button
                                                        onClick={() => toggleItemEligibility(item)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all shrink-0 cursor-pointer ${
                                                            isEligible 
                                                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs' 
                                                                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                                                        }`}
                                                    >
                                                        {isEligible ? 'ON' : 'OFF'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
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

                            <div className="pt-2">
                                <label className="block text-sm font-bold mb-1">Linked Menu Item (Auto-Inject on Redeem)</label>
                                <select
                                    value={rewardFormData.linked_menu_item_id}
                                    onChange={e => setRewardFormData({...rewardFormData, linked_menu_item_id: e.target.value})}
                                    className="w-full bg-gray-50 p-2.5 rounded border outline-none focus:border-black text-sm"
                                >
                                    <option value="">-- ไม่ผูกเมนู (No linked item) --</option>
                                    {menuItems.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">If selected, this menu item will be automatically added to the POS cart for 0.00 THB when the reward code is applied.</p>
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
