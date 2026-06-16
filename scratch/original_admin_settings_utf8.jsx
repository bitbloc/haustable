import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Save, Power, Upload, Calendar, Trash2, Volume2, Bell, MessageSquare, QrCode, RefreshCw, Download, Cake, Heart, TrendingUp } from 'lucide-react'

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
        steak_corkage_price: '0',
        qr_ordering_enabled: 'true',
        qr_gps_enabled: 'true',
        qr_latitude: '17.40722',
        qr_longitude: '104.78028',
        qr_radius: '50',
        spotify_client_id: '',
        spotify_client_secret: ''
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
    
    // Store Settings (Relational Table)
    const [targetFoodCost, setTargetFoodCost] = useState(30);

    // Load Settings
    useEffect(() => { 
        fetchSettings();
        fetchStoreSettings();
    }, [])

    const fetchStoreSettings = async () => {
        const { data } = await supabase.from('store_settings').select('target_food_cost_pct').single();
        if (data) setTargetFoodCost(data.target_food_cost_pct || 30);
    };

    const handleSaveStoreSetting = async (key, value) => {
         // Optimistic
         if (key === 'target_food_cost_pct') setTargetFoodCost(value);

         try {
             const { error } = await supabase.from('store_settings').update({ [key]: value }).eq('id', 1); // Singleton ID 1
             if (error) throw error;
         } catch (err) {
             console.error(err);
             alert('Failed to save store setting'); // Changed toast.error to alert
             fetchStoreSettings();
         }
    };

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

                    {/* Pricing Strategy Config */}
                    <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                             <TrendingUp size={20} className="text-blue-600" /> Pricing Strategy
                        </h2>
                         <div>
                            <label className="block text-xs font-bold text-subInk uppercase mb-1">Target Food Cost %</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="1" max="100"
                                    value={targetFoodCost}
                                    onChange={(e) => handleSaveStoreSetting('target_food_cost_pct', parseFloat(e.target.value))}
                                    className="w-24 bg-canvas border border-gray-200 p-3 rounded-xl text-ink font-bold text-lg outline-none focus:border-blue-500 font-mono text-center"
                                />
                                <span className="text-ink font-bold">%</span>
                                <div className="text-xs text-subInk ml-2">
                                    used to calculate recommended selling price. <br/>
                                    (e.g. Cost 30 / 30% = Price 100)
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* QR Customer Ordering Settings Card */}
                    <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                             <QrCode size={20} className="text-orange-500" /> QR Customer Ordering
                        </h2>
                        
                        <div className="space-y-4">
                            {/* Enable QR Ordering Toggle */}
                            <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                    <span className="block font-bold text-sm text-ink">Enable QR Ordering</span>
                                    <span className="text-[10px] text-subInk">Allow customers to place orders via QR code at tables</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.qr_ordering_enabled === 'true'}
                                    onChange={(e) => handleSave('qr_ordering_enabled', e.target.checked ? 'true' : 'false')}
                                    className="accent-brandDark w-4 h-4"
                                />
                            </label>

                            {/* Enable Geofencing Toggle */}
                            <label className="flex items-center justify-between cursor-pointer border-t border-gray-100 pt-3">
                                <div>
                                    <span className="block font-bold text-sm text-ink">Enable GPS Geofencing</span>
                                    <span className="text-[10px] text-subInk">Prevent customers ordering from outside restaurant premises</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.qr_gps_enabled === 'true'}
                                    onChange={(e) => handleSave('qr_gps_enabled', e.target.checked ? 'true' : 'false')}
                                    className="accent-brandDark w-4 h-4"
                                />
                            </label>

                            {settings.qr_gps_enabled === 'true' && (
                                <div className="space-y-3 bg-canvas p-4 rounded-2xl border border-gray-100 animate-fade-in">
                                    <div>
                                        <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Restaurant Latitude</label>
                                        <input
                                            type="text"
                                            value={settings.qr_latitude || ''}
                                            onChange={(e) => setSettings(prev => ({ ...prev, qr_latitude: e.target.value }))}
                                            onBlur={() => handleSave('qr_latitude', settings.qr_latitude)}
                                            className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                            placeholder="e.g. 17.40722"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Restaurant Longitude</label>
                                        <input
                                            type="text"
                                            value={settings.qr_longitude || ''}
                                            onChange={(e) => setSettings(prev => ({ ...prev, qr_longitude: e.target.value }))}
                                            onBlur={() => handleSave('qr_longitude', settings.qr_longitude)}
                                            className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                            placeholder="e.g. 104.78028"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Allowed Radius (meters)</label>
                                        <input
                                            type="number"
                                            value={settings.qr_radius || ''}
                                            onChange={(e) => setSettings(prev => ({ ...prev, qr_radius: e.target.value }))}
                                            onBlur={() => handleSave('qr_radius', settings.qr_radius)}
                                            className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-ink outline-none focus:border-brand"
                                            placeholder="e.g. 50"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Spotify Song Request System Settings */}
                    <div className="bg-paper p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                             <span className="text-lg">๐ต</span> Spotify Song Requests
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Spotify Client ID</label>
                                <input
                                    type="text"
                                    value={settings.spotify_client_id || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, spotify_client_id: e.target.value }))}
                                    onBlur={() => handleSave('spotify_client_id', settings.spotify_client_id)}
                                    className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                    placeholder="Enter Spotify Client ID"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-subInk uppercase font-bold mb-1">Spotify Client Secret</label>
                                <input
                                    type="password"
                                    value={settings.spotify_client_secret || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, spotify_client_secret: e.target.value }))}
                                    onBlur={() => handleSave('spotify_client_secret', settings.spotify_client_secret)}
                                    className="w-full bg-canvas border border-gray-200 p-2.5 rounded-xl text-xs font-mono text-ink outline-none focus:border-brand"
                                    placeholder="Enter Spotify Client Secret"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                Get these credentials from <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline font-bold">Spotify Developer Dashboard</a> by creating a Web API application.
                            </p>
                        </div>
                    </div>

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



            </div>

                {/* Blocked Dates Management */}
                {/* Blocked Dates Management */}
                <div className="bg-paper p-6 md:p-8 rounded-3xl border border-gray-200 space-y-6 flex flex-col shadow-sm">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-ink flex items-center gap-2 mb-2">
                            <Calendar size={20} className="text-red-500" /> Blocked Dates
                        </h2>
                        <p className="text-xs text-subInk mb-6">Close bookings for specific days or ranges.</p>

                        <form onSubmit={handleBlockDates} className="flex flex-col gap-3 mb-6 bg-canvas p-4 rounded-xl border border-gray-200">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-subInk uppercase font-bold">เธงเธฑเธเธ—เธตเนเน€เธฃเธดเนเธกเธซเธขเธธเธ” (Start)</label>
                                    <input
                                        type="date"
                                        value={blockForm.startDate}
                                        onClick={(e) => e.target.showPicker?.()}
                                        onChange={e => setBlockForm({ ...blockForm, startDate: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-ink text-sm focus:border-brand outline-none cursor-pointer"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-subInk uppercase font-bold">เธ–เธถเธเธงเธฑเธเธ—เธตเน (End)</label>
                                    <input
                                        type="date"
                                        value={blockForm.endDate}
                                        min={blockForm.startDate}
                                        onClick={(e) => e.target.showPicker?.()}
                                        onChange={e => setBlockForm({ ...blockForm, endDate: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-ink text-sm focus:border-brand outline-none cursor-pointer"
                                    />
                                </div>
                            </div>
                            <input type="text" placeholder="Reason (e.g. Holiday)" value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-ink text-sm focus:border-brand outline-none" />
                            <button className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg text-sm transition-colors mt-1">Block Dates</button>
                        </form>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {blockedList.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-canvas p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                    <div>
                                        <div className="text-ink text-sm font-bold">{new Date(item.blocked_date).toLocaleDateString()}</div>
                                        <div className="text-xs text-subInk">{item.reason}</div>
                                    </div>
                                    <button onClick={() => handleDeleteBlockedDate(item.id)} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            {blockedList.length === 0 && (
                                <div className="text-center text-subInk text-xs py-10">No blocked dates</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Announcement Card Settings */}
            <div className="bg-paper p-8 rounded-3xl border border-gray-200 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-ink flex items-center gap-2">
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
                        className="flex items-center gap-2 bg-brand text-ink px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow"
                    >
                        <Save size={16} /> เธเธฑเธเธ—เธถเธ
                    </button>
                </div>
                <div>
                    <label className="block text-xs text-subInk mb-1">Headline (Bold)</label>
                    <input
                        type="text"
                        value={settings.announcement_headline || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, announcement_headline: e.target.value }))}
                        placeholder="e.g. BY เธฃเนเธฒเธเนเธเธเนเธฒเธ"
                        className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand"
                    />
                </div>
                <div>
                    <label className="block text-xs text-subInk mb-1">Detail (Marquee)</label>
                    <input
                        type="text"
                        value={settings.announcement_detail || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, announcement_detail: e.target.value }))}
                        placeholder="e.g. IN THE HAUS..."
                        className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand"
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Contact Phone</label>
                        <input
                            type="text"
                            value={settings.contact_phone || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
                            placeholder="e.g. 0812345678"
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand font-mono"
                        />
                     </div>
                     <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Google Maps URL</label>
                        <input
                            type="text"
                            value={settings.contact_map_url || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, contact_map_url: e.target.value }))}
                            placeholder="https://maps.google.com/..."
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand"
                        />
                     </div>
                </div>

                {/* --- New Policy & Rate Settings --- */}
                <div className="pt-4 border-t border-gray-100 space-y-4">
                    <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Minimum Spend per Person (THB)</label>
                        <input
                            type="number"
                            value={settings.booking_min_spend || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, booking_min_spend: e.target.value }))}
                            placeholder="e.g. 150"
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Min Advance Booking (Hours)</label>
                        <input
                            type="number"
                            value={settings.booking_min_advance_hours || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, booking_min_advance_hours: e.target.value }))}
                            placeholder="e.g. 2"
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Min Advance Pickup (Hours)</label>
                        <input
                            type="number"
                            value={settings.pickup_min_advance_hours || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, pickup_min_advance_hours: e.target.value }))}
                            placeholder="e.g. 1"
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Service Time Slots (Comma separated)</label>
                        <input
                            type="text"
                            value={settings.booking_time_slots || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, booking_time_slots: e.target.value }))}
                            placeholder="e.g. 11:00, 12:00, 13:00"
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Dine-in Policy (Before Pay)</label>
                        <textarea
                            rows={3}
                            value={settings.policy_dine_in || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, policy_dine_in: e.target.value }))}
                            placeholder="Message above the confirm checkbox..."
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-brandDark font-bold mb-1">Pickup Policy (Before Pay)</label>
                        <textarea
                            rows={3}
                            value={settings.policy_pickup || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, policy_pickup: e.target.value }))}
                            placeholder="Message above the confirm checkbox..."
                            className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* --- Sound Alert Settings --- */}
            <div className="bg-paper p-8 rounded-3xl border border-gray-200 space-y-6 mt-8 shadow-sm">
                <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                    <Volume2 className="text-brandDark" /> Sound Alert (Loop)
                </h2>
                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-canvas rounded-xl p-4 flex items-center justify-between border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brandDark">
                                <Bell size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-ink">Current Alert Sound</p>
                                <p className="text-xs text-subInk">
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
                    <label className="block text-xs font-bold text-subInk uppercase mb-2">
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
                        className="block w-full text-sm text-subInk
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-xs file:font-semibold
                        file:bg-brand file:text-ink
                        hover:file:bg-brand/80
                        cursor-pointer"
                    />
                    <p className="mt-2 text-xs text-gray-400">{uploadingSound ? 'Uploading...' : 'Recommended: Short loopable sound'}</p>
                </div>
            </div>



            {/* Floor Plan & QR */}
            {/* QR Code Section */}
            <div className="bg-paper p-8 rounded-3xl border border-gray-200 shadow-sm">
                <h2 className="text-xl font-bold text-ink mb-2">QR Payment</h2>
                <div className="mb-6 flex justify-center">
                    {settings.payment_qr_url ? (
                        <img src={`${settings.payment_qr_url}?t=${timestamp}`} className="w-48 h-48 object-cover rounded-2xl border-2 border-brand" />
                    ) : (
                        <div className="w-48 h-48 bg-gray-100 rounded-2xl flex items-center justify-center text-subInk">No QR</div>
                    )}
                </div>
                <label className="block w-full cursor-pointer group">
                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-4 text-center group-hover:border-brand transition-colors">
                        <span className="text-subInk text-sm group-hover:text-ink">{uploadingQr ? 'Uploading...' : 'Click to replace QR'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'payment_qr_url', setUploadingQr)} />
                </label>
                <p className="text-[10px] text-gray-400 mt-2 text-center">Recommended: Square image (1:1), JPG/PNG, Max 500KB</p>
            </div>

            {/* Floor Plan Section */}
            <div className="bg-paper p-8 rounded-3xl border border-gray-200 shadow-sm mt-8">
                <h2 className="text-xl font-bold text-ink mb-2">Floor Plan</h2>
                <div className="mb-6">
                    {settings.floorplan_url ? (
                        <img src={`${settings.floorplan_url}?t=${timestamp}`} className="w-full h-40 object-cover rounded-2xl border border-gray-200 opacity-90" />
                    ) : (
                        <div className="w-full h-40 bg-gray-100 rounded-2xl flex items-center justify-center text-subInk">No Plan</div>
                    )}
                </div>
                <label className="block w-full cursor-pointer group">
                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-4 text-center group-hover:border-brand transition-colors">
                        <span className="text-subInk text-sm group-hover:text-ink">{uploadingFloor ? 'Uploading...' : 'Click to replace Floor Plan'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'floorplan_url', setUploadingFloor)} />
                </label>
                <p className="text-[10px] text-gray-400 mt-2 text-center">Recommended: Landscape (16:9), High resolution, Max 2MB</p>
            </div>

            {/* Home Background Section */}
            <div className="bg-paper p-8 rounded-3xl border border-gray-200 mt-8 shadow-sm">
                <h2 className="text-xl font-bold text-ink mb-2">Home Background</h2>
                <div className="mb-6">
                    {settings.home_background_url ? (
                        <img src={`${settings.home_background_url}?t=${timestamp}`} className="w-full h-40 object-cover rounded-2xl border border-gray-200 opacity-90" />
                    ) : (
                        <div className="w-full h-40 bg-gray-100 rounded-2xl flex items-center justify-center text-subInk">Default (Ken Burns)</div>
                    )}
                </div>
                <label className="block w-full cursor-pointer group">
                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-4 text-center group-hover:border-brand transition-colors">
                        <span className="text-subInk text-sm group-hover:text-ink">{uploadingHomeBg ? 'Uploading...' : 'Click to replace Home Background'}</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload(e.target.files[0], 'home_background_url', setUploadingHomeBg)} />
                </label>
                <div className="flex justify-between items-center mt-2">
                     <p className="text-[10px] text-gray-400 text-center">Recommended: 1920x1080 (HD), Dark Tone, Max 2MB</p>
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

            {/* โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ• LINK PAGE MANAGER โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ• */}
            <LinkPageManager 
                settings={settings} 
                handleSave={handleSave} 
                handleUpload={handleUpload}
                timestamp={timestamp}
                setTimestamp={setTimestamp}
            />

            {/* Steak Wizard Settings */}
            <div className="bg-paper p-8 rounded-3xl border border-gray-200 space-y-6 mt-8 shadow-sm">
                 <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                    ๐ฅฉ Steak Wizard Config
                </h2>
                
                {/* Special Details */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brandDark uppercase border-b border-gray-200 pb-2">Special Details Texts</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-subInk mb-1">Cake Request Label</label>
                            <input 
                                value={settings.steak_qt_cake_label || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_cake_label: e.target.value})}
                                onBlur={() => handleSave('steak_qt_cake_label', settings.steak_qt_cake_label)}
                                placeholder="Cake / Special Decoration Request"
                                className="w-full bg-canvas border border-gray-200 p-2 rounded-lg text-ink text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-subInk mb-1">Cake Placeholder</label>
                            <input 
                                value={settings.steak_qt_cake_placeholder || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_cake_placeholder: e.target.value})}
                                onBlur={() => handleSave('steak_qt_cake_placeholder', settings.steak_qt_cake_placeholder)}
                                placeholder="Need a cake? Write here..."
                                className="w-full bg-canvas border border-gray-200 p-2 rounded-lg text-ink text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-subInk mb-1">Dietary Label</label>
                            <input 
                                value={settings.steak_qt_dietary_label || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_dietary_label: e.target.value})}
                                onBlur={() => handleSave('steak_qt_dietary_label', settings.steak_qt_dietary_label)}
                                placeholder="Dietary Restrictions / Allergies"
                                className="w-full bg-canvas border border-gray-200 p-2 rounded-lg text-ink text-sm"
                            />
                        </div>
                         <div>
                            <label className="block text-xs text-subInk mb-1">Dietary Placeholder</label>
                            <input 
                                value={settings.steak_qt_dietary_placeholder || ''} 
                                onChange={(e) => setSettings({...settings, steak_qt_dietary_placeholder: e.target.value})}
                                onBlur={() => handleSave('steak_qt_dietary_placeholder', settings.steak_qt_dietary_placeholder)}
                                placeholder="e.g. No Nuts"
                                className="w-full bg-canvas border border-gray-200 p-2 rounded-lg text-ink text-sm"
                            />
                        </div>
                    </div>
                </div>

                </div>

                {/* Add-ons Configuration (Cake & Flower) */}
                <div className="space-y-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-brandDark uppercase border-b border-gray-200 pb-2">Add-ons Configuration</h3>
                    
                    {/* Cake Config */}
                    <div className="bg-canvas p-4 rounded-2xl border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.steak_addon_cake_enabled === 'true' ? 'bg-brand/20 text-brandDark' : 'bg-gray-200 text-gray-500'}`}>
                                    <Cake size={16} />
                                </div>
                                <span className={`text-sm font-bold ${settings.steak_addon_cake_enabled === 'true' ? 'text-ink' : 'text-subInk'}`}>
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
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                            </label>
                        </div>
                        
                        <div className={`grid md:grid-cols-2 gap-4 transition-all ${settings.steak_addon_cake_enabled === 'true' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div>
                                 <label className="block text-xs text-subInk mb-1">Display Name (Label)</label>
                                 <input 
                                    value={settings.steak_addon_cake_name || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_cake_name: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_cake_name', settings.steak_addon_cake_name)}
                                    placeholder="e.g. เธฃเธฑเธเน€เธเนเธ (Receive Cake)"
                                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-ink text-sm"
                                 />
                            </div>
                            <div>
                                <label className="block text-xs text-subInk mb-1">Price (THB)</label>
                                <input 
                                    type="number"
                                    value={settings.steak_addon_cake_price || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_cake_price: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_cake_price', settings.steak_addon_cake_price)}
                                    placeholder="1000"
                                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-ink text-sm font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flower Config */}
                    <div className="bg-canvas p-4 rounded-2xl border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${settings.steak_addon_flower_enabled === 'true' ? 'bg-brand/20 text-brandDark' : 'bg-gray-200 text-gray-500'}`}>
                                    <Heart size={16} />
                                </div>
                                <span className={`text-sm font-bold ${settings.steak_addon_flower_enabled === 'true' ? 'text-ink' : 'text-subInk'}`}>
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
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                            </label>
                        </div>
                        
                        <div className={`grid md:grid-cols-2 gap-4 transition-all ${settings.steak_addon_flower_enabled === 'true' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div>
                                 <label className="block text-xs text-subInk mb-1">Display Name (Label)</label>
                                 <input 
                                    value={settings.steak_addon_flower_name || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_flower_name: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_flower_name', settings.steak_addon_flower_name)}
                                    placeholder="e.g. เธฃเธฑเธเธ”เธญเธเนเธกเน (Receive Flower)"
                                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-ink text-sm"
                                 />
                            </div>
                            <div>
                                <label className="block text-xs text-subInk mb-1">Price (THB)</label>
                                <input 
                                    type="number"
                                    value={settings.steak_addon_flower_price || ''} 
                                    onChange={(e) => setSettings({...settings, steak_addon_flower_price: e.target.value})}
                                    onBlur={() => handleSave('steak_addon_flower_price', settings.steak_addon_flower_price)}
                                    placeholder="1000"
                                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-ink text-sm font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Wine List Manager */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-brandDark uppercase border-b border-gray-200 pb-2">Wine List Manager</h3>
                    
                    {/* Render List */}
                    <div className="space-y-2">
                        {(() => {
                            let wines = []
                            try { wines = JSON.parse(settings.steak_wine_list || '[]') } catch (e) { wines = [] }
                            
                            return wines.map((wine, idx) => (
                                <div key={idx} className="bg-canvas border border-gray-200 p-3 rounded-xl flex items-center justify-between gap-4">
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
                                            className="bg-white border border-gray-200 rounded px-2 py-1 text-ink text-xs"
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
                                            className="bg-white border border-gray-200 rounded px-2 py-1 text-ink text-xs font-mono"
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
                                            className="bg-white border border-gray-200 rounded px-2 py-1 text-subInk text-xs"
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
                        className="w-full py-2 border border-dashed border-gray-300 text-subInk text-xs rounded-xl hover:border-brand hover:text-brandDark transition-colors"
                    >
                        + Add New Wine
                    </button>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="pt-2">
                             <label className="block text-xs text-subInk mb-1">Corkage Fee (Label)</label>
                             <input 
                                value={settings.steak_corkage_fee || ''} 
                                onChange={(e) => setSettings({...settings, steak_corkage_fee: e.target.value})}
                                onBlur={() => handleSave('steak_corkage_fee', settings.steak_corkage_fee)}
                                placeholder="Corkage Fee"
                                className="w-full bg-white border border-gray-200 p-2 rounded-lg text-ink text-sm"
                            />
                        </div>
                        <div className="pt-2">
                             <label className="block text-xs text-subInk mb-1">Corkage Price (THB)</label>
                             <input 
                                type="number"
                                value={settings.steak_corkage_price || '0'} 
                                onChange={(e) => setSettings({...settings, steak_corkage_price: e.target.value})}
                                onBlur={() => handleSave('steak_corkage_price', settings.steak_corkage_price)}
                                placeholder="0"
                                className="w-full bg-white border border-gray-200 p-2 rounded-lg text-ink text-sm font-mono"
                            />
                        </div>
                    </div>
                </div>


            {/* Data Maintenance Section */}
            <div className="mt-8 bg-paper p-8 rounded-3xl border border-gray-200 space-y-6 shadow-sm">
                <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                    <span className="text-red-500">โ </span> Data Maintenance
                </h2>
                <div className="flex items-center justify-between p-4 border border-red-100 rounded-2xl bg-red-50/50">
                    <div>
                        <h3 className="font-bold text-ink">Clean Old Slips (&gt;180 Days)</h3>
                        <p className="text-xs text-subInk mt-1">
                            เธฅเธเธฃเธนเธเธชเธฅเธดเธเธ—เธตเนเน€เธเนเธฒเธเธงเนเธฒ 180 เธงเธฑเธ (6 เน€เธ”เธทเธญเธ) เธญเธญเธเธเธฒเธ Storage เน€เธเธทเนเธญเธเธฃเธฐเธซเธขเธฑเธ”เธเธทเนเธเธ—เธตเน (เธเนเธญเธกเธนเธฅเธเธฒเธฃเธเธญเธเธขเธฑเธเธญเธขเธนเน)
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            if (!window.confirm('Are you sure you want to delete slip images older than 180 days (6 months)?')) return

                            try {
                                setLoading(true)
                                // 1. Calculate Date 180 Days Ago
                                const d = new Date()
                                d.setDate(d.getDate() - 180)
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
                        className="px-6 py-3 bg-white text-red-500 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Cleaning...' : 'Clean Now'}
                    </button>
                </div>
            </div>

        </div>
    )
}

// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
// Link Page Manager โ€” Admin UI for /link landing page
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
function LinkPageManager({ settings, handleSave, timestamp, setTimestamp }) {
    const [uploading, setUploading] = useState({})
    const [menuUrls, setMenuUrls] = useState([])
    const [atmUrls, setAtmUrls] = useState([])

    useEffect(() => {
        const urls = []
        for (let i = 1; i <= 10; i++) {
            const url = settings[`link_menu_${i}`]
            if (url) urls.push({ slot: i, url })
        }
        setMenuUrls(urls)

        const aUrls = []
        for (let i = 1; i <= 10; i++) {
            const url = settings[`link_atm_${i}`]
            if (url) aUrls.push({ slot: i, url })
        }
        setAtmUrls(aUrls)
    }, [settings])

    // Auto-resize image before upload (max 1200px width, converts to WebP with JPEG fallback, 0.8 quality)
    const resizeImage = (file, maxWidth = 1200) => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    const scale = Math.min(1, maxWidth / img.width)
                    canvas.width = img.width * scale
                    canvas.height = img.height * scale
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                    
                    // Detect webp support via canvas
                    let type = 'image/webp'
                    let ext = '.webp'
                    try {
                        const testData = canvas.toDataURL('image/webp')
                        if (!testData.startsWith('data:image/webp')) {
                            type = 'image/jpeg'
                            ext = '.jpg'
                        }
                    } catch (err) {
                        type = 'image/jpeg'
                        ext = '.jpg'
                    }

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type, lastModified: Date.now() }))
                    }, type, 0.8)
                }
                img.src = e.target.result
            }
            reader.readAsDataURL(file)
        })
    }

    const uploadImage = async (file, settingKey) => {
        if (!file) return
        setUploading(prev => ({ ...prev, [settingKey]: true }))
        try {
            // Optimize signature images to 600px width, others to 1200px
            const maxWidth = settingKey.startsWith('link_sig_img_') ? 600 : 1200
            // Resize image before uploading
            const resized = await resizeImage(file, maxWidth)
            const ext = resized.name.split('.').pop()
            const fileName = `link/${settingKey}_${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('public-assets').upload(fileName, resized, { upsert: true, contentType: resized.type, cacheControl: '15552000' })
            if (uploadError) throw uploadError
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)
            await handleSave(settingKey, publicUrl)
            setTimestamp(Date.now())
        } catch (error) {
            alert('Upload error: ' + error.message)
        } finally {
            setUploading(prev => ({ ...prev, [settingKey]: false }))
        }
    }

    const uploadVideo = async (file) => {
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (!['mp4', 'mov'].includes(ext)) {
            alert('เธฃเธญเธเธฃเธฑเธเน€เธเธเธฒเธฐเนเธเธฅเน .mp4 เนเธฅเธฐ .mov เน€เธ—เนเธฒเธเธฑเนเธ')
            return
        }
        // Limit 50MB
        if (file.size > 50 * 1024 * 1024) {
            alert('เนเธเธฅเนเธงเธดเธ”เธตเนเธญเธ•เนเธญเธเนเธกเนเน€เธเธดเธ 50MB')
            return
        }
        setUploading(prev => ({ ...prev, link_video_url: true }))
        try {
            const fileName = `link/video_${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('public-assets').upload(fileName, file, { upsert: true, contentType: ext === 'mp4' ? 'video/mp4' : 'video/quicktime', cacheControl: '15552000' })
            if (uploadError) throw uploadError
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)
            await handleSave('link_video_url', publicUrl)
            setTimestamp(Date.now())
            alert('เธญเธฑเธเนเธซเธฅเธ”เธงเธดเธ”เธตเนเธญเธชเธณเน€เธฃเนเธ!')
        } catch (error) {
            alert('Upload error: ' + error.message)
        } finally {
            setUploading(prev => ({ ...prev, link_video_url: false }))
        }
    }

    const uploadFoodVideo = async (file) => {
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        if (!['mp4', 'mov'].includes(ext)) {
            alert('เธฃเธญเธเธฃเธฑเธเน€เธเธเธฒเธฐเนเธเธฅเน .mp4 เนเธฅเธฐ .mov เน€เธ—เนเธฒเธเธฑเนเธ')
            return
        }
        if (file.size > 50 * 1024 * 1024) {
            alert('เนเธเธฅเนเธงเธดเธ”เธตเนเธญเธ•เนเธญเธเนเธกเนเน€เธเธดเธ 50MB')
            return
        }
        setUploading(prev => ({ ...prev, link_food_video_url: true }))
        try {
            const fileName = `link/food_video_${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('public-assets').upload(fileName, file, { upsert: true, contentType: ext === 'mp4' ? 'video/mp4' : 'video/quicktime', cacheControl: '15552000' })
            if (uploadError) throw uploadError
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName)
            await handleSave('link_food_video_url', publicUrl)
            setTimestamp(Date.now())
            alert('เธญเธฑเธเนเธซเธฅเธ”เธงเธดเธ”เธตเนเธญเธชเธณเน€เธฃเนเธ!')
        } catch (error) {
            alert('Upload error: ' + error.message)
        } finally {
            setUploading(prev => ({ ...prev, link_food_video_url: false }))
        }
    }

    const handleMenuUpload = async (files) => {
        if (!files || files.length === 0) return
        const fileArr = Array.from(files)
        let nextSlot = 1
        for (let i = 1; i <= 10; i++) {
            if (!settings[`link_menu_${i}`]) { nextSlot = i; break }
            if (i === 10 && settings[`link_menu_${i}`]) { alert('เน€เธกเธเธนเน€เธ•เนเธก 10 เธฃเธนเธเนเธฅเนเธง'); return }
            nextSlot = i + 1
        }
        for (const file of fileArr) {
            if (nextSlot > 10) break
            await uploadImage(file, `link_menu_${nextSlot}`)
            nextSlot++
        }
        alert(`เธญเธฑเธเนเธซเธฅเธ”เน€เธกเธเธนเธชเธณเน€เธฃเนเธ ${fileArr.length} เธฃเธนเธ!`)
    }

    const handleDeleteMenu = async (slot) => {
        if (!confirm('เธฅเธเธฃเธนเธเน€เธกเธเธนเธเธตเน?')) return
        await handleSave(`link_menu_${slot}`, '')
        const remaining = []
        for (let i = 1; i <= 10; i++) {
            if (i === slot) continue
            const url = settings[`link_menu_${i}`]
            if (url) remaining.push(url)
        }
        for (let i = 1; i <= 10; i++) {
            await handleSave(`link_menu_${i}`, remaining[i - 1] || '')
        }
    }

    const handleAtmUpload = async (files) => {
        if (!files || files.length === 0) return
        const fileArr = Array.from(files)
        let nextSlot = 1
        for (let i = 1; i <= 10; i++) {
            if (!settings[`link_atm_${i}`]) { nextSlot = i; break }
            if (i === 10 && settings[`link_atm_${i}`]) { alert('เธฃเธนเธเธเธฃเธฃเธขเธฒเธเธฒเธจเน€เธ•เนเธก 10 เธฃเธนเธเนเธฅเนเธง'); return }
            nextSlot = i + 1
        }
        for (const file of fileArr) {
            if (nextSlot > 10) break
            await uploadImage(file, `link_atm_${nextSlot}`)
            nextSlot++
        }
        alert(`เธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธเธฃเธฃเธขเธฒเธเธฒเธจเธชเธณเน€เธฃเนเธ ${fileArr.length} เธฃเธนเธ!`)
    }

    const handleDeleteAtm = async (slot) => {
        if (!confirm('เธฅเธเธฃเธนเธเธเธฃเธฃเธขเธฒเธเธฒเธจเธเธตเน?')) return
        await handleSave(`link_atm_${slot}`, '')
        const remaining = []
        for (let i = 1; i <= 10; i++) {
            if (i === slot) continue
            const url = settings[`link_atm_${i}`]
            if (url) remaining.push(url)
        }
        for (let i = 1; i <= 10; i++) {
            await handleSave(`link_atm_${i}`, remaining[i - 1] || '')
        }
    }

    // Helper: image upload block
    const ImageUploadBlock = ({ settingKey, label, aspect = 'aspect-video', placeholder }) => (
        <div className="space-y-2">
            <label className="block text-xs font-bold text-brandDark uppercase">{label}</label>
            <div className={`relative w-full ${aspect} rounded-2xl overflow-hidden bg-gray-100 border border-gray-200`}>
                {settings[settingKey] ? (
                    <img src={`${settings[settingKey]}?t=${timestamp}`} className="w-full h-full object-cover" alt={label} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-subInk text-sm">{placeholder || 'เธขเธฑเธเนเธกเนเธกเธตเธฃเธนเธ'}</div>
                )}
            </div>
            <div className="flex gap-2">
                <label className="flex-1 cursor-pointer group">
                    <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-2.5 text-center group-hover:border-brand transition-colors">
                        <span className="text-subInk text-xs group-hover:text-ink">
                            {uploading[settingKey] ? 'เธเธณเธฅเธฑเธเธญเธฑเธเนเธซเธฅเธ”...' : '๐“ธ เน€เธฅเธทเธญเธเธฃเธนเธ'}
                        </span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], settingKey)} />
                </label>
                {settings[settingKey] && (
                    <button onClick={() => handleSave(settingKey, '')} className="text-xs text-red-500 hover:text-red-400 px-2">เธฅเธ</button>
                )}
            </div>
        </div>
    )

    return (
        <div className="bg-paper p-8 rounded-3xl border border-gray-200 space-y-6 mt-8 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ink flex items-center gap-2">๐”— Link Page Manager</h2>
                <a href="/link" target="_blank" className="text-xs bg-zinc-800 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-zinc-700 transition-colors">
                    เธ”เธนเธซเธเนเธฒ /link โ’
                </a>
            </div>
            <p className="text-xs text-subInk -mt-4">เธเธฑเธ”เธเธฒเธฃเธฃเธนเธเธ เธฒเธ, เน€เธกเธเธน เนเธฅเธฐเธเนเธญเธเธงเธฒเธกเธชเธณเธซเธฃเธฑเธ Landing Page (/link)</p>

            {/* Logo */}
            <div className="max-w-xs">
                <ImageUploadBlock settingKey="link_logo_url" label="Logo (เนเธฅเนเธเน)" aspect="aspect-square" placeholder="เธขเธฑเธเนเธกเนเธกเธตเนเธฅเนเธเน" />
            </div>

            {/* Text Fields */}
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">เธเธทเนเธญเธฃเนเธฒเธ EN (Shop Name)</label>
                    <input type="text" value={settings.link_shop_name || ''} onChange={(e) => handleSave('link_shop_name', e.target.value)}
                        placeholder="IN THE HAUS" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">เธเธทเนเธญเธฃเนเธฒเธ TH</label>
                    <input type="text" value={settings.link_shop_name_th || ''} onChange={(e) => handleSave('link_shop_name_th', e.target.value)}
                        placeholder="เนเธเธเนเธฒเธ" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">Subtitle / Tagline</label>
                    <input type="text" value={settings.link_subtitle || ''} onChange={(e) => handleSave('link_subtitle', e.target.value)}
                        placeholder="เธเธฃเธดเธ•เธเธฑเธ” เธฃเธชเธเธฑเธ”เน€เธเธ" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-brandDark uppercase mb-1">เน€เธงเธฅเธฒเน€เธเธดเธ”-เธเธดเธ”</label>
                    <input type="text" value={settings.link_hours || ''} onChange={(e) => handleSave('link_hours', e.target.value)}
                        placeholder="เน€เธเธดเธ”เธ—เธธเธเธงเธฑเธ 11:30 - 23:30 เธ." className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-brandDark uppercase mb-1">๐“ เธ—เธตเนเธญเธขเธนเน (Location Text)</label>
                <input type="text" value={settings.link_location_text || ''} onChange={(e) => handleSave('link_location_text', e.target.value)}
                    placeholder="เธฃเธดเธกเนเธกเนเธเนเธณเนเธเธ ยท เธเธเธฃเธเธเธก" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand" />
            </div>
            <div>
                <label className="block text-xs font-bold text-brandDark uppercase mb-1">#๏ธโฃ Hashtags (เธเธฑเนเธเธ”เนเธงเธข comma)</label>
                <input type="text" value={settings.link_tags || ''} onChange={(e) => handleSave('link_tags', e.target.value)}
                    placeholder="#inthehausth, #homefood, #southernthaifood" className="w-full bg-canvas border border-gray-200 p-3 rounded-xl text-ink outline-none focus:border-brand font-mono text-sm" />
                <p className="text-[10px] text-gray-400 mt-1">เนเธชเน # เธเธณเธซเธเนเธฒ เธเธฑเนเธเธ”เนเธงเธข comma เน€เธเนเธ #tag1, #tag2, #tag3</p>
            </div>

            {/* Signature Dishes */}
            <div className="space-y-4 border-t border-gray-100 pt-6">
                <label className="block text-xs font-bold text-brandDark uppercase">๐ฝ Signature Dishes (เน€เธกเธเธนเนเธเธฐเธเธณ เธชเธนเธเธชเธธเธ” 3 เธเธฒเธ)</label>
                <p className="text-[10px] text-subInk -mt-2">เธ–เนเธฒเนเธกเนเนเธชเนเธเธฐเนเธกเนเนเธชเธ”เธเธชเนเธงเธเธเธตเนเนเธเธซเธเนเธฒ /link</p>
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(n => (
                        <div key={n} className="space-y-2 bg-canvas p-3 rounded-xl border border-gray-200">
                            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                {settings[`link_sig_img_${n}`] ? (
                                    <img src={`${settings[`link_sig_img_${n}`]}?t=${timestamp}`} className="w-full h-full object-cover" alt={`Sig ${n}`} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-subInk text-[10px]">#{n}</div>
                                )}
                            </div>
                            <label className="block cursor-pointer">
                                <div className="text-center text-[10px] text-subInk hover:text-ink py-1 border border-dashed border-gray-300 rounded-lg cursor-pointer">
                                    {uploading[`link_sig_img_${n}`] ? '...' : '๐“ธ'}
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], `link_sig_img_${n}`)} />
                            </label>
                            <input type="text" value={settings[`link_sig_name_${n}`] || ''} onChange={(e) => handleSave(`link_sig_name_${n}`, e.target.value)}
                                placeholder="เธเธทเนเธญเน€เธกเธเธน" className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-ink text-xs outline-none focus:border-brand" />
                            <input type="text" value={settings[`link_sig_price_${n}`] || ''} onChange={(e) => handleSave(`link_sig_price_${n}`, e.target.value)}
                                placeholder="เธฃเธฒเธเธฒ" className="w-full bg-white border border-gray-200 p-1.5 rounded-lg text-ink text-xs outline-none focus:border-brand font-mono" />
                            {settings[`link_sig_img_${n}`] && (
                                <button onClick={() => { handleSave(`link_sig_img_${n}`, ''); handleSave(`link_sig_name_${n}`, ''); handleSave(`link_sig_price_${n}`, ''); }}
                                    className="text-[10px] text-red-500 hover:text-red-400 w-full text-center">เธฅเธ</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Video Upload */}
            <div className="space-y-3 border-t border-gray-100 pt-6">
                <label className="block text-xs font-bold text-brandDark uppercase">๐ฌ เธงเธดเธ”เธตเนเธญเธชเธฑเนเธ (Short Video Loop)</label>
                <p className="text-[10px] text-subInk -mt-1">เธญเธฑเธเนเธซเธฅเธ”เธงเธดเธ”เธตเนเธญเธชเธฑเนเธเน (.mp4, .mov) เธชเธนเธเธชเธธเธ” 50MB เธเธฐเนเธชเธ”เธเน€เธเนเธ loop เนเธ•เน Signature Dishes</p>
                {settings.link_video_url ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-black">
                        <video src={`${settings.link_video_url}?t=${timestamp}`} autoPlay loop muted playsInline className="w-full h-auto max-h-64 object-contain" />
                        <button onClick={() => handleSave('link_video_url', '')} className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors">เธฅเธเธงเธดเธ”เธตเนเธญ</button>
                    </div>
                ) : (
                    <label className="block w-full cursor-pointer group">
                        <div className="bg-canvas border-2 border-dashed border-gray-300 rounded-xl p-6 text-center group-hover:border-brand transition-colors">
                            <span className="text-3xl block mb-2">๐ฌ</span>
                            <span className="text-subInk text-sm group-hover:text-ink block">
                                {uploading.link_video_url ? 'เธเธณเธฅเธฑเธเธญเธฑเธเนเธซเธฅเธ”...' : 'เน€เธฅเธทเธญเธเธงเธดเธ”เธตเนเธญ (.mp4, .mov)'}
                            </span>
                            <span className="text-[10px] text-gray-400 mt-1 block">เนเธเธฐเธเธณ: เธเธงเธฒเธกเธขเธฒเธง 5-15 เธงเธดเธเธฒเธ—เธต, เธชเธนเธเธชเธธเธ” 50MB</span>
                        </div>
                        <input type="file" className="hidden" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(e) => uploadVideo(e.target.files[0])} />
                    </label>
        )}
            </div>

            {/* Food Vertical Video Upload */}
            <div className="space-y-3 border-t border-gray-100 pt-6">
                <label className="block text-xs font-bold text-brandDark uppercase">๐“ฑ เธงเธดเธ”เธตเนเธญเธเธญเธเน€เธ—เธเธ•เนเธญเธฒเธซเธฒเธฃ (Vertical 9:16)</label>
                <p className="text-[10px] text-subInk -mt-1">เธญเธฑเธเนเธซเธฅเธ”เธงเธดเธ”เธตเนเธญเนเธเธงเธ•เธฑเนเธเน€เธเธตเนเธขเธงเธเธฑเธเธญเธฒเธซเธฒเธฃ (.mp4, .mov)</p>
                {settings.link_food_video_url ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-black aspect-[9/16] max-w-sm mx-auto">
                        <video src={`${settings.link_food_video_url}?t=${timestamp}`} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        <button onClick={() => handleSave('link_food_video_url', '')} className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition-colors">เธฅเธเธงเธดเธ”เธตเนเธญ</button>
                    </div>
                ) : (
                    <label className="block w-full cursor-pointer group">
                        <div className="bg-canvas border-2 border-dashed border-gray-300 rounded-xl p-6 text-center group-hover:border-brand transition-colors">
                            <span className="text-3xl block mb-2">๐“ฑ</span>
                            <span className="text-subInk text-sm group-hover:text-ink block">
                                {uploading.link_food_video_url ? 'เธเธณเธฅเธฑเธเธญเธฑเธเนเธซเธฅเธ”...' : 'เน€เธฅเธทเธญเธเธงเธดเธ”เธตเนเธญเนเธเธงเธ•เธฑเนเธ (.mp4, .mov)'}
                            </span>
                            <span className="text-[10px] text-gray-400 mt-1 block">เนเธเธฐเธเธณ: เธญเธฑเธ•เธฃเธฒเธชเนเธงเธ 9:16, เธชเธนเธเธชเธธเธ” 50MB</span>
                        </div>
                        <input type="file" className="hidden" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(e) => uploadFoodVideo(e.target.files[0])} />
                    </label>
                )}
            </div>

            {/* Atmosphere Images Manager */}
            <div className="space-y-3 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-brandDark uppercase">โจ เธเธฃเธฃเธขเธฒเธเธฒเธจเธฃเนเธฒเธ (Atmosphere Images)</label>
                    <span className="text-subInk text-[10px]">เธฃเธฐเธเธธเธ•เธณเนเธซเธเนเธเธฃเธนเธเธเธฃเธฃเธขเธฒเธเธฒเธจเธ—เธตเนเธเธฐเนเธชเธ”เธเนเธเนเธเธฅเน€เธฅเธญเธฃเธต (เธฃเธนเธเธ—เธตเน 1 เธเธฐเนเธชเธ”เธเน€เธเนเธเธฃเธนเธเนเธฃเธเธชเธธเธ”)</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(slot => {
                        const url = settings[`link_atm_${slot}`];
                        const isFirst = slot === 1;
                        return (
                            <div key={slot} className={`bg-canvas p-2 rounded-xl border flex flex-col justify-between ${isFirst ? 'border-brand ring-1 ring-brand bg-brand/5' : 'border-gray-200'}`}>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[9px] font-bold ${isFirst ? 'text-ink' : 'text-subInk'}`}>
                                            เธฃเธนเธเธ—เธตเน #{slot} {isFirst ? '(เธซเธเนเธฒเธเธ)' : ''}
                                        </span>
                                    </div>

                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-150 border border-gray-200 flex items-center justify-center">
                                        {url ? (
                                            <img src={`${url}?t=${timestamp}`} alt={`Atm ${slot}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center text-gray-300 text-xs font-bold font-mono">Empty</div>
                                        )}
                                        {uploading[`link_atm_${slot}`] && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-col gap-1">
                                    <label className="w-full cursor-pointer">
                                        <div className="bg-white border border-gray-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-md py-1 text-[9px] font-bold text-center transition-all cursor-pointer">
                                            {url ? '๐” เน€เธเธฅเธตเนเธขเธเธฃเธนเธ' : '๐“ธ เธญเธฑเธเนเธซเธฅเธ”'}
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], `link_atm_${slot}`)} />
                                    </label>
                                    {url && (
                                        <div className="flex gap-1 w-full">
                                            <button
                                                onClick={() => handleSave(`link_atm_${slot}`, '')}
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="เธฅเธเน€เธเธเธฒเธฐเธเนเธญเธเธเธตเน"
                                            >
                                                เธฅเธเธฃเธนเธ
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAtm(slot)}
                                                className="flex-1 bg-neutral-100 hover:bg-neutral-250 text-neutral-600 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="เธฅเธเนเธฅเธฐเน€เธฅเธทเนเธญเธเธเธดเธงเธ เธฒเธเธ–เธฑเธ”เนเธเธกเธฒเนเธ—เธเธ—เธตเน"
                                            >
                                                เธฅเธ & เน€เธฅเธทเนเธญเธ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-3">
                    <label className="block w-full cursor-pointer group">
                        <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-3 text-center group-hover:border-brand transition-colors">
                            <span className="text-subInk text-xs group-hover:text-ink block">โก เธญเธฑเธเนเธซเธฅเธ”เน€เธเธดเนเธกเธซเธฅเธฒเธขเธฃเธนเธเธเธฃเนเธญเธกเธเธฑเธ (เธเธฐเธชเธธเนเธกเน€เธเนเธฒเธเนเธญเธเธงเนเธฒเธเธ–เธฑเธ”เนเธเนเธ”เธขเธญเธฑเธ•เนเธเธกเธฑเธ•เธด)</span>
                        </div>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleAtmUpload(e.target.files)} />
                    </label>
                </div>
            </div>

            {/* Menu Images Manager */}
            <div className="space-y-3 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-brandDark uppercase">๐“– เน€เธกเธเธน (Menu Images)</label>
                    <span className="text-subInk text-[10px]">เธฃเธฐเธเธธเธ•เธณเนเธซเธเนเธเธ•เธฒเธกเธซเธเนเธฒเธ—เธตเนเนเธชเธ”เธเธเธเน€เธงเนเธ (เธซเธเนเธฒ 5 เธเธทเธญเนเธเธฃเนเธกเธเธฑเนเธเธเธดเน€เธจเธฉ)</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(slot => {
                        const url = settings[`link_menu_${slot}`];
                        const isPromo = slot === 5;
                        return (
                            <div key={slot} className={`bg-canvas p-2 rounded-xl border flex flex-col justify-between ${isPromo ? 'border-red-200 ring-1 ring-red-100 bg-red-50/20' : 'border-gray-200'}`}>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[9px] font-bold ${isPromo ? 'text-red-500' : 'text-subInk'}`}>
                                            เธซเธเนเธฒ #{slot} {isPromo ? '(เนเธเธฃเนเธกเธเธฑเนเธ)' : '(เน€เธกเธเธนเธซเธฅเธฑเธ)'}
                                        </span>
                                    </div>

                                    <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-gray-150 border border-gray-205 flex items-center justify-center">
                                        {url ? (
                                            <img src={`${url}?t=${timestamp}`} alt={`Menu ${slot}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center text-gray-300 text-xs font-bold font-mono">Empty</div>
                                        )}
                                        {uploading[`link_menu_${slot}`] && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-col gap-1">
                                    <label className="w-full cursor-pointer">
                                        <div className="bg-white border border-gray-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-md py-1 text-[9px] font-bold text-center transition-all cursor-pointer">
                                            {url ? '๐” เน€เธเธฅเธตเนเธขเธเธฃเธนเธ' : '๐“ธ เธญเธฑเธเนเธซเธฅเธ”'}
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadImage(e.target.files[0], `link_menu_${slot}`)} />
                                    </label>
                                    {url && (
                                        <div className="flex gap-1 w-full">
                                            <button
                                                onClick={() => handleSave(`link_menu_${slot}`, '')}
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="เธฅเธเน€เธเธเธฒเธฐเธเนเธญเธเธเธตเน"
                                            >
                                                เธฅเธเธฃเธนเธ
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMenu(slot)}
                                                className="flex-1 bg-neutral-100 hover:bg-neutral-250 text-neutral-600 rounded-md py-0.5 text-[8px] font-bold transition-all text-center"
                                                title="เธฅเธเนเธฅเธฐเน€เธฅเธทเนเธญเธเธเธดเธงเธ เธฒเธเธ–เธฑเธ”เนเธเธกเธฒเนเธ—เธเธ—เธตเน"
                                            >
                                                เธฅเธ & เน€เธฅเธทเนเธญเธ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-3">
                    <label className="block w-full cursor-pointer group">
                        <div className="bg-canvas border border-dashed border-gray-300 rounded-xl p-3 text-center group-hover:border-brand transition-colors">
                            <span className="text-subInk text-xs group-hover:text-ink block">โก เธญเธฑเธเนเธซเธฅเธ”เน€เธเธดเนเธกเธซเธฅเธฒเธขเธฃเธนเธเธเธฃเนเธญเธกเธเธฑเธ (เธเธฐเธชเธธเนเธกเน€เธเนเธฒเธเนเธญเธเธงเนเธฒเธเธ–เธฑเธ”เนเธเนเธ”เธขเธญเธฑเธ•เนเธเธกเธฑเธ•เธด)</span>
                        </div>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleMenuUpload(e.target.files)} />
                    </label>
                </div>
            </div>
        </div>
    )
}

