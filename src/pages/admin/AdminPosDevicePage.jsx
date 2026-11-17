// Register / remove THIS browser as a POS device (web only; the Sunmi app always opens /pos).
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import {
    getPosDeviceStatus, registerThisDevice, unregisterThisDevice, POS_DEVICE_ADMIN_ROLES
} from '../../utils/posDevice'

const formatThai = (iso) => {
    try {
        return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })
    } catch {
        return iso
    }
}

export default function AdminPosDevicePage() {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState(getPosDeviceStatus)
    const [name, setName] = useState('')

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('profiles').select('role, display_name, nickname').eq('id', user.id).single()
                if (!cancelled) setProfile(data || null)
            }
            if (!cancelled) setLoading(false)
        })()
        return () => { cancelled = true }
    }, [])

    const role = (profile?.role || '').toLowerCase()
    const canManage = POS_DEVICE_ADMIN_ROLES.includes(role)
    const who = profile?.nickname || profile?.display_name || role

    const register = () => {
        registerThisDevice({ name, by: who })
        setStatus(getPosDeviceStatus())
        setName('')
    }
    const unregister = () => {
        unregisterThisDevice()
        setStatus(getPosDeviceStatus())
    }

    return (
        <div className="max-w-2xl font-sans text-ink">
            <AdminPageHeader
                title="เครื่อง POS (เว็บ)"
                description="หน้า /pos และจอลูกค้า /pos/cfd บนเว็บเปิดได้เฉพาะเครื่องที่ลงทะเบียนที่นี่ คนอื่นที่พิมพ์ /pos (รวมถึงลูกค้า) จะถูกพากลับหน้าแรกทันที แอปบนเครื่อง Sunmi เปิดได้เสมอ"
            />

            <section className="border border-[var(--color-rule)] bg-paper rounded-rams">
                <div className="p-6 border-b border-[var(--color-rule)]">
                    <p className="text-sm font-bold text-[var(--color-muted)] leading-normal">เครื่องนี้</p>
                    {status.reason === 'app' && (
                        <p className="mt-1 text-base leading-relaxed">แอป POS: เปิด /pos ได้เสมอ ไม่ต้องลงทะเบียน</p>
                    )}
                    {status.reason === 'preview' && (
                        <p className="mt-1 text-base leading-relaxed">โหมด preview ในเครื่องนักพัฒนา: เปิด /pos ได้ ไม่ต้องลงทะเบียน</p>
                    )}
                    {status.reason === 'registered' && (
                        <div className="mt-1 text-base leading-relaxed">
                            <p><strong>ลงทะเบียนแล้ว</strong> ชื่อ <span className="font-bold">{status.record.name}</span></p>
                            <p className="text-[var(--color-muted)]">
                                โดย {status.record.by || '-'} เมื่อ <span className="font-mono">{formatThai(status.record.at)}</span>
                            </p>
                        </div>
                    )}
                    {status.reason === 'not_registered' && (
                        <p className="mt-1 text-base leading-relaxed">ยังไม่ได้ลงทะเบียน: เปิด /pos แล้วจะถูกพากลับหน้าแรก</p>
                    )}
                </div>

                <div className="p-6">
                    {loading ? (
                        <p className="text-base text-[var(--color-muted)]">กำลังตรวจสิทธิ์...</p>
                    ) : !canManage ? (
                        <p className="text-base leading-relaxed">เฉพาะเจ้าของ แอดมิน หรือผู้จัดการ เท่านั้นที่ลงทะเบียนหรือยกเลิกเครื่อง POS ได้</p>
                    ) : status.reason === 'registered' ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <a href="/pos" className="min-h-12 px-6 flex items-center justify-center bg-ink text-paper font-bold text-base">เปิด POS</a>
                            <button
                                type="button"
                                onClick={unregister}
                                className="min-h-12 px-6 border border-error text-error font-bold text-base hover:bg-error hover:text-paper transition-colors"
                            >
                                ยกเลิกการลงทะเบียนเครื่องนี้
                            </button>
                        </div>
                    ) : status.reason === 'not_registered' ? (
                        <div className="flex flex-col gap-3">
                            <label className="text-sm font-bold text-[var(--color-muted)] leading-normal" htmlFor="pos-device-name">
                                ชื่อเครื่อง (ไว้จำว่าเป็นเครื่องไหน)
                            </label>
                            <input
                                id="pos-device-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="เช่น โน้ตบุ๊กแคชเชียร์"
                                className="min-h-12 px-3 bg-canvas border border-[var(--color-rule)] rounded-rams text-base outline-none focus:border-ink"
                            />
                            <button
                                type="button"
                                onClick={register}
                                className="min-h-12 px-6 bg-ink text-paper font-bold text-base"
                            >
                                ลงทะเบียนเครื่องนี้เป็นเครื่อง POS
                            </button>
                            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                                ลงทะเบียนเฉพาะเครื่องของร้าน ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเบราว์เซอร์ ต้องลงทะเบียนใหม่
                            </p>
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    )
}
