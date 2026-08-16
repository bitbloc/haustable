// Shared Expense Constants for In The Haus

export const EXPENSE_CATEGORIES = [
    { id: 'raw_material', label: '🛒 วัตถุดิบ & ของสด (Makro/ตลาด/น้ำแข็ง)', defaultVendor: 'Siam Makro', defaultDoc: 'tax_invoice' },
    { id: 'marketing', label: '📣 ค่ายิงแอด & การตลาด (Ads)', defaultVendor: 'Facebook/TikTok Ads', defaultDoc: 'tax_invoice' },
    { id: 'fuel_logistics', label: '⛽ ค่าน้ำมันรถ & ค่าส่งของ (Fuel/Delivery)', defaultVendor: 'ปั๊ม ปตท. (PTT)', defaultDoc: 'tax_invoice' },
    { id: 'utilities', label: '⚡ ค่าน้ำ / ค่าไฟ / ค่าแก๊สหุงต้ม / ค่าเน็ต', defaultVendor: 'การไฟฟ้า/การประปา/ร้านแก๊ส', defaultDoc: 'tax_invoice' },
    { id: 'rent', label: '🏠 ค่าเช่าสถานที่ / ร้าน', defaultVendor: 'เจ้าของที่เช่า', defaultDoc: 'slip_only' },
    { id: 'staff_wages', label: '👥 ค่าจ้าง / เงินเดือนพนักงาน', defaultVendor: 'พนักงานร้าน', defaultDoc: 'receipt_voucher' },
    { id: 'equipment_supplies', label: '📦 ของใช้ / ถุงแก้ว / บรรจุภัณฑ์', defaultVendor: 'ร้านบรรจุภัณฑ์', defaultDoc: 'tax_invoice' },
    { id: 'maintenance', label: '🔧 ซ่อมบำรุง / ช่างแอร์ / ตกแต่งร้าน', defaultVendor: 'HomePro/ช่าง', defaultDoc: 'cash_bill' },
    { id: 'software_service', label: '💻 ค่าบริการ / ซอฟต์แวร์ / ดนตรี', defaultVendor: 'Spotify/Canva/ระบบ', defaultDoc: 'tax_invoice' },
    { id: 'other', label: '📌 อื่นๆ / เบ็ดเตล็ด', defaultVendor: '', defaultDoc: 'cash_bill' }
];

export const VENDOR_PRESETS = [
    'Siam Makro',
    'Lotus',
    'Big C',
    'CJ More / 7-Eleven',
    'ตลาดสดท้องถิ่น / ตลาดไท',
    'ร้านแก๊ส / เวิลด์แก๊ส / สยามแก๊ส / ปตท.แก๊ส',
    'โรงน้ำแข็ง / น้ำแข็งหลอด',
    'Facebook Ads',
    'TikTok Ads',
    'LINE Ads',
    'Google Ads',
    'ปั๊ม ปตท. (PTT)',
    'ปั๊ม บางจาก (Bangchak)',
    'ปั๊ม Shell / Caltex',
    'Lalamove / Grab / Lineman',
    'การไฟฟ้านครหลวง (MEA)',
    'การไฟฟ้าส่วนภูมิภาค (PEA)',
    'การประปานครหลวง / ส่วนภูมิภาค',
    'True / AIS / 3BB / NT',
    'เจ้าของพื้นที่เช่า',
    'HomePro / ไทวัสดุ',
    'ช่างแอร์ / งานซ่อมบำรุง',
    'OfficeMate'
];
