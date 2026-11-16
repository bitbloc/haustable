/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · app style: achromatic ledger (shared with the Stock page) */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { getShortBookingId } from './utils/printerHelper';
import { stockStatus } from './utils/stockUtils';
import './StaffDashboard.css';

// The screen's question: what needs doing on the floor right now?

const ORDER_STATUS_LABEL = {
    pending: 'รอรับ',
    confirmed: 'ยืนยันแล้ว',
    approved: 'ยืนยันแล้ว',
    seated: 'นั่งแล้ว',
    preparing: 'กำลังทำ',
    ready: 'พร้อมเสิร์ฟ',
    paid: 'จ่ายแล้ว',
    completed: 'เสร็จ',
    cancelled: 'ยกเลิก',
    void: 'ยกเลิก',
};

const JOBS = [
    { to: '/staff/stock', title: 'คลังวัตถุดิบ', desc: 'นับ รับของ ปรับยอด' },
    { to: '/staff/tables', title: 'โต๊ะ', desc: 'จัดที่นั่ง ปล่อยโต๊ะ' },
    { to: '/staff/sop', title: 'สูตรบาร์', desc: 'สูตรและขั้นตอน' },
];

const clock = (d) => d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

/** "21:00" today, "15 พ.ย. 21:00" for anything older, so a time never reads as today's by mistake. */
const stamp = (iso) => {
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) return clock(d);
    return `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${clock(d)}`;
};

const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

const stockVerb = (t) => (t.transaction_type === 'set' ? 'ปรับยอด' : Number(t.quantity_change) > 0 ? 'รับเข้า' : 'ใช้');

function Figure({ loading, hot, signal, children }) {
    if (loading) return <span className="sd-bar sd-bar--figure" aria-hidden="true" />;
    return <span className={`sd-stat__n ${hot ? 'is-hot' : ''} ${signal ? 'is-signal' : ''}`}>{children}</span>;
}

function Rows({ loading, error, rows, empty, onRetry, render }) {
    if (loading) {
        return (
            <ul className="sd-rows" aria-hidden="true">
                {[0, 1, 2, 3, 4].map(i => (
                    <li key={i} className="sd-row">
                        <span className="sd-row__main"><span className="sd-bar sd-bar--line" /><span className="sd-bar sd-bar--sub" /></span>
                    </li>
                ))}
            </ul>
        );
    }
    if (error) {
        return (
            <p className="sd-note">
                โหลดรายการไม่ได้ <button type="button" className="sd-link" onClick={onRetry}>ลองอีกครั้ง</button>
            </p>
        );
    }
    if (rows.length === 0) return <p className="sd-note">{empty}</p>;
    return <ul className="sd-rows">{rows.map(render)}</ul>;
}

