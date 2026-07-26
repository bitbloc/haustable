-- 1. ไปที่ LINE Developers Console: https://developers.line.biz/console/
-- 2. เลือก Provider และ Channel ของคุณ (Messaging API)
-- 3. ไปที่แท็บ "Basic Settings" (คนละแท็บกับ Token นะครับ อันนี้ Basic Settings)
-- 4. เลื่อนลงมาหารายการ "Channel secret"
-- 5. กด copy มาใส่แทนที่ 'วาง_CHANNEL_SECRET_ของคุณที่นี่' ด้านล่างครับ
-- 6. กด Run

INSERT INTO app_settings (key, value)
VALUES ('line_channel_secret', '55ce326955cce0cdb0bca9944f2598c4')
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;

-- ตรวจสอบผล
SELECT * FROM app_settings WHERE key = 'line_channel_secret';
