/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { Power, Save, TrendingUp, ShieldCheck, Trash2, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabaseClient';
import { safeTimestampUrl } from '../../../utils/urlHelper';
import VisualCalendarBlocker from './VisualCalendarBlocker';
import TimeSlotStudio from './TimeSlotStudio';

export default function GeneralBookingSettingsTab({
    settings,
    handleSave,
    handleUpload,
    timestamp,
    setTimestamp,
    blockedList,
    fetchSettings
}) {
    const [uploadingQr, setUploadingQr] = useState(false);
    const [uploadingFloor, setUploadingFloor] = useState(false);
    const [uploadingHomeBg, setUploadingHomeBg] = useState(false);
    const [cleaningSlips, setCleaningSlips] = useState(false);

    const handleSavePolicies = async () => {
        try {
            await handleSave('announcement_headline', settings.announcement_headline || '');
            await handleSave('announcement_detail', settings.announcement_detail || '');
            await handleSave('booking_min_spend', settings.booking_min_spend || '');
            await handleSave('booking_min_advance_hours', settings.booking_min_advance_hours || '');
            await handleSave('pickup_min_advance_hours', settings.pickup_min_advance_hours || '');
            await handleSave('booking_time_slots', settings.booking_time_slots || '');
            await handleSave('policy_dine_in', settings.policy_dine_in || '');
            await handleSave('policy_pickup', settings.policy_pickup || '');
            await handleSave('contact_phone', settings.contact_phone || '');
            await handleSave('contact_map_url', settings.contact_map_url || '');
            toast.success('บันทึกการตั้งค่าข้อความและเงื่อนไขเรียบร้อย');
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || err));
        }
    };

    const handleCleanOldSlips = async () => {
        if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรูปสลิปที่เก่ากว่า 180 วัน (6 เดือน) ออกจากระบบเพื่อประหยัดพื้นที่?')) {
            return;
        }

        try {
            setCleaningSlips(true);
            const d = new Date();
            d.setDate(d.getDate() - 180);
            const cutoffDate = d.toISOString();

            const { data: oldBookings, error: fetchError } = await supabase
                .from('bookings')
                .select('id, payment_slip_url')
                .lt('booking_time', cutoffDate)
                .not('payment_slip_url', 'is', null);

            if (fetchError) throw fetchError;
            if (!oldBookings || oldBookings.length === 0) {
                toast.info('ไม่พบรูปสลิปที่เก่ากว่า 180 วันในระบบ');
                return;
            }

            const filesToRemove = oldBookings.map(b => b.payment_slip_url).filter(Boolean);
            if (filesToRemove.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from('slips')
                    .remove(filesToRemove);
                if (storageError) throw storageError;
            }

            const idsToUpdate = oldBookings.map(b => b.id);
            const { error: updateError } = await supabase
                .from('bookings')
                .update({ payment_slip_url: null })
                .in('id', idsToUpdate);

            if (updateError) throw updateError;

            toast.success(`ล้างรูปสลิปเก่าสำเร็จจำนวน ${filesToRemove.length} รายการ`);
        } catch (e) {
            console.error(e);
            toast.error('เกิดข้อผิดพลาดในการล้างสลิป: ' + (e.message || e));
        } finally {
            setCleaningSlips(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Grid: Service Status Switches & Blocked Dates */}
            <div className="grid lg:grid-cols-12 gap-6">
                {/* Column 1: Shop Status Controls (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-5">
                        <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--color-paper)] text-[var(--color-ink)] rounded-xl border border-[var(--color-rule)]">
                                    <Power size={18} />
                                </div>
                                <div>
                                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                        Shop Service Modes
                                    </h2>
                                    <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                                        สถานะเปิด-ปิด 3 บริการหลักของร้าน
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Table Booking Mode */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-mono font-bold text-[var(--color-ink)] uppercase tracking-wider">
                                    Table Booking (จองโต๊ะทานที่ร้าน)
                                </label>
                                <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                    {settings.shop_mode_table || 'auto'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                                {[
                                    { mode: 'auto', label: 'Auto (ตามเวลา)' },
                                    { mode: 'manual_open', label: 'Manual Open' },
                                    { mode: 'manual_close', label: 'Manual Close' }
                                ].map(({ mode, label }) => {
                                    const isSelected = settings.shop_mode_table === mode;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleSave('shop_mode_table', mode)}
                                            className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer text-center select-none ${
                                                isSelected
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] shadow-xs'
                                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Pickup Mode */}
                        <div className="space-y-2 pt-3 border-t border-[var(--color-rule)]">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-mono font-bold text-[var(--color-ink)] uppercase tracking-wider">
                                    Pickup Online (สั่งรับกลับบ้าน)
                                </label>
                                <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                    {settings.shop_mode_pickup || 'auto'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                                {[
                                    { mode: 'auto', label: 'Auto (ตามเวลา)' },
                                    { mode: 'manual_open', label: 'Manual Open' },
                                    { mode: 'manual_close', label: 'Manual Close' }
                                ].map(({ mode, label }) => {
                                    const isSelected = settings.shop_mode_pickup === mode;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleSave('shop_mode_pickup', mode)}
                                            className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer text-center select-none ${
                                                isSelected
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] shadow-xs'
                                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* HAUSMADE Shop Mode */}
                        <div className="space-y-2 pt-3 border-t border-[var(--color-rule)]">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-mono font-bold text-[var(--color-ink)] uppercase tracking-wider">
                                    HAUSMADE Shop (สินค้าออนไลน์)
                                </label>
                                <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                    {settings.shop_mode_hausmade || 'manual_close'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                                {[
                                    { mode: 'auto', label: 'Auto (ตามเวลา)' },
                                    { mode: 'manual_open', label: 'Manual Open' },
                                    { mode: 'manual_close', label: 'Manual Close' }
                                ].map(({ mode, label }) => {
                                    const isSelected = (settings.shop_mode_hausmade || 'manual_close') === mode;
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleSave('shop_mode_hausmade', mode)}
                                            className={`py-2 px-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer text-center select-none ${
                                                isSelected
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] shadow-xs'
                                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-neutral)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Operating Hours for Auto Mode */}
                        <div className="pt-3 border-t border-[var(--color-rule)]">
                            <p className="text-[10px] font-mono text-[var(--color-neutral)] mb-2">
                                กำหนดเวลาเปิด-ปิดร้านสำหรับโหมด Auto
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                                        เวลาเปิดร้าน (Opens)
                                    </label>
                                    <input
                                        type="time"
                                        value={settings.opening_time || '11:00'}
                                        onChange={(e) => handleSave('opening_time', e.target.value)}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2 rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                                        เวลาปิดร้าน (Closes)
                                    </label>
                                    <input
                                        type="time"
                                        value={settings.closing_time || '22:00'}
                                        onChange={(e) => handleSave('closing_time', e.target.value)}
                                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2 rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Default VAT 7% Toggle */}
                        <div className="pt-3 border-t border-[var(--color-rule)]">
                            <label className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                                settings.default_vat_enabled === 'true'
                                    ? 'bg-[var(--color-paper)] border-[var(--color-ink)] shadow-2xs'
                                    : 'bg-[var(--color-paper)] border-[var(--color-rule)] hover:border-[var(--color-neutral)]'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 bg-[var(--color-paper-2)] text-[var(--color-ink)] rounded-lg border border-[var(--color-rule)]">
                                        <TrendingUp size={16} />
                                    </div>
                                    <div>
                                        <span className="block font-mono font-bold text-xs text-[var(--color-ink)]">
                                            Default VAT 7%
                                        </span>
                                        <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                                            ภาษีมูลค่าเพิ่ม 7% เริ่มต้นของร้าน
                                        </span>
                                    </div>
                                </div>
                                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                                    settings.default_vat_enabled === 'true' ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'
                                }`}>
                                    <div className={`w-4 h-4 rounded-full bg-[var(--color-paper)] shadow-xs transform transition-transform duration-200 ${
                                        settings.default_vat_enabled === 'true' ? 'translate-x-4' : 'translate-x-0'
                                    }`} />
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={settings.default_vat_enabled === 'true'}
                                    onChange={(e) => handleSave('default_vat_enabled', e.target.checked ? 'true' : 'false')}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Column 2: Blocked Dates Studio (7 cols) */}
                <div className="lg:col-span-7">
                    <VisualCalendarBlocker
                        blockedList={blockedList}
                        onRefresh={fetchSettings}
                    />
                </div>
            </div>

            {/* Announcement & Policies Card */}
            <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-4 gap-3">
                    <div>
                        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            Announcement & Store Policies
                        </h2>
                        <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                            จัดการข้อความประกาศ เงื่อนไขการสั่ง และรอบเวลาบริการ
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSavePolicies}
                        className="flex items-center justify-center gap-2 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] px-5 py-2.5 rounded-xl font-mono font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                        <Save size={15} /> บันทึกการตั้งค่า
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            Headline (หัวข้อข่าวประกาศ)
                        </label>
                        <input
                            type="text"
                            value={settings.announcement_headline || ''}
                            onChange={(e) => handleSave('announcement_headline', e.target.value)}
                            placeholder="เช่น BY ร้านในบ้าน"
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            Detail (ข้อความวิ่ง Marquee)
                        </label>
                        <input
                            type="text"
                            value={settings.announcement_detail || ''}
                            onChange={(e) => handleSave('announcement_detail', e.target.value)}
                            placeholder="เช่น IN THE HAUS จริตจัด รสชัดเจน..."
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                        />
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            เบอร์โทรติดต่อร้าน (Contact Phone)
                        </label>
                        <input
                            type="text"
                            value={settings.contact_phone || ''}
                            onChange={(e) => handleSave('contact_phone', e.target.value)}
                            placeholder="เช่น 0812345678"
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            Google Maps URL
                        </label>
                        <input
                            type="text"
                            value={settings.contact_map_url || ''}
                            onChange={(e) => handleSave('contact_map_url', e.target.value)}
                            placeholder="https://maps.google.com/..."
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                        />
                    </div>
                </div>

                {/* Policy Numerical Parameters */}
                <div className="pt-4 border-t border-[var(--color-rule)] grid md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            ขั้นต่ำต่อท่าน (บาท)
                        </label>
                        <input
                            type="number"
                            value={settings.booking_min_spend || ''}
                            onChange={(e) => handleSave('booking_min_spend', e.target.value)}
                            placeholder="150"
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            จองล่วงหน้าขั้นต่ำ (ชั่วโมง)
                        </label>
                        <input
                            type="number"
                            value={settings.booking_min_advance_hours || ''}
                            onChange={(e) => handleSave('booking_min_advance_hours', e.target.value)}
                            placeholder="2"
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                            Pickup ล่วงหน้าขั้นต่ำ (ชั่วโมง)
                        </label>
                        <input
                            type="number"
                            value={settings.pickup_min_advance_hours || ''}
                            onChange={(e) => handleSave('pickup_min_advance_hours', e.target.value)}
                            placeholder="1"
                            className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                        />
                    </div>
                </div>

                {/* Time Slot Studio Integration */}
                <div className="pt-2">
                    <TimeSlotStudio
                        value={settings.booking_time_slots || ''}
                        openingTime={settings.opening_time || '11:00'}
                        closingTime={settings.closing_time || '22:00'}
                        onChange={(newSlots) => handleSave('booking_time_slots', newSlots)}
                    />
                </div>

                {/* System Default Active Policies Reference */}
                <div className="bg-[var(--color-paper)] p-4 rounded-xl border border-[var(--color-rule)] space-y-3">
                    <div className="flex items-center gap-2 text-[var(--color-ink)] font-mono font-bold text-xs">
                        <ShieldCheck size={16} />
                        System Default Active Policies (เงื่อนไขการจองในระบบ)
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-xs text-[var(--color-muted)] font-mono">
                        <div className="bg-[var(--color-paper-2)] p-3 rounded-lg border border-[var(--color-rule)] space-y-1">
                            <span className="font-bold text-[var(--color-ink)] block mb-1">Dine-in Policy (การจองโต๊ะทานที่ร้าน):</span>
                            <p>• สั่งอาหารขั้นต่ำ 150 บาทต่อท่าน</p>
                            <p>• ชำระมัดจำ 50% อัตโนมัติ (หักคืนให้อัตโนมัติจากบิลหน้าร้าน)</p>
                            <p>• คืนมัดจำได้หากยกเลิกล่วงหน้าเกิน 24 ชั่วโมง</p>
                        </div>
                        <div className="bg-[var(--color-paper-2)] p-3 rounded-lg border border-[var(--color-rule)] space-y-1">
                            <span className="font-bold text-[var(--color-ink)] block mb-1">Pickup Policy (การสั่งกลับบ้าน):</span>
                            <p>• ชำระเงินเต็มจำนวน 100% เท่านั้น</p>
                            <p>• ไม่สามารถยกเลิกออเดอร์และขอคืนเงินได้ทุกกรณี</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* QR Payment, Floor Plan, Home Background Image Grid (3 Columns) */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* QR Payment Card */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] flex flex-col justify-between space-y-4">
                    <div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-3">
                            QR Payment (พร้อมเพย์)
                        </h2>
                        <div className="mb-4 flex justify-center bg-[var(--color-paper)] p-4 rounded-xl border border-[var(--color-rule)]">
                            {settings.payment_qr_url ? (
                                <img
                                    src={safeTimestampUrl(settings.payment_qr_url, timestamp)}
                                    alt="Payment QR"
                                    className="w-32 h-32 object-cover rounded-lg border border-[var(--color-rule)]"
                                />
                            ) : (
                                <div className="w-32 h-32 bg-[var(--color-paper-2)] rounded-lg flex items-center justify-center text-[var(--color-neutral)] text-xs font-mono">
                                    No QR Image
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block w-full cursor-pointer group">
                            <div className="bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-xl p-3 text-center group-hover:border-[var(--color-ink)] transition-colors">
                                <span className="text-[var(--color-neutral)] text-xs font-mono group-hover:text-[var(--color-ink)]">
                                    {uploadingQr ? 'กำลังอัปโหลด...' : 'เลือกรูป QR เพื่อเปลี่ยน'}
                                </span>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleUpload(e.target.files[0], 'payment_qr_url', setUploadingQr)}
                            />
                        </label>
                        <p className="text-[10px] font-mono text-[var(--color-neutral)] mt-2 text-center">
                            สัดส่วน 1:1, ขนาดไม่เกิน 500KB
                        </p>

                        <div className="mt-3 pt-3 border-t border-[var(--color-rule)] space-y-2.5">
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                    ชื่อบัญชีพร้อมเพย์ (Account Name)
                                </label>
                                <input
                                    type="text"
                                    value={settings.promptpay_name || ''}
                                    onChange={(e) => handleSave('promptpay_name', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    placeholder="เช่น อิน เดอะ เฮ้าส์"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                    เบอร์พร้อมเพย์รับเงิน (PromptPay ID)
                                </label>
                                <input
                                    type="text"
                                    value={settings.promptpay_id || ''}
                                    onChange={(e) => handleSave('promptpay_id', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    placeholder="เช่น 0985284217 หรือ เลขประจำตัว 13 หลัก"
                                />
                            </div>
                            <p className="text-[10px] font-mono text-[var(--color-neutral)]">
                                ใช้แสดงชื่อบัญชี เบอร์โทร และสร้าง Dynamic QR บนจอ CDS และสลิป
                            </p>
                        </div>
                    </div>
                </div>

                {/* Floor Plan Card */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] flex flex-col justify-between space-y-4">
                    <div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-3">
                            Floor Plan (ผังโต๊ะร้าน)
                        </h2>
                        <div className="mb-4 flex justify-center bg-[var(--color-paper)] p-4 rounded-xl border border-[var(--color-rule)]">
                            {settings.floorplan_url ? (
                                <img
                                    src={safeTimestampUrl(settings.floorplan_url, timestamp)}
                                    alt="Floor Plan"
                                    className="w-full h-32 object-cover rounded-lg border border-[var(--color-rule)]"
                                />
                            ) : (
                                <div className="w-full h-32 bg-[var(--color-paper-2)] rounded-lg flex items-center justify-center text-[var(--color-neutral)] text-xs font-mono">
                                    No Floor Plan Image
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block w-full cursor-pointer group">
                            <div className="bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-xl p-3 text-center group-hover:border-[var(--color-ink)] transition-colors">
                                <span className="text-[var(--color-neutral)] text-xs font-mono group-hover:text-[var(--color-ink)]">
                                    {uploadingFloor ? 'กำลังอัปโหลด...' : 'เลือกรูปผังโต๊ะเพื่อเปลี่ยน'}
                                </span>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleUpload(e.target.files[0], 'floorplan_url', setUploadingFloor)}
                            />
                        </label>
                        <p className="text-[10px] font-mono text-[var(--color-neutral)] mt-2 text-center">
                            สัดส่วน 16:9 แนวนอน, ไม่เกิน 2MB
                        </p>
                    </div>
                </div>

                {/* Home Background Card */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] flex flex-col justify-between space-y-4">
                    <div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-3">
                            Home Background (ภาพพื้นหลัง)
                        </h2>
                        <div className="mb-4 flex justify-center bg-[var(--color-paper)] p-4 rounded-xl border border-[var(--color-rule)]">
                            {settings.home_background_url ? (
                                <img
                                    src={safeTimestampUrl(settings.home_background_url, timestamp)}
                                    alt="Home Background"
                                    className="w-full h-32 object-cover rounded-lg border border-[var(--color-rule)]"
                                />
                            ) : (
                                <div className="w-full h-32 bg-[var(--color-paper-2)] rounded-lg flex items-center justify-center text-[var(--color-neutral)] text-xs font-mono">
                                    Default Background
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block w-full cursor-pointer group">
                            <div className="bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-xl p-3 text-center group-hover:border-[var(--color-ink)] transition-colors">
                                <span className="text-[var(--color-neutral)] text-xs font-mono group-hover:text-[var(--color-ink)]">
                                    {uploadingHomeBg ? 'กำลังอัปโหลด...' : 'เปลี่ยนภาพพื้นหลัง'}
                                </span>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleUpload(e.target.files[0], 'home_background_url', setUploadingHomeBg)}
                            />
                        </label>
                        <div className="flex justify-between items-center mt-2 px-1">
                            <p className="text-[10px] font-mono text-[var(--color-neutral)]">1920x1080, ไม่เกิน 2MB</p>
                            {settings.home_background_url && (
                                <button
                                    type="button"
                                    onClick={() => handleSave('home_background_url', '')}
                                    className="text-[10px] font-mono text-[var(--color-accent)] hover:underline cursor-pointer"
                                >
                                    Reset Default
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Maintenance Utility Card */}
            <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--color-rule)] pb-3">
                    <Trash2 size={18} className="text-[var(--color-ink)]" />
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Data Maintenance & Storage Optimization
                    </h2>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-[var(--color-rule)] rounded-xl bg-[var(--color-paper)] gap-4">
                    <div>
                        <h3 className="font-mono font-bold text-[var(--color-ink)] text-xs uppercase tracking-wide">
                            Clean Old Slips (&gt; 180 Days)
                        </h3>
                        <p className="text-[11px] font-mono text-[var(--color-neutral)] mt-0.5 leading-relaxed">
                            ลบรูปสลิปที่เก่ากว่า 180 วัน (6 เดือน) ออกจาก Storage เพื่อประหยัดพื้นที่ (ข้อมูลการจองและบิลหลักยังคงอยู่ครบถ้วน)
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleCleanOldSlips}
                        disabled={cleaningSlips}
                        className="px-5 py-2.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-rule)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-xl font-mono text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                        {cleaningSlips ? 'กำลังประมวลผล...' : 'ล้างสลิปเก่า (> 180 วัน)'}
                    </button>
                </div>
            </div>
        </div>
    );
}
