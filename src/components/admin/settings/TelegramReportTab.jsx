/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabaseClient';

const EVENT_TOGGLES = [
    { key: 'telegram_notify_table_open', label: 'เปิดโต๊ะ', desc: 'Walk-in, ลูกค้าจองมาถึง, สแกน QR' },
    { key: 'telegram_notify_items', label: 'ลูกค้าสั่งอาหาร', desc: 'ทุกครั้งที่มีรายการเพิ่มเข้าบิล' },
    { key: 'telegram_notify_bill', label: 'เช็คบิล', desc: 'ยอดชำระ ส่วนลด และช่องทางจ่าย' },
    { key: 'telegram_notify_online', label: 'ออเดอร์ออนไลน์', desc: 'จองโต๊ะ, รับที่ร้าน, HAUSMADE' },
    { key: 'telegram_notify_shift', label: 'ปิดรอบเงินสด', desc: 'ยอดรอบและส่วนต่างเงินสด' },
    { key: 'telegram_notify_stock', label: 'นับปิดร้าน (สต๊อก)', desc: 'รายการผิดปกติ มูลค่าที่ขาด และของที่ต้องสั่ง' },
    { key: 'telegram_daily_summary', label: 'สรุปรายวัน', desc: 'ส่งอัตโนมัติวันละครั้งตามเวลาที่ตั้ง' }
];

