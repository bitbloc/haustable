/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react'
import AdminPageHeader, { AdminTabs } from '../components/admin/AdminPageHeader'
import { AdminStatStrip, AdminTabPanel } from '../components/admin/AdminKit'
import { supabase } from '../lib/supabaseClient'
import TableManager from '../components/shared/TableManager'
import AdminTableEditor from '../AdminTableEditor'
import { getThaiDate } from '../utils/timeUtils'

export default function AdminTableManager({ defaultTab = 'live' }) {
    const [activeTab, setActiveTab] = useState(defaultTab) // 'live' | 'editor'
    
    // Live Summary Stats
    const [metrics, setMetrics] = useState({
        totalTables: 0,
        totalCapacity: 0,
        occupiedTables: 0,
        occupancyRate: 0,
        seatedGuests: 0,
        activeBillTotal: 0,
        pendingCalls: 0
    })

    useEffect(() => {
        fetchMetrics()

        const channel = supabase
            .channel('admin-table-manager-kpi')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchMetrics())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, () => fetchMetrics())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchMetrics())
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchMetrics = async () => {
        try {
            // 1. Tables
            const { data: tablesData } = await supabase.from('tables_layout').select('id, capacity')
            const totalTables = tablesData ? tablesData.length : 0
            const totalCapacity = tablesData ? tablesData.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0) : 0

            // 2. Active Bookings
            const today = getThaiDate()
            const start = `${today}T00:00:00+07:00`
            const end = `${today}T23:59:59+07:00`

            const { data: bookingsData } = await supabase
                .from('bookings')
                .select(`
                    id, table_id, booking_time, end_time, pax, status, staff_remark, total_amount, booking_type,
                    order_items(price_at_time, quantity)
                `)
                .in('status', ['confirmed', 'pending', 'seated', 'ready', 'approved', 'paid'])
                .gte('booking_time', start)
                .lte('booking_time', end)

            const now = new Date()
            let occupiedCount = 0
            let seatedPax = 0
            let billSum = 0
            let callAlerts = 0

            if (bookingsData && tablesData) {
                bookingsData.forEach(b => {
                    if (['completed', 'cancelled', 'void', 'no_show'].includes(b.status)) return
                    const bStart = new Date(b.booking_time)
                    const bEnd = b.end_time ? new Date(b.end_time) : new Date(bStart.getTime() + 2 * 60 * 60 * 1000)
                    const isCurrent = b.status === 'seated' || 
                        (b.status === 'ready' && b.booking_type !== 'pickup') || 
                        ((b.status === 'confirmed' || b.status === 'approved') && now >= bStart && now < bEnd)

                    if (isCurrent) {
                        occupiedCount++
                        seatedPax += Number(b.pax) || 2
                        
                        // Calculate order total
                        const items = b.order_items || []
                        const bTotal = items.reduce((sum, i) => sum + (Number(i.price_at_time || i.price || 0) * Number(i.quantity || 1)), 0) || Number(b.total_amount || 0)
                        billSum += bTotal

                        if (b.staff_remark?.includes('[CALL_STAFF]') || b.staff_remark?.includes('[CALL_BILL]')) {
                            callAlerts++
                        }
                    }
                })
            }

            const occRate = totalTables > 0 ? Math.round((occupiedCount / totalTables) * 100) : 0

            setMetrics({
                totalTables,
                totalCapacity,
                occupiedTables: occupiedCount,
                occupancyRate: occRate,
                seatedGuests: seatedPax,
                activeBillTotal: billSum,
                pendingCalls: callAlerts
            })
        } catch (err) {
            console.error('Error fetching table KPI metrics:', err)
        }
    }

    return (
        <div className="flex flex-col min-h-[calc(100vh-140px)] font-sans pb-12">
            
            <AdminPageHeader
                title="Floor & Tables"
                description="สถานะโต๊ะสด การจัดที่นั่ง ผังร้าน และ QR ประจำโต๊ะ"
                meta={metrics.pendingCalls > 0 ? (
                    <span className="text-[oklch(52%_0.16_28)] font-medium">{metrics.pendingCalls} โต๊ะกำลังเรียกพนักงาน</span>
                ) : null}
            >
                <AdminTabs
                    ariaLabel="Floor & Tables"
                    layoutId="tables-tabs"
                    tabs={[
                        { id: 'live', label: 'Live operations' },
                        { id: 'editor', label: 'Layout & QR studio' }
                    ]}
                    active={activeTab}
                    onChange={setActiveTab}
                />
            </AdminPageHeader>

            <AdminStatStrip
                items={[
                    { key: 'capacity', label: 'ความจุร้าน', value: `${metrics.totalTables} โต๊ะ`, note: `${metrics.totalCapacity} ที่นั่ง` },
                    { key: 'occupancy', label: 'โต๊ะที่ใช้อยู่', value: `${metrics.occupancyRate}%`, note: `${metrics.occupiedTables} จาก ${metrics.totalTables} โต๊ะ`, tone: metrics.occupiedTables > 0 ? 'accent' : undefined },
                    { key: 'guests', label: 'ลูกค้าในร้าน', value: `${metrics.seatedGuests} ท่าน`, note: 'กำลังนั่งโต๊ะ' },
                    { key: 'bills', label: 'ยอดบิลที่เปิดอยู่', value: `฿${metrics.activeBillTotal.toLocaleString()}`, note: 'ยังไม่ชำระ' }
                ]}
            />

            {/* Tab Body */}
            <div className="flex-1 bg-[oklch(98%_0.006_28)] rounded-sm border border-[oklch(85%_0.012_28)] overflow-hidden">
                <AdminTabPanel id={activeTab}>
                    {activeTab === 'live' ? (
                        <TableManager isStaffView={false} />
                    ) : (
                        <AdminTableEditor />
                    )}
                </AdminTabPanel>
            </div>
        </div>
    )
}
