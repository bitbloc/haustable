/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { getThaiDate, toThaiISO } from '../../utils/timeUtils'
import { fetchAndSortMenu } from '../../utils/menuHelper'
import { sendPOSBroadcast } from '../../utils/realtimeNotifier'
import { getShortBookingId } from '../../utils/printerHelper'
import { checkOverlap } from '../../utils/availabilityUtils'
import { toast } from 'sonner'

export default function ManualBookingModal({
    isOpen,
    onClose,
    onSuccess,
    initialTableId = '',
    initialDate = '',
    tablesList = [],
    existingBookings = []
}) {
    // 1. Service Type & Source
    const [bookingType, setBookingType] = useState('dine_in') // 'dine_in' | 'pickup' | 'walk_in'
    const [source, setSource] = useState('line') // 'line' | 'facebook' | 'phone' | 'walk_in' | 'admin'

    // 2. Schedule
    const [serviceDate, setServiceDate] = useState(() => initialDate || getThaiDate())
    const [serviceTime, setServiceTime] = useState('18:00')
    const [durationHours, setDurationHours] = useState(2)

    // 3. Table & Party Size
    const [tableId, setTableId] = useState(() => initialTableId || '')
    const [pax, setPax] = useState(2)

    // 4. Customer Information
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [customerNote, setCustomerNote] = useState('')

    // 5. Financials & Deposit
    const [totalAmount, setTotalAmount] = useState('')
    const [depositAmount, setDepositAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('transfer') // 'transfer' | 'cash' | 'credit' | 'unpaid'
    const [slipFile, setSlipFile] = useState(null)
    const [slipPreview, setSlipPreview] = useState(null)

    // 6. Pre-order Menu Items
    const [isMenuPickerOpen, setIsMenuPickerOpen] = useState(false)
    const [menuItems, setMenuItems] = useState([])
    const [menuCategories, setMenuCategories] = useState([])
    const [menuSearch, setMenuSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('ALL')
    const [preOrderItems, setPreOrderItems] = useState([]) // [{ id, name, price, quantity, note }]

    // 7. Status & Remarks
    const [status, setStatus] = useState('confirmed') // 'confirmed' | 'pending' | 'seated'
    const [staffRemark, setStaffRemark] = useState('')

    // 8. Internal Tables List & Bookings Fallback
    const [tables, setTables] = useState(tablesList)
    const [loadingTables, setLoadingTables] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Update initial state when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialTableId) setTableId(initialTableId)
            if (initialDate) setServiceDate(initialDate)
            loadMenu()
            if (!tablesList || tablesList.length === 0) {
                loadTables()
            } else {
                setTables(tablesList)
            }
        }
    }, [isOpen, initialTableId, initialDate, tablesList])

    // Load active tables if not provided
    const loadTables = async () => {
        setLoadingTables(true)
        try {
            const { data, error } = await supabase
                .from('tables_layout')
                .select('id, table_name, capacity, is_active')
                .order('table_name', { ascending: true })
            if (!error && data) {
                setTables(data)
            }
        } catch (e) {
            console.warn('[ManualBookingModal] Failed to load tables:', e)
        } finally {
            setLoadingTables(false)
        }
    }

    // Load menu for optional pre-ordering
    const loadMenu = async () => {
        try {
            const { menuItems: items, categories } = await fetchAndSortMenu()
            setMenuItems(items || [])
            setMenuCategories(categories || [])
        } catch (e) {
            console.warn('[ManualBookingModal] Failed to load menu:', e)
        }
    }

    // Handle Slip File Selection
    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น')
                return
            }
            setSlipFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setSlipPreview(reader.result)
            reader.readAsDataURL(file)
        }
    }

    const handleRemoveSlip = () => {
        setSlipFile(null)
        setSlipPreview(null)
    }

    // Quick Deposit Calculators
    const handleSetHalfDeposit = () => {
        const total = parseFloat(totalAmount) || 0
        setDepositAmount(Math.round(total * 0.5))
    }

    const handleSetFullDeposit = () => {
        const total = parseFloat(totalAmount) || 0
        setDepositAmount(total)
    }

    const handleSetZeroDeposit = () => {
        setDepositAmount(0)
    }

    // Pre-order Item Handlers
    const handleAddPreOrderItem = (item) => {
        setPreOrderItems(prev => {
            const existing = prev.find(i => i.id === item.id)
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
            }
            return [...prev, {
                id: item.id,
                menu_item_id: item.id,
                name: item.name,
                price: Number(item.price || 0),
                quantity: 1,
                note: ''
            }]
        })
    }

    const handleUpdateItemQty = (id, delta) => {
        setPreOrderItems(prev => {
            return prev.map(i => {
                if (i.id === id) {
                    const newQty = i.quantity + delta
                    return newQty > 0 ? { ...i, quantity: newQty } : null
                }
                return i
            }).filter(Boolean)
        })
    }

    const handleRemovePreOrderItem = (id) => {
        setPreOrderItems(prev => prev.filter(i => i.id !== id))
    }

    // Auto calculate total amount from pre-ordered items if items exist
    useEffect(() => {
        if (preOrderItems.length > 0) {
            const sum = preOrderItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0)
            setTotalAmount(sum)
        }
    }, [preOrderItems])

    // Filtered menu items for quick picker
    const filteredMenuItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory
            const matchesSearch = !menuSearch || item.name.toLowerCase().includes(menuSearch.toLowerCase())
            return matchesCat && matchesSearch
        })
    }, [menuItems, selectedCategory, menuSearch])

    // Detect Table Overlap Conflict
    const tableConflict = useMemo(() => {
        if (!tableId || bookingType !== 'dine_in' || !serviceDate || !serviceTime) return null

        const reqStartIso = toThaiISO(serviceDate, serviceTime)
        if (!reqStartIso) return null
        const reqStart = new Date(reqStartIso)
        const reqEnd = new Date(reqStart.getTime() + (durationHours * 60 * 60 * 1000))

        const conflicts = (existingBookings || []).filter(b => {
            if (b.status === 'cancelled' || b.status === 'void') return false
            if (b.table_id !== tableId) return false
            return checkOverlap(reqStart, reqEnd, b.booking_time, 2)
        })

        if (conflicts.length > 0) {
            const first = conflicts[0]
            const name = first.pickup_contact_name || first.profiles?.display_name || 'ลูกค้าท่านอื่น'
            const time = new Date(first.booking_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
            return {
                hasConflict: true,
                message: `โต๊ะนี้มีการจองซ้อนทับ: ${name} (${time})`
            }
        }
        return null
    }, [tableId, bookingType, serviceDate, serviceTime, durationHours, existingBookings])

    // Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!customerName.trim()) {
            toast.error('กรุณาระบุชื่อลูกค้า')
            return
        }

        if (!serviceDate || !serviceTime) {
            toast.error('กรุณาระบุวันและเวลารับบริการ')
            return
        }

        setIsSubmitting(true)
        try {
            // 1. Calculate Timestamps
            const bookingTimeIso = toThaiISO(serviceDate, serviceTime)
            const startDate = new Date(bookingTimeIso)
            const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000))
            const endTimeIso = endDate.toISOString()

            // 2. Upload Slip if provided
            let uploadedSlipUrl = null
            if (slipFile) {
                const ext = slipFile.name.split('.').pop() || 'jpg'
                const fileName = `manual_slip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`

                // Attempt Strategy 1: 'slips' bucket
                try {
                    const { error: slipsErr } = await supabase.storage.from('slips').upload(fileName, slipFile, {
                        cacheControl: '15552000'
                    })
                    if (!slipsErr) {
                        uploadedSlipUrl = fileName
                    }
                } catch (e) {
                    console.warn('[ManualBookingModal] slips bucket upload error:', e)
                }

                // Fallback Strategy 2: 'receipts' bucket
                if (!uploadedSlipUrl) {
                    try {
                        const { error: receiptsErr } = await supabase.storage.from('receipts').upload(fileName, slipFile, {
                            cacheControl: '15552000'
                        })
                        if (!receiptsErr) {
                            uploadedSlipUrl = `receipts/${fileName}`
                        }
                    } catch (e) {
                        console.warn('[ManualBookingModal] receipts bucket fallback error:', e)
                    }
                }
            }

            // 3. Format Staff Remark
            const defaultRemarkTag = `[MANUAL_ADMIN] รับจองผ่าน ${source.toUpperCase()}`
            const fullStaffRemark = staffRemark.trim()
                ? `${defaultRemarkTag} · ${staffRemark.trim()}`
                : defaultRemarkTag

            // 4. Generate Unique Tracking Token
            const trackingToken = crypto.randomUUID()

            // 5. Construct Final Booking Payload
            const totalNum = parseFloat(totalAmount) || 0
            const depositNum = parseFloat(depositAmount) || 0

            const bookingPayload = {
                booking_type: bookingType,
                status: status,
                table_id: (bookingType === 'dine_in' && tableId) ? tableId : null,
                booking_time: bookingTimeIso,
                end_time: endTimeIso,
                pax: Number(pax) || 2,
                pickup_contact_name: customerName.trim(),
                pickup_contact_phone: customerPhone.trim() || null,
                total_amount: totalNum,
                deposit_amount: depositNum,
                payment_slip_url: uploadedSlipUrl,
                customer_note: customerNote.trim() || null,
                staff_remark: fullStaffRemark,
                source: source,
                tracking_token: trackingToken,
                created_at: new Date().toISOString()
            }

            // 6. Insert Booking Record
            const { data: createdBooking, error: insertError } = await supabase
                .from('bookings')
                .insert(bookingPayload)
                .select(`
                    *,
                    tables_layout (id, table_name, capacity)
                `)
                .single()

            if (insertError) throw insertError

            // 7. Insert Pre-ordered Items if any
            if (preOrderItems.length > 0 && createdBooking?.id) {
                const orderItemsToInsert = preOrderItems.map(item => ({
                    booking_id: createdBooking.id,
                    menu_item_id: item.menu_item_id || item.id,
                    quantity: Number(item.quantity || 1),
                    price_at_time: Number(item.price || 0),
                    selected_options: item.note ? { note: item.note } : null,
                    status: 'pending'
                }))

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItemsToInsert)

                if (itemsError) {
                    console.warn('[ManualBookingModal] Failed to insert order items:', itemsError)
                    toast.warning('บันทึกการจองสำเร็จ แต่บันทึกรายการอาหารบางส่วนไม่สำเร็จ')
                }
            }

            // 8. Instant Real-time POS Broadcast
            try {
                sendPOSBroadcast('online_order_created', {
                    booking_id: createdBooking.id,
                    booking_type: createdBooking.booking_type,
                    table_id: createdBooking.table_id || null,
                    customer_name: customerName.trim(),
                    phone: customerPhone.trim(),
                    total_amount: totalNum,
                    has_slip: Boolean(uploadedSlipUrl),
                    booking_time: createdBooking.booking_time,
                    items_count: preOrderItems.length
                })
            } catch (broadcastErr) {
                console.warn('[ManualBookingModal] Realtime broadcast error:', broadcastErr)
            }

            const shortId = getShortBookingId(createdBooking)
            toast.success(`สร้างการจองสำเร็จ! #${shortId} (คุณ${customerName})`)

            if (onSuccess) onSuccess(createdBooking)
            if (onClose) onClose()

        } catch (err) {
            console.error('[ManualBookingModal] Submission failed:', err)
            toast.error('เกิดข้อผิดพลาดในการสร้างการจอง: ' + (err.message || 'โปรดลองอีกครั้ง'))
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[var(--color-paper)] border-2 border-[var(--color-rule)] max-w-2xl w-full max-h-[92vh] flex flex-col font-mono text-xs shadow-2xl my-auto">
                {/* 1. Minimalist Tabular Header */}
                <div className="flex justify-between items-center p-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--color-accent)] uppercase tracking-wider bg-[var(--color-paper)] px-2 py-0.5 border border-[var(--color-rule)]">
                                SYS.ADMIN · MANUAL ENTRY
                            </span>
                            <span className="text-[10px] text-[var(--color-neutral)] uppercase">
                                POSTGRESQL · 2026
                            </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-[var(--color-ink)] uppercase mt-1 tracking-tight">
                            Create New Booking & Order
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-2.5 py-1 text-[var(--color-neutral)] hover:text-[var(--color-ink)] border border-[var(--color-rule)] bg-[var(--color-paper)] font-bold text-xs cursor-pointer transition-colors"
                    >
                        [✕]
                    </button>
                </div>

                {/* 2. Scrollable Form Container */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {/* Section 1: Service Type & Source Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[var(--color-rule)]">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                SERVICE TYPE (ประเภทบริการ)
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                                {[
                                    { key: 'dine_in', label: 'DINE-IN' },
                                    { key: 'pickup', label: 'PICKUP' },
                                    { key: 'walk_in', label: 'WALK-IN' }
                                ].map(t => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setBookingType(t.key)}
                                        className={`py-1.5 border text-center font-bold text-[11px] cursor-pointer transition-colors ${
                                            bookingType === t.key
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                : 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper)]'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                BOOKING SOURCE (ช่องทางที่ติดต่อ)
                            </label>
                            <div className="grid grid-cols-5 gap-1">
                                {[
                                    { key: 'line', label: 'LINE' },
                                    { key: 'facebook', label: 'FB' },
                                    { key: 'phone', label: 'CALL' },
                                    { key: 'walk_in', label: 'WALK' },
                                    { key: 'admin', label: 'ADMIN' }
                                ].map(s => (
                                    <button
                                        key={s.key}
                                        type="button"
                                        onClick={() => setSource(s.key)}
                                        className={`py-1.5 border text-center font-bold text-[10px] cursor-pointer transition-colors ${
                                            source === s.key
                                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                : 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper)]'
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Date, Time & Duration */}
                    <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    SERVICE DATE (วันที่)
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={serviceDate}
                                    onChange={e => setServiceDate(e.target.value)}
                                    className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)]"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    SERVICE TIME (เวลาจัดบริการ)
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="18:00"
                                    value={serviceTime}
                                    onChange={e => setServiceTime(e.target.value)}
                                    className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    DURATION (ระยะเวลาโต๊ะ)
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                    {[1, 1.5, 2, 3].map(h => (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => setDurationHours(h)}
                                            className={`py-2 border text-center font-bold text-[10px] cursor-pointer transition-colors ${
                                                durationHours === h
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                    : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)]'
                                            }`}
                                        >
                                            {h}h
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Quick Time Slot Buttons */}
                        <div>
                            <span className="text-[9px] font-bold text-[var(--color-neutral)] uppercase block mb-1">
                                QUICK TIME PRESETS:
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {['11:30', '12:00', '13:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setServiceTime(t)}
                                        className={`px-2 py-1 border text-[10px] font-bold tabular-nums cursor-pointer transition-colors ${
                                            serviceTime === t
                                                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                                                : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-rule)] hover:bg-[var(--color-paper-2)]'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Table Assignment & Pax (Only relevant for Dine-in) */}
                    {bookingType === 'dine_in' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    ASSIGNED TABLE (จัดสรรโต๊ะ)
                                </label>
                                <select
                                    value={tableId}
                                    onChange={e => setTableId(e.target.value)}
                                    className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)]"
                                >
                                    <option value="">— ไม่ระบุโต๊ะ / รอกำหนดหน้าร้าน (UNASSIGNED) —</option>
                                    {tables.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.table_name} (Cap: {t.capacity}P)
                                        </option>
                                    ))}
                                </select>
                                {tableConflict && (
                                    <div className="mt-1.5 p-2 bg-[oklch(94%_0.02_28)] border border-[oklch(52%_0.16_28)] text-[oklch(35%_0.14_28)] text-[10px] font-bold">
                                        ⚠️ {tableConflict.message}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    GUESTS (จำนวนท่าน / PAX)
                                </label>
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 4, 6].map(num => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => setPax(num)}
                                            className={`px-3 py-2 border font-bold text-xs cursor-pointer transition-colors ${
                                                Number(pax) === num
                                                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                                    : 'bg-[var(--color-paper-2)] text-[var(--color-ink)] border-[var(--color-rule)]'
                                            }`}
                                        >
                                            {num}P
                                        </button>
                                    ))}
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={pax}
                                        onChange={e => setPax(e.target.value)}
                                        className="w-16 p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-center text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section 4: Customer Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                CUSTOMER NAME (ชื่อผู้จอง) *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="เช่น น.ส. ชิดชนก, คุณสมชาย"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                CONTACT PHONE (เบอร์โทรศัพท์)
                            </label>
                            <input
                                type="tel"
                                placeholder="08X-XXX-XXXX"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Section 5: Financials, Deposit & Slip */}
                    <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-[var(--color-ink)] uppercase">
                                FINANCIALS & ADVANCE DEPOSIT (การเงินและมัดจำ)
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={handleSetHalfDeposit}
                                    className="px-2 py-0.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[10px] font-bold hover:bg-[var(--color-paper-2)] cursor-pointer"
                                >
                                    มัดจำ 50%
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSetFullDeposit}
                                    className="px-2 py-0.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[10px] font-bold hover:bg-[var(--color-paper-2)] cursor-pointer"
                                >
                                    ชำระเต็ม 100%
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSetZeroDeposit}
                                    className="px-2 py-0.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[10px] font-bold hover:bg-[var(--color-paper-2)] cursor-pointer"
                                >
                                    มัดจำ ฿0
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    ESTIMATED TOTAL (ยอดรวม ฿)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={totalAmount}
                                    onChange={e => setTotalAmount(e.target.value)}
                                    className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    DEPOSIT PAID (ยอดมัดจำ ฿)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={depositAmount}
                                    onChange={e => setDepositAmount(e.target.value)}
                                    className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] tabular-nums text-[var(--color-accent)]"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                    PAYMENT METHOD (ช่องทางชำระ)
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full p-2 bg-[var(--color-paper)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] uppercase"
                                >
                                    <option value="transfer">โอนเงิน / สลิป (TRANSFER)</option>
                                    <option value="cash">เงินสด (CASH)</option>
                                    <option value="credit">บัตรเครดิต (CREDIT)</option>
                                    <option value="unpaid">ยังไม่ชำระ (UNPAID)</option>
                                </select>
                            </div>
                        </div>

                        {/* Slip Upload & Thumbnail Preview */}
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                PAYMENT SLIP ATTACHMENT (แนบหลักฐานสลิปโอนเงิน - อุปกรณ์เสริม)
                            </label>
                            {slipPreview ? (
                                <div className="flex items-center gap-3 p-2 bg-[var(--color-paper)] border border-[var(--color-rule)]">
                                    <img src={slipPreview} alt="Slip Preview" className="w-12 h-12 object-cover border border-[var(--color-rule)]" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-bold text-[var(--color-ink)] truncate block">
                                            {slipFile?.name || 'slip.jpg'}
                                        </span>
                                        <span className="text-[10px] text-[var(--color-neutral)]">
                                            {(slipFile?.size ? (slipFile.size / 1024).toFixed(1) + ' KB' : '')}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveSlip}
                                        className="px-2.5 py-1 text-[var(--color-accent)] hover:text-red-700 text-[10px] font-bold border border-[var(--color-rule)] cursor-pointer"
                                    >
                                        [REMOVE]
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="w-full p-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] text-[11px] file:mr-3 file:py-1 file:px-2 file:border file:border-[var(--color-rule)] file:bg-[var(--color-paper-2)] file:text-xs file:font-mono file:font-bold file:cursor-pointer"
                                />
                            )}
                        </div>
                    </div>

                    {/* Section 6: Pre-order Menu Items (Optional Accordion) */}
                    <div className="border border-[var(--color-rule)]">
                        <button
                            type="button"
                            onClick={() => setIsMenuPickerOpen(!isMenuPickerOpen)}
                            className="w-full flex justify-between items-center p-2.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] text-left cursor-pointer transition-colors"
                        >
                            <span className="text-[10px] font-bold text-[var(--color-ink)] uppercase">
                                PRE-ORDER MENU ITEMS (สั่งอาหารล่วงหน้า · {preOrderItems.length} รายการ)
                            </span>
                            <span className="text-[10px] font-bold text-[var(--color-neutral)]">
                                {isMenuPickerOpen ? '[COLLAPSE ▲]' : '[EXPAND +]'}
                            </span>
                        </button>

                        {isMenuPickerOpen && (
                            <div className="p-3 bg-[var(--color-paper)] border-t border-[var(--color-rule)] space-y-3">
                                {/* Selected Items List */}
                                {preOrderItems.length > 0 && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase block">
                                            SELECTED DISHES (อาหารที่เลือก):
                                        </span>
                                        <div className="divide-y divide-[var(--color-rule)] border border-[var(--color-rule)] bg-[var(--color-paper-2)]">
                                            {preOrderItems.map(item => (
                                                <div key={item.id} className="p-2 flex items-center justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-bold text-[11px] text-[var(--color-ink)] truncate block">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--color-neutral)] tabular-nums">
                                                            ฿{Number(item.price).toFixed(2)} x {item.quantity} = ฿{(item.price * item.quantity).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateItemQty(item.id, -1)}
                                                            className="w-6 h-6 border border-[var(--color-rule)] bg-[var(--color-paper)] font-bold text-xs"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-6 text-center font-bold text-xs tabular-nums">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateItemQty(item.id, 1)}
                                                            className="w-6 h-6 border border-[var(--color-rule)] bg-[var(--color-paper)] font-bold text-xs"
                                                        >
                                                            +
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePreOrderItem(item.id)}
                                                            className="ml-2 text-[var(--color-accent)] hover:text-red-700 text-xs font-bold"
                                                        >
                                                            [✕]
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Menu Search & Filter */}
                                <div className="space-y-2 pt-2 border-t border-[var(--color-rule)]">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="ค้นหาเมนูอาหาร..."
                                            value={menuSearch}
                                            onChange={e => setMenuSearch(e.target.value)}
                                            className="flex-1 p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                                        />
                                        <select
                                            value={selectedCategory}
                                            onChange={e => setSelectedCategory(e.target.value)}
                                            className="p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold uppercase"
                                        >
                                            <option value="ALL">ALL CATEGORIES</option>
                                            {menuCategories.map(cat => (
                                                <option key={cat.id} value={cat.name}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Quick Menu Items Grid */}
                                    <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                                        {filteredMenuItems.slice(0, 30).map(item => (
                                            <div
                                                key={item.id}
                                                className="p-1.5 border border-[var(--color-rule)] bg-[var(--color-paper)] flex items-center justify-between gap-1.5"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-[11px] text-[var(--color-ink)] truncate">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[10px] text-[var(--color-neutral)] tabular-nums">
                                                        ฿{Number(item.price || 0).toFixed(2)}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddPreOrderItem(item)}
                                                    className="px-2 py-1 bg-[var(--color-ink)] hover:opacity-90 text-[var(--color-paper)] text-[10px] font-bold uppercase cursor-pointer"
                                                >
                                                    + ADD
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 7: Status, Notes & Remarks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                INITIAL STATUS (สถานะเริ่มต้น)
                            </label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono font-bold focus:outline-none focus:border-[var(--color-accent)] uppercase"
                            >
                                <option value="confirmed">CONFIRMED (ยืนยันแล้ว)</option>
                                <option value="pending">PENDING (รอตรวจสอบ)</option>
                                <option value="seated">SEATED (เข้าโต๊ะแล้ว)</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                                CUSTOMER NOTE (ข้อความพิเศษจากลูกค้า)
                            </label>
                            <input
                                type="text"
                                placeholder="เช่น ขอโต๊ะริมหน้าต่าง / เก้าอี้เด็ก / วันเกิด"
                                value={customerNote}
                                onChange={e => setCustomerNote(e.target.value)}
                                className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-[var(--color-muted)] uppercase block mb-1">
                            STAFF INTERNAL REMARK (บันทึกภายในสำหรับพนักงาน)
                        </label>
                        <input
                            type="text"
                            placeholder="เช่น รับโอน SCB 503 บาท จากคุณชิดชนก"
                            value={staffRemark}
                            onChange={e => setStaffRemark(e.target.value)}
                            className="w-full p-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>

                    {/* 3. Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-rule)]">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 border border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] font-bold text-xs uppercase cursor-pointer transition-colors"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-[var(--color-ink)] hover:opacity-90 text-[var(--color-paper)] font-bold text-xs uppercase cursor-pointer transition-opacity flex items-center gap-2"
                        >
                            <span>{isSubmitting ? 'CREATING BOOKING…' : 'CONFIRM & CREATE BOOKING'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
