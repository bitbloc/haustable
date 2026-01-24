import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Save, Power, Upload, Calendar, Trash2, Volume2, Bell, MessageSquare, QrCode, RefreshCw, Download, Cake, Heart } from 'lucide-react'

// PWA Install Button Component
const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (!deferredPrompt) return null

  return (
    <button 
        onClick={handleInstall}
        className="flex items-center gap-2 bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-700 transition-colors border border-zinc-700"
    >
        <Download size={16} /> Install App
    </button>
  )
}

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        shop_mode_table: 'auto',
        shop_mode_pickup: 'auto',
        shop_mode_steak: 'auto',
        steak_addon_cake_price: '1000',
        steak_addon_flower_price: '1000',
        steak_addon_cake_enabled: 'true',
        steak_addon_flower_enabled: 'true',
        steak_addon_cake_name: 'เธฃเธฑเธเน€เธเนเธ (Receive Cake)',
        steak_addon_flower_name: 'เธฃเธฑเธเธ”เธญเธเนเธกเน (Receive Flower)',
        steak_wine_list: '[]', // JSON string
        opening_time: '10:00',
        closing_time: '20:00',
        floorplan_url: '',
        payment_qr_url: '',
        booking_time_slots: '11:00, 12:00, 13:00, 14:00, 17:00, 18:00, 19:00, 20:00',
        is_menu_system_enabled: 'true',
        alert_sound_url: null,
        sms_api_key: '',
        sms_api_secret: '',
        admin_phone_contact: '',
        staff_pin_code: '',
        contact_phone: '',
        contact_map_url: '',
        steak_corkage_price: '0'
    })
    const [loading, setLoading] = useState(false)
    const [timestamp, setTimestamp] = useState(Date.now())
    const [uploadingQr, setUploadingQr] = useState(false)
    const [uploadingFloor, setUploadingFloor] = useState(false)
    const [uploadingSound, setUploadingSound] = useState(false)
    const [uploadingHomeBg, setUploadingHomeBg] = useState(false)

    // Blocked Dates
    const [blockedList, setBlockedList] = useState([])
    const [blockForm, setBlockForm] = useState({ startDate: '', endDate: '', reason: '' })

    // Load Settings
    useEffect(() => { fetchSettings() }, [])

    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('*')
        if (data) {
            const map = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {})
            // Merge เธเธฑเธเธเนเธฒ default เน€เธเธทเนเธญเธเนเธญเธเธเธฑเธ undefined
            setSettings(prev => ({ ...prev, ...map }))
        }

        // Fetch Blocked Dates
        const { data: bd } = await supabase.from('blocked_dates').select('*').order('blocked_date', { ascending: true })
        setBlockedList(bd || [])
    }

    // Save Function (เนเธเนเนเธซเธกเนเนเธซเนเธฅเธทเนเธเธเธถเนเธ)
    const handleSave = async (key, value) => {
        // 1. เธญเธฑเธเน€เธ”เธ•เธซเธเนเธฒเธเธญเธ—เธฑเธเธ—เธต (UI Optimistic Update)
        setSettings(prev => ({ ...prev, [key]: value }))

        // 2. เธชเนเธเธเนเธฒเนเธ Database เน€เธเธตเธขเธเน
        try {
            const { error } = await supabase.from('app_settings').upsert({ key, value: String(value) })
            if (error) throw error
        } catch (err) {
            console.error(err)
            alert('เธเธฑเธเธ—เธถเธเนเธกเนเธชเธณเน€เธฃเนเธ เนเธเธฃเธ”เธฅเธญเธเนเธซเธกเน')
            fetchSettings() // เธ–เนเธฒเธเธฑเธ เนเธซเนเนเธซเธฅเธ”เธเนเธฒเน€เธ”เธดเธกเธเธฅเธฑเธเธกเธฒ
        }
    }

    // Upload Function
    const handleUpload = async (file, settingKey, loadingSetter) => {
        if (!file) return
        loadingSetter(true)
        try {
            // 1. เธญเธฑเธเนเธซเธฅเธ”เธ—เธฑเธเนเธเธฅเนเน€เธ”เธดเธก (เนเธเน upsert: true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${settingKey}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, file, { upsert: true })

            if (uploadError) throw uploadError

            // 2. เนเธ”เน URL เธกเธฒ
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)

            // 3. เธเธฑเธเธ—เธถเธ URL เธเนเธฒเธ handleSave เน€เธเธทเนเธญเธเธงเธฒเธก Consistent
            await handleSave(settingKey, publicUrl)

            // 4. เธญเธฑเธเน€เธ”เธ• timestamp
            setTimestamp(Date.now())

            alert('เธญเธฑเธเน€เธ”เธ•เน€เธฃเธตเธขเธเธฃเนเธญเธข!')
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
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in pl-6 md:pl-0">
            <h1 className="text-3xl font-bold text-ink mb-8 tracking-tight">System Settings</h1>

            {/* Network Connection Helper & Staff Access */}
            <div className="bg-paper p-6 rounded-3xl border border-gray-200 mb-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    {/* QR Code Column */}
                    <div className="flex-shrink-0 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                settings.manual_ip 
                                    ? `http://${settings.manual_ip}:5173/staff`
                                    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                                        ? `http://${process.env.HOST_IP || 'localhost'}:5173/staff`
                                        : `${window.location.origin}/staff`
                            )}`} 
                            alt="Staff Access QR" 
                            className="w-32 h-32 md:w-40 md:h-40"
                        />
                    </div>

                    {/* Text Column */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <h2 className="text-xl font-bold text-ink flex items-center justify-center md:justify-start gap-2">
                                <QrCode className="text-brandDark" /> Staff Mobile Access
                            </h2>
                            <p className="text-subInk text-sm mt-1">
                                Scan to open Staff View for kitchen and service.
                            </p>
                        </div>
                        
                        <div className="flex flex-col md:flex-row gap-3 justify-center md:justify-start">
                             <div className="px-4 py-2 bg-gray-50 rounded-lg text-ink font-mono text-sm border border-gray-200 select-all">
                                 {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
                                    ? `http://${process.env.HOST_IP || 'localhost'}:5173/staff`
                                    : `${window.location.origin}/staff`
                                 }
                             </div>
                             <InstallPWA />
                        </div>

                         <div className="text-[10px] text-gray-400">
                             Mode: {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'Local Dev (LAN)' : 'Production (Cloud)'}
                         </div>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-6">
                    {/* Enable Booking System - Redesigned as a Card */}
                    <label className={`block bg-paper p-6 rounded-3xl border transition-all cursor-pointer shadow-sm ${settings.is_menu_system_enabled === 'true' ? 'border-brand ring-1 ring-brand' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${settings.is_menu_system_enabled === 'true' ? 'bg-brand' : 'bg-gray-200'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${settings.is_menu_system_enabled === 'true' ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <div>
                                    <span className={`block font-bold text-lg ${settings.is_menu_system_enabled === 'true' ? 'text-ink' : 'text-subInk'}`}>
                                        Booking System {settings.is_menu_system_enabled === 'true' ? 'Active' : 'Disabled'}
                                    </span>
                                    <span className="text-xs text-subInk">Master switch for all customer ordering</span>
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

                    {/* Shop Status Control - Split into 3 */}
                    <div className="bg-paper p-6 md:p-8 rounded-3xl border border-gray-200 space-y-8 shadow-sm">
                        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                             <Power size={20} className="text-brandDark" /> Shop Status Controls
                        </h2>

                        {/* 1. Table Booking Status */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-subInk uppercase">๐ฝ Table Booking Status</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {['auto', 'manual_open', 'manual_close'].map((mode) => (
                                    <label key={mode} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${settings.shop_mode_table === mode ? 'bg-brand/10 border-brand' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input
                                            type="radio"
                                            name="shop_mode_table"
                                            checked={settings.shop_mode_table === mode}
                                            onChange={() => handleSave('shop_mode_table', mode)}
                                            className="accent-brandDark w-4 h-4"
                                        />
                                        <div>
                                            <span className="block text-ink font-bold text-sm capitalize">{mode.replace('_', ' ')}</span>
                                            <span className="text-[10px] text-subInk">
                                                {mode === 'auto' ? 'เธเธณเธซเธเธ”เน€เธงเธฅเธฒเธเธฒเธฃเธเธญเธเธเธตเนเนเธกเธเธ–เธถเธเธเธตเนเนเธกเธ (Based on schedule)' : (mode === 'manual_open' ? 'Force Open' : 'Force Close')}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 2. Pickup Status */}
                        <div className="space-y-3 border-t border-gray-100 pt-4">
                            <h3 className="text-sm font-bold text-subInk uppercase">๐ Pickup Status</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {['auto', 'manual_open', 'manual_close'].map((mode) => (
                                    <label key={mode} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${settings.shop_mode_pickup === mode ? 'bg-brand/10 border-brand' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input
                                            type="radio"
                                            name="shop_mode_pickup"
                                            checked={settings.shop_mode_pickup === mode}
                                            onChange={() => handleSave('shop_mode_pickup', mode)}
                                            className="accent-brandDark w-4 h-4"
                                        />
                                        <div>
                                            <span className="block text-ink font-bold text-sm capitalize">{mode.replace('_', ' ')}</span>
                                            <span className="text-[10px] text-subInk">
                                                {mode === 'auto' ? 'เธเธณเธซเธเธ”เน€เธงเธฅเธฒเธเธฒเธฃเธเธญเธเธเธตเนเนเธกเธเธ–เธถเธเธเธตเนเนเธกเธ (Based on schedule)' : (mode === 'manual_open' ? 'Force Open' : 'Force Close')}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 3. Steak Pre-order Status */}
                        <div className="space-y-3 border-t border-gray-100 pt-4">
                            <h3 className="text-sm font-bold text-subInk uppercase">๐ฅฉ Steak Pre-order Status</h3>
                            <div className="grid grid-cols-1 gap-2">
                                {['auto', 'manual_open', 'manual_close'].map((mode) => (
                                    <label key={mode} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${settings.shop_mode_steak === mode ? 'bg-brand/10 border-brand' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input
                                            type="radio"
                                            name="shop_mode_steak"
                                            checked={settings.shop_mode_steak === mode}
                                            onChange={() => handleSave('shop_mode_steak', mode)}
                                            className="accent-brandDark w-4 h-4"
                                        />
                                        <div>
                                            <span className="block text-ink font-bold text-sm capitalize">{mode.replace('_', ' ')}</span>
                                            <span className="text-[10px] text-subInk">
                                                {mode === 'auto' ? 'เธเธณเธซเธเธ”เน€เธงเธฅเธฒเธเธฒเธฃเธเธญเธเธเธตเนเนเธกเธเธ–เธถเธเธเธตเนเนเธกเธ (Based on schedule)' : (mode === 'manual_open' ? 'Force Open' : 'Force Close')}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Time Settings */}
                        <div className="pt-4 border-t border-gray-100">
                            <p className="text-[10px] text-subInk mb-3">* Time settings below apply to all "Auto" modes</p>
                            <div className={`grid grid-cols-2 gap-4 transition-opacity duration-300`}>
                                <div>
                                    <label className="block text-xs text-subInk mb-1">Opens at</label>
                                    <input type="time" value={settings.opening_time} onChange={(e) => handleSave('opening_time', e.target.value)} className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand shadow-inner" />
                                </div>
                                <div>
                                    <label className="block text-xs text-subInk mb-1">Closes at</label>
                                    <input type="time" value={settings.closing_time} onChange={(e) => handleSave('closing_time', e.target.value)} className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand shadow-inner" />
                                </div>
                            </div>
                        </div>
                    </div>


                {/* Staff Access Settings */}
                <div className="bg-paper p-6 md:p-8 rounded-3xl border border-gray-200 space-y-4 shadow-sm">
                    <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                            ๐‘จโ€๐ณ Staff Access
                    </h2>
                    <div>
                        <label className="block text-xs text-subInk mb-1">Staff PIN Code</label>
                        <input 
                            type="text" 
                            value={settings.staff_pin_code || ''} 
                            onChange={(e) => handleSave('staff_pin_code', e.target.value)} 
                            placeholder="e.g. 1234"
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand font-mono tracking-widest text-center text-lg shadow-inner" 
                        />
                        <p className="text-[10px] text-subInk mt-2">Simple code for staff to access Staff View without email login.</p>
                    </div> w
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
                                    <label className="text-[10px] text-gray-400 uppercase font-bold">เธงเธฑเธเธ—เธตเนเน€เธฃเธดเนเธกเธซเธขเธธเธ” (Start)</label>
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
                                    <label className="text-[10px] text-gray-400 uppercase font-bold">เธ–เธถเธเธงเธฑเธเธ—เธตเน (End)</label>
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
                            await handleSave('contact_phone', settings.contact_phone)
                            await handleSave('contact_map_url', settings.contact_map_url)
                            alert('เธเธฑเธเธ—เธถเธเธเธฒเธฃเธ•เธฑเนเธเธเนเธฒเน€เธฃเธตเธขเธเธฃเนเธญเธข!')
                        }}
                        className="flex items-center gap-2 bg-[#DFFF00] text-black px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform"
                    >
                        <Save size={16} /> เธเธฑเธเธ—เธถเธ
                    </button>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Headline (Bold)</label>
                    <input
                        type="text"
                        value={settings.announcement_headline || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, announcement_headline: e.target.value }))}
                        placeholder="e.g. BY เธฃเนเธฒเธเนเธเธเนเธฒเธ"
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
                
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Contact Phone</label>
                        <input
                            type="text"
                            value={settings.contact_phone || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
                            placeholder="e.g. 0812345678"
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand font-mono"
                        />
                     </div>
                     <div>
                        <label className="block text-xs text-[#DFFF00] font-bold mb-1">Google Maps URL</label>
                        <input
                            type="text"
                            value={settings.contact_map_url || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, contact_map_url: e.target.value }))}
                            placeholder="https://maps.google.com/..."
                            className="w-full bg-black border border-white/10 p-3 rounded-xl text-white outline-none focus:border-brand"
                        />
                     </div>
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

            {/* --- Sound Alert Settings --- */}
            <div className="bg-[#111] p-8 rounded-3xl border border-white/5 space-y-6 mt-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Volume2 className="text-[#DFFF00]" /> Sound Alert (Loop)
                </h2>
                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-black rounded-xl p-4 flex items-center justify-between border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#DFFF00]/10 flex items-center justify-center text-[#DFFF00]">
                                <Bell size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Current Alert Sound</p>
                                <p className="text-xs text-gray-400">
                                    {settings.alert_sound_url ? 'Custom File Uploaded' : 'System Default (Beep)'}
                                </p>
                            </div>
                        </div>
                        {settings.alert_sound_url && (
                            <audio controls src={settings.alert_sound_url} className="h-8 w-32" />
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                        Upload New Sound (Max 1MB, .mp3/.wav)
                    </label>
                    <input
                        type="file"
                        accept=".mp3,audio/mpeg,audio/wav"
                        onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                                if (file.size > 1024 * 1024) return alert("File size exceeds 1MB")
                                handleUpload(file, 'alert_sound_url', setUploadingSound)
                            }
                        }}
                        disabled={uploadingSound}
                        className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-xs file:font-semibold
                        file:bg-[#DFFF00] file:text-black
                        hover:file:bg-[#eaff66]
                        cursor-pointer"
                    />
                    <p className="mt-2 text-xs text-gray-500">{uploadingSound ? 'Uploading...' : 'Recommended: Short loopable sound'}</p>
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

            {/* Home Background Section */}
            <div className="bg-[#111] p-8 rounded-3xl border border-white/5 mt-8">
                <h2 className="text-xl font-bold text-white mb-2">Home Background</h2>
                <div className="mb-6">
                    {settings.home_background_url ? (
                        <img src={`${settings.home_background_url}?t=${timestamp}`} className="w-full h-40 object-cover rounded-2xl border border-gray-700 opacity-80" />
                    ) : (
                        <div className="w-full h-40 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500">Default (Ken Burns)</div>
                    )}
                </div>
                <label className="block w-full cursor-pointer group">
                    <div className="bg-black border border-dashed border-gray-700 rounded-xl p-4 text-center group-hover:border-[#DFFF00] transition-colors">
                        <span className="text-gray-400 text-sm group-hover:text-white">{uploadingHomeBg ? 'Uploading...' : 'Click to replace Home Background'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'home_background_url', setUploadingHomeBg)} />
                </label>
                <div className="flex justify-between items-center mt-2">
                     <p className="text-[10px] text-gray-500 text-center">Recommended: 1920x1080 (HD), Dark Tone, Max 2MB</p>
                     {settings.home_background_url && (
                        <button 
                            onClick={() => handleSave('home_background_url', '')}
                            className="text-[10px] text-red-500 hover:text-red-400 underline"
                        >
                            Reset to Default
                        </button>
                     )}
                </div>
            </div>

            {/* Steak Wizard Settings */}
            <div className="bg-[#111] p-8 rounded-3xl border border-white/5 space-y-6 mt-8">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    ๐ฅฉ Steak Wizard Config
                </h2>
                
                {/* Special Details */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-[#DFFF00] uppercase border-b border-white/10 pb-2">Special Details Texts</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Cake Request Label</label>
                            <input 
                                value={settings.steak_qt_cake_label || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_cake_label: e.target.value})}
                                onBlur={() => handleSave('steak_qt_cake_label', settings.steak_qt_cake_label)}
                                placeholder="Cake / Special Decoration Request"
                                className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Cake Placeholder</label>
                            <input 
                                value={settings.steak_qt_cake_placeholder || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_cake_placeholder: e.target.value})}
                                onBlur={() => handleSave('steak_qt_cake_placeholder', settings.steak_qt_cake_placeholder)}
                                placeholder="Need a cake? Write here..."
                                className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Dietary Label</label>
                            <input 
                                value={settings.steak_qt_dietary_label || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_dietary_label: e.target.value})}
                                onBlur={() => handleSave('steak_qt_dietary_label', settings.steak_qt_dietary_label)}
                                placeholder="Dietary Restrictions / Allergies"
                                className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm"
                            />
                        </div>
                         <div>
                            <label className="block text-xs text-gray-400 mb-1">Dietary Placeholder</label>
                            <input 
                                value={settings.steak_qt_dietary_placeholder || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_dietary_placeholder: e.target.value})}
                                onBlur={() => handleSave('steak_qt_dietary_placeholder', settings.steak_qt_dietary_placeholder)}
                                placeholder="e.g. No Nuts"
                                className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm"
                            />
                        </div>
                    </div>
                </div>

                </div>

                {/* Add-ons Configuration (Cake & Flower) */}
                <div className="space-y-6 pt-6 border-t border-white/10">
                    <h3 className="text-sm font-bold text-[#DFFF00] uppercase border-b border-white/10 pb-2">Add-ons Configuration</h3>
                    
                    {/* Cake Config */}
                    <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.steak_addon_cake_enabled === 'true' ? 'bg-[#DFFF00]/20 text-[#DFFF00]' : 'bg-gray-800 text-gray-500'}`}>
                                    <Cake size={16} />
                                </div>
                                <span className={`text-sm font-bold ${settings.steak_addon_cake_enabled === 'true' ? 'text-white' : 'text-gray-500'}`}>
                                    Add-on #1 (Default: Cake)
                                </span>
                            </div>
                             <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={settings.steak_addon_cake_enabled === 'true'} 
                                    onChange={e => handleSave('steak_addon_cake_enabled', e.target.checked ? 'true' : 'false')} 
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#DFFF00]"></div>
                            </label>
                        </div>
                        
                        <div className={`grid md:grid-cols-2 gap-4 transition-all ${settings.steak_addon_cake_enabled === 'true' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div>
                                 <label className="block text-xs text-gray-400 mb-1">Display Name (Label)</label>
                                 <input 
                                    value={settings.steak_addon_cake_name || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_cake_name: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_cake_name', settings.steak_addon_cake_name)}
                                    placeholder="e.g. เธฃเธฑเธเน€เธเนเธ (Receive Cake)"
                                    className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm"
                                 />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Price (THB)</label>
                                <input 
                                    type="number"
                                    value={settings.steak_addon_cake_price || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_cake_price: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_cake_price', settings.steak_addon_cake_price)}
                                    placeholder="1000"
                                    className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flower Config */}
                    <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.steak_addon_flower_enabled === 'true' ? 'bg-[#DFFF00]/20 text-[#DFFF00]' : 'bg-gray-800 text-gray-500'}`}>
                                    <Heart size={16} />
                                </div>
                                <span className={`text-sm font-bold ${settings.steak_addon_flower_enabled === 'true' ? 'text-white' : 'text-gray-500'}`}>
                                    Add-on #2 (Default: Flower)
                                </span>
                            </div>
                             <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={settings.steak_addon_flower_enabled === 'true'} 
                                    onChange={e => handleSave('steak_addon_flower_enabled', e.target.checked ? 'true' : 'false')} 
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#DFFF00]"></div>
                            </label>
                        </div>
                        
                        <div className={`grid md:grid-cols-2 gap-4 transition-all ${settings.steak_addon_flower_enabled === 'true' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div>
                                 <label className="block text-xs text-gray-400 mb-1">Display Name (Label)</label>
                                 <input 
                                    value={settings.steak_addon_flower_name || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_flower_name: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_flower_name', settings.steak_addon_flower_name)}
                                    placeholder="e.g. เธฃเธฑเธเธ”เธญเธเนเธกเน (Receive Flower)"
                                    className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm"
                                 />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Price (THB)</label>
                                <input 
                                    type="number"
                                    value={settings.steak_addon_flower_price || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_flower_price: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_flower_price', settings.steak_addon_flower_price)}
                                    placeholder="1000"
                                    className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Wine List Manager */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                    <h3 className="text-sm font-bold text-[#DFFF00] uppercase border-b border-white/10 pb-2">Wine List Manager</h3>
                    
                    {/* Render List */}
                    <div className="space-y-2">
                        {(() => {
                            let wines = []
                            try { wines = JSON.parse(settings.steak_wine_list || '[]') } catch (e) { wines = [] }
                            
                            return wines.map((wine, idx) => (
                                <div key={idx} className="bg-black/40 border border-white/10 p-3 rounded-xl flex items-center justify-between gap-4">
                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                        <input 
                                            placeholder="Wine Name"
                                            value={wine.name}
                                            onChange={(e) => {
                                                const newWines = [...wines]
                                                newWines[idx].name = e.target.value
                                                setSettings({...settings, steak_wine_list: JSON.stringify(newWines)})
                                            }}
                                            onBlur={() => handleSave('steak_wine_list', JSON.stringify(wines))}
                                            className="bg-transparent border border-white/5 rounded px-2 py-1 text-white text-xs"
                                        />
                                        <input 
                                            placeholder="Price (THB)"
                                            type="number"
                                            value={wine.price}
                                            onChange={(e) => {
                                                const newWines = [...wines]
                                                newWines[idx].price = parseInt(e.target.value) || 0
                                                setSettings({...settings, steak_wine_list: JSON.stringify(newWines)})
                                            }}
                                            onBlur={() => handleSave('steak_wine_list', JSON.stringify(wines))}
                                            className="bg-transparent border border-white/5 rounded px-2 py-1 text-white text-xs font-mono"
                                        />
                                        <input 
                                            placeholder="Description"
                                            value={wine.description || ''}
                                            onChange={(e) => {
                                                const newWines = [...wines]
                                                newWines[idx].description = e.target.value
                                                setSettings({...settings, steak_wine_list: JSON.stringify(newWines)})
                                            }}
                                            onBlur={() => handleSave('steak_wine_list', JSON.stringify(wines))}
                                            className="bg-transparent border border-white/5 rounded px-2 py-1 text-gray-400 text-xs"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const newWines = wines.filter((_, i) => i !== idx)
                                            setSettings({...settings, steak_wine_list: JSON.stringify(newWines)})
                                            handleSave('steak_wine_list', JSON.stringify(newWines))
                                        }}
                                        className="text-red-500 hover:text-red-400 p-2"
                                    >
                                        โ•
                                    </button>
                                </div>
                            ))
                        })()}
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={() => {
                            let wines = []
                            try { wines = JSON.parse(settings.steak_wine_list || '[]') } catch (e) { wines = [] }
                            const newWines = [...wines, { name: '', price: 0, description: '' }]
                            setSettings({...settings, steak_wine_list: JSON.stringify(newWines)})
                            handleSave('steak_wine_list', JSON.stringify(newWines))
                        }}
                        className="w-full py-2 border border-dashed border-white/20 text-gray-400 text-xs rounded-xl hover:border-[#DFFF00] hover:text-[#DFFF00] transition-colors"
                    >
                        + Add New Wine
                    </button>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="pt-2">
                             <label className="block text-xs text-gray-400 mb-1">Corkage Fee (Label)</label>
                             <input 
                                value={settings.steak_corkage_fee || ''} 
                                onChange={(e) => setSettings({...settings, steak_corkage_fee: e.target.value})}
                                onBlur={() => handleSave('steak_corkage_fee', settings.steak_corkage_fee)}
                                placeholder="Corkage Fee"
                                className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm"
                            />
                        </div>
                        <div className="pt-2">
                             <label className="block text-xs text-gray-400 mb-1">Corkage Price (THB)</label>
                             <input 
                                type="number"
                                value={settings.steak_corkage_price || '0'} 
                                onChange={(e) => setSettings({...settings, steak_corkage_price: e.target.value})}
                                onBlur={() => handleSave('steak_corkage_price', settings.steak_corkage_price)}
                                placeholder="0"
                                className="w-full bg-black border border-white/10 p-2 rounded-lg text-white text-sm font-mono"
                            />
                        </div>
                    </div>
                </div>


            {/* Data Maintenance Section */}
            <div className="mt-8 bg-[#111] p-8 rounded-3xl border border-white/5 space-y-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-red-500">โ </span> Data Maintenance
                </h2>
                <div className="flex items-center justify-between p-4 border border-white/10 rounded-2xl bg-black/20">
                    <div>
                        <h3 className="font-bold text-white">Clean Old Slips (&gt;30 Days)</h3>
                        <p className="text-xs text-gray-400 mt-1">
                            เธฅเธเธฃเธนเธเธชเธฅเธดเธเธ—เธตเนเน€เธเนเธฒเธเธงเนเธฒ 30 เธงเธฑเธเธญเธญเธเธเธฒเธ Storage เน€เธเธทเนเธญเธเธฃเธฐเธซเธขเธฑเธ”เธเธทเนเธเธ—เธตเน (เธเนเธญเธกเธนเธฅเธเธฒเธฃเธเธญเธเธขเธฑเธเธญเธขเธนเน)
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
