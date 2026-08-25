/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React from 'react';
import { ExternalLink, Check, Sun, Moon, Clock, TrendingUp, Radio, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabaseClient';

export default function IntegrationsTab({
    settings,
    handleSave,
    targetFoodCost,
    handleSaveStoreSetting,
    allCategories,
    setAllCategories,
    defaultRouteCategory
}) {
    // Helper to extract closed categories
    const getKitchenClosedCategoryIds = () => {
        try {
            if (!settings.qr_kitchen_closed_categories) return [];
            const parsed = typeof settings.qr_kitchen_closed_categories === 'string'
                ? JSON.parse(settings.qr_kitchen_closed_categories)
                : settings.qr_kitchen_closed_categories;
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.warn('Error parsing qr_kitchen_closed_categories:', e);
        }

        return allCategories
            .filter(c => c.hide_on_kitchen_close === true)
            .map(c => c.id);
    };

    const isKitchenCurrentlyClosed = () => {
        const mode = settings.qr_kitchen_mode || 'auto';
        if (mode === 'force_close') return true;
        if (mode === 'force_open') return false;
        if (settings.qr_kitchen_cutoff_enabled === 'false') return false;

        const openTimeStr = settings.qr_kitchen_open_time || settings.opening_time || '10:00';
        const [openH, openM] = openTimeStr.split(':').map(Number);
        const closeTimeStr = settings.qr_kitchen_close_time || '22:00';
        const [closeH, closeM] = closeTimeStr.split(':').map(Number);

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const openMins = (openH ?? 10) * 60 + (openM || 0);
        const closeMins = (closeH ?? 22) * 60 + (closeM || 0);

        if (closeMins > openMins) {
            return currentMins < openMins || currentMins >= closeMins;
        } else {
            return currentMins < openMins && currentMins >= closeMins;
        }
    };

    const handleToggleKitchenCutoffCategory = async (catId) => {
        const currentList = getKitchenClosedCategoryIds();
        const exists = currentList.includes(catId);
        const nextList = exists ? currentList.filter(id => id !== catId) : [...currentList, catId];
        const nextListStr = JSON.stringify(nextList);

        await handleSave('qr_kitchen_closed_categories', nextListStr);

        try {
            await supabase.from('menu_categories').update({ hide_on_kitchen_close: !exists }).eq('id', catId);
            setAllCategories(prev => prev.map(c => c.id === catId ? { ...c, hide_on_kitchen_close: !exists } : c));
            toast.success(`อัปเดตการซ่อนหมวดหมู่เมื่อครัวปิด`);
        } catch (err) {
            console.warn('Sync hide_on_kitchen_close err:', err);
        }
    };

    const handleSelectAllKitchenCategories = async () => {
        const kitchenCatIds = allCategories
            .filter(c => defaultRouteCategory(c) === 'kitchen')
            .map(c => c.id);
        const nextListStr = JSON.stringify(kitchenCatIds);
        await handleSave('qr_kitchen_closed_categories', nextListStr);

        try {
            await supabase.from('menu_categories').update({ hide_on_kitchen_close: true }).in('id', kitchenCatIds);
            const barCatIds = allCategories.filter(c => defaultRouteCategory(c) === 'bar').map(c => c.id);
            if (barCatIds.length > 0) {
                await supabase.from('menu_categories').update({ hide_on_kitchen_close: false }).in('id', barCatIds);
            }
            setAllCategories(prev => prev.map(c => ({
                ...c,
                hide_on_kitchen_close: kitchenCatIds.includes(c.id)
            })));
            toast.success('เลือกเฉพาะหมวดหมู่อาหารครัวเรียบร้อย');
        } catch (err) {
            console.warn('Sync hide_on_kitchen_close err:', err);
        }
    };

    const handleSelectAllCategoriesForCutoff = async () => {
        const allIds = allCategories.map(c => c.id);
        await handleSave('qr_kitchen_closed_categories', JSON.stringify(allIds));
        try {
            await supabase.from('menu_categories').update({ hide_on_kitchen_close: true }).in('id', allIds);
            setAllCategories(prev => prev.map(c => ({ ...c, hide_on_kitchen_close: true })));
            toast.success('เลือกซ่อนทุกหมวดหมู่เมื่อครัวปิด');
        } catch (e) {}
    };

    const handleClearAllCutoffCategories = async () => {
        await handleSave('qr_kitchen_closed_categories', JSON.stringify([]));
        try {
            const allIds = allCategories.map(c => c.id);
            if (allIds.length > 0) {
                await supabase.from('menu_categories').update({ hide_on_kitchen_close: false }).in('id', allIds);
            }
            setAllCategories(prev => prev.map(c => ({ ...c, hide_on_kitchen_close: false })));
            toast.success('ล้างการเลือกหมวดหมู่ทั้งหมดแล้ว');
        } catch (e) {}
    };

    return (
        <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column: Pricing & Spotify */}
            <div className="space-y-6">
                {/* Pricing Strategy Config */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-4">
                    <div className="flex items-center gap-2 border-b border-[var(--color-rule)] pb-3">
                        <TrendingUp size={18} className="text-[var(--color-ink)]" />
                        <div>
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                Pricing Strategy (เป้าหมาย Food Cost %)
                            </h2>
                            <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                                ใช้สำหรับคำนวณราคาขายแนะนำในระบบ Recipe Lab และ Costing
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            Target Food Cost %
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={targetFoodCost}
                                onChange={(e) => handleSaveStoreSetting('target_food_cost_pct', parseFloat(e.target.value))}
                                className="w-24 bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-[var(--color-ink)] font-bold text-base outline-none focus:border-[var(--color-ink)] font-mono text-center"
                            />
                            <span className="text-[var(--color-ink)] font-bold font-mono text-sm">%</span>
                            <div className="text-[11px] font-mono text-[var(--color-neutral)] leading-tight">
                                ตัวอย่าง: ต้นทุน 30 บาท ÷ 30% = ราคาขายแนะนำ 100 บาท
                            </div>
                        </div>
                    </div>
                </div>

                {/* Spotify Song Request System Settings */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-4">
                    <div className="flex items-center gap-2 border-b border-[var(--color-rule)] pb-3">
                        <Radio size={18} className="text-[var(--color-ink)]" />
                        <div>
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                Spotify Song Requests API
                            </h2>
                            <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                                ระบบรับคำขอเพลงอัตโนมัติจากลูกค้าผ่าน Spotify Web API
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                Spotify Client ID
                            </label>
                            <input
                                type="text"
                                value={settings.spotify_client_id || ''}
                                onChange={(e) => handleSave('spotify_client_id', e.target.value)}
                                className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                placeholder="ป้อน Spotify Client ID"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                Spotify Client Secret
                            </label>
                            <input
                                type="password"
                                value={settings.spotify_client_secret || ''}
                                onChange={(e) => handleSave('spotify_client_secret', e.target.value)}
                                className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                placeholder="ป้อน Spotify Client Secret"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                Spotify Playlist URL or ID
                            </label>
                            <input
                                type="text"
                                value={settings.spotify_playlist_id || ''}
                                onChange={(e) => handleSave('spotify_playlist_id', e.target.value)}
                                className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                placeholder="เช่น 37i9dQZF1DXcBWIGg3m31s หรือ URL เต็ม"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                กฎและแนวเพลงคุมโทนร้าน (Music Guidelines)
                            </label>
                            <textarea
                                rows={3}
                                value={settings.song_request_guidelines || ''}
                                onChange={(e) => handleSave('song_request_guidelines', e.target.value)}
                                className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] resize-y"
                                placeholder="แนะนำแนว Pop / Jazz ชิลๆ สบายๆ"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: QR Ordering & Kitchen Cutoff */}
            <div className="space-y-6">
                {/* QR Customer Ordering Settings Card */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-4">
                    <div className="border-b border-[var(--color-rule)] pb-3">
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            QR Ordering & Location Geofencing
                        </h2>
                        <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                            ควบคุมการสั่งอาหารด้วยตนเองของลูกค้าที่โต๊ะอาหาร
                        </p>
                    </div>

                    <div className="space-y-3">
                        {/* Enable QR Ordering Toggle */}
                        <label className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                            settings.qr_ordering_enabled === 'true'
                                ? 'bg-[var(--color-paper)] border-[var(--color-ink)] shadow-2xs'
                                : 'bg-[var(--color-paper)] border-[var(--color-rule)]'
                        }`}>
                            <div>
                                <span className="block font-mono font-bold text-xs text-[var(--color-ink)]">
                                    Enable QR Ordering
                                </span>
                                <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                    เปิดให้ลูกค้าสแกนสั่งอาหารและเครื่องดื่มที่โต๊ะ
                                </span>
                            </div>
                            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                                settings.qr_ordering_enabled === 'true' ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'
                            }`}>
                                <div className={`w-4 h-4 rounded-full bg-[var(--color-paper)] shadow-xs transform transition-transform duration-200 ${
                                    settings.qr_ordering_enabled === 'true' ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={settings.qr_ordering_enabled === 'true'}
                                onChange={(e) => handleSave('qr_ordering_enabled', e.target.checked ? 'true' : 'false')}
                            />
                        </label>

                        {/* Enable Song Request Toggle */}
                        <label className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                            settings.song_request_enabled !== 'false'
                                ? 'bg-[var(--color-paper)] border-[var(--color-ink)] shadow-2xs'
                                : 'bg-[var(--color-paper)] border-[var(--color-rule)]'
                        }`}>
                            <div>
                                <span className="block font-mono font-bold text-xs text-[var(--color-ink)]">
                                    Enable Song Request Page
                                </span>
                                <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                    เปิดหน้าขอเพลงให้ลูกค้าเลือกส่งเพลงเข้าคิว
                                </span>
                            </div>
                            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                                settings.song_request_enabled !== 'false' ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'
                            }`}>
                                <div className={`w-4 h-4 rounded-full bg-[var(--color-paper)] shadow-xs transform transition-transform duration-200 ${
                                    settings.song_request_enabled !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={settings.song_request_enabled !== 'false'}
                                onChange={(e) => handleSave('song_request_enabled', e.target.checked ? 'true' : 'false')}
                            />
                        </label>

                        {/* Enable Geofencing Toggle */}
                        <label className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                            settings.qr_gps_enabled === 'true'
                                ? 'bg-[var(--color-paper)] border-[var(--color-ink)] shadow-2xs'
                                : 'bg-[var(--color-paper)] border-[var(--color-rule)]'
                        }`}>
                            <div>
                                <span className="block font-mono font-bold text-xs text-[var(--color-ink)]">
                                    Enable GPS Geofencing (จำกัดพิกัดสั่งในร้าน)
                                </span>
                                <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                    ป้องกันการสั่งจากนอกบริเวณร้าน
                                </span>
                            </div>
                            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                                settings.qr_gps_enabled === 'true' ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'
                            }`}>
                                <div className={`w-4 h-4 rounded-full bg-[var(--color-paper)] shadow-xs transform transition-transform duration-200 ${
                                    settings.qr_gps_enabled === 'true' ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={settings.qr_gps_enabled === 'true'}
                                onChange={(e) => handleSave('qr_gps_enabled', e.target.checked ? 'true' : 'false')}
                            />
                        </label>

                        {settings.qr_gps_enabled === 'true' && (
                            <div className="space-y-3 bg-[var(--color-paper)] p-4 rounded-xl border border-[var(--color-rule)]">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                            Latitude
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.qr_latitude || ''}
                                            onChange={(e) => handleSave('qr_latitude', e.target.value)}
                                            className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2 rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                            placeholder="เช่น 17.40722"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                            Longitude
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.qr_longitude || ''}
                                            onChange={(e) => handleSave('qr_longitude', e.target.value)}
                                            className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2 rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                            placeholder="เช่น 104.78028"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                        Allowed Radius (รัศมีเป็นเมตร)
                                    </label>
                                    <input
                                        type="number"
                                        value={settings.qr_radius || ''}
                                        onChange={(e) => handleSave('qr_radius', e.target.value)}
                                        className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2 rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        placeholder="เช่น 50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Google Review URL */}
                        <div className="pt-2">
                            <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                                Google Review URL (ลิงก์รีวิว Google Maps)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={settings.google_review_url || ''}
                                    onChange={(e) => handleSave('google_review_url', e.target.value)}
                                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    placeholder="https://g.page/r/.../review"
                                />
                                {settings.google_review_url && (
                                    <a
                                        href={settings.google_review_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-2 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl text-xs font-mono text-[var(--color-ink)] flex items-center gap-1 shrink-0"
                                    >
                                        <ExternalLink size={13} />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Kitchen Cutoff & QR Schedule Card */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-4">
                    <div className="flex items-start justify-between border-b border-[var(--color-rule)] pb-3 gap-2">
                        <div>
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
                                <Clock size={16} />
                                Kitchen Cutoff Schedule (เวลาปิดครัว)
                            </h2>
                            <p className="text-[11px] font-mono text-[var(--color-neutral)] mt-0.5">
                                กำหนดเวลาปิดรับออเดอร์ครัว และเลือกหมวดหมู่ที่ต้องการซ่อนในหน้า QR ลูกค้า
                            </p>
                        </div>

                        {/* Status Badge */}
                        {(() => {
                            const isClosed = isKitchenCurrentlyClosed();
                            const closedCount = getKitchenClosedCategoryIds().length;
                            return (
                                <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold shrink-0 ${
                                    isClosed
                                        ? 'bg-[var(--color-paper)] border-[var(--color-accent)] text-[var(--color-accent)]'
                                        : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink)]'
                                }`}>
                                    {isClosed ? `ครัวปิด (${closedCount} หมวดซ่อน)` : 'ครัวเปิด'}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="space-y-3">
                        {/* Cutoff Master Switch */}
                        <label className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                            settings.qr_kitchen_cutoff_enabled !== 'false'
                                ? 'bg-[var(--color-paper)] border-[var(--color-ink)] shadow-2xs'
                                : 'bg-[var(--color-paper)] border-[var(--color-rule)]'
                        }`}>
                            <div>
                                <span className="block font-mono font-bold text-xs text-[var(--color-ink)]">
                                    เปิดใช้งานระบบตัดรอบเวลาปิดครัว
                                </span>
                                <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                    เมื่อถึงเวลาปิดครัว จะซ่อนหมวดหมู่อาหารที่เลือกไว้โดยอัตโนมัติ
                                </span>
                            </div>
                            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                                settings.qr_kitchen_cutoff_enabled !== 'false' ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'
                            }`}>
                                <div className={`w-4 h-4 rounded-full bg-[var(--color-paper)] shadow-xs transform transition-transform duration-200 ${
                                    settings.qr_kitchen_cutoff_enabled !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={settings.qr_kitchen_cutoff_enabled !== 'false'}
                                onChange={(e) => handleSave('qr_kitchen_cutoff_enabled', e.target.checked ? 'true' : 'false')}
                            />
                        </label>

                        {/* Kitchen Status Mode Options */}
                        <div className="space-y-1.5 pt-1">
                            <label className="text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase tracking-wider block">
                                โหมดสถานะห้องครัว (Kitchen Status Mode)
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { mode: 'auto', label: 'Auto (ตามเวลา)' },
                                    { mode: 'force_close', label: 'Force Close (ปิดทันที)' },
                                    { mode: 'force_open', label: 'Force Open (เปิดตลอด)' }
                                ].map(({ mode, label }) => {
                                    const isSelected = (settings.qr_kitchen_mode || 'auto') === mode;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleSave('qr_kitchen_mode', mode)}
                                            className={`p-2 rounded-lg border text-[10px] font-mono font-bold transition-colors cursor-pointer text-center ${
                                                isSelected
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] shadow-xs'
                                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Kitchen Operating Hours */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {/* Morning Open */}
                            <div className="bg-[var(--color-paper)] p-3 rounded-xl border border-[var(--color-rule)] space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase flex items-center gap-1">
                                        <Sun size={13} /> เวลาเปิดครัว (Open)
                                    </label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={settings.qr_kitchen_open_time || '10:00'}
                                        onChange={(e) => handleSave('qr_kitchen_open_time', e.target.value)}
                                        className="w-24 bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-1.5 rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    />
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {['08:00', '09:00', '10:00', '11:00'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => handleSave('qr_kitchen_open_time', t)}
                                                className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold cursor-pointer transition-colors ${
                                                    (settings.qr_kitchen_open_time || '10:00') === t
                                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                        : 'bg-[var(--color-paper)] text-[var(--color-neutral)] border-[var(--color-rule)] hover:text-[var(--color-ink)]'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Night Cutoff */}
                            <div className="bg-[var(--color-paper)] p-3 rounded-xl border border-[var(--color-rule)] space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase flex items-center gap-1">
                                        <Moon size={13} /> เวลาปิดครัว (Cutoff)
                                    </label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={settings.qr_kitchen_close_time || '22:00'}
                                        onChange={(e) => handleSave('qr_kitchen_close_time', e.target.value)}
                                        className="w-24 bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-1.5 rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    />
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {['21:00', '21:30', '22:00', '22:30', '23:00'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => handleSave('qr_kitchen_close_time', t)}
                                                className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold cursor-pointer transition-colors ${
                                                    (settings.qr_kitchen_close_time || '22:00') === t
                                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                        : 'bg-[var(--color-paper)] text-[var(--color-neutral)] border-[var(--color-rule)] hover:text-[var(--color-ink)]'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cutoff Categories Checklist */}
                        <div className="space-y-2 pt-2 border-t border-[var(--color-rule)]">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <span className="block font-mono font-bold text-[10px] text-[var(--color-ink)] uppercase tracking-wider">
                                        Cutoff Categories (หมวดที่ซ่อนเมื่อครัวปิด)
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllKitchenCategories}
                                        className="px-2 py-1 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-lg text-[9px] font-mono font-bold transition-colors cursor-pointer"
                                    >
                                        เฉพาะครัว
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSelectAllCategoriesForCutoff}
                                        className="px-2 py-1 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] rounded-lg text-[9px] font-mono font-bold transition-colors cursor-pointer"
                                    >
                                        ทั้งหมด
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearAllCutoffCategories}
                                        className="px-2 py-1 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] rounded-lg text-[9px] font-mono font-bold transition-colors cursor-pointer"
                                    >
                                        ล้าง
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[var(--color-paper)] p-3 rounded-xl border border-[var(--color-rule)] max-h-56 overflow-y-auto">
                                {allCategories.map(cat => {
                                    const closedIds = getKitchenClosedCategoryIds();
                                    const isSelected = closedIds.includes(cat.id) || cat.hide_on_kitchen_close === true;
                                    const isBar = defaultRouteCategory(cat) === 'bar';

                                    return (
                                        <div
                                            key={cat.id}
                                            onClick={() => handleToggleKitchenCutoffCategory(cat.id)}
                                            className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors select-none ${
                                                isSelected
                                                    ? 'bg-[var(--color-paper-2)] border-[var(--color-ink)] text-[var(--color-ink)] font-bold'
                                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:border-[var(--color-neutral)]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-paper)]' : 'border-[var(--color-rule)] bg-[var(--color-paper)]'
                                                }`}>
                                                    {isSelected && <Check size={10} strokeWidth={3} />}
                                                </div>
                                                <span className="text-xs truncate">{cat.name}</span>
                                            </div>
                                            <span className="text-[8.5px] font-mono uppercase text-[var(--color-neutral)] shrink-0">
                                                {isBar ? 'Bar' : 'Kitchen'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
