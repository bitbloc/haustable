import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useHausmadeAdmin } from '../../hooks/useHausmadeAdmin'
import HausmadeDocumentPrinter from '../../components/hausmade/HausmadeDocumentPrinter'
import HausmadeOnlineBillModal from '../../components/hausmade/HausmadeOnlineBillModal'
import HausmadeCatalogManager from '../../components/hausmade/HausmadeCatalogManager'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'
import { exportFlashExpressCSV, exportKexCSV, exportThailandPostCSV } from '../../utils/courierExportHelper'
import { exportToSTL, exportToSTEP } from '../../utils/keychain3dExporter'

export default function HausmadeAdminPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const urlTab = searchParams.get('tab')
    const {
        loading,
        orders,
        settings,
        fetchAdminData,
        updateSettings,
        updateOrderStatus,
        updateBatchOrderStatus
    } = useHausmadeAdmin()

    const [activeTab, setActiveTab] = useState(urlTab || 'orders') // 'orders' | 'catalog' | 'settings'

    useEffect(() => {
        if (urlTab && urlTab !== activeTab) {
            setActiveTab(urlTab)
        }
    }, [urlTab])
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null)
    const [printOrders, setPrintOrders] = useState([])
    const [selectedOrderForPngBill, setSelectedOrderForPngBill] = useState(null)
    const [printDocType, setPrintDocType] = useState('label') // 'label' | 'a4_stickers' | 'receipt'
    const [slipModalUrl, setSlipModalUrl] = useState(null)

    // Batch Selection State for Orders
    const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())
    const [isBatchUpdating, setIsBatchUpdating] = useState(false)

    // Form state for Settings
    const [formSettings, setFormSettings] = useState({
        shopModeHausmade: settings.shopModeHausmade || 'manual_close',
        shippingFee: settings.shippingFee,
        freeShippingMinItems: settings.freeShippingMinItems,
        freeShippingMinAmount: settings.freeShippingMinAmount,
        senderName: settings.senderName,
        senderPhone: settings.senderPhone,
        senderAddress: settings.senderAddress,
        senderTaxId: settings.senderTaxId,
        keychainPricing: settings.keychainPricing || {
            basePrice: 180,
            baseCharLimit: 4,
            extraCharPrice: 15,
            maxChars: 10,
            maxElements: 2,
            elementPrice: 20,
            dualTonePrice: 30,
            reverseEngravePrice: 35,
            heavyDutyPrice: 20
        },
        keychainCharms: settings.keychainCharms || [
            { id: 'flower', name: 'HAUS Flower (ดอกไม้เอกลักษณ์)', symbol: '✿', is_default: true, price: 20, stl_url: null }
        ]
    })

    // Brand Charm STL Upload Form State
    const [newCharmName, setNewCharmName] = useState('')
    const [newCharmSymbol, setNewCharmSymbol] = useState('✿')
    const [newCharmPrice, setNewCharmPrice] = useState(20)
    const [newCharmFile, setNewCharmFile] = useState(null)
    const [isUploadingCharm, setIsUploadingCharm] = useState(false)

    const [settingsSaveMsg, setSettingsSaveMsg] = useState('')

    // Sync settings when loaded
    React.useEffect(() => {
        setFormSettings({
            shopModeHausmade: settings.shopModeHausmade || 'manual_close',
            shippingFee: settings.shippingFee,
            freeShippingMinItems: settings.freeShippingMinItems,
            freeShippingMinAmount: settings.freeShippingMinAmount,
            senderName: settings.senderName,
            senderPhone: settings.senderPhone,
            senderAddress: settings.senderAddress,
            senderTaxId: settings.senderTaxId,
            keychainPricing: settings.keychainPricing || {
                basePrice: 180,
                baseCharLimit: 4,
                extraCharPrice: 15,
                maxChars: 10,
                maxElements: 2,
                elementPrice: 20,
                dualTonePrice: 30,
                reverseEngravePrice: 35,
                heavyDutyPrice: 20
            },
            keychainCharms: settings.keychainCharms || [
                { id: 'flower', name: 'HAUS Flower (ดอกไม้เอกลักษณ์)', symbol: '✿', is_default: true, price: 20, stl_url: null }
            ]
        })
    }, [settings])

    // Handler to Add a Brand Charm STL
    const handleAddBrandCharm = async (e) => {
        e.preventDefault()
        if (!newCharmName.trim()) {
            toast.error('กรุณาระบุชื่อชาร์ม')
            return
        }

        try {
            setIsUploadingCharm(true)
            let stlUrl = null
            if (newCharmFile) {
                const path = `charms/${Date.now()}_${newCharmFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
                const { data, error } = await supabase.storage.from('public-assets').upload(path, newCharmFile, { upsert: true })
                if (!error && data) {
                    const { data: publicUrlData } = supabase.storage.from('public-assets').getPublicUrl(path)
                    stlUrl = publicUrlData.publicUrl
                }
            }

            const newCharm = {
                id: `charm-${Date.now()}`,
                name: newCharmName.trim(),
                symbol: newCharmSymbol.trim() || '✿',
                price: Number(newCharmPrice) || 0,
                stl_url: stlUrl,
                created_at: new Date().toISOString()
            }

            const updatedCharms = [...(formSettings.keychainCharms || []), newCharm]
            setFormSettings(prev => ({
                ...prev,
                keychainCharms: updatedCharms
            }))

            setNewCharmName('')
            setNewCharmFile(null)
            toast.success(`เพิ่มชาร์มแบรนด์ "${newCharm.name}" สำเร็จ (อย่าลืมกดบันทึกการตั้งค่าด้านล่าง)`)
        } catch (err) {
            console.error('Error adding charm:', err)
            toast.error('ไม่สามารถอัปโหลดชาร์มได้: ' + err.message)
        } finally {
            setIsUploadingCharm(false)
        }
    }

    const handleRemoveBrandCharm = (charmId) => {
        if (charmId === 'flower') {
            toast.error('ไม่สามารถลบชาร์มดอกไม้หลักของแบรนด์ได้')
            return
        }
        setFormSettings(prev => ({
            ...prev,
            keychainCharms: (prev.keychainCharms || []).filter(c => c.id !== charmId)
        }))
        toast.info('ลบชาร์มเรียบร้อยแล้ว (อย่าลืมกดบันทึกการตั้งค่าด้านล่าง)')
    }

    // Order Tracking Form State (per order ID)
    const [trackingInputs, setTrackingInputs] = useState({})

    const handleTrackingChange = (orderId, field, value) => {
        setTrackingInputs(prev => ({
            ...prev,
            [orderId]: {
                ...prev[orderId],
                [field]: value
            }
        }))
    }

    // Selection Helpers for Batch Actions
    const toggleSelectOrder = (id) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAllOrders = (orderList) => {
        if (selectedOrderIds.size === orderList.length) {
            setSelectedOrderIds(new Set())
        } else {
            setSelectedOrderIds(new Set(orderList.map(o => o.id)))
        }
    }

    const clearSelectedOrders = () => {
        setSelectedOrderIds(new Set())
    }

    const handleSaveTracking = async (orderId, currentStatus) => {
        const input = trackingInputs[orderId] || {}
        const courier = input.courierName !== undefined ? input.courierName : 'Flash Express'
        const trackingNum = input.trackingNumber || ''

        const newStatus = trackingNum ? 'shipped' : currentStatus

        const res = await updateOrderStatus(orderId, {
            status: newStatus,
            courierName: courier,
            trackingNumber: trackingNum
        })

        if (res.success) {
            // Attempt to send LINE Push notification if user has linked LINE
            if (trackingNum) {
                try {
                    const orderData = orders.find(o => o.id === orderId)
                    const profileId = orderData?.user_id
                    let lineUserId = null
                    if (profileId) {
                        const { data: prof } = await supabase.from('profiles').select('line_user_id').eq('id', profileId).maybeSingle()
                        if (prof?.line_user_id) lineUserId = prof.line_user_id
                    }

                    if (lineUserId) {
                        await supabase.functions.invoke('send-line-push', {
                            body: {
                                lineUserId,
                                messageType: 'tracking_update',
                                courierName: courier,
                                trackingNumber: trackingNum,
                                trackingUrl: `https://inthehaus.cafe/tracking/${orderData?.tracking_token || orderId}`,
                                orderToken: orderData?.tracking_token || orderId
                            }
                        })
                    }
                } catch (lineErr) {
                    console.warn('[handleSaveTracking] LINE push error:', lineErr)
                }
            }
            toast.success('บันทึกข้อมูลการจัดส่งเรียบร้อยแล้ว')
        } else {
            toast.error('เกิดข้อผิดพลาด: ' + res.error)
        }
    }

    const handleStatusChange = async (orderId, newStatus) => {
        const res = await updateOrderStatus(orderId, { status: newStatus })
        if (res.success) {
            toast.success(`เปลี่ยนสถานะเป็น ${newStatus.toUpperCase()} สำเร็จ`)
        } else {
            toast.error('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + res.error)
        }
    }

    const handleBatchStatusUpdate = async (newStatus) => {
        if (selectedOrderIds.size === 0) return
        const count = selectedOrderIds.size
        const statusLabels = {
            confirmed: 'รับออเดอร์ (CONFIRMED)',
            packing: 'กำลังแพ็คพัสดุ (PACKING)',
            ready: 'พร้อมส่ง/รอรับ (READY)',
            shipped: 'จัดส่งแล้ว (SHIPPED)',
            completed: 'สำเร็จเรียบร้อย (COMPLETED)',
            cancelled: 'ยกเลิกและคืนสต็อก (CANCEL & RESTOCK)'
        }
        const label = statusLabels[newStatus] || newStatus
        if (!window.confirm(`ต้องการเปลี่ยนสถานะของ ${count} ออเดอร์ที่เลือกเป็น "${label}" หรือไม่?`)) return

        setIsBatchUpdating(true)
        try {
            const res = await updateBatchOrderStatus(selectedOrderIds, { status: newStatus })
            if (res.success) {
                toast.success(`อัปเดตสถานะสำเร็จ ${res.count || count} ออเดอร์เรียบร้อยแล้ว`)
                clearSelectedOrders()
            } else {
                toast.error('เกิดข้อผิดพลาดในการอัปเดต: ' + res.error)
            }
        } catch (err) {
            toast.error('เกิดข้อผิดพลาด: ' + err.message)
        } finally {
            setIsBatchUpdating(false)
        }
    }

    const handleSaveSettingsSubmit = async (e) => {
        e.preventDefault()
        setSettingsSaveMsg('')
        const res = await updateSettings(formSettings)
        if (res.success) {
            setSettingsSaveMsg('บันทึกการตั้งค่าเรียบร้อยแล้ว')
            setTimeout(() => setSettingsSaveMsg(''), 3000)
        } else {
            setSettingsSaveMsg('เกิดข้อผิดพลาด: ' + res.error)
        }
    }

    // 3D Keychain Exporter for Staff & Print Operators
    const handleAdminExport3D = (item, format) => {
        try {
            const textMatch = (item.name || '').match(/["'“](.*?)["'”]/) || (item.selected_options || '').match(/ชื่อ:\s*["'“]?(.*?)["'”]?\s*\|/)
            const customText = textMatch ? textMatch[1] : 'CUSTOM'
            const is5mm = (item.selected_options || '').includes('5mm')
            const holeDiameter = is5mm ? 5.0 : 4.0

            const specs = {
                text: customText,
                holeDiameter,
                baseStyle: (item.selected_options || '').includes('CAPSULE') ? 'capsule' : ((item.selected_options || '').includes('CONNECTED') ? 'connected' : 'rail'),
                eyeletPosition: 'left'
            }

            if (format === 'stl') {
                const filename = exportToSTL(specs)
                toast.success(`ดาวน์โหลดไฟล์ STL "${filename}" สำหรับพิมพ์ 3D เรียบร้อย`)
            } else {
                const filename = exportToSTEP(specs)
                toast.success(`ดาวน์โหลดไฟล์ CAD STEP "${filename}" เรียบร้อย`)
            }
        } catch (e) {
            console.error('3D export error:', e)
            toast.error('ไม่สามารถส่งออกไฟล์ 3D ได้: ' + e.message)
        }
    }

    const filteredOrders = orders.filter(o => {
        // Pre-order special filter
        if (statusFilter === 'preorder') {
            const isPreOrder = o.is_preorder === true || (o.customer_note || '').includes('PRE-ORDER')
            if (!isPreOrder) return false
        } else if (statusFilter !== 'ALL' && o.status !== statusFilter) {
            return false
        }

        // Search query filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            const token = (o.tracking_token || o.id || '').toLowerCase()
            const name = (o.pickup_contact_name || o.guest_name || '').toLowerCase()
            const phone = (o.pickup_contact_phone || o.phone_number || '').toLowerCase()
            const tracking = (o.tracking_number || '').toLowerCase()
            return token.includes(q) || name.includes(q) || phone.includes(q) || tracking.includes(q)
        }

        return true
    })

    return (
        <div className="min-h-screen bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-mono p-4 sm:p-6 flex flex-col gap-6 selection:bg-[oklch(52%_0.16_28)] selection:text-white">
            {/* Top Admin Header Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)]">
                <div>
                    <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest block">
                        // DEDICATED BRAND BACKOFFICE
                    </span>
                    <h1 className="text-2xl font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)] mt-0.5">
                        [ HAUSMADE ADMIN SYSTEM ]
                    </h1>
                </div>

                {/* Header Actions & Tab Switcher (Tabular Brutalist Cell Grid) */}
                <div className="flex items-center gap-3 flex-wrap">
                    <a
                        href="/hausmade"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 text-xs font-bold uppercase border border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] hover:bg-[oklch(52%_0.16_28)] hover:text-white transition-colors cursor-pointer rounded-xs"
                        title="เปิดหน้าร้าน HAUSMADE สำหรับลูกค้าในแท็บใหม่"
                    >
                        [ SHOP ↗ ]
                    </a>

                    <div className="inline-flex items-stretch border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] rounded-xs overflow-hidden divide-x divide-[oklch(85%_0.012_28)]">
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`px-4 py-2 text-xs font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === 'orders'
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                            }`}
                        >
                            [ FULFILLMENT QUEUE ]
                        </button>
                        <button
                            onClick={() => setActiveTab('catalog')}
                            className={`px-4 py-2 text-xs font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === 'catalog'
                                    ? 'bg-[oklch(52%_0.16_28)] text-white'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                            }`}
                        >
                            [ CATALOG & PRODUCTS ]
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-2 text-xs font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === 'settings'
                                    ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                    : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)] hover:bg-[oklch(90%_0.012_28)]'
                            }`}
                        >
                            [ SHIPPING & SENDER SETTINGS ]
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'orders' ? (
                /* TAB 1: ORDER FULFILLMENT QUEUE */
                <div className="flex flex-col gap-6">
                    {/* Search & Filter Bar */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-[oklch(85%_0.012_28)] pb-4">
                        {/* Status Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {['ALL', 'pending', 'confirmed', 'packing', 'ready', 'shipped', 'preorder', 'cancelled'].map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-3 py-1.5 text-xs font-bold uppercase border transition-all whitespace-nowrap rounded-xs cursor-pointer ${
                                        statusFilter === st
                                            ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                            : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}
                                >
                                    {st === 'preorder' ? '[ PRE-ORDER ]' : `[ ${st.toUpperCase()} ]`}
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative min-w-[260px]">
                            <input
                                type="text"
                                placeholder="ค้นหา Token, ชื่อ, เบอร์โทร, เลขพัสดุ..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-3 py-1.5 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs focus:outline-none focus:border-[oklch(52%_0.16_28)] rounded-xs"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[oklch(55%_0.010_28)] uppercase cursor-pointer"
                                >
                                    [ X ]
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Pre-order Batch Mode Banner */}
                    {statusFilter === 'preorder' && (
                        <div className="p-4 bg-[oklch(52%_0.16_28)]/10 border border-[oklch(52%_0.16_28)] flex flex-wrap items-center justify-between gap-3 text-xs rounded-xs">
                            <div>
                                <span className="font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider block">
                                    [ BATCH PRE-ORDER MANAGEMENT ] // จัดการรอบพรีออเดอร์
                                </span>
                                <span className="text-[oklch(42%_0.010_28)]">
                                    พบ <strong className="tabular-nums text-[oklch(18%_0.012_28)]">{filteredOrders.length}</strong> รายการพรีออเดอร์ · สามารถเลือกหลายรายการเพื่อเปลี่ยนสถานะทั้งรอบ หรือพิมพ์สติกเกอร์ส่งของเป็นชุดได้ทันที
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => selectAllOrders(filteredOrders)}
                                    className="px-3 py-1.5 bg-[oklch(18%_0.012_28)] text-white text-[11px] font-bold uppercase hover:bg-[oklch(28%_0.012_28)] transition-colors cursor-pointer rounded-xs"
                                >
                                    เลือกพรีออเดอร์ทั้งหมดในรอบนี้
                                </button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="py-16 text-center text-xs text-[oklch(55%_0.010_28)] uppercase tracking-widest animate-pulse">
                            [ LOADING FULFILLMENT ORDERS... ]
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="py-16 text-center border-2 border-dashed border-[oklch(85%_0.012_28)] bg-[oklch(98%_0.006_28)] text-xs text-[oklch(55%_0.010_28)] uppercase rounded-xs">
                            [ NO ORDERS FOUND IN QUEUE ]
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* Batch Actions & Courier Export Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] font-mono text-xs rounded-xs">
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                                        <input
                                            type="checkbox"
                                            checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                                            onChange={() => selectAllOrders(filteredOrders)}
                                            className="w-4 h-4 accent-[oklch(52%_0.16_28)] cursor-pointer"
                                        />
                                        <span>เลือกทั้งหมด (<span className="tabular-nums">{selectedOrderIds.size}</span>/<span className="tabular-nums">{filteredOrders.length}</span>)</span>
                                    </label>

                                    {selectedOrderIds.size > 0 && (
                                        <button
                                            onClick={clearSelectedOrders}
                                            className="text-[10px] text-[oklch(52%_0.16_28)] hover:underline cursor-pointer"
                                        >
                                            [ ล้างที่เลือก ]
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Batch Status Changer Dropdown */}
                                    <div className="flex items-center gap-1.5 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] px-2 py-1 rounded-xs shadow-2xs">
                                        <span className="text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase">
                                            {isBatchUpdating ? 'กำลังอัปเดต...' : 'เปลี่ยนสถานะชุด:'}
                                        </span>
                                        <select
                                            disabled={selectedOrderIds.size === 0 || isBatchUpdating}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    handleBatchStatusUpdate(e.target.value)
                                                    e.target.value = ''
                                                }
                                            }}
                                            className="bg-transparent text-xs font-bold outline-none cursor-pointer text-[oklch(18%_0.012_28)] disabled:text-[oklch(65%_0.010_28)]"
                                        >
                                            <option value="">-- เลือกสถานะ ({selectedOrderIds.size}) --</option>
                                            <option value="confirmed">รับออเดอร์ (CONFIRMED)</option>
                                            <option value="packing">กำลังแพ็คพัสดุ (PACKING)</option>
                                            <option value="ready">พร้อมส่ง/รอรับ (READY)</option>
                                            <option value="shipped">จัดส่งแล้ว (SHIPPED)</option>
                                            <option value="completed">สำเร็จเรียบร้อย (COMPLETED)</option>
                                            <option value="cancelled">ยกเลิกและคืนสต็อก (CANCEL & RESTOCK)</option>
                                        </select>
                                    </div>

                                    {/* A4 Sticker Sheet Batch Print */}
                                    <button
                                        disabled={selectedOrderIds.size === 0}
                                        onClick={() => {
                                            const toPrint = filteredOrders.filter(o => selectedOrderIds.has(o.id))
                                            setPrintOrders(toPrint)
                                            setPrintDocType('a4_stickers')
                                            setSelectedOrderForPrint(toPrint[0])
                                        }}
                                        className={`px-3 py-1.5 font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap rounded-xs ${
                                            selectedOrderIds.size > 0
                                                ? 'bg-[oklch(52%_0.16_28)] text-white hover:opacity-90 cursor-pointer shadow-2xs'
                                                : 'bg-[oklch(90%_0.010_28)] text-[oklch(55%_0.010_28)] cursor-not-allowed'
                                        }`}
                                        title="พิมพ์ใบปะหน้าพัสดุขนาด A4 แบบ 4 ใบต่อหน้า (2x2)"
                                    >
                                        <span>[ A4 สติกเกอร์ ]</span>
                                        <span className="tabular-nums">({selectedOrderIds.size})</span>
                                    </button>

                                    {/* 100x150mm Direct Thermal Label Batch Print */}
                                    <button
                                        disabled={selectedOrderIds.size === 0}
                                        onClick={() => {
                                            const toPrint = filteredOrders.filter(o => selectedOrderIds.has(o.id))
                                            setPrintOrders(toPrint)
                                            setPrintDocType('thermal_100x150')
                                            setSelectedOrderForPrint(toPrint[0])
                                        }}
                                        className={`px-3 py-1.5 font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap rounded-xs ${
                                            selectedOrderIds.size > 0
                                                ? 'bg-[oklch(18%_0.012_28)] text-white hover:bg-[oklch(28%_0.012_28)] cursor-pointer shadow-2xs'
                                                : 'bg-[oklch(90%_0.010_28)] text-[oklch(55%_0.010_28)] cursor-not-allowed'
                                        }`}
                                        title="พิมพ์สติกเกอร์ความร้อนขนาด 100x150 มม. (4x6 นิ้ว) สำหรับเครื่องพิมพ์ฉลาก Flash/Kerry/Xprinter"
                                    >
                                        <span>[ ฉลาก 100x150 ]</span>
                                        <span className="tabular-nums">({selectedOrderIds.size})</span>
                                    </button>

                                    {/* Flash Express CSV Export */}
                                    <button
                                        disabled={selectedOrderIds.size === 0}
                                        onClick={() => {
                                            const toExport = filteredOrders.filter(o => selectedOrderIds.has(o.id))
                                            exportFlashExpressCSV(toExport)
                                        }}
                                        className={`px-2.5 py-1.5 font-bold uppercase border transition-all rounded-xs whitespace-nowrap ${
                                            selectedOrderIds.size > 0
                                                ? 'bg-[oklch(92%_0.08_75)] text-[oklch(22%_0.08_75)] border-[oklch(80%_0.10_75)] hover:bg-[oklch(88%_0.10_75)] cursor-pointer shadow-2xs'
                                                : 'bg-[oklch(92%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)] cursor-not-allowed'
                                        }`}
                                        title="ส่งออกไฟล์ CSV สำหรับอัปโหลดเข้า Flash Express FlashDrop"
                                    >
                                        [ FLASH CSV ]
                                    </button>

                                    {/* KEX (Kerry) CSV Export */}
                                    <button
                                        disabled={selectedOrderIds.size === 0}
                                        onClick={() => {
                                            const toExport = filteredOrders.filter(o => selectedOrderIds.has(o.id))
                                            exportKexCSV(toExport)
                                        }}
                                        className={`px-2.5 py-1.5 font-bold uppercase border transition-all rounded-xs whitespace-nowrap ${
                                            selectedOrderIds.size > 0
                                                ? 'bg-[oklch(90%_0.08_45)] text-[oklch(25%_0.08_45)] border-[oklch(78%_0.10_45)] hover:bg-[oklch(85%_0.10_45)] cursor-pointer shadow-2xs'
                                                : 'bg-[oklch(92%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)] cursor-not-allowed'
                                        }`}
                                        title="ส่งออกไฟล์ CSV สำหรับอัปโหลดเข้า KEX (Kerry Express)"
                                    >
                                        [ KEX CSV ]
                                    </button>

                                    {/* Thailand Post CSV Export */}
                                    <button
                                        disabled={selectedOrderIds.size === 0}
                                        onClick={() => {
                                            const toExport = filteredOrders.filter(o => selectedOrderIds.has(o.id))
                                            exportThailandPostCSV(toExport)
                                        }}
                                        className={`px-2.5 py-1.5 font-bold uppercase border transition-all rounded-xs whitespace-nowrap ${
                                            selectedOrderIds.size > 0
                                                ? 'bg-[oklch(90%_0.08_25)] text-[oklch(25%_0.08_25)] border-[oklch(78%_0.10_25)] hover:bg-[oklch(85%_0.10_25)] cursor-pointer shadow-2xs'
                                                : 'bg-[oklch(92%_0.010_28)] text-[oklch(55%_0.010_28)] border-[oklch(85%_0.012_28)] cursor-not-allowed'
                                        }`}
                                        title="ส่งออกไฟล์ CSV สำหรับอัปโหลดเข้า ไปรษณีย์ไทย EMS Drop-off"
                                    >
                                        [ ไปรษณีย์ไทย CSV ]
                                    </button>
                                </div>
                            </div>

                            {filteredOrders.map((order) => {
                                const inputState = trackingInputs[order.id] || {}
                                const currentCourier = inputState.courierName !== undefined ? inputState.courierName : (order.courier_name || 'Flash Express')
                                const currentTracking = inputState.trackingNumber !== undefined ? inputState.trackingNumber : (order.tracking_number || '')

                                return (
                                    <div
                                        key={order.id}
                                        className="bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] p-6 flex flex-col gap-4 shadow-2xs rounded-xs"
                                    >
                                        {/* Order Top Bar */}
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-[oklch(85%_0.012_28)] pb-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOrderIds.has(order.id)}
                                                    onChange={() => toggleSelectOrder(order.id)}
                                                    className="w-4 h-4 accent-[oklch(52%_0.16_28)] cursor-pointer shrink-0"
                                                />
                                                <span className="font-bold text-sm text-[oklch(52%_0.16_28)] tabular-nums">
                                                    TOKEN: {order.tracking_token || order.id}
                                                </span>
                                                <span className="text-xs text-[oklch(55%_0.010_28)] tabular-nums">
                                                    DATE: {new Date(order.created_at).toLocaleDateString('th-TH')} {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                {(order.is_preorder || (order.customer_note && order.customer_note.includes('PRE-ORDER'))) && (
                                                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase border bg-[oklch(45%_0.08_140)]/15 text-[oklch(35%_0.08_140)] border-[oklch(45%_0.08_140)] rounded-xs">
                                                        [ PRE-ORDER ]
                                                    </span>
                                                )}
                                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase border rounded-xs ${
                                                    order.status === 'confirmed' || order.status === 'shipped'
                                                        ? 'bg-[oklch(45%_0.08_140)]/10 text-[oklch(35%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                        : 'bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                                }`}>
                                                    [ STATUS: {order.status?.toUpperCase()} ]
                                                </span>
                                                <span className="px-2.5 py-1 text-[10px] font-bold uppercase border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] rounded-xs">
                                                    {order.order_type === 'hausmade_shipping' ? '[ จัดส่งพัสดุ ]' : '[ รับหน้าร้าน ]'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Customer & Address Details */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                            <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-[oklch(85%_0.012_28)] pb-3 md:pb-0 md:pr-4">
                                                <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ CUSTOMER INFORMATION ]</span>
                                                <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">{order.pickup_contact_name || order.guest_name || 'ลูกค้า HAUSMADE'}</span>
                                                <span className="tabular-nums">TEL: {order.pickup_contact_phone || order.phone_number || '-'}</span>
                                                {order.customer_note && (
                                                    <span className="text-[11px] text-[oklch(52%_0.16_28)] mt-1 font-bold">
                                                        NOTE: {order.customer_note}
                                                    </span>
                                                )}
                                                {order.payment_slip_url && (
                                                    <button
                                                        onClick={() => setSlipModalUrl(order.payment_slip_url.startsWith('http') ? order.payment_slip_url : `${supabase.storage.from('slips').getPublicUrl(order.payment_slip_url).data.publicUrl}`)}
                                                        className="mt-2 text-[10px] font-bold text-[oklch(52%_0.16_28)] hover:underline self-start border border-[oklch(52%_0.16_28)] px-2 py-0.5 bg-[oklch(52%_0.16_28)]/10 rounded-xs cursor-pointer"
                                                    >
                                                        [ VIEW PAYMENT SLIP // ดูสลิป ]
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ DESTINATION ADDRESS ]</span>
                                                <span className="font-bold text-xs leading-relaxed">{order.shipping_address || 'รับหน้าร้าน IN THE HAUS'}</span>
                                                <span className="text-[oklch(55%_0.010_28)] mt-1 tabular-nums font-mono">
                                                    TOTAL: ฿{order.total_amount?.toLocaleString()}.- (SHIPPING: ฿{order.shipping_fee || 0}.-)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Items Checklist Table */}
                                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 text-xs rounded-xs">
                                            <span className="text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase block mb-2">
                                                [ ORDER ITEMS CHECKLIST ]
                                            </span>
                                            <div className="flex flex-col gap-1">
                                                {order.order_items?.map((item, idx) => {
                                                    const itemName = item.name || item.menu_items?.name || 'HAUSMADE ITEM'
                                                    const is3dKeychain = itemName.includes('3D') || 
                                                                         itemName.includes('พวงกุญแจ') || 
                                                                         (item.selected_options || '').includes('รูเชือก') ||
                                                                         (item.selected_options || '').includes('CORD')

                                                    return (
                                                        <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-[oklch(85%_0.012_28)] last:border-b-0 py-1.5 gap-2">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-[oklch(18%_0.012_28)]">{itemName}</span>
                                                                    {is3dKeychain && (
                                                                        <span className="px-1.5 py-0.2 bg-[oklch(52%_0.16_28)] text-white font-mono text-[9px] font-bold uppercase rounded-2xs">
                                                                            🖨️ 3D PRINT
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {item.selected_options && (
                                                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] mt-0.5">({item.selected_options})</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                                {is3dKeychain && (
                                                                    <div className="flex items-center gap-1 font-mono">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleAdminExport3D(item, 'stl')}
                                                                            className="px-2 py-0.5 bg-[oklch(18%_0.012_28)] text-white text-[10px] font-bold uppercase hover:bg-[oklch(52%_0.16_28)] cursor-pointer rounded-2xs"
                                                                            title="ดาวน์โหลดไฟล์ 3D STL สำหรับเปิดใน Bambu Studio หรือ PrusaSlicer"
                                                                        >
                                                                            [ STL ]
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleAdminExport3D(item, 'step')}
                                                                            className="px-2 py-0.5 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] text-[10px] font-bold uppercase hover:bg-[oklch(94%_0.010_28)] cursor-pointer rounded-2xs"
                                                                            title="ดาวน์โหลดไฟล์ CAD STEP สำหรับเปิดในโปรแกรม CAD"
                                                                        >
                                                                            [ STEP ]
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <span className="font-bold text-[oklch(52%_0.16_28)] tabular-nums ml-2">x{item.quantity}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Status Action Buttons */}
                                        <div className="flex items-center gap-2 flex-wrap border-t border-[oklch(85%_0.012_28)] pt-3">
                                            <span className="text-[10px] text-[oklch(55%_0.010_28)] uppercase">[ QUICK ACTIONS ]:</span>
                                            <button
                                                onClick={() => handleStatusChange(order.id, 'confirmed')}
                                                className={`px-2.5 py-1 text-[10px] font-bold uppercase border whitespace-nowrap rounded-xs cursor-pointer transition-colors ${order.status === 'confirmed' ? 'bg-[oklch(18%_0.012_28)] text-white' : 'bg-[oklch(96%_0.008_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.010_28)]'}`}
                                            >
                                                [ ยืนยันชำระ ]
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(order.id, 'packing')}
                                                className={`px-2.5 py-1 text-[10px] font-bold uppercase border whitespace-nowrap rounded-xs cursor-pointer transition-colors ${order.status === 'packing' ? 'bg-[oklch(18%_0.012_28)] text-white' : 'bg-[oklch(96%_0.008_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.010_28)]'}`}
                                            >
                                                [ กำลังแพ็ค ]
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(order.id, 'shipped')}
                                                className={`px-2.5 py-1 text-[10px] font-bold uppercase border whitespace-nowrap rounded-xs cursor-pointer transition-colors ${order.status === 'shipped' ? 'bg-[oklch(45%_0.08_140)] text-white' : 'bg-[oklch(96%_0.008_28)] text-[oklch(18%_0.012_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(90%_0.010_28)]'}`}
                                            >
                                                [ จัดส่งแล้ว ]
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(order.id, 'cancelled')}
                                                className="px-2.5 py-1 text-[10px] font-bold uppercase border border-[oklch(52%_0.16_28)] text-[oklch(52%_0.16_28)] bg-[oklch(96%_0.008_28)] hover:bg-[oklch(52%_0.16_28)] hover:text-white transition-colors ml-auto whitespace-nowrap rounded-xs cursor-pointer"
                                            >
                                                [ ยกเลิก ]
                                            </button>
                                        </div>

                                        {/* Tracking & Document Actions */}
                                        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border-t border-[oklch(85%_0.012_28)] pt-4">
                                            {/* Tracking Code Form */}
                                            <div className="flex items-center gap-2 flex-grow">
                                                <select
                                                    value={currentCourier}
                                                    onChange={(e) => handleTrackingChange(order.id, 'courierName', e.target.value)}
                                                    className="px-2.5 py-1.5 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs focus:outline-none rounded-xs"
                                                >
                                                    <option value="Flash Express">Flash Express</option>
                                                    <option value="KEX (Kerry Express)">KEX (Kerry Express)</option>
                                                    <option value="ไปรษณีย์ไทย (EMS)">ไปรษณีย์ไทย (EMS)</option>
                                                    <option value="J&T Express">J&T Express</option>
                                                    <option value="SPX Express">SPX Express</option>
                                                    <option value="Lineman / Grab">Lineman / Grab</option>
                                                    <option value="Seller Own Fleet">Seller Own Fleet</option>
                                                </select>

                                                <input
                                                    type="text"
                                                    placeholder="กรอกเลขพัสดุ Tracking #"
                                                    value={currentTracking}
                                                    onChange={(e) => handleTrackingChange(order.id, 'trackingNumber', e.target.value)}
                                                    className="px-3 py-1.5 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs flex-grow focus:outline-none rounded-xs tabular-nums"
                                                />

                                                <button
                                                    onClick={() => handleSaveTracking(order.id, order.status)}
                                                    className="px-3.5 py-1.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-bold uppercase hover:bg-[oklch(52%_0.16_28)] transition-colors whitespace-nowrap rounded-xs cursor-pointer"
                                                >
                                                    [ SAVE TRACKING ]
                                                </button>
                                            </div>

                                            {/* Document & Bill Actions */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => setSelectedOrderForPngBill(order)}
                                                    className="px-3 py-1.5 bg-[oklch(52%_0.16_28)] text-white text-xs font-bold uppercase hover:opacity-90 transition-opacity whitespace-nowrap shadow-2xs cursor-pointer flex items-center gap-1 rounded-xs"
                                                    title="ออกบิลรูปภาพ PNG คมชัดสูง ปรับค่าส่งได้ ส่งทาง LINE/IG"
                                                >
                                                    <span>[ ออกบิล PNG ]</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrderForPrint(order)
                                                        setPrintDocType('label')
                                                    }}
                                                    className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] text-xs font-bold uppercase hover:bg-[oklch(18%_0.012_28)] hover:text-white transition-colors whitespace-nowrap cursor-pointer rounded-xs"
                                                >
                                                    [ พิมพ์ใบจ่าหน้า ]
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrderForPrint(order)
                                                        setPrintDocType('receipt')
                                                    }}
                                                    className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] text-xs font-bold uppercase hover:bg-[oklch(18%_0.012_28)] hover:text-white transition-colors whitespace-nowrap cursor-pointer rounded-xs"
                                                >
                                                    [ พิมพ์ใบเสร็จ ]
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : activeTab === 'catalog' ? (
                /* TAB 2: CATALOG & PRODUCT MANAGER */
                <HausmadeCatalogManager />
            ) : (
                /* TAB 3: SHIPPING & SENDER SETTINGS */
                <form onSubmit={handleSaveSettingsSubmit} className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-6 flex flex-col gap-6 rounded-xs">
                    <div className="border-b border-[oklch(85%_0.012_28)] pb-3">
                        <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest block">
                            // CONFIGURATION PANEL
                        </span>
                        <h2 className="text-lg font-bold uppercase text-[oklch(18%_0.012_28)]">
                            [ ตั้งค่าสถานะร้านค้า, ค่าจัดส่ง & ข้อมูลผู้ส่งบนใบจ่าหน้า ]
                        </h2>
                    </div>

                    {/* Section 0: Shop Operational Status */}
                    <div className="flex flex-col gap-3 border-b border-[oklch(85%_0.012_28)] pb-6">
                        <span className="text-xs font-bold text-[oklch(55%_0.010_28)] uppercase">
                            [ 0. SHOP OPERATIONAL STATUS // เปิด-ปิดระบบร้านค้า HAUSMADE ]
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { mode: 'manual_close', label: '[ CLOSE ] ปิดบริการชั่วคราว', desc: 'ลูกค้ายังไม่สามารถเข้าสั่งซื้อสินค้าได้' },
                                { mode: 'manual_open', label: '[ OPEN ] เปิดให้บริการปกติ', desc: 'เปิดให้สั่งซื้อพัสดุและรับหน้าร้าน 24 ชม.' },
                                { mode: 'auto', label: '[ AUTO ] เปิดตามเวลาทำการ', desc: 'เปิด/ปิดตามเวลาเปิดร้าน IN THE HAUS' }
                            ].map(({ mode, label, desc }) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setFormSettings({ ...formSettings, shopModeHausmade: mode })}
                                    className={`p-3.5 text-left border font-mono text-xs transition-all flex flex-col gap-1 cursor-pointer rounded-xs ${
                                        formSettings.shopModeHausmade === mode
                                            ? 'border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)]/10 font-bold text-[oklch(18%_0.012_28)] shadow-xs'
                                            : 'border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] text-[oklch(42%_0.010_28)] hover:bg-[oklch(94%_0.010_28)]'
                                    }`}
                                >
                                    <span className="font-bold text-[oklch(18%_0.012_28)]">{label}</span>
                                    <span className="text-[10px] text-[oklch(55%_0.010_28)] leading-tight">{desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 1: Sender Info */}
                    <div className="flex flex-col gap-4 border-b border-[oklch(85%_0.012_28)] pb-6">
                        <span className="text-xs font-bold text-[oklch(55%_0.010_28)] uppercase">
                            [ 1. SENDER INFORMATION // ข้อมูลผู้ส่งพัสดุ ]
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ชื่อผู้ส่ง (Sender Name) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formSettings.senderName}
                                    onChange={(e) => setFormSettings({ ...formSettings, senderName: e.target.value })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    เบอร์โทรศัพท์ผู้ส่ง (Sender Phone) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formSettings.senderPhone}
                                    onChange={(e) => setFormSettings({ ...formSettings, senderPhone: e.target.value })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                ที่อยู่ผู้ส่ง / ที่อยู่ตีกลับพัสดุ (Sender Address) *
                            </label>
                            <textarea
                                required
                                rows={2}
                                value={formSettings.senderAddress}
                                onChange={(e) => setFormSettings({ ...formSettings, senderAddress: e.target.value })}
                                className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                เลขประจำตัวผู้เสียภาษี (Tax ID for Receipts)
                            </label>
                            <input
                                type="text"
                                value={formSettings.senderTaxId}
                                onChange={(e) => setFormSettings({ ...formSettings, senderTaxId: e.target.value })}
                                className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none max-w-md rounded-xs tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Section 2: Shipping Fee Rules */}
                    <div className="flex flex-col gap-4">
                        <span className="text-xs font-bold text-[oklch(55%_0.010_28)] uppercase">
                            [ 2. SHIPPING FEE & PROMOTION RULES // กฎค่าจัดส่ง ]
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ค่าจัดส่งเหมาจ่าย (Flat Rate Shipping Fee - THB)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.shippingFee}
                                    onChange={(e) => setFormSettings({ ...formSettings, shippingFee: Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ซื้อครบกี่ชิ้นจัดส่งฟรี (Min Items for Free Shipping)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.freeShippingMinItems}
                                    onChange={(e) => setFormSettings({ ...formSettings, freeShippingMinItems: Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    หรือซื้อครบกี่บาทจัดส่งฟรี (Min Amount for Free Shipping)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.freeShippingMinAmount}
                                    onChange={(e) => setFormSettings({ ...formSettings, freeShippingMinAmount: Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: 3D Keychain Dynamic Pricing & Boundaries */}
                    <div className="flex flex-col gap-4 border-t border-[oklch(85%_0.012_28)] pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                                [ 3. 3D KEYCHAIN PRICING & BOUNDARIES // โครงสร้างราคาและขอบเขตการผลิต ]
                            </span>
                            <span className="text-[10px] text-[oklch(42%_0.010_28)]">
                                คำนวณอัตโนมัติที่หน้า Canvas ตามสูตรที่กำหนด
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ราคาตั้งต้น (Base Price - THB)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.keychainPricing?.basePrice ?? 180}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, basePrice: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    จำนวนตัวอักษรฟรีในราคาตั้งต้น (Included Characters)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={formSettings.keychainPricing?.baseCharLimit ?? 4}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, baseCharLimit: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ราคาตัวอักษรส่วนเกิน (Extra Char Price - THB/ตัว)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.keychainPricing?.extraCharPrice ?? 15}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, extraCharPrice: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ขีดจำกัดตัวอักษรสูงสุด (Max Physical Characters Limit)
                                </label>
                                <input
                                    type="number"
                                    min="3"
                                    max="20"
                                    value={formSettings.keychainPricing?.maxChars ?? 10}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, maxChars: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ขีดจำกัดชาร์ม/องค์ประกอบ (Max Elements Limit)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    value={formSettings.keychainPricing?.maxElements ?? 2}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, maxElements: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ค่าบริการพิมพ์สองสี (Dual-Tone Palette - THB)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.keychainPricing?.dualTonePrice ?? 30}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, dualTonePrice: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ค่าสลักข้อความด้านหลัง (Reverse Engraving - THB)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.keychainPricing?.reverseEngravePrice ?? 35}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, reverseEngravePrice: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                    ค่าความหนาพิเศษ 5.0mm (Heavy-Duty Thickness - THB)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formSettings.keychainPricing?.heavyDutyPrice ?? 20}
                                    onChange={(e) => setFormSettings({
                                        ...formSettings,
                                        keychainPricing: { ...formSettings.keychainPricing, heavyDutyPrice: Number(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 bg-[oklch(99%_0.005_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none rounded-xs tabular-nums"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Brand STL Charm Library Manager */}
                    <div className="flex flex-col gap-4 border-t border-[oklch(85%_0.012_28)] pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[oklch(52%_0.16_28)] uppercase tracking-wider">
                                [ 4. BRAND STL CHARMS & 3D LIBRARY // คลังชาร์มและไฟล์ 3D โมเดลแบรนด์ ]
                            </span>
                            <span className="text-[10px] text-[oklch(42%_0.010_28)]">
                                ลูกค้าเลือกได้สูงสุด {formSettings.keychainPricing?.maxElements || 2} ชิ้น
                            </span>
                        </div>

                        {/* List of active charms */}
                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(99%_0.005_28)] rounded-xs overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[10px] uppercase text-[oklch(42%_0.010_28)]">
                                        <th className="p-2.5 w-12 text-center">สัญลักษณ์</th>
                                        <th className="p-2.5">ชื่อชาร์ม / โมเดล 3D</th>
                                        <th className="p-2.5 w-24">ราคาบวกเพิ่ม</th>
                                        <th className="p-2.5 w-32">ไฟล์ STL / 3D MESH</th>
                                        <th className="p-2.5 w-20 text-center">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(formSettings.keychainCharms || []).map((charm) => (
                                        <tr key={charm.id} className="border-b border-[oklch(85%_0.012_28)] last:border-b-0 hover:bg-[oklch(96%_0.008_28)]">
                                            <td className="p-2.5 text-center text-base font-serif">{charm.symbol || '✿'}</td>
                                            <td className="p-2.5 font-bold">
                                                {charm.name}
                                                {charm.is_default && (
                                                    <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-[oklch(52%_0.16_28)] text-white uppercase rounded-xs">
                                                        [ BRAND SIGNATURE ]
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2.5 tabular-nums font-bold">+{charm.price} ฿</td>
                                            <td className="p-2.5 text-[10px]">
                                                {charm.stl_url ? (
                                                    <a
                                                        href={charm.stl_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[oklch(52%_0.16_28)] underline hover:text-[oklch(18%_0.012_28)] truncate block max-w-[120px]"
                                                        title={charm.stl_url}
                                                    >
                                                        [ ดาวน์โหลด .STL ]
                                                    </a>
                                                ) : (
                                                    <span className="text-[oklch(55%_0.010_28)]">โมเดลในระบบ (Procedural)</span>
                                                )}
                                            </td>
                                            <td className="p-2.5 text-center">
                                                {!charm.is_default ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBrandCharm(charm.id)}
                                                        className="text-[10px] text-red-600 hover:text-red-800 underline uppercase cursor-pointer"
                                                    >
                                                        ลบ
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-[oklch(55%_0.010_28)]">หลัก</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Add New Charm Upload Box */}
                        <div className="p-4 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col gap-3 rounded-xs">
                            <span className="text-[10px] font-bold text-[oklch(18%_0.012_28)] uppercase tracking-wider">
                                + อัปโหลดชาร์ม / ไฟล์โมเดล 3D (.STL) ใหม่เข้าระบบแบรนด์
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                                <div className="sm:col-span-1">
                                    <label className="text-[9px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                        ชื่อชาร์ม *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="เช่น HAUS Monogram"
                                        value={newCharmName}
                                        onChange={(e) => setNewCharmName(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-xs focus:outline-none rounded-xs"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                        สัญลักษณ์ย่อ / Emoji
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="✿"
                                        value={newCharmSymbol}
                                        onChange={(e) => setNewCharmSymbol(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-xs focus:outline-none rounded-xs text-center"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                        ราคาบวกเพิ่ม (THB)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newCharmPrice}
                                        onChange={(e) => setNewCharmPrice(Number(e.target.value))}
                                        className="w-full px-3 py-1.5 bg-white border border-[oklch(85%_0.012_28)] text-xs focus:outline-none rounded-xs tabular-nums"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] text-[oklch(42%_0.010_28)] uppercase block mb-1">
                                        ไฟล์โมเดล 3D (.STL)
                                    </label>
                                    <input
                                        type="file"
                                        accept=".stl"
                                        onChange={(e) => setNewCharmFile(e.target.files[0] || null)}
                                        className="w-full text-[10px] text-[oklch(42%_0.010_28)] file:mr-2 file:py-1 file:px-2 file:border-0 file:text-[10px] file:bg-[oklch(18%_0.012_28)] file:text-white file:rounded-xs cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    disabled={isUploadingCharm}
                                    onClick={handleAddBrandCharm}
                                    className="py-1.5 px-4 bg-[oklch(52%_0.16_28)] text-white text-[11px] font-bold uppercase hover:bg-[oklch(18%_0.012_28)] transition-colors cursor-pointer rounded-xs disabled:opacity-50"
                                >
                                    {isUploadingCharm ? '[ กำลังอัปโหลด... ]' : '[ + เพิ่มชาร์มลงแคตตาล็อก ]'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {settingsSaveMsg && (
                        <div className="p-3 border border-[oklch(45%_0.08_140)] bg-[oklch(45%_0.08_140)]/10 text-[oklch(35%_0.08_140)] text-xs font-bold rounded-xs">
                            [ SYSTEM ]: {settingsSaveMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="py-3 px-6 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-bold uppercase hover:bg-[oklch(52%_0.16_28)] transition-colors self-start cursor-pointer rounded-xs"
                    >
                        [ SAVE SETTINGS // บันทึกการตั้งค่า ]
                    </button>
                </form>
            )}

            {/* Slip Modal Preview */}
            {slipModalUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
                    <div className="relative bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] max-w-md w-full p-4 flex flex-col items-center rounded-xs shadow-xl">
                        <img src={slipModalUrl} alt="Slip" className="max-h-[70vh] object-contain border border-[oklch(85%_0.012_28)] rounded-xs" />
                        <button
                            onClick={() => setSlipModalUrl(null)}
                            className="mt-4 px-4 py-2 bg-[oklch(18%_0.012_28)] text-white font-bold text-xs uppercase hover:bg-[oklch(52%_0.16_28)] transition-colors rounded-xs cursor-pointer"
                        >
                            [ CLOSE ]
                        </button>
                    </div>
                </div>
            )}

            {/* Document Printer Modal */}
            {selectedOrderForPrint && (
                <HausmadeDocumentPrinter
                    order={selectedOrderForPrint}
                    orders={printOrders.length > 0 ? printOrders : [selectedOrderForPrint]}
                    senderInfo={settings}
                    docType={printDocType}
                    onClose={() => {
                        setSelectedOrderForPrint(null)
                        setPrintOrders([])
                    }}
                />
            )}

            {/* Online PNG Bill Generator Modal */}
            {selectedOrderForPngBill && (
                <HausmadeOnlineBillModal
                    order={selectedOrderForPngBill}
                    senderInfo={settings}
                    onClose={() => setSelectedOrderForPngBill(null)}
                    onOrderUpdated={() => fetchAdminData()}
                />
            )}
        </div>
    )
}

