import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Save, Power, Upload } from 'lucide-react'

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        shop_mode: 'auto',
        opening_time: '10:00',
        closing_time: '20:00',
        floorplan_url: '',
        payment_qr_url: '',
        booking_time_slots: '11:00, 12:00, 13:00, 14:00, 17:00, 18:00, 19:00, 20:00' // Default Value
    })
    const [loading, setLoading] = useState(false)
    const [timestamp, setTimestamp] = useState(Date.now()) // ตัวแก้ Cache รูป
    const [uploadingQr, setUploadingQr] = useState(false)
    const [uploadingFloor, setUploadingFloor] = useState(false)

    // Load Settings
    useEffect(() => { fetchSettings() }, [])

    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('*')
        if (data) {
            const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
            // Merge กับค่า default เพื่อป้องกัน undefined
            setSettings(prev => ({ ...prev, ...map }))
        }
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

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">System Settings</h1>

            <div className="grid md:grid-cols-2 gap-8">

                {/* Shop Status Control */}
                <div className="bg-[#111] p-8 rounded-3xl border border-white/5 space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Power size={20} className={settings.shop_mode === 'manual_close' ? 'text-red-500' : 'text-brand'} />
                        Shop Status
                    </h2>

                    <div className="space-y-3">
                        {['auto', 'manual_open', 'manual_close'].map((mode) => (
                            <label key={mode} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${settings.shop_mode === mode ? 'bg-white/10 border-brand' : 'border-white/10 hover:bg-white/5'}`}>
                                <input
                                    type="radio"
                                    name="shop_mode"
                                    checked={settings.shop_mode === mode}
                                    onChange={() => handleSave('shop_mode', mode)}
                                    className="accent-brand w-5 h-5"
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
                            <input type="time" value={settings.opening_time} onChange={(e) => handleSave('opening_time', e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Closes at</label>
                            <input type="time" value={settings.closing_time} onChange={(e) => handleSave('closing_time', e.target.value)} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand" />
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
                                // Only delete if valid filenames (no http links if any)
                                // Assuming simple filenames. 
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
