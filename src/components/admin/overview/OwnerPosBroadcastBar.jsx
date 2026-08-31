/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { Send, Megaphone, Trash2, CheckCircle2, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { toast } from 'sonner'

const QUICK_CHIPS = [
    'เตรียมปิดรับออเดอร์ครัว 21:30',
    'วัตถุดิบเนื้อวากิวหมดแล้ว',
    'มีลูกค้า VIP จองโต๊ะ ดูแลเป็นพิเศษ',
    'เตรียมตรวจนับเงินสดปิดรอบกะ',
    'เปิดรับออเดอร์ตามปกติ'
]

export default function OwnerPosBroadcastBar() {
    const [message, setMessage] = useState('')
    const [activeBroadcast, setActiveBroadcast] = useState(null)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        loadCurrentBroadcast()

        const channel = supabase
            .channel('pos-broadcast-listener')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.pos_owner_broadcast' }, () => {
                loadCurrentBroadcast()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const loadCurrentBroadcast = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value, updated_at')
                .eq('key', 'pos_owner_broadcast')
                .maybeSingle()

            if (!error && data && data.value) {
                try {
                    const parsed = JSON.parse(data.value)
                    setActiveBroadcast(parsed)
                } catch {
                    setActiveBroadcast({ text: data.value, time: data.updated_at })
                }
            } else {
                setActiveBroadcast(null)
            }
        } catch {
            setActiveBroadcast(null)
        }
    }

    const handleSendBroadcast = async (textToSend = message) => {
        const text = (textToSend || '').trim()
        if (!text) {
            toast.error('กรุณาพิมพ์ข้อความที่ต้องการส่งถึง POS')
            return
        }

        setSending(true)
        try {
            const payload = {
                text,
                sender: 'OWNER / BACKOFFICE',
                timestamp: new Date().toISOString(),
                id: crypto.randomUUID()
            }

            // 1. Broadcast via Realtime Channel
            const channel = supabase.channel('pos-broadcast-live')
            await channel.send({
                type: 'broadcast',
                event: 'owner-announcement',
                payload
            })
            supabase.removeChannel(channel)

            // 2. Persist in app_settings
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'pos_owner_broadcast',
                    value: JSON.stringify(payload),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            if (error) throw error

            toast.success('ส่งประกาศถึงหน้าจอ POS ทุกเครื่องเรียบร้อยแล้ว')
            setMessage('')
            setActiveBroadcast(payload)
        } catch (err) {
            console.error('Failed to broadcast to POS:', err)
            toast.error('เกิดข้อผิดพลาดในการส่งข้อความ: ' + err.message)
        } finally {
            setSending(false)
        }
    }

    const handleClearBroadcast = async () => {
        try {
            await supabase
                .from('app_settings')
                .delete()
                .eq('key', 'pos_owner_broadcast')

            // Broadcast clear event
            const channel = supabase.channel('pos-broadcast-live')
            await channel.send({
                type: 'broadcast',
                event: 'owner-announcement-clear',
                payload: {}
            })
            supabase.removeChannel(channel)

            setActiveBroadcast(null)
            toast.success('ลบประกาศออกจากหน้าจอ POS แล้ว')
        } catch (err) {
            toast.error('Failed to clear: ' + err.message)
        }
    }

    return (
        <div className="bg-[oklch(98%_0.006_28)] border-2 border-[oklch(85%_0.012_28)] rounded-xl p-4 md:p-5 space-y-3 shadow-xs">
            {/* Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[oklch(85%_0.012_28)] font-mono">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[oklch(18%_0.012_28)] text-white rounded-xs">
                        <Megaphone size={15} />
                    </div>
                    <div>
                        <h3 className="text-xs md:text-sm font-black uppercase text-[oklch(18%_0.012_28)]">
                            OWNER DIRECT BROADCAST TO POS // ส่งคำสั่งด่วนถึงหน้าร้าน
                        </h3>
                        <p className="text-[10px] text-[oklch(42%_0.010_28)]">
                            ข้อความจะแจ้งเตือนบนหน้าจอ POS ทุกเครื่องของพนักงานทันทีแบบ Real-time
                        </p>
                    </div>
                </div>

                {activeBroadcast && (
                    <div className="flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto">
                        <span className="px-2 py-0.5 bg-[oklch(92%_0.02_140)] text-[oklch(35%_0.08_140)] border border-[oklch(85%_0.04_140)] rounded-xs font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.14_140)] animate-pulse" />
                            <span>ACTIVE ON POS</span>
                        </span>
                        <button
                            onClick={handleClearBroadcast}
                            className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xs font-bold transition-colors"
                            title="ลบประกาศออกจากหน้าจอ POS"
                        >
                            ลบประกาศ
                        </button>
                    </div>
                )}
            </div>

            {/* Active Announcement Preview */}
            {activeBroadcast && (
                <div className="bg-[oklch(96%_0.015_28)] border border-[oklch(88%_0.02_28)] rounded-lg p-2.5 flex items-center justify-between gap-3 font-mono text-xs">
                    <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider text-[10px] shrink-0">
                            ประกาศปัจจุบัน:
                        </span>
                        <span className="font-bold text-[oklch(18%_0.012_28)] truncate">
                            "{activeBroadcast.text}"
                        </span>
                    </div>
                    <span className="text-[10px] text-[oklch(55%_0.010_28)] shrink-0">
                        {activeBroadcast.timestamp ? new Date(activeBroadcast.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
            )}

            {/* Input Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2 font-mono text-xs">
                <input
                    type="text"
                    placeholder="พิมพ์คำสั่งด่วนหรือประกาศถึงพนักงานหน้าร้าน..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendBroadcast()
                        }
                    }}
                    className="w-full bg-white border border-[oklch(85%_0.012_28)] rounded-lg px-3.5 py-2 text-xs text-[oklch(18%_0.012_28)] placeholder:text-gray-400 focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                />
                <button
                    onClick={() => handleSendBroadcast()}
                    disabled={sending || !message.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-[oklch(18%_0.012_28)] hover:bg-black disabled:opacity-50 text-white rounded-lg font-black flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm"
                >
                    <Send size={13} />
                    <span>{sending ? 'กำลังส่ง...' : 'SEND TO POS'}</span>
                </button>
            </div>

            {/* Quick Preset Chips */}
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px] pt-1">
                <span className="text-[oklch(55%_0.010_28)] text-[10px] font-bold uppercase">ข้อความด่วน:</span>
                {QUICK_CHIPS.map((chip, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            setMessage(chip)
                            handleSendBroadcast(chip)
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm font-semibold transition-colors"
                    >
                        + {chip}
                    </button>
                ))}
            </div>
        </div>
    )
}
