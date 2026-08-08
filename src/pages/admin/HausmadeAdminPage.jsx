import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useHausmadeAdmin } from '../../hooks/useHausmadeAdmin'
import HausmadeDocumentPrinter from '../../components/hausmade/HausmadeDocumentPrinter'
import { supabase } from '../../lib/supabaseClient'

export default function HausmadeAdminPage() {
    const {
        loading,
        orders,
        settings,
        fetchAdminData,
        updateSettings,
        updateOrderStatus
    } = useHausmadeAdmin()

    const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'settings'
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null)
    const [printDocType, setPrintDocType] = useState('label') // 'label' | 'receipt'
    const [slipModalUrl, setSlipModalUrl] = useState(null)

    // Form state for Settings
    const [formSettings, setFormSettings] = useState({
        shippingFee: settings.shippingFee,
        freeShippingMinItems: settings.freeShippingMinItems,
        freeShippingMinAmount: settings.freeShippingMinAmount,
        senderName: settings.senderName,
        senderPhone: settings.senderPhone,
        senderAddress: settings.senderAddress,
        senderTaxId: settings.senderTaxId
    })

    const [settingsSaveMsg, setSettingsSaveMsg] = useState('')

    // Sync settings when loaded
    React.useEffect(() => {
        setFormSettings({
            shippingFee: settings.shippingFee,
            freeShippingMinItems: settings.freeShippingMinItems,
            freeShippingMinAmount: settings.freeShippingMinAmount,
            senderName: settings.senderName,
            senderPhone: settings.senderPhone,
            senderAddress: settings.senderAddress,
            senderTaxId: settings.senderTaxId
        })
    }, [settings])

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
            alert('บันทึกข้อมูลการจัดส่งเรียบร้อยแล้ว')
        } else {
            alert('เกิดข้อผิดพลาด: ' + res.error)
        }
    }

    const handleStatusChange = async (orderId, newStatus) => {
        const res = await updateOrderStatus(orderId, { status: newStatus })
        if (!res.success) {
            alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + res.error)
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

    const filteredOrders = orders.filter(o => {
        if (statusFilter === 'ALL') return true
        return o.status === statusFilter
    })

    return (
        <div className="min-h-screen bg-[oklch(97%_0.008_28)] text-[oklch(18%_0.012_28)] font-mono p-6 flex flex-col gap-6 selection:bg-[oklch(52%_0.16_28)] selection:text-white">
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

                {/* Tab Switcher */}
                <div className="flex items-center gap-2 bg-[oklch(97%_0.008_28)] p-1 border border-[oklch(85%_0.012_28)]">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-4 py-2 text-xs font-bold uppercase transition-all ${
                            activeTab === 'orders'
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                        }`}
                    >
                        [ FULFILLMENT QUEUE ({orders.length}) ]
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 text-xs font-bold uppercase transition-all ${
                            activeTab === 'settings'
                                ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)]'
                                : 'text-[oklch(42%_0.010_28)] hover:text-[oklch(18%_0.012_28)]'
                        }`}
                    >
                        [ SHIPPING & SENDER SETTINGS ]
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'orders' ? (
                /* TAB 1: ORDER FULFILLMENT QUEUE */
                <div className="flex flex-col gap-6">
                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[oklch(85%_0.012_28)]">
                        {['ALL', 'pending', 'confirmed', 'packing', 'shipped', 'cancelled'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 text-xs font-bold uppercase border transition-all ${
                                    statusFilter === st
                                        ? 'bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] border-[oklch(18%_0.012_28)]'
                                        : 'bg-[oklch(97%_0.008_28)] text-[oklch(42%_0.010_28)] border-[oklch(85%_0.012_28)] hover:bg-[oklch(94%_0.010_28)]'
                                }`}
                            >
                                [ {st.toUpperCase()} ]
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="py-16 text-center text-xs text-[oklch(55%_0.010_28)] uppercase tracking-widest">
                            [ LOADING FULFILLMENT ORDERS... ]
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-[oklch(85%_0.012_28)] text-xs text-[oklch(55%_0.010_28)] uppercase">
                            [ NO ORDERS FOUND IN QUEUE ]
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {filteredOrders.map((order) => {
                                const inputState = trackingInputs[order.id] || {}
                                const currentCourier = inputState.courierName !== undefined ? inputState.courierName : (order.courier_name || 'Flash Express')
                                const currentTracking = inputState.trackingNumber !== undefined ? inputState.trackingNumber : (order.tracking_number || '')

                                return (
                                    <div
                                        key={order.id}
                                        className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-6 flex flex-col gap-4"
                                    >
                                        {/* Order Top Bar */}
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-[oklch(85%_0.012_28)] pb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-sm text-[oklch(52%_0.16_28)]">
                                                    TOKEN: {order.tracking_token || order.id}
                                                </span>
                                                <span className="text-xs text-[oklch(55%_0.010_28)]">
                                                    DATE: {new Date(order.created_at).toLocaleDateString('th-TH')} {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase border ${
                                                    order.status === 'confirmed' || order.status === 'shipped'
                                                        ? 'bg-[oklch(45%_0.08_140)]/10 text-[oklch(45%_0.08_140)] border-[oklch(45%_0.08_140)]'
                                                        : 'bg-[oklch(52%_0.16_28)]/10 text-[oklch(52%_0.16_28)] border-[oklch(52%_0.16_28)]'
                                                }`}>
                                                    [ STATUS: {order.status?.toUpperCase()} ]
                                                </span>
                                                <span className="px-2.5 py-1 text-[10px] font-bold uppercase border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)]">
                                                    {order.order_type === 'hausmade_shipping' ? '🚚 จัดส่งพัสดุ' : '🏪 รับหน้าร้าน'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Customer & Address Details */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                            <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-[oklch(85%_0.012_28)] pb-3 md:pb-0 md:pr-4">
                                                <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ CUSTOMER INFORMATION ]</span>
                                                <span className="font-bold text-sm text-[oklch(18%_0.012_28)]">{order.guest_name}</span>
                                                <span>TEL: {order.phone_number}</span>
                                                {order.payment_slip_url && (
                                                    <button
                                                        onClick={() => setSlipModalUrl(order.payment_slip_url.startsWith('http') ? order.payment_slip_url : `${supabase.storage.from('slips').getPublicUrl(order.payment_slip_url).data.publicUrl}`)}
                                                        className="mt-2 text-[10px] font-bold text-[oklch(52%_0.16_28)] hover:underline self-start border border-[oklch(52%_0.16_28)] px-2 py-0.5 bg-[oklch(52%_0.16_28)]/10"
                                                    >
                                                        [ VIEW PAYMENT SLIP // ดูสลิป ]
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <span className="text-[oklch(55%_0.010_28)] text-[10px] uppercase">[ DESTINATION ADDRESS ]</span>
                                                <span className="font-bold text-xs leading-relaxed">{order.shipping_address || 'รับหน้าร้าน IN THE HAUS'}</span>
                                                <span className="text-[oklch(55%_0.010_28)] mt-1">TOTAL AMOUNT: ฿{order.total_amount?.toLocaleString()}.- (SHIPPING: ฿{order.shipping_fee || 0}.-)</span>
                                            </div>
                                        </div>

                                        {/* Items Checklist Table */}
                                        <div className="border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] p-3 text-xs">
                                            <span className="text-[10px] font-bold text-[oklch(55%_0.010_28)] uppercase block mb-2">
                                                [ ORDER ITEMS CHECKLIST ]
                                            </span>
                                            <div className="flex flex-col gap-1">
                                                {order.order_items?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between border-b border-[oklch(85%_0.012_28)] last:border-b-0 py-1">
                                                        <span>
                                                            <span className="font-bold text-[oklch(18%_0.012_28)]">{item.menu_items?.name || 'HAUSMADE ITEM'}</span>
                                                            {item.selected_options && (
                                                                <span className="text-[10px] text-[oklch(55%_0.010_28)] ml-2">({item.selected_options})</span>
                                                            )}
                                                        </span>
                                                        <span className="font-bold text-[oklch(52%_0.16_28)]">x{item.quantity}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Tracking & Document Actions */}
                                        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border-t border-[oklch(85%_0.012_28)] pt-4">
                                            {/* Tracking Code Form */}
                                            <div className="flex items-center gap-2 flex-grow">
                                                <select
                                                    value={currentCourier}
                                                    onChange={(e) => handleTrackingChange(order.id, 'courierName', e.target.value)}
                                                    className="px-2.5 py-1.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs focus:outline-none"
                                                >
                                                    <option value="Flash Express">Flash Express</option>
                                                    <option value="Kerry Express">Kerry Express</option>
                                                    <option value="J&T Express">J&T Express</option>
                                                    <option value="ไปรษณีย์ไทย (EMS)">ไปรษณีย์ไทย (EMS)</option>
                                                </select>

                                                <input
                                                    type="text"
                                                    placeholder="กรอกเลข พัสดุ Tracking #"
                                                    value={currentTracking}
                                                    onChange={(e) => handleTrackingChange(order.id, 'trackingNumber', e.target.value)}
                                                    className="px-3 py-1.5 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs flex-grow focus:outline-none"
                                                />

                                                <button
                                                    onClick={() => handleSaveTracking(order.id, order.status)}
                                                    className="px-3 py-1.5 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-bold uppercase hover:bg-[oklch(52%_0.16_28)] transition-colors"
                                                >
                                                    [ SAVE TRACKING ]
                                                </button>
                                            </div>

                                            {/* Document Print Buttons */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrderForPrint(order)
                                                        setPrintDocType('label')
                                                    }}
                                                    className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] text-xs font-bold uppercase hover:bg-[oklch(18%_0.012_28)] hover:text-white transition-colors"
                                                >
                                                    [ พิมพ์ใบจ่าหน้า ]
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrderForPrint(order)
                                                        setPrintDocType('receipt')
                                                    }}
                                                    className="px-3 py-1.5 border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] text-[oklch(18%_0.012_28)] text-xs font-bold uppercase hover:bg-[oklch(18%_0.012_28)] hover:text-white transition-colors"
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
            ) : (
                /* TAB 2: SHIPPING & SENDER SETTINGS */
                <form onSubmit={handleSaveSettingsSubmit} className="bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] p-6 flex flex-col gap-6">
                    <div className="border-b border-[oklch(85%_0.012_28)] pb-3">
                        <span className="text-[10px] font-bold text-[oklch(52%_0.16_28)] uppercase tracking-widest block">
                            // CONFIGURATION PANEL
                        </span>
                        <h2 className="text-lg font-bold uppercase text-[oklch(18%_0.012_28)]">
                            [ ตั้งค่าค่าจัดส่ง & ข้อมูลผู้ส่งบนใบจ่าหน้า ]
                        </h2>
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
                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none"
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
                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none"
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
                                className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none"
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
                                className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none max-w-md"
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
                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none"
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
                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none"
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
                                    className="w-full px-3 py-2 bg-[oklch(97%_0.008_28)] border border-[oklch(85%_0.012_28)] text-xs font-bold focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {settingsSaveMsg && (
                        <div className="p-3 border border-[oklch(45%_0.08_140)] bg-[oklch(45%_0.08_140)]/10 text-[oklch(45%_0.08_140)] text-xs font-bold">
                            [ SYSTEM ]: {settingsSaveMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="py-3 px-6 bg-[oklch(18%_0.012_28)] text-[oklch(97%_0.008_28)] text-xs font-bold uppercase hover:bg-[oklch(52%_0.16_28)] transition-colors self-start"
                    >
                        [ SAVE SETTINGS // บันทึกการตั้งค่า ]
                    </button>
                </form>
            )}

            {/* Slip Modal Preview */}
            {slipModalUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="relative bg-white border border-zinc-300 max-w-md w-full p-4 flex flex-col items-center">
                        <img src={slipModalUrl} alt="Slip" className="max-h-[70vh] object-contain border" />
                        <button
                            onClick={() => setSlipModalUrl(null)}
                            className="mt-4 px-4 py-2 bg-black text-white font-bold text-xs uppercase"
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
                    senderInfo={settings}
                    docType={printDocType}
                    onClose={() => setSelectedOrderForPrint(null)}
                />
            )}
        </div>
    )
}