function Toggle({ checked, onChange, label, desc }) {
    return (
        <label className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 bg-[var(--color-paper)] ${
            checked ? 'border-[var(--color-ink)] shadow-2xs' : 'border-[var(--color-rule)]'
        }`}>
            <div className="min-w-0">
                <span className="block font-bold text-xs text-[var(--color-ink)]">{label}</span>
                <span className="block text-[11px] text-[var(--color-neutral)] leading-snug">{desc}</span>
            </div>
            <div className={`w-9 h-5 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${checked ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-rule)]'}`}>
                <div className={`w-4 h-4 rounded-full bg-[var(--color-paper)] shadow-xs transform transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}

export default function TelegramReportTab({ settings, handleSave }) {
    const [chatIdDraft, setChatIdDraft] = useState(null);
    const [busy, setBusy] = useState('');
    const [chats, setChats] = useState(null);

    const chatId = chatIdDraft ?? settings.telegram_chat_id ?? '';
    const enabled = settings.telegram_enabled === 'true';
    const isOn = (key) => settings[key] === undefined || settings[key] === 'true';

    const invoke = async (event, label) => {
        setBusy(event);
        try {
            const { data, error } = await supabase.functions.invoke('telegram-report', {
                body: { event, chat_id: chatId.trim() || undefined }
            });
            if (error) {
                let msg = error.message;
                try {
                    msg = (await error.context.json()).error || msg;
                } catch {
                    // response body was not JSON; keep the generic message
                }
                throw new Error(msg);
            }
            if (data?.error) throw new Error(data.error);
            if (label) toast.success(label);
            return data;
        } catch (err) {
            toast.error(`Telegram: ${err.message}`);
            return null;
        } finally {
            setBusy('');
        }
    };

    const saveChatId = () => {
        if (chatIdDraft === null) return;
        handleSave('telegram_chat_id', chatIdDraft.trim());
        setChatIdDraft(null);
    };

    const findChats = async () => {
        const data = await invoke('discover_chats');
        if (data) {
            setChats(data.chats || []);
            if (!data.chats?.length) toast.message('ยังไม่พบห้อง — เพิ่มบอทเข้ากลุ่มแล้วพิมพ์ข้อความใดก็ได้ 1 ครั้ง แล้วกดค้นหาอีกครั้ง');
        }
    };

    const btn = 'px-3 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait';
    const btnGhost = `${btn} bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]`;
    const btnInk = `${btn} bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90`;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Connection */}
            <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-4">
                <div className="border-b border-[var(--color-rule)] pb-3">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Telegram Reports
                    </h2>
                    <p className="text-xs text-[var(--color-neutral)] leading-relaxed">
                        ส่งรายงานการขายเข้ากลุ่ม Telegram ของเจ้าของร้านแบบเรียลไทม์
                    </p>
                </div>

                <Toggle
                    checked={enabled}
                    onChange={(v) => {
                        if (v && !settings.telegram_chat_id) {
                            toast.error('ตั้งค่า Chat ID ก่อนเปิดใช้งาน');
                            return;
                        }
                        handleSave('telegram_enabled', v ? 'true' : 'false');
                    }}
                    label="เปิดการส่งรายงาน"
                    desc={enabled ? 'กำลังส่งรายงานเข้า Telegram' : 'ปิดอยู่ — ไม่มีข้อความถูกส่ง'}
                />

                <div>
                    <label htmlFor="telegram-chat-id" className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                        Chat ID ของกลุ่ม
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="telegram-chat-id"
                            type="text"
                            inputMode="numeric"
                            value={chatId}
                            onChange={(e) => setChatIdDraft(e.target.value)}
                            onBlur={saveChatId}
                            className="flex-1 min-w-0 bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                            placeholder="-1001234567890"
                        />
                        <button type="button" onClick={findChats} disabled={!!busy} className={btnGhost}>
                            {busy === 'discover_chats' ? 'กำลังค้นหา…' : 'ค้นหา'}
                        </button>
                    </div>
                    {chats && chats.length > 0 && (
                        <div className="mt-2 border border-[var(--color-rule)] rounded-xl divide-y divide-[var(--color-rule)] bg-[var(--color-paper)] overflow-hidden">
                            {chats.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        handleSave('telegram_chat_id', c.id);
                                        setChatIdDraft(null);
                                        setChats(null);
                                        toast.success(`เลือกห้อง ${c.title}`);
                                    }}
                                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--color-paper-2)] cursor-pointer"
                                >
                                    <span className="text-xs text-[var(--color-ink)] truncate">{c.title}</span>
                                    <span className="text-[11px] font-mono text-[var(--color-neutral)] shrink-0">{c.type} · {c.id}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => invoke('test', 'ส่งข้อความทดสอบแล้ว')} disabled={!!busy || !chatId} className={btnInk}>
                        {busy === 'test' ? 'กำลังส่ง…' : 'ส่งข้อความทดสอบ'}
                    </button>
                    <button type="button" onClick={() => invoke('daily_summary_now', 'ส่งสรุปแล้ว')} disabled={!!busy || !chatId} className={btnGhost}>
                        {busy === 'daily_summary_now' ? 'กำลังส่ง…' : 'ส่งสรุปถึงตอนนี้'}
                    </button>
                    <button type="button" onClick={() => invoke('stock_summary_now', 'ส่งสรุปสต๊อกแล้ว')} disabled={!!busy || !chatId} className={btnGhost}>
                        {busy === 'stock_summary_now' ? 'กำลังส่ง…' : 'ส่งสรุปนับปิดร้าน'}
                    </button>
                </div>

                <ol className="text-xs text-[var(--color-muted)] leading-relaxed space-y-1 list-decimal pl-4 border-t border-[var(--color-rule)] pt-3">
                    <li>สร้างบอทกับ <span className="font-mono">@BotFather</span> แล้วตั้ง secret <span className="font-mono">TELEGRAM_BOT_TOKEN</span> ใน Supabase</li>
                    <li>เพิ่มบอทเข้ากลุ่มเจ้าของร้าน แล้วพิมพ์ข้อความในกลุ่ม <span className="whitespace-nowrap">1 ครั้ง</span></li>
                    <li>กด “ค้นหา” เพื่อเลือกกลุ่ม แล้วกด “ส่งข้อความทดสอบ”</li>
                </ol>
            </div>

            {/* What to send */}
            <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] space-y-4">
                <div className="border-b border-[var(--color-rule)] pb-3">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Events
                    </h2>
                    <p className="text-xs text-[var(--color-neutral)] leading-relaxed">
                        เลือกเหตุการณ์ที่ต้องการให้แจ้งเตือน
                    </p>
                </div>

                <div className="space-y-2">
                    {EVENT_TOGGLES.map((t) => (
                        <Toggle
                            key={t.key}
                            checked={isOn(t.key)}
                            onChange={(v) => handleSave(t.key, v ? 'true' : 'false')}
                            label={t.label}
                            desc={t.desc}
                        />
                    ))}
                </div>

                <div>
                    <label htmlFor="telegram-summary-time" className="block text-xs font-bold text-[var(--color-ink)] mb-1">
                        เวลาส่งสรุปรายวัน
                    </label>
                    <input
                        id="telegram-summary-time"
                        type="time"
                        value={settings.telegram_daily_summary_time || '03:00'}
                        onChange={(e) => e.target.value && handleSave('telegram_daily_summary_time', e.target.value)}
                        className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-2.5 rounded-xl text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                    />
                    <p className="mt-1 text-[11px] text-[var(--color-neutral)] leading-snug">
                        สรุปครอบคลุม 24 ชม. ก่อนเวลานี้ — ตั้งหลังร้านปิด เช่น 03:00 เพื่อรวมบิลหลังเที่ยงคืน
                    </p>
                </div>
            </div>
        </div>
    );
}
