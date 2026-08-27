import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function updatePickupAvailability() {
    const targetIds = [
        144, // Naga in haus (RED)
        145, // Naga in haus (Black)
        138, // สะตอผัดกุ้งจริตจัด
        139, // ใบเหลียงผัดไข่ในบ้าน
        17,  // ทาทากิ(ยำเนื้อญี่ปุ่น)
        18,  // ถั่วแระญี่ปุ่น
        19,  // เม็ดมะม่วงหิมพานต์คั่วเกลือ
        22,  // เฟรนช์ฟรายส์
        23,  // ไก่ป๊อบ
        24   // ชุดทอดรวม
    ];

    console.log(`Updating is_pickup_available = true for IDs:`, targetIds);

    const { data, error } = await supabase
        .from('menu_items')
        .update({ is_pickup_available: true })
        .in('id', targetIds)
        .select('id, name, category, is_pickup_available');

    if (error) {
        console.error('Update error:', error);
        return;
    }

    console.log('Successfully updated items:');
    data.forEach(item => {
        console.log(` - [ID ${item.id}] ${item.name} (${item.category}): is_pickup_available = ${item.is_pickup_available}`);
    });
}

updatePickupAvailability();
