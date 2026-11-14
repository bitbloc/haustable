/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { toast } from 'sonner'

const QUICK_CHIPS = [
    'เตรียมปิดรับออเดอร์ครัว 20:45',
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

            // 1. Broadcast via Realtime Channel with connection handshake
            const channel = supabase.channel('pos-broadcast-live', { config: { broadcast: { ack: true } } })
            try {
                if (channel.state !== 'joined') {
                    await new Promise((resolve) => {
                        const timer = setTimeout(resolve, 1500)
                        channel.subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                                clearTimeout(timer)
                                resolve()
                            }
                        })
                    })
                }
                await channel.send({
                    type: 'broadcast',
                    event: 'owner-announcement',
                    payload
                })
            } catch (broadcastErr) {
                console.warn('Realtime broadcast notice:', broadcastErr)
            } finally {
                try { supabase.removeChannel(channel) } catch (e) {}
            }

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

            // Broadcast clear event with connection handshake
            const channel = supabase.channel('pos-broadcast-live', { config: { broadcast: { ack: true } } })
            try {
                if (channel.state !== 'joined') {
                    await new Promise((resolve) => {
                        const timer = setTimeout(resolve, 1500)
                        channel.subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                                clearTimeout(timer)
                                resolve()
                            }
                        })
                    })
                }
                await channel.send({
                    type: 'broadcast',
                    event: 'owner-announcement-clear',
                    payload: {}
                })
            } catch (broadcastErr) {
                console.warn('Realtime broadcast clear notice:', broadcastErr)
            } finally {
                try { supabase.removeChannel(channel) } catch (e) {}
            }

            setActiveBroadcast(null)
            toast.success('ลบประกาศออกจากหน้าจอ POS แล้ว')
        } catch (err) {
            toast.error('Failed to clear: ' + err.message)
        }
    }

    return (
        <div className="bg-[oklch(97%_0.008_28)] border border-[oklch(88%_0.012_28)] rounded-2xl p-4 md:p-5 space-y-3.5 shadow-2xs font-sans">
            {/* Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[oklch(88%_0.012_28)]">
                <div>
                    <h3 className="text-sm font-semibold text-[oklch(18%_0.012_28)] tracking-tight">
                        ส่งข้อความประกาศถึงหน้าจอ POS
                    </h3>
                    <p className="text-xs text-[oklch(50%_0.010_28)] mt-0.5">
                        แสดงการแจ้งเตือนบนหน้าจอ POS ทุกเครื่องของพนักงานทันทีแบบเรียลไทม์
                    </p>
                </div>

                {activeBroadcast && (
                    <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
                        <span className="px-2.5 py-0.5 bg-[oklch(94%_0.02_140)] text-[oklch(35%_0.08_140)] border border-[oklch(84%_0.04_140)] rounded-full font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(45%_0.08_140)]" />
                            <span>กำลังแสดงบน POS</span>
                        </span>
                        <button
                            type="button"
                            onClick={handleClearBroadcast}
                            className="px-2.5 py-0.5 bg-[oklch(94%_0.02_28)] hover:bg-[oklch(90%_0.03_28)] text-[oklch(45%_0.15_28)] border border-[oklch(85%_0.04_28)] rounded-full font-medium transition-colors cursor-pointer"
                            title="ลบประกาศออกจากหน้าจอ POS"
                        >
                            ล้างประกาศ
                        </button>
                    </div>
                )}
            </div>

            {/* Active Announcement Preview */}
            {activeBroadcast && (
                <div className="bg-[oklch(94%_0.010_28)] border border-[oklch(88%_0.012_28)] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-[oklch(52%_0.16_28)] shrink-0">
                            ประกาศล่าสุด:
                        </span>
                        <span className="font-semibold text-[oklch(18%_0.012_28)] truncate">
                            &ldquo;{activeBroadcast.text}&rdquo;
                        </span>
                    </div>
                    <span className="font-mono text-[11px] text-[oklch(50%_0.010_28)] shrink-0 tabular-nums">
                        {activeBroadcast.timestamp ? new Date(activeBroadcast.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
            )}

            {/* Input Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2 text-xs">
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
                    className="w-full bg-[oklch(99%_0.004_28)] border border-[oklch(86%_0.012_28)] rounded-xl px-3.5 py-2.5 text-xs text-[oklch(18%_0.012_28)] placeholder:text-[oklch(60%_0.010_28)] focus:outline-none focus:border-[oklch(52%_0.16_28)]"
                />
                <button
                    type="button"
                    onClick={() => handleSendBroadcast()}
                    disabled={sending || !message.trim()}
                    className="w-full sm:w-auto px-4 py-2.5 bg-[oklch(18%_0.012_28)] hover:bg-[oklch(28%_0.012_28)] disabled:opacity-45 text-[oklch(97%_0.008_28)] rounded-xl font-medium flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer whitespace-nowrap"
                >
                    <span>{sending ? 'กำลังส่ง...' : 'ส่งถึง POS'}</span>
                    {!sending && <span aria-hidden="true">&rarr;</span>}
                </button>
            </div>

            {/* Quick Preset Chips */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-[oklch(50%_0.010_28)] font-medium mr-0.5">ข้อความด่วน:</span>
                {QUICK_CHIPS.map((chip, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => {
                            setMessage(chip)
                            handleSendBroadcast(chip)
                        }}
                        className="px-2.5 py-1 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(88%_0.012_28)] text-[oklch(28%_0.012_28)] rounded-full font-medium transition-colors cursor-pointer"
                    >
                        + {chip}
                    </button>
                ))}
            </div>
        </div>
    )
}
