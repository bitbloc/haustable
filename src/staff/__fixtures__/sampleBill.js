// Dev-only sample bill for looking at the staff remote's screens when no table is open
// (open /staff/tables/<id>?fixture=1 on the dev server). Never loaded in a production build,
// and nothing here is written to the database.
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString()

export const sampleBill = () => ({
    id: '00000000-0000-4000-8000-000000000001',
    status: 'seated',
    booking_type: 'walk_in',
    booking_time: minutesAgo(48),
    discount_amount: 50,
    deposit_amount: 0,
    staff_remark: '',
    order_items: [
        { id: 9001, quantity: 2, price_at_time: 324, destination: 'kitchen', created_at: minutesAgo(46), kitchen_printed_at: minutesAgo(45),
          selected_options: [{ group_name: 'Add-on', name: 'ไข่ออนเซ็นซูวี ( Onsen Egg )', price: 25 }], menu_items: { name: 'ข้าวซอสญี่ปุ่น • เนื้อสันคอ' } },
        { id: 9002, quantity: 1, price_at_time: 159, destination: 'kitchen', created_at: minutesAgo(46), kitchen_printed_at: minutesAgo(45),
          selected_options: [{ group_name: 'หมายเหตุ', name: 'เผ็ดน้อย ไม่ใส่ผักชี', price: 0 }], menu_items: { name: 'แกงไตปลา (รสชัดเจน!)' } },
        { id: 9003, quantity: 3, price_at_time: 20, destination: 'bar', created_at: minutesAgo(30), kitchen_printed_at: minutesAgo(29),
          selected_options: [], menu_items: { name: 'น้ำเปล่าสิงห์ 600 มล' }, ordered_by_name: 'มายด์' },
        { id: 9004, quantity: 1, price_at_time: 199, destination: 'kitchen', created_at: minutesAgo(3), kitchen_printed_at: null,
          selected_options: [], menu_items: { name: 'ทาทากิ(ยำเนื้อญี่ปุ่น)' }, ordered_by_name: 'มายด์' },
        { id: 9005, quantity: 1, price_at_time: 65, destination: 'bar', created_at: new Date().toISOString(), kitchen_printed_at: null,
          selected_options: [{ group_name: 'ความหวาน', name: 'หวานน้อย', price: 0 }], menu_items: { name: 'ชาไทยเย็น' }, ordered_by_name: 'มายด์' },
    ],
})
