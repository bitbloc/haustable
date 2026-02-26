import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    CalendarCheck, 
    CalendarX2, 
    Clock, 
    LogOut,
    CheckCircle2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';

export default function StaffAttendanceModal({ isOpen, onClose }) {
    // 1. State Management
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ attendance: [], leaves: [] });
    const [error, setError] = useState(null);
    
    const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'leaves'

    // 2. Fetch Data
    useEffect(() => {
        if (!isOpen) return;
        
        const fetchHRData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`https://inthehaus-hr.vercel.app/api/export/staff-data?startDate=${startDate}&endDate=${endDate}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                const result = await response.json();
                setData({
                    attendance: result.attendance || [],
                    leaves: result.leaves || []
                });
            } catch (err) {
                console.error("Error fetching HR data:", err);
                setError('ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
            } finally {
                setLoading(false);
            }
        };

        fetchHRData();
    }, [isOpen, startDate, endDate]);

    // 3. Render Helpers
    const changeMonth = (offset) => {
        const currentDate = new Date(startDate);
        currentDate.setMonth(currentDate.getMonth() + offset);
        setStartDate(format(startOfMonth(currentDate), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(currentDate), 'yyyy-MM-dd'));
    };

    const formatThaiTime = (isoString) => {
         // The API returns timestamp in UTC (+00:00). We need to explicitly convert it to Thai time (+07:00).
         const date = new Date(isoString);
         // Ensure correct manual offset formatting without relying solely on browser locale timezone offset changes
         // Since JS Date object auto-converts to local time based on system settings, 
         // we format directly or let simple toLocaleTimeString handle it if system is already TH time.
         return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    const formatThaiDateShort = (isoString) => {
         const date = new Date(isoString);
         return format(date, 'd MMM yyyy', { locale: th });
    }

    // 4. UI Components

    // Group attendance by employee for summary view, or keep flat for timeline. 
    // We'll group them by day, then by employee.
    const renderAttendanceLog = () => {
        if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
        if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
        if (data.attendance.length === 0) return <div className="text-center py-12 text-gray-500">ไม่มีข้อมูลบันทึกเวลาเข้า-ออก</div>;

        // Group records by Date (YYYY-MM-DD)
        const groupedByDay = data.attendance.reduce((acc, curr) => {
            // API timestamp format "2026-02-26T11:39:15.365+00:00"
            // Let's get the local Thai date string for grouping
            const dateObj = new Date(curr.timestamp);
            const dateStr = format(dateObj, 'yyyy-MM-dd');
            
            if (!acc[dateStr]) acc[dateStr] = {};
            
            // Further group by employee within the day
            if (!acc[dateStr][curr.employee_id]) {
                 acc[dateStr][curr.employee_id] = {
                     name: curr.employee_name,
                     position: curr.position,
                     records: []
                 };
            }
            acc[dateStr][curr.employee_id].records.push(curr);
            return acc;
        }, {});

        // Sort days descending
        const sortedDays = Object.keys(groupedByDay).sort((a,b) => b.localeCompare(a));

        return (
            <div className="space-y-6">
                {sortedDays.map(day => (
                    <div key={day} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                            <Calendar className="w-5 h-5 text-blue-500" />
                            <h3 className="font-bold text-gray-800 text-lg">{format(parseISO(day), 'EEEEที่ d MMMM yyyy', { locale: th })}</h3>
                        </div>
                        
                        <div className="space-y-4">
                            {Object.values(groupedByDay[day]).map(emp => {
                                // Extract Check-In and Check-Out
                                const checkIn = emp.records.find(r => r.action_type === 'check_in' || r.action_type === 'clock_in');
                                const checkOut = emp.records.find(r => r.action_type === 'check_out' || r.action_type === 'clock_out');

                                return (
                                    <div key={emp.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-2xl gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{emp.name}</p>
                                                <p className="text-xs text-gray-500">{emp.position}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 text-sm font-medium">
                                            <div className="flex flex-col items-center bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 min-w-[100px]">
                                                <span className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> เข้างาน</span>
                                                {checkIn ? (
                                                    <span className="text-green-600 font-bold text-lg flex items-center gap-2">
                                                        {formatThaiTime(checkIn.timestamp)} {checkIn.mood_status && <span className="text-base">{checkIn.mood_status}</span>}
                                                    </span>
                                                ) : <span className="text-gray-300">-</span>}
                                            </div>
                                            <div className="flex flex-col items-center bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 min-w-[100px]">
                                                <span className="text-xs text-gray-400 mb-1 flex items-center gap-1"><LogOut className="w-3 h-3"/> เลิกงาน</span>
                                                {checkOut ? (
                                                    <span className="text-red-500 font-bold text-lg flex items-center gap-2">
                                                        {formatThaiTime(checkOut.timestamp)} {checkOut.mood_status && <span className="text-base">{checkOut.mood_status}</span>}
                                                    </span>
                                                ) : <span className="text-gray-300">-</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderLeavesLog = () => {
        if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
        if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
        if (data.leaves.length === 0) return <div className="text-center py-12 text-gray-500">ไม่มีข้อมูลการลาในช่วงนี้</div>;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.leaves.map(leave => (
                    <motion.div 
                        key={leave.record_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden"
                    >
                        {/* Status Ribbon */}
                        <div className={`absolute top-0 right-0 px-4 py-1 text-xs font-bold rounded-bl-xl ${
                            leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                            leave.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                            {leave.status === 'approved' ? 'อนุมัติแล้ว' : leave.status === 'pending' ? 'รออนุมัติ' : 'ไม่อนุมัติ'}
                        </div>

                        <div className="flex items-center gap-3 mb-4 mt-2">
                            <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xl">
                                {leave.employee_name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-lg">{leave.employee_name}</p>
                                <p className="text-xs text-gray-500">{leave.position}</p>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-2xl">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">ประเภทการลา</span>
                                <span className="font-bold capitalize">{leave.leave_type}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">วันที่ลา</span>
                                <span className="font-bold text-orange-600">{formatThaiDateShort(leave.leave_date)}</span>
                            </div>
                            <div className="pt-2 border-t border-gray-200 mt-2">
                                <span className="text-gray-500 block mb-1">เหตุผล</span>
                                <span className="font-medium text-gray-800 break-words">{leave.reason || '-'}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />

                    {/* Modal Content */}
                    <motion.div 
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 md:inset-auto md:top-[5%] md:left-[10%] md:right-[10%] md:bottom-[5%] bg-[#F8F9FB] rounded-t-[2.5rem] md:rounded-[2.5rem] z-50 flex flex-col shadow-2xl overflow-hidden max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="bg-white px-6 py-6 border-b border-gray-100 rounded-t-[2.5rem] flex-shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50"></div>
                            
                            <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                                        Staff Attendance 
                                        <span className="text-2xl">🎉</span>
                                    </h2>
                                    <p className="text-sm text-gray-500 font-medium">ระบบดูข้อมูลเข้า-ออกงานและการลา</p>
                                </div>
                                <button 
                                    onClick={onClose}
                                    className="w-12 h-12 bg-gray-50 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center transition-colors shadow-sm"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Controls (Filters & Tabs) */}
                        <div className="bg-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 flex-shrink-0 z-10 shadow-sm relative">
                            {/* Tabs */}
                            <div className="flex p-1 bg-gray-100 rounded-2xl w-full md:w-auto">
                                <button 
                                    onClick={() => setActiveTab('attendance')}
                                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                                        activeTab === 'attendance' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    <CalendarCheck className="w-4 h-4" /> เข้า-ออกงาน
                                </button>
                                <button 
                                    onClick={() => setActiveTab('leaves')}
                                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                                        activeTab === 'leaves' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    <CalendarX2 className="w-4 h-4" /> ประวัติการลา
                                </button>
                            </div>

                            {/* Month Selector */}
                            <div className="flex items-center bg-gray-50 rounded-2xl p-1 border border-gray-200">
                                <button 
                                    onClick={() => changeMonth(-1)}
                                    className="p-3 hover:bg-white rounded-xl transition-colors shadow-sm text-gray-600"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="px-6 font-bold text-gray-800 min-w-[150px] text-center">
                                    {format(parseISO(startDate), 'MMMM yyyy', { locale: th })}
                                </div>
                                <button 
                                    onClick={() => changeMonth(1)}
                                    disabled={loading || isAfter(parseISO(startDate), new Date())}
                                    className={`p-3 rounded-xl transition-colors shadow-sm text-gray-600 ${
                                        isAfter(parseISO(startDate), new Date()) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'
                                    }`}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-6 overflow-y-auto flex-1 bg-[#F8F9FB] smooth-scroll">
                            {activeTab === 'attendance' ? renderAttendanceLog() : renderLeavesLog()}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
