/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react';
import { ExternalLink, Upload, Trash2, Plus, RotateCcw, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabaseClient';
import { safeTimestampUrl } from '../../../utils/urlHelper';

export default function LandingPageSettingsTab({
    settings,
    handleSave,
    timestamp,
    setTimestamp
}) {
    const [uploading, setUploading] = useState({});
    const [, setMenuUrls] = useState([]);
    const [, setAtmUrls] = useState([]);

    const promoSlots = (settings.link_menu_promo_slots || '5')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(Number);

    useEffect(() => {
        const urls = [];
        for (let i = 1; i <= 10; i++) {
            const url = settings[`link_menu_${i}`];
            if (url) urls.push({ slot: i, url });
        }
        setMenuUrls(urls);

        const aUrls = [];
        for (let i = 1; i <= 10; i++) {
            const url = settings[`link_atm_${i}`];
            if (url) aUrls.push({ slot: i, url });
        }
        setAtmUrls(aUrls);
    }, [settings]);

    // Auto-resize image before upload (max 1200px width, converts to WebP with JPEG fallback, 0.8 quality)
    const resizeImage = (file, maxWidth = 1200, forceJpeg = false) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const scale = Math.min(1, maxWidth / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    let type = 'image/webp';
                    let ext = '.webp';
                    if (forceJpeg) {
                        type = 'image/jpeg';
                        ext = '.jpg';
                    } else {
                        try {
                            const testData = canvas.toDataURL('image/webp');
                            if (!testData.startsWith('data:image/webp')) {
                                type = 'image/jpeg';
                                ext = '.jpg';
                            }
                        } catch {
                            type = 'image/jpeg';
                            ext = '.jpg';
                        }
                    }

                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type, lastModified: Date.now() }));
                    }, type, 0.8);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const uploadImage = async (file, settingKey) => {
        if (!file) return;
        setUploading(prev => ({ ...prev, [settingKey]: true }));
        try {
            const maxWidth = settingKey.startsWith('link_sig_img_') ? 600 : 1200;
            const forceJpeg = settingKey === 'link_og_image_url';
            const resized = await resizeImage(file, maxWidth, forceJpeg);
            const ext = resized.name.split('.').pop();
            const fileName = `link/${settingKey}_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, resized, { upsert: true, contentType: resized.type, cacheControl: '15552000' });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName);
            await handleSave(settingKey, publicUrl);
            setTimestamp(Date.now());
            toast.success('อัปโหลดรูปภาพสำเร็จ');
        } catch (error) {
            toast.error('เกิดข้อผิดพลาดในการอัปโหลด: ' + error.message);
        } finally {
            setUploading(prev => ({ ...prev, [settingKey]: false }));
        }
    };

    const handleMenuUpload = async (files) => {
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        let nextSlot = 1;
        for (let i = 1; i <= 10; i++) {
            if (!settings[`link_menu_${i}`]) { nextSlot = i; break; }
            if (i === 10 && settings[`link_menu_${i}`]) {
                toast.info('ช่องเมนูเต็มครบ 10 รูปแล้ว');
                return;
            }
            nextSlot = i + 1;
        }
        for (const file of fileArr) {
            if (nextSlot > 10) break;
            await uploadImage(file, `link_menu_${nextSlot}`);
            nextSlot++;
        }
        toast.success(`อัปโหลดเมนูสำเร็จ ${fileArr.length} รูป`);
    };

    const handleDeleteMenu = async (slot) => {
        if (!window.confirm(`ลบรูปเมนูช่อง #${slot} และเลื่อนคิวภาพถัดไปมาแทนที่?`)) return;
        await handleSave(`link_menu_${slot}`, '');
        const remaining = [];
        for (let i = 1; i <= 10; i++) {
            if (i === slot) continue;
            const url = settings[`link_menu_${i}`];
            if (url) remaining.push(url);
        }
        for (let i = 1; i <= 10; i++) {
            await handleSave(`link_menu_${i}`, remaining[i - 1] || '');
        }
        toast.success('ลบและจัดลำดับเมนูใหม่เรียบร้อย');
    };

    const handleAtmUpload = async (files) => {
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        let nextSlot = 1;
        for (let i = 1; i <= 10; i++) {
            if (!settings[`link_atm_${i}`]) { nextSlot = i; break; }
            if (i === 10 && settings[`link_atm_${i}`]) {
                toast.info('ช่องรูปบรรยากาศเต็มครบ 10 รูปแล้ว');
                return;
            }
            nextSlot = i + 1;
        }
        for (const file of fileArr) {
            if (nextSlot > 10) break;
            await uploadImage(file, `link_atm_${nextSlot}`);
            nextSlot++;
        }
        toast.success(`อัปโหลดรูปบรรยากาศสำเร็จ ${fileArr.length} รูป`);
    };

    const handleDeleteAtm = async (slot) => {
        if (!window.confirm(`ลบรูปบรรยากาศช่อง #${slot} และเลื่อนคิวภาพถัดไปมาแทนที่?`)) return;
        await handleSave(`link_atm_${slot}`, '');
        const remaining = [];
        for (let i = 1; i <= 10; i++) {
            if (i === slot) continue;
            const url = settings[`link_atm_${i}`];
            if (url) remaining.push(url);
        }
        for (let i = 1; i <= 10; i++) {
            await handleSave(`link_atm_${i}`, remaining[i - 1] || '');
        }
        toast.success('ลบและจัดลำดับรูปบรรยากาศใหม่เรียบร้อย');
    };

    const togglePromoSlot = async (slotNum) => {
        let currentPromo = (settings.link_menu_promo_slots || '5')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .map(Number);

        if (currentPromo.includes(slotNum)) {
            currentPromo = currentPromo.filter(n => n !== slotNum);
        } else {
            currentPromo = [...currentPromo, slotNum];
        }

        const newValue = currentPromo.sort((a, b) => a - b).join(',');
        await handleSave('link_menu_promo_slots', newValue);
        toast.success(`ปรับสถานะโปรโมชั่นสำหรับเมนูหน้า #${slotNum}`);
    };

    const ImageUploadBlock = ({ settingKey, label, aspect = 'aspect-video', placeholder }) => (
        <div className="space-y-2">
            <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase tracking-wider">
                {label}
            </label>
            <div className={`relative w-full ${aspect} rounded-xl overflow-hidden bg-[var(--color-paper)] border border-[var(--color-rule)]`}>
                {settings[settingKey] ? (
                    <img
                        src={safeTimestampUrl(settings[settingKey], timestamp)}
                        className="w-full h-full object-cover"
                        alt={label}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral)] font-mono text-xs p-4 text-center">
                        {placeholder || 'ยังไม่มีรูปภาพ'}
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <label className="flex-1 cursor-pointer group">
                    <div className="bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-xl p-2.5 text-center group-hover:border-[var(--color-ink)] transition-colors">
                        <span className="text-[var(--color-neutral)] text-xs font-mono group-hover:text-[var(--color-ink)]">
                            {uploading[settingKey] ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพใหม่'}
                        </span>
                    </div>
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => uploadImage(e.target.files[0], settingKey)}
                    />
                </label>
                {settings[settingKey] && (
                    <button
                        type="button"
                        onClick={() => handleSave(settingKey, '')}
                        className="text-xs font-mono font-bold text-[var(--color-accent)] hover:underline px-3 py-1 border border-[var(--color-rule)] rounded-xl bg-[var(--color-paper)] cursor-pointer"
                    >
                        ลบ
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-[var(--color-paper-2)] p-6 md:p-8 rounded-2xl border border-[var(--color-rule)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-4 gap-3">
                <div>
                    <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Link Page Manager (/link)
                    </h2>
                    <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                        จัดการรูปภาพ เมนู ข้อมูลติดต่อ และสื่อสำหรับหน้า Landing Page
                    </p>
                </div>
                <a
                    href="/link"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] px-4 py-2 rounded-xl text-xs font-mono font-bold transition-colors shadow-xs"
                >
                    <span>เปิดดูหน้า /link</span>
                    <ExternalLink size={13} />
                </a>
            </div>

            {/* Logo & Open Graph Share Image */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="max-w-xs">
                    <ImageUploadBlock
                        settingKey="link_logo_url"
                        label="Logo (โลโก้ร้าน)"
                        aspect="aspect-square"
                        placeholder="ยังไม่มีโลโก้ (1:1)"
                    />
                </div>
                <div>
                    <ImageUploadBlock
                        settingKey="link_og_image_url"
                        label="ภาพพรีวิวแชร์โซเชียล (Open Graph Image)"
                        aspect="aspect-video"
                        placeholder="ยังไม่มีรูปพรีวิว (แนะนำสัดส่วน 16:9 แนวนอน)"
                    />
                </div>
            </div>

            {/* Store Information Text Fields */}
            <div className="grid lg:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                        ชื่อร้านภาษาอังกฤษ (Shop Name EN)
                    </label>
                    <input
                        type="text"
                        value={settings.link_shop_name || ''}
                        onChange={(e) => handleSave('link_shop_name', e.target.value)}
                        placeholder="IN THE HAUS"
                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                        ชื่อร้านภาษาไทย (Shop Name TH)
                    </label>
                    <input
                        type="text"
                        value={settings.link_shop_name_th || ''}
                        onChange={(e) => handleSave('link_shop_name_th', e.target.value)}
                        placeholder="ในบ้าน"
                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                    />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                        Subtitle / Tagline (สโลแกนร้าน)
                    </label>
                    <input
                        type="text"
                        value={settings.link_subtitle || ''}
                        onChange={(e) => handleSave('link_subtitle', e.target.value)}
                        placeholder="จริตจัด รสชัดเจน"
                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                        เวลาเปิด-ปิด (Hours Text)
                    </label>
                    <input
                        type="text"
                        value={settings.link_hours || ''}
                        onChange={(e) => handleSave('link_hours', e.target.value)}
                        placeholder="เปิดทุกวัน 11:30 - 23:30 น."
                        className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                    ที่อยู่ร้าน (Location Text)
                </label>
                <input
                    type="text"
                    value={settings.link_location_text || ''}
                    onChange={(e) => handleSave('link_location_text', e.target.value)}
                    placeholder="ริมแม่น้ำโขง · นครพนม"
                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                />
            </div>

            <div>
                <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                    แฮชแท็กโซเชียล (Hashtags)
                </label>
                <input
                    type="text"
                    value={settings.link_tags || ''}
                    onChange={(e) => handleSave('link_tags', e.target.value)}
                    placeholder="#inthehausth, #homefood, #southernthaifood"
                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                />
                <p className="text-[10px] font-mono text-[var(--color-neutral)] mt-1">
                    ใส่เครื่องหมาย # นำหน้าและคั่นด้วยจุลภาค เช่น #tag1, #tag2, #tag3
                </p>
            </div>

            <div>
                <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                    Social Media Feed JSON URL (ฟีดรูปภาพเช็กอิน)
                </label>
                <input
                    type="text"
                    value={settings.link_social_feed_url || ''}
                    onChange={(e) => handleSave('link_social_feed_url', e.target.value)}
                    placeholder="เช่น https://widgets.elfsight.com/... หรือ JSON Feed URL"
                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                />
                <p className="text-[10px] font-mono text-[var(--color-neutral)] mt-1">
                    วางลิงก์ JSON Feed จากภายนอก (เช่น Elfsight, EmbedSocial) เพื่อแสดงรูปเช็กอินสด
                </p>
            </div>

            <div>
                <label className="block text-xs font-mono font-bold text-[var(--color-ink)] uppercase mb-1">
                    คำอธิบายสำหรับแชร์โซเชียล (Social Share Description)
                </label>
                <textarea
                    rows={3}
                    value={settings.link_og_description || ''}
                    onChange={(e) => handleSave('link_og_description', e.target.value)}
                    placeholder="ป้อนคำอธิบายของร้านสำหรับแสดงเวลาแชร์ลิงก์ลง LINE, Facebook..."
                    className="w-full bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] resize-y"
                />
            </div>

            {/* Menu Images Manager (10 Slots) */}
            <div className="space-y-4 border-t border-[var(--color-rule)] pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Menu Pages (รูปเมนู 10 หน้า)
                    </h3>
                    <span className="text-[10px] font-mono text-[var(--color-neutral)]">
                        คลิกปุ่มเพื่อสลับระหว่างหน้าเมนูหลักกับแท็บโปรโมชั่น
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((slot) => {
                        const url = settings[`link_menu_${slot}`];
                        const isPromo = promoSlots.includes(slot);
                        return (
                            <div
                                key={slot}
                                className={`p-2.5 rounded-xl border flex flex-col justify-between transition-colors ${
                                    isPromo
                                        ? 'bg-[var(--color-paper)] border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]'
                                        : 'bg-[var(--color-paper)] border-[var(--color-rule)]'
                                }`}
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <button
                                            type="button"
                                            onClick={() => togglePromoSlot(slot)}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                                                isPromo
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                    : 'bg-[var(--color-paper-2)] text-[var(--color-neutral)] border-[var(--color-rule)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            {isPromo ? 'PROMO' : 'MAIN'}
                                        </button>
                                        <span className="text-[9px] font-mono text-[var(--color-neutral)] font-bold">
                                            #{slot}
                                        </span>
                                    </div>

                                    <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-[var(--color-paper-2)] border border-[var(--color-rule)] flex items-center justify-center">
                                        {url ? (
                                            <img
                                                src={safeTimestampUrl(url, timestamp)}
                                                alt={`Menu ${slot}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-[10px] font-mono text-[var(--color-neutral)]">ว่าง</span>
                                        )}
                                        {uploading[`link_menu_${slot}`] && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-col gap-1">
                                    <label className="w-full cursor-pointer">
                                        <div className="bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md py-1 text-[9px] font-mono font-bold text-center text-[var(--color-ink)] transition-colors">
                                            {url ? 'เปลี่ยนรูป' : 'อัปโหลด'}
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => uploadImage(e.target.files[0], `link_menu_${slot}`)}
                                        />
                                    </label>
                                    {url && (
                                        <div className="flex gap-1 w-full">
                                            <button
                                                type="button"
                                                onClick={() => handleSave(`link_menu_${slot}`, '')}
                                                className="flex-1 bg-[var(--color-paper-2)] text-[var(--color-accent)] border border-[var(--color-rule)] rounded-md py-1 text-[9px] font-mono font-bold transition-colors text-center cursor-pointer"
                                                title="ลบเฉพาะช่องนี้"
                                            >
                                                ลบ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteMenu(slot)}
                                                className="flex-1 bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] hover:text-[var(--color-ink)] rounded-md py-1 text-[9px] font-mono font-bold transition-colors text-center cursor-pointer"
                                                title="ลบและเลื่อนคิวภาพถัดไปมาแทนที่"
                                            >
                                                ลบ & เลื่อน
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <label className="block w-full cursor-pointer group">
                    <div className="bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-xl p-3 text-center group-hover:border-[var(--color-ink)] transition-colors">
                        <span className="text-[var(--color-neutral)] text-xs font-mono group-hover:text-[var(--color-ink)] block">
                            อัปโหลดเมนูหลายรูปพร้อมกัน (ระบบจะเรียงเข้าช่องว่างถัดไป)
                        </span>
                    </div>
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleMenuUpload(e.target.files)}
                    />
                </label>
            </div>

            {/* Signature Dishes Manager (3 Slots) */}
            <div className="space-y-4 border-t border-[var(--color-rule)] pt-6">
                <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Signature Dishes (เมนูแนะนำ 3 จาน)
                    </h3>
                    <p className="text-[10px] font-mono text-[var(--color-neutral)]">
                        หากไม่ระบุ ระบบจะไม่แสดงส่วนนี้ในหน้า /link
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[1, 2, 3].map((n) => (
                        <div
                            key={n}
                            className="space-y-2 bg-[var(--color-paper)] p-3.5 rounded-xl border border-[var(--color-rule)]"
                        >
                            <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                {settings[`link_sig_img_${n}`] ? (
                                    <img
                                        src={safeTimestampUrl(settings[`link_sig_img_${n}`], timestamp)}
                                        className="w-full h-full object-cover"
                                        alt={`Sig ${n}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[var(--color-neutral)] font-mono text-xs">
                                        จานที่ #{n}
                                    </div>
                                )}
                            </div>
                            <label className="block cursor-pointer">
                                <div className="text-center text-[10px] font-mono font-bold text-[var(--color-neutral)] hover:text-[var(--color-ink)] py-1.5 border border-dashed border-[var(--color-rule)] rounded-lg">
                                    {uploading[`link_sig_img_${n}`] ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพ'}
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => uploadImage(e.target.files[0], `link_sig_img_${n}`)}
                                />
                            </label>
                            <input
                                type="text"
                                value={settings[`link_sig_name_${n}`] || ''}
                                onChange={(e) => handleSave(`link_sig_name_${n}`, e.target.value)}
                                placeholder="ชื่อเมนู"
                                className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2 rounded-lg text-[var(--color-ink)] text-xs font-bold outline-none focus:border-[var(--color-ink)]"
                            />
                            <input
                                type="text"
                                value={settings[`link_sig_price_${n}`] || ''}
                                onChange={(e) => handleSave(`link_sig_price_${n}`, e.target.value)}
                                placeholder="ราคา (บาท)"
                                className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2 rounded-lg text-[var(--color-ink)] text-xs font-mono outline-none focus:border-[var(--color-ink)]"
                            />
                            {settings[`link_sig_img_${n}`] && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSave(`link_sig_img_${n}`, '');
                                        handleSave(`link_sig_name_${n}`, '');
                                        handleSave(`link_sig_price_${n}`, '');
                                    }}
                                    className="text-[10px] font-mono text-[var(--color-accent)] hover:underline w-full text-center py-1 cursor-pointer"
                                >
                                    ลบข้อมูลจานนี้
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Atmosphere Images Manager (10 Slots) */}
            <div className="space-y-4 border-t border-[var(--color-rule)] pt-6">
                <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Atmosphere Gallery (รูปบรรยากาศร้าน 10 ช่อง)
                    </h3>
                    <p className="text-[10px] font-mono text-[var(--color-neutral)]">
                        รูปช่องที่ #1 จะถูกใช้เป็นภาพปกบรรยากาศในแกลเลอรี
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((slot) => {
                        const url = settings[`link_atm_${slot}`];
                        const isFirst = slot === 1;
                        return (
                            <div
                                key={slot}
                                className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                                    isFirst
                                        ? 'bg-[var(--color-paper)] border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]'
                                        : 'bg-[var(--color-paper)] border-[var(--color-rule)]'
                                }`}
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className={`text-[9px] font-mono font-bold ${
                                            isFirst ? 'text-[var(--color-ink)]' : 'text-[var(--color-neutral)]'
                                        }`}>
                                            #{slot} {isFirst ? '(COVER)' : ''}
                                        </span>
                                    </div>

                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[var(--color-paper-2)] border border-[var(--color-rule)] flex items-center justify-center">
                                        {url ? (
                                            <img
                                                src={safeTimestampUrl(url, timestamp)}
                                                alt={`Atm ${slot}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-[10px] font-mono text-[var(--color-neutral)]">ว่าง</span>
                                        )}
                                        {uploading[`link_atm_${slot}`] && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-col gap-1">
                                    <label className="w-full cursor-pointer">
                                        <div className="bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-md py-1 text-[9px] font-mono font-bold text-center text-[var(--color-ink)] transition-colors">
                                            {url ? 'เปลี่ยนรูป' : 'อัปโหลด'}
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => uploadImage(e.target.files[0], `link_atm_${slot}`)}
                                        />
                                    </label>
                                    {url && (
                                        <div className="flex gap-1 w-full">
                                            <button
                                                type="button"
                                                onClick={() => handleSave(`link_atm_${slot}`, '')}
                                                className="flex-1 bg-[var(--color-paper-2)] text-[var(--color-accent)] border border-[var(--color-rule)] rounded-md py-1 text-[9px] font-mono font-bold transition-colors text-center cursor-pointer"
                                                title="ลบเฉพาะช่องนี้"
                                            >
                                                ลบ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteAtm(slot)}
                                                className="flex-1 bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] hover:text-[var(--color-ink)] rounded-md py-1 text-[9px] font-mono font-bold transition-colors text-center cursor-pointer"
                                                title="ลบและเลื่อนคิวภาพถัดไปมาแทนที่"
                                            >
                                                ลบ & เลื่อน
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <label className="block w-full cursor-pointer group">
                    <div className="bg-[var(--color-paper)] border border-dashed border-[var(--color-rule)] rounded-xl p-3 text-center group-hover:border-[var(--color-ink)] transition-colors">
                        <span className="text-[var(--color-neutral)] text-xs font-mono group-hover:text-[var(--color-ink)] block">
                            อัปโหลดรูปบรรยากาศหลายรูปพร้อมกัน (ระบบจะเรียงเข้าช่องว่างถัดไป)
                        </span>
                    </div>
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleAtmUpload(e.target.files)}
                    />
                </label>
            </div>
        </div>
    );
}
