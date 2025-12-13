import { createContext, useState, useContext } from 'react';

const LanguageContext = createContext();

// คำแปลภาษา
const translations = {
    th: {
        // Header
        welcome: 'ยินดีต้อนรับ',
        login: 'เข้าสู่ระบบ',
        logout: 'ออกจากระบบ',
        guest: 'ผู้เยี่ยมชม',

        // Home
        headline: 'haus table.',
        subHeadline: 'by ร้านในบ้าน in the haus',
        description: 'ระบบจองโต๊ะและมารับอาหารที่ร้าน',
        dineIn: 'จองโต๊ะ (Dine-in)',
        takeaway: 'สั่งกลับบ้าน (Pickup)',
        bookTable: 'จองโต๊ะ',
        orderPickup: 'สั่งอาหาร',
        openNow: 'เปิดให้บริการ',
        loginGoogle: 'เข้าสู่ระบบด้วย Google',

        // Booking & Pickup
        backToHome: 'กลับหน้าหลัก',
        back: 'ย้อนกลับ',
        step1: 'เลือกเมนู',
        step2: 'สรุปยอด',
        addToCart: 'ใส่ตะกร้า',
        added: 'เพิ่มแล้ว',
        cartTotal: 'ยอดรวม',
        confirmOrder: 'ยืนยันการสั่งซื้อ',
        yourName: 'ชื่อผู้รับ',
        phoneNumber: 'เบอร์โทรศัพท์',
        pickupTime: 'เวลารับสินค้า',
        paymentTitle: 'ชำระเงิน',
        uploadSlip: 'แนบสลิป',
        agreement: 'ยอมรับเงื่อนไข',
        disclaimer: 'หากไม่มารับภายใน 1 ชม. 30 นาที และติดต่อไม่ได้ ทางร้านขอสงวนสิทธิ์ยกเลิกออเดอร์และไม่คืนเงินทุกกรณี',
        minOrderWarn: 'ขั้นต่ำ 180 บาท',
        reservation: 'จองโต๊ะ',
        stepDate: 'ขั้นตอน 1/3',
        stepSeat: 'ขั้นตอน 2/3',
        stepFood: 'ขั้นตอน 3/3',
        selectSeat: 'เลือกที่นั่ง',
        foodAndDetail: 'อาหาร & รายละเอียด',
        confirmBooking: 'ยืนยันการจอง',
        date: 'วันที่',
        timeSlot: 'เวลารับบริการ',
        guests: 'จำนวนลูกค้า',
        selectTable: 'เลือกโต๊ะนี้',
        orderFood: 'สั่งอาหาร',
        searchMenu: 'ค้นหาเมนู...',
        next: 'ถัดไป',
        skipFood: 'ข้ามขั้นตอนอาหาร',
        bookingDetail: 'รายละเอียดการจอง',
        foodTotal: 'ค่าอาหาร',
        paymentRequired: 'จำเป็นต้องชำระเงิน',
        uploadSlipDesc: 'กรุณาแนบสลิปเพื่อยืนยันการจอง',
        agreeTerms: 'ฉันยอมรับเงื่อนไข',
        processing: 'กำลังดำเนินการ...',
        shopClosed: 'ร้านปิดอยู่',
        openUntil: 'เปิดถึง',
        opensAt: 'เปิดเวลา',
        selected: 'เลือกแล้ว',
        available: 'ว่าง',
        pleaseTapTable: 'กรุณาเลือกโต๊ะ',
        table: 'โต๊ะ',
        minCondition: 'หากไม่มารับภายใน 90 นาที ออเดอร์จะถูกยกเลิก',

        // Admin
        adminDashboard: 'จัดการการจอง',
        status: 'สถานะ',
        approve: 'อนุมัติ',
        reject: 'ยกเลิก',
    },
    en: {
        // Header
        welcome: 'Welcome',
        login: 'Login',
        logout: 'Logout',
        guest: 'Guest',

        // Home
        headline: 'haus table.',
        subHeadline: 'by In The Haus',
        description: 'Table booking & Pickup ordering system',
        dineIn: 'Dine-in',
        takeaway: 'Takeaway',
        bookTable: 'Book Table',
        orderPickup: 'Order Pickup',
        openNow: 'Open Now',
        loginGoogle: 'Login with Google',

        // Booking & Pickup
        backToHome: 'Back to Home',
        back: 'Back',
        step1: 'Menu',
        step2: 'Summary',
        addToCart: 'Add',
        added: 'Added',
        cartTotal: 'Total',
        confirmOrder: 'Confirm Order',
        yourName: 'Your Name',
        phoneNumber: 'Phone Number',
        pickupTime: 'Pickup Time',
        paymentTitle: 'Payment',
        uploadSlip: 'Upload Slip',
        agreement: 'Accept Terms',
        disclaimer: 'If not picked up within 1.5 hours and unreachable, the order will be cancelled with NO REFUND.',
        minOrderWarn: 'Min order 180 THB',
        reservation: 'Reservation',
        stepDate: 'Step 1/3',
        stepSeat: 'Step 2/3',
        stepFood: 'Step 3/3',
        selectSeat: 'Select Seat',
        foodAndDetail: 'Food & Detail',
        confirmBooking: 'Confirm Booking',
        date: 'Date',
        timeSlot: 'Time Slot',
        guests: 'Guests',
        selectTable: 'Select Table',
        orderFood: 'Order Food',
        searchMenu: 'Search menu...',
        next: 'Next',
        skipFood: 'Skip Food & Continue',
        bookingDetail: 'Booking Detail',
        foodTotal: 'Food Total',
        paymentRequired: 'Payment Required',
        uploadSlipDesc: 'Please upload a slip to confirm your booking.',
        agreeTerms: 'I agree to terms',
        processing: 'Processing...',
        shopClosed: 'Shop is currently closed',
        openUntil: 'Open until',
        opensAt: 'Opens at',
        selected: 'Selected',
        available: 'Available',
        pleaseTapTable: 'Please tap a table',
        table: 'Table',
        minCondition: 'Order will be cancelled without refund if not picked up within 90 minutes.',

        // Admin
        adminDashboard: 'Admin Dashboard',
        status: 'Status',
        approve: 'Approve',
        reject: 'Reject',
    }
};

export const LanguageProvider = ({ children }) => {
    const [lang, setLang] = useState('th');

    const toggleLanguage = () => {
        setLang(prev => prev === 'th' ? 'en' : 'th');
    };

    const t = (key) => translations[lang][key] || key;

    return (
        <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