export default function StaffDashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ pendingOrders: 0, upcomingBookings: 0, stock: { out: 0, low: 0, reorder: 0 } });
    const [stockMoves, setStockMoves] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [isLive, setIsLive] = useState(false);

    const fetchStats = useCallback(async (isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) setRefreshing(true);
        try {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const results = await Promise.all([
                supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
                supabase.from('bookings').select('*', { count: 'exact', head: true })
                    .in('status', ['confirmed', 'approved'])
                    .gte('booking_time', now.toISOString())
                    .lte('booking_time', tomorrow.toISOString()),
                supabase.from('stock_items').select('item_type, current_quantity, min_stock_threshold, reorder_point'),
                supabase.from('stock_transactions').select('*, stock_items(name)').order('created_at', { ascending: false }).limit(5),
                supabase.from('bookings').select('*, tables_layout(table_name)').order('created_at', { ascending: false }).limit(5),
            ]);
            const failed = results.find(r => r.error);
            if (failed) throw failed.error;
            const [pendingResult, bookingResult, stockResult, recentStock, recentOrders] = results;

            // Same rule and same item set as the Stock page's "ต้องสั่งซื้อ" tab (recipes are not shelf items).
            const stock = { out: 0, low: 0, reorder: 0, ok: 0 };
            for (const item of stockResult.data || []) {
                if (item.item_type !== 'recipe') stock[stockStatus(item)] += 1;
            }

            setStats({ pendingOrders: pendingResult.count || 0, upcomingBookings: bookingResult.count || 0, stock });
            setStockMoves(recentStock.data || []);
            setOrders(recentOrders.data || []);
            setUpdatedAt(new Date());
            setError(false);
        } catch (err) {
            console.error('Staff dashboard fetch error:', err);
            setError(true);
        } finally {
            if (!isBackgroundRefresh) setRefreshing(false);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const initUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                fetchStats();
            }
            // StaffAuthLayout handles the redirect when there is no session
        };
        initUser();
    }, [fetchStats]);

    useEffect(() => {
        const channel = supabase
            .channel('dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchStats(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, () => fetchStats(true))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_transactions' }, () => fetchStats(true))
            .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchStats]);

    const handleLogout = async () => {
        // Only the staff session keys: this device also holds POS offline data, printer and tax settings.
        localStorage.removeItem('staff_role');
        localStorage.removeItem('staff_id');
        await supabase.auth.signOut();
        navigate('/login');
    };

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'พนักงาน';
    const { pendingOrders, upcomingBookings, stock } = stats;
    const restock = stock.out + stock.low + stock.reorder;

    return (
        <div className="staff-dash">
            <header className="sd-top">
                <div className="sd-top__bar">
                    <div className="sd-wrap sd-top__row">
                        <div className="sd-brand">
                            <img src="/logo-staff-dark.png" alt="In the haus" className="sd-brand__logo" />
                            <span className="sd-brand__scope">Staff</span>
                        </div>
                        <nav className="sd-top__links" aria-label="บัญชีและทางลัด">
                            <span className="sd-top__user">{firstName}</span>
                            <button type="button" className="sd-quiet" onClick={() => navigate('/admin')}>Backoffice</button>
                            <a className="sd-quiet sd-top__wide" href="/booking">หน้าจองของลูกค้า</a>
                            <button type="button" className="sd-quiet" onClick={handleLogout}>ออกจากระบบ</button>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="sd-wrap sd-main">
                <div className="sd-title">
                    <div className="sd-title__text">
                        <h1>ภาพรวมหน้าร้าน</h1>
                        <p>
                            {loading
                                ? 'กำลังโหลด'
                                : pendingOrders > 0
                                    ? `มี ${pendingOrders.toLocaleString('th-TH')} ออเดอร์รอรับ`
                                    : 'ไม่มีออเดอร์รอรับ'}
                        </p>
                    </div>
                    <div className="sd-title__side">
                        <span className="sd-fresh" role="status">
                            <span className={`sd-fresh__dot ${isLive ? 'is-live' : ''}`} aria-hidden="true" />
                            {isLive ? 'สด' : 'กำลังเชื่อมต่อ'}
                            {updatedAt && <span className="sd-fresh__time"> · อัปเดต {clock(updatedAt)}</span>}
                        </span>
                        <button type="button" className="sd-quiet" onClick={() => fetchStats(false)} disabled={refreshing}>
                            {refreshing ? 'กำลังโหลด' : 'รีเฟรช'}
                        </button>
                    </div>
                </div>

                {error && !loading && (
                    <p className="sd-note sd-note--block">
                        โหลดข้อมูลล่าสุดไม่ได้{updatedAt ? ` ตัวเลขด้านล่างเป็นของ ${clock(updatedAt)}` : ''}{' '}
                        <button type="button" className="sd-link" onClick={() => fetchStats(false)}>ลองอีกครั้ง</button>
                    </p>
                )}

                {/* What needs doing: one container, three figures. This screen is used on a phone, so nothing links to the POS terminal. */}
                <section className="sd-stats" aria-label="สิ่งที่ต้องทำตอนนี้">
                    <div className="sd-stat">
                        <span className="sd-stat__label">ออเดอร์รอรับ</span>
                        <Figure loading={loading} hot={pendingOrders > 0} signal={pendingOrders > 0}>{pendingOrders.toLocaleString('th-TH')}</Figure>
                        <span className="sd-stat__sub">รอยืนยันที่เครื่อง POS</span>
                    </div>
                    <button type="button" className="sd-stat" onClick={() => navigate('/staff/tables')}>
                        <span className="sd-stat__label">จองใน 24 ชม. ข้างหน้า</span>
                        <Figure loading={loading} hot={upcomingBookings > 0}>{upcomingBookings.toLocaleString('th-TH')}</Figure>
                        <span className="sd-stat__sub">ยืนยันแล้ว ดูที่ผังโต๊ะ</span>
                    </button>
                    <button type="button" className="sd-stat" onClick={() => navigate('/staff/stock')}>
                        <span className="sd-stat__label">วัตถุดิบต้องสั่งซื้อ</span>
                        <Figure loading={loading} hot={restock > 0}>{restock.toLocaleString('th-TH')}</Figure>
                        <span className="sd-stat__sub">
                            {loading ? ' ' : restock === 0 ? 'ครบทุกรายการ' : (
                                <>
                                    <span className={stock.out > 0 ? 'sd-signal' : ''}>หมด {stock.out}</span>
                                    <span className="sd-nowrap"> · เหลือน้อย {stock.low}</span>
                                    <span className="sd-nowrap"> · ควรสั่ง {stock.reorder}</span>
                                </>
                            )}
                        </span>
                    </button>
                </section>

                {/* Where the work happens */}
                <nav className="sd-jobs" aria-label="หน้าทำงาน">
                    {JOBS.map(job => (
                        <button
                            key={job.to}
                            type="button"
                            className="sd-job"
                            onClick={() => navigate(job.to)}
                        >
                            <span className="sd-job__title">{job.title}</span>
                            <span className="sd-job__desc">{job.desc}</span>
                        </button>
                    ))}
                </nav>

                <div className="sd-lists">
                    <section className="sd-panel" aria-labelledby="sd-orders-h">
                        <header className="sd-panel__head">
                            <h2 id="sd-orders-h">ออเดอร์ล่าสุด</h2>
                        </header>
                        <Rows
                            loading={loading}
                            error={error && orders.length === 0}
                            rows={orders}
                            empty="ยังไม่มีออเดอร์"
                            onRetry={() => fetchStats(false)}
                            render={(o) => (
                                <li key={o.id} className="sd-row">
                                    <span className="sd-row__main">
                                        <span className="sd-row__title">
                                            {o.tables_layout?.table_name ? `โต๊ะ ${o.tables_layout.table_name}` : 'รับกลับบ้าน'}
                                        </span>
                                        <span className="sd-row__sub">#{getShortBookingId(o)}</span>
                                    </span>
                                    <span className="sd-row__side">
                                        <span className={o.status === 'pending' ? 'sd-pill' : 'sd-row__state'}>
                                            {ORDER_STATUS_LABEL[o.status] || o.status}
                                        </span>
                                        <span className="sd-row__time">{stamp(o.created_at)}</span>
                                    </span>
                                </li>
                            )}
                        />
                    </section>

                    <section className="sd-panel" aria-labelledby="sd-stock-h">
                        <header className="sd-panel__head">
                            <h2 id="sd-stock-h">สต๊อกเคลื่อนไหวล่าสุด</h2>
                            <button type="button" className="sd-link" onClick={() => navigate('/staff/stock')}>เปิดคลัง</button>
                        </header>
                        <Rows
                            loading={loading}
                            error={error && stockMoves.length === 0}
                            rows={stockMoves}
                            empty="ยังไม่มีการเคลื่อนไหวของสต๊อก"
                            onRetry={() => fetchStats(false)}
                            render={(t) => (
                                <li key={t.id} className="sd-row">
                                    <span className="sd-row__main">
                                        <span className="sd-row__title">{t.stock_items?.name || 'ไม่ระบุรายการ'}</span>
                                        <span className="sd-row__sub">{stockVerb(t)} · {t.performed_by || 'พนักงาน'}</span>
                                    </span>
                                    <span className="sd-row__side">
                                        <span className="sd-row__qty">{signed(Number(t.quantity_change) || 0)}</span>
                                        <span className="sd-row__time">{stamp(t.created_at)}</span>
                                    </span>
                                </li>
                            )}
                        />
                    </section>
                </div>
            </main>
        </div>
    );
}
