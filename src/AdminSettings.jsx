import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Save, Power, Upload, Calendar, Trash2 } from 'lucide-react'

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        shop_mode: 'auto',
        opening_time: '10:00',
        closing_time: '20:00',
        floorplan_url: '',
        payment_qr_url: '',
        booking_time_slots: '11:00, 12:00, 13:00, 14:00, 17:00, 18:00, 19:00, 20:00',
        is_menu_system_enabled: 'true'
    })
    const [loading, setLoading] = useState(false)
    const [timestamp, setTimestamp] = useState(Date.now())
    const [uploadingQr, setUploadingQr] = useState(false)
    const [uploadingFloor, setUploadingFloor] = useState(false)

    // Blocked Dates
    const [blockedList, setBlockedList] = useState([])
    const [blockForm, setBlockForm] = useState({ startDate: '', endDate: '', reason: '' })

    // Load Settings
    useEffect(() => { fetchSettings() }, [])

    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('*')
        if (data) {
            const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
            // Merge กับค่า default เพื่อป้องกัน undefined
            setSettings(prev => ({ ...prev, ...map }))
        }

        // Fetch Blocked Dates
        const { data: bd } = await supabase.from('blocked_dates').select('*').order('blocked_date', { ascending: true })
        setBlockedList(bd || [])
    }

    // Save Function (แก้ใหม่ให้ลื่นขึ้น)
    const handleSave = async (key, value) => {
        // 1. อัปเดตหน้าจอทันที (UI Optimistic Update)
        setSettings(prev => ({ ...prev, [key]: value }))

        // 2. ส่งค่าไป Database เงียบๆ
        try {
            const { error } = await supabase.from('app_settings').upsert({ key, value: String(value) })
            if (error) throw error
        } catch (err) {
            console.error(err)
            alert('บันทึกไม่สำเร็จ โปรดลองใหม่')
            fetchSettings() // ถ้าพัง ให้โหลดค่าเดิมกลับมา
        }
    }

    // Upload Function
    const handleUpload = async (file, settingKey, loadingSetter) => {
        if (!file) return
        loadingSetter(true)
        try {
            // 1. อัปโหลดทับไฟล์เดิม (ใช้ upsert: true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${settingKey}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, file, { upsert: true })

            if (uploadError) throw uploadError

            // 2. ได้ URL มา
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)

            // 3. บันทึก URL ผ่าน handleSave เพื่อความ Consistent
            await handleSave(settingKey, publicUrl)

            // 4. อัปเดต timestamp
            setTimestamp(Date.now())

            alert('อัปเดตเรียบร้อย!')
        } catch (error) {
            alert('Error: ' + error.message)
        } finally {
            loadingSetter(false)
        }
    }

    // Helper: Create range array
    const getDatesInRange = (startDate, endDate) => {
        const dates = []
        let currentDate = new Date(startDate)
        const stopDate = new Date(endDate)
        while (currentDate <= stopDate) {
            dates.push(currentDate.toISOString().split('T')[0])
            currentDate.setDate(currentDate.getDate() + 1)
        }
        return dates
    }

    const handleBlockDates = async (e) => {
        e.preventDefault()
        if (!blockForm.startDate) return alert('Select start date')

        // Use startDate as endDate if endDate is empty (Single day block)
        const finalEndDate = blockForm.endDate || blockForm.startDate

        if (new Date(blockForm.startDate) > new Date(finalEndDate)) {
            return alert('Start date must be before end date')
        }

        try {
            const datesToBlock = getDatesInRange(blockForm.startDate, finalEndDate)
            const payload = datesToBlock.map(dateStr => ({
                blocked_date: dateStr,
                reason: blockForm.reason || 'Closed'
            }))

            // UPSERT with ignoreDuplicates
            const { error } = await supabase
                .from('blocked_dates')
                .upsert(payload, { onConflict: 'blocked_date', ignoreDuplicates: true })

            if (error) throw error

            setBlockForm({ startDate: '', endDate: '', reason: '' })
            fetchSettings()
            alert(`Blocked ${datesToBlock.length} dates successfully!`)
        } catch (err) { alert(err.message) }
    }

    const handleDeleteBlockedDate = async (id) => {
        if (!confirm('Unblock this date?')) return
        const { error } = await supabase.from('blocked_dates').delete().eq('id', id)
        if (!error) fetchSettings()
    }

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">System Settings</h1>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-6">
                    {/* Enable Booking System - Redesigned as a Card */}
                    <label className={`block bg-[#111] p-6 rounded-3xl border transition-all cursor-pointer ${settings.is_menu_system_enabled === 'true' ? 'border-[#DFFF00]/50 shadow-[0_0_20px_rgba(223,255,0,0.1)]' : 'border-white/5 hover:bg-white/5'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${settings.is_menu_system_enabled === 'true' ? 'bg-[#DFFF00]' : 'bg-gray-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${settings.is_menu_system_enabled === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <div>
                                    <span className={`block font-bold text-lg ${settings.is_menu_system_enabled === 'true' ? 'text-[#DFFF00]' : 'text-white'}`}>
                                        Booking System {settings.is_menu_system_enabled === 'true' ? 'Active' : 'Disabled'}
                                    </span>
                                    <span className="text-xs text-gray-400">Master switch for all customer ordering</span>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={settings.is_menu_system_enabled === 'true'}
                                onChange={(e) => handleSave('is_menu_system_enabled', e.target.checked ? 'true' : 'false')}
                            />
                        </div>
                    </label>

                    {/* Shop Status Control */}
                    <div className="bg-[#111] p-6 md:p-8 rounded-3xl border border-white/5 space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Power size={20} className={settings.shop_mode === 'manual_close' ? 'text-red-500' : 'text-[#DFFF00]'} />
                            Shop Status
                        </h2>

                        <div className="space-y-3">
                            {['auto', 'manual_open', 'manual_close'].map((mode) => (
                                <label key={mode} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${settings.shop_mode === mode ? 'bg-white/10 border-[#DFFF00]' : 'border-white/10 hover:bg-white/5'}`}>
                                    <input
                                        type="radio"
                                        name="shop_mode"
                                        checked={settings.shop_mode === mode}
                                        onChange={() => handleSave('shop_mode', mode)}
                                        className="accent-[#DFFF00] w-5 h-5"
                                    />
                                    <div>
                                        <span className="block text-white font-bold capitalize">{mode.replace('_', ' ')}</span>
                                        <span className="text-xs text-gray-500">
                                            {mode === 'auto' ? 'Based on schedule' : (mode === 'manual_open' ? 'Force Open' : 'Force Close')}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* Time Settings */}
                        <div className={`grid grid-cols-2 gap-4 transition-opacity duration-300 ${settings.shop_mode !== 'auto' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Opens at</label>
                                <input type="time" value={settings.opening_time} onChange={(e) => handleSave('opening_time', e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#DFFF00]" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Closes at</label>
                                <input type="time" value={settings.closing_time} onChange={(e) => handleSave('closing_time', e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#DFFF00]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Blocked Dates Management */}
                <div className="bg-[#111] p-6 md:p-8 rounded-3xl border border-white/5 space-y-6 flex flex-col">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                            <Calendar size={20} className="text-red-500" /> Blocked Dates
                        </h2>
                        <p className="text-xs text-gray-500 mb-6">Close bookings for specific days or ranges.</p>

                        <form onSubmit={handleBlockDates} className="flex flex-col gap-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold">วันที่เริ่มหยุด (Start)</label>
                                    <input
                                        type="date"
                                        value={blockForm.startDate}
                                        onClick={(e) => e.target.showPicker?.()}
                                        onChange={e => setBlockForm({ ...blockForm, startDate: e.target.value })}
                                        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#DFFF00] outline-none cursor-pointer"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold">ถึงวันที่ (End)</label>
                                    <input
                                        type="date"
                                        value={blockForm.endDate}
                                        min={blockForm.startDate}
                                        onClick={(e) => e.target.showPicker?.()}
                                        onChange={e => setBlockForm({ ...blockForm, endDate: e.target.value })}
                                        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#DFFF00] outline-none cursor-pointer"
                                    />
                                </div>
                            </div>
                            <input type="text" placeholder="Reason (e.g. Holiday)" value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#DFFF00] outline-none" />
                            <button className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm transition-colors mt-1">Block Dates</button>
                        </form>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {blockedList.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                    <div>
                                        <div className="text-white text-sm font-bold">{new Date(item.blocked_date).toLocaleDateString()}</div>
                                        <div className="text-xs text-gray-400">{item.reason}</div>
                                    </div>
                                    <button onClick={() => handleDeleteBlockedDate(item.id)} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            {blockedList.length === 0 && (
                                <div className="text-center text-gray-600 text-xs py-10">No blocked dates</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Announcement Card Settings */}
            <div className="bg-[#111] p-8 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        Announcement Card
                    </h2>
                    <button
                        onClick={async () => {
                            await handleSave('announcement_headline', settings.announcement_headline)
                            await handleSave('announcement_detail', settings.announcement_detail)
                            await handleSave('booking_min_spend', settings.booking_min_spend)
                            await handleSave('booking_min_advance_hours', settings.booking_min_advance_hours)
                            await handleSave('booking_min_advance_hours', settings.booking_min_advance_hours)
                            await handleSave('pickup_min_advance_hours', settings.pickup_min_advance_hours)
                            await handleSave('booking_time_slots', settings.booking_time_slots)
                            await handleSave('policy_dine_in', settings.policy_dine_in)
                            await handleSave('policy_pickup', settings.policy_pickup)
                            await handleSave('is_menu_system_enabled', settings.is_menu_system_enabled)
                            alert('บันทึกการตั้งค่าเรียบร้อย!')
                        }}
                        className="flex items-center gap-2 bg-[#DFFF00] text-black px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform"
                    >
                        <Save size={16} /> บันทึก
                    </button>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Headline (Bold)</label>
                    <input
                        type="text"
                        value={settings.announcement_headline || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, announcement_headline: e.target.value }))}
                        placeholder="e.g. BY ร้านในบ้าน"
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Detail (Marquee)</label>
                    <input
                        type="text"
                        value={settings.announcement_detail || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, announcement_detail: e.target.value }))}
                        placeholder="e.g. IN THE HAUS..."
                        className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand"
                    />
                </div>

                {/* --- New Policy & Rate Settings --- */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                    <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Minimum Spend per Person (THB)</label>
                        <input
                            type="number"
                            value={settings.booking_min_spend || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, booking_min_spend: e.target.value }))}
                            placeholder="e.g. 150"
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Min Advance Booking (Hours)</label>
                        <input
                            type="number"
                            value={settings.booking_min_advance_hours || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, booking_min_advance_hours: e.target.value }))}
                            placeholder="e.g. 2"
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Min Advance Pickup (Hours)</label>
                        <input
                            type="number"
                            value={settings.pickup_min_advance_hours || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, pickup_min_advance_hours: e.target.value }))}
                            placeholder="e.g. 1"
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Service Time Slots (Comma separated)</label>
                        <input
                            type="text"
                            value={settings.booking_time_slots || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, booking_time_slots: e.target.value }))}
                            placeholder="e.g. 11:00, 12:00, 13:00"
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Dine-in Policy (Before Pay)</label>
                        <textarea
                            rows={3}
                            value={settings.policy_dine_in || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, policy_dine_in: e.target.value }))}
                            placeholder="Message above the confirm checkbox..."
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Pickup Policy (Before Pay)</label>
                        <textarea
                            rows={3}
                            value={settings.policy_pickup || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, policy_pickup: e.target.value }))}
                            placeholder="Message above the confirm checkbox..."
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Floor Plan & QR */}
            {/* QR Code Section */}
            <div className="bg-[#111] p-8 rounded-3xl border border-white/5">
                <h2 className="text-xl font-bold text-white mb-2">QR Payment</h2>
                <div className="mb-6 flex justify-center">
                    {settings.payment_qr_url ? (
                        <img src={`${settings.payment_qr_url}?t=${timestamp}`} className="w-48 h-48 object-cover rounded-2xl border-2 border-[#DFFF00]" />
                    ) : (
                        <div className="w-48 h-48 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500">No QR</div>
                    )}
                </div>
                <label className="block w-full cursor-pointer group">
                    <div className="bg-black border border-dashed border-gray-700 rounded-xl p-4 text-center group-hover:border-[#DFFF00] transition-colors">
                        <span className="text-gray-400 text-sm group-hover:text-white">{uploadingQr ? 'Uploading...' : 'Click to replace QR'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'payment_qr_url', setUploadingQr)} />
                </label>
                <p className="text-[10px] text-gray-500 mt-2 text-center">Recommended: Square image (1:1), JPG/PNG, Max 500KB</p>
            </div>

            {/* Floor Plan Section */}
            <div className="bg-[#111] p-8 rounded-3xl border border-white/5">
                <h2 className="text-xl font-bold text-white mb-2">Floor Plan</h2>
                <div className="mb-6">
                    {settings.floorplan_url ? (
                        <img src={`${settings.floorplan_url}?t=${timestamp}`} className="w-full h-40 object-cover rounded-2xl border border-gray-700 opacity-60" />
                    ) : (
                        <div className="w-full h-40 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500">No Plan</div>
                    )}
                </div>
                <label className="block w-full cursor-pointer group">
                    <div className="bg-black border border-dashed border-gray-700 rounded-xl p-4 text-center group-hover:border-[#DFFF00] transition-colors">
                        <span className="text-gray-400 text-sm group-hover:text-white">{uploadingFloor ? 'Uploading...' : 'Click to replace Floor Plan'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'floorplan_url', setUploadingFloor)} />
                </label>
                <p className="text-[10px] text-gray-500 mt-2 text-center">Recommended: Landscape (16:9), High resolution, Max 2MB</p>
            </div>

            {/* Data Maintenance Section */}
            <div className="mt-8 bg-[#111] p-8 rounded-3xl border border-white/5 space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-red-500">⚠</span> Data Maintenance
                </h2>
                <div className="flex items-center justify-between p-4 border border-white/10 rounded-2xl bg-black/20">
                    <div>
                        <h3 className="font-bold text-white">Clean Old Slips (&gt;30 Days)</h3>
                        <p className="text-xs text-gray-400 mt-1">
                            ลบรูปสลิปที่เก่ากว่า 30 วันออกจาก Storage เพื่อประหยัดพื้นที่ (ข้อมูลการจองยังอยู่)
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            if (!window.confirm('Are you sure you want to delete slip images older than 30 days?')) return

                            try {
                                setLoading(true)
                                // 1. Calculate Date 30 Days Ago
                                const d = new Date()
                                d.setDate(d.getDate() - 30)
                                const cutoffDate = d.toISOString()

                                // 2. Find old bookings with slips
                                const { data: oldBookings, error: fetchError } = await supabase
                                    .from('bookings')
                                    .select('id, payment_slip_url')
                                    .lt('booking_time', cutoffDate)
                                    .not('payment_slip_url', 'is', null)

                                if (fetchError) throw fetchError
                                if (!oldBookings || oldBookings.length === 0) {
                                    alert('No old slips found to clean.')
                                    return
                                }

                                // 3. Delete from Storage
                                const filesToRemove = oldBookings.map(b => b.payment_slip_url)
                                const { error: storageError } = await supabase.storage
                                    .from('slips')
                                    .remove(filesToRemove)

                                if (storageError) throw storageError

                                // 4. Update Database (Set payment_slip_url to null)
                                const idsToUpdate = oldBookings.map(b => b.id)
                                const { error: updateError } = await supabase
                                    .from('bookings')
                                    .update({ payment_slip_url: null })
                                    .in('id', idsToUpdate)

                                if (updateError) throw updateError

                                alert(`Cleaned up ${filesToRemove.length} old slips successfully!`)

                            } catch (e) {
                                console.error(e)
                                alert('Error cleaning slips: ' + e.message)
                            } finally {
                                setLoading(false)
                            }
                        }}
                        disabled={loading}
                        className="px-6 py-3 bg-red-900/30 text-red-500 border border-red-500/50 rounded-xl font-bold hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Cleaning...' : 'Clean Now'}
                    </button>
                </div>
            </div>

        </div>
    )
}
