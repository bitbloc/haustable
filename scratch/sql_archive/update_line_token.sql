-- 1. ไปที่ LINE Developers Console: https://developers.line.biz/console/
-- 2. เลือก Provider และ Channel ของคุณ (Messaging API)
-- 3. ไปที่แท็บ "Messaging API"
-- 4. เลื่อนลงไปล่างสุดที่หัวข้อ "Channel access token"
-- 5. กดปุ่ม "Issue" (ถ้ายังไม่มี) หรือ copy token ยาวๆ มา
-- 6. แทนที่ 'วาง_CHANNEL_ACCESS_TOKEN_ของคุณที่นี่' ในบรรทัดด้านล่างด้วย token ที่ได้มา
-- 7. กด Run เพื่อบันทึกค่าลงฐานข้อมูล

INSERT INTO app_settings (key, value)
VALUES ('line_channel_access_token', '<LINE_CHANNEL_ACCESS_TOKEN>')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- ตรวจสอบว่าค่าเข้าหรือไม่
SELECT * FROM app_settings WHERE key = 'line_channel_access_token';
