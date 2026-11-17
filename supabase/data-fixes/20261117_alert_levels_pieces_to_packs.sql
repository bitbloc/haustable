-- Alert levels typed in bottles / pieces on items counted in crates / packs (owner, 2026-11-17:
-- "เป็นขวดครับ"). Stock is stored in the counting unit, so the levels are divided by the
-- pieces in one crate or pack. Guarded by the old values: running it twice changes nothing.
begin;
with fix(name, mn, rp, par) as (values
  ('เบียร์สิงห์', 15, 20, 48),
  ('เบียร์บัดไวเซอร์', 10, 12, 48),
  ('โค้ก 500 มล', 5, 10, 45),
  ('น้ำแร่ Flow ', 5, 10, 60),
  ('น้ำสิงห์ 1.5 ลิตร', 5, 10, 48),
  ('น้ำสิงห์ 600 มล', 5, 20, 60),
  ('แก้วร้อน 8 ออนซ์', 10, 15, 50),
  ('ฝาแก้วร้อน', 10, 15, 50),
  ('ทิชชู่เช็ดปาก', 5, 8, 30),
  ('ทิชชู่ในห้องน้ำ', 5, 8, 50)
)
update stock_items s
   set min_stock_threshold = round((fix.mn / s.conversion_factor)::numeric, 4),
       reorder_point       = round((fix.rp / s.conversion_factor)::numeric, 4),
       par_level           = round((fix.par / s.conversion_factor)::numeric, 4)
  from fix
 where s.name = fix.name
   and s.conversion_factor > 1
   and s.min_stock_threshold = fix.mn and s.reorder_point = fix.rp and s.par_level = fix.par
returning s.name, s.conversion_factor, s.min_stock_threshold, s.reorder_point, s.par_level;
commit;
