-- Repair stock balances wrongly converted by the unit-change form (17-22 Nov 2026).
-- Group A only: items whose contents are measured in g/ml/kg; the conversion made counted
-- containers read as a few grams. Sets the balance back to what people counted/received,
-- through post_stock_movement so the ledger records it, and restores alert levels.
BEGIN;
SELECT public.post_stock_movement('f4172fe1-d2ed-43a6-9cf0-45050925593f'::uuid, 'set', 10.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 60.6061 → 10.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 5.0 WHERE id = 'f4172fe1-d2ed-43a6-9cf0-45050925593f';
SELECT public.post_stock_movement('c121bed7-5bf4-4459-b04f-324d09f3ce9b'::uuid, 'set', 5.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.05 → 5.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 2.0, par_level = 4.0 WHERE id = 'c121bed7-5bf4-4459-b04f-324d09f3ce9b';
SELECT public.post_stock_movement('771520a3-9f02-4574-8c60-f5c45c30dd13'::uuid, 'set', 5.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 52.6316 → 5.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 2.0 WHERE id = '771520a3-9f02-4574-8c60-f5c45c30dd13';
SELECT public.post_stock_movement('9282f614-e90f-470a-8d11-01477abdf2b7'::uuid, 'set', 1.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.001 → 1.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 1.0 WHERE id = '9282f614-e90f-470a-8d11-01477abdf2b7';
SELECT public.post_stock_movement('9b6b873d-d215-4067-ab45-83f619fffa02'::uuid, 'set', 0.5, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 1.0 → 0.5 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = '9b6b873d-d215-4067-ab45-83f619fffa02';
SELECT public.post_stock_movement('daf4e040-112b-4274-827b-0513db07bad2'::uuid, 'set', 8.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.032 → 8.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 3.0 WHERE id = 'daf4e040-112b-4274-827b-0513db07bad2';
SELECT public.post_stock_movement('3c9dbca0-6bb9-4d15-8917-e16d017280a4'::uuid, 'set', 1.05, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.0011 → 1.05 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 0.9545 WHERE id = '3c9dbca0-6bb9-4d15-8917-e16d017280a4';
SELECT public.post_stock_movement('d1b70984-4737-4223-8842-18c6682cc4d9'::uuid, 'set', 1.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 100.0 → 1.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 2.0, reorder_point = 0.5, par_level = 10.0 WHERE id = 'd1b70984-4737-4223-8842-18c6682cc4d9';
SELECT public.post_stock_movement('db78e2b1-4f6c-426d-b332-56f5344217d8'::uuid, 'set', 0.85, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.0002 → 0.85 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 0.425, reorder_point = 0.425, par_level = 3.4 WHERE id = 'db78e2b1-4f6c-426d-b332-56f5344217d8';
SELECT public.post_stock_movement('c7043cc8-38c4-4de7-b9b8-032f673ffeee'::uuid, 'set', 5.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 250.0 → 5.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 1.0 WHERE id = 'c7043cc8-38c4-4de7-b9b8-032f673ffeee';
SELECT public.post_stock_movement('2ea69347-38b1-4882-809c-800ec351f4ae'::uuid, 'set', 10.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 62.5 → 10.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 2.0 WHERE id = '2ea69347-38b1-4882-809c-800ec351f4ae';
SELECT public.post_stock_movement('ebbde474-b91a-4050-92b2-00bfa828c34e'::uuid, 'set', 3.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 2.001 → 3.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 0.2, par_level = 5.0 WHERE id = 'ebbde474-b91a-4050-92b2-00bfa828c34e';
SELECT public.post_stock_movement('0c607062-d5ad-4c67-b276-5879c0ef4c3a'::uuid, 'set', 1.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.001 → 1.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = '0c607062-d5ad-4c67-b276-5879c0ef4c3a';
SELECT public.post_stock_movement('bc7fcbc2-9d33-4406-adda-622a2aa602a4'::uuid, 'set', 1.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.001 → 1.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = 'bc7fcbc2-9d33-4406-adda-622a2aa602a4';
SELECT public.post_stock_movement('c6c5948a-a7b5-45b9-8390-d7cee61c5581'::uuid, 'set', 0.5, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.0005 → 0.5 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = 'c6c5948a-a7b5-45b9-8390-d7cee61c5581';
SELECT public.post_stock_movement('9fabcc29-907c-405a-8d5b-6447f1dd3e16'::uuid, 'set', 3.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.0231 → 3.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 2.0, reorder_point = 2.0, par_level = 9.987 WHERE id = '9fabcc29-907c-405a-8d5b-6447f1dd3e16';
SELECT public.post_stock_movement('d7294dce-e4b6-49e9-bef5-fbb55538bacc'::uuid, 'set', 0.4556, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.2056 → 0.4556 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 0.2 WHERE id = 'd7294dce-e4b6-49e9-bef5-fbb55538bacc';
SELECT public.post_stock_movement('3c238688-9845-4c13-aafa-d3cd233d6198'::uuid, 'set', 4.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.0267 → 4.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 1.9925, reorder_point = 2.9963, par_level = 9.9925 WHERE id = '3c238688-9845-4c13-aafa-d3cd233d6198';
SELECT public.post_stock_movement('e28def6e-1545-486a-84ce-fcaa082e2f2c'::uuid, 'set', 6.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 60.0 → 6.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 5.0, reorder_point = 3.0, par_level = 20.0 WHERE id = 'e28def6e-1545-486a-84ce-fcaa082e2f2c';
SELECT public.post_stock_movement('5cc8a744-dd1c-4bdd-90f5-0a656667536f'::uuid, 'set', 10.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.1 → 10.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 2.0, reorder_point = 3.0, par_level = 10.0 WHERE id = '5cc8a744-dd1c-4bdd-90f5-0a656667536f';
SELECT public.post_stock_movement('0339e3c0-7d77-4220-8758-28cdbb09c773'::uuid, 'set', 2.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 20.0 → 2.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET reorder_point = 1.0 WHERE id = '0339e3c0-7d77-4220-8758-28cdbb09c773';
SELECT public.post_stock_movement('9773d29f-4fbd-4828-bb37-8ea6a8fd8876'::uuid, 'set', 18.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.09 → 18.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 2.0, reorder_point = 3.0, par_level = 8.0 WHERE id = '9773d29f-4fbd-4828-bb37-8ea6a8fd8876';
SELECT public.post_stock_movement('bdbdac86-7188-4468-9520-6ff9a16f0dcb'::uuid, 'set', 5.0, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 33.3333 → 5.0 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 2.0, reorder_point = 3.0, par_level = 8.0 WHERE id = 'bdbdac86-7188-4468-9520-6ff9a16f0dcb';
SELECT public.post_stock_movement('cef3cf29-d0e2-4164-a378-c1394faeb5b9'::uuid, 'set', 2.3, 'opening', 'System (undo unit change)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.0012 → 2.3 (ยอดตามที่นับ/รับเข้าก่อนแปลง)');
UPDATE public.stock_items SET min_stock_threshold = 0.9583, reorder_point = 0.575, par_level = 2.875 WHERE id = 'cef3cf29-d0e2-4164-a378-c1394faeb5b9';
-- Alert levels of items already recounted since the conversion (balance is right, levels are not)
UPDATE public.stock_items SET min_stock_threshold = 0.375, reorder_point = 0.525, par_level = 2.025 WHERE id = 'd67ddfb8-d806-4a7e-b18a-7a66a2a38e1f'; -- Tanqueray London Dry Gin
UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 2.0, par_level = 5.0 WHERE id = 'afb02785-6703-47e7-ac50-0381d9d48085'; -- กะทิอัมพวา
UPDATE public.stock_items SET reorder_point = 0.5 WHERE id = '0f9c2b97-7d9b-473f-9b15-ef181551a3e3'; -- ข้าวคั่ว
UPDATE public.stock_items SET min_stock_threshold = 0.3, reorder_point = 0.3 WHERE id = '3ed7fe83-a6df-4c4b-84c1-56c434cbd4f0'; -- ครีมชีส emborg
UPDATE public.stock_items SET min_stock_threshold = 0.05, reorder_point = 0.05 WHERE id = '0e5fd348-90cb-45eb-9234-336402777a57'; -- ซอสฝาเขียว/แกลอน
UPDATE public.stock_items SET reorder_point = 1.0 WHERE id = '015df2c9-664d-428c-8604-aac66b66f88a'; -- ซอสพริกโรซ่า/ถุง
UPDATE public.stock_items SET reorder_point = 1.0 WHERE id = 'cbb144f0-01a2-4921-b83a-e475c239f38b'; -- ซอสมะเขือเทศโรซ่า/ถุง
UPDATE public.stock_items SET min_stock_threshold = 2.0, reorder_point = 6.0, par_level = 12.0 WHERE id = '794f3729-d524-48d7-b57b-d16a9118013a'; -- ซอสแม็กกี้
UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 1.0, par_level = 4.0 WHERE id = '15c18534-4aef-4d5f-a0bf-3f356f4132b1'; -- ถุงหูหิ้วใสบาง Aro 7*15
UPDATE public.stock_items SET reorder_point = 2.0 WHERE id = 'ced53861-7460-4c84-a886-7d7d433148fa'; -- น้ำกระเทียมดองSavepak/ขวด
UPDATE public.stock_items SET reorder_point = 0.5 WHERE id = '69950086-41b0-4f43-ad3f-01bfb35c4c53'; -- น้ำตาลกรวด/ถุง
UPDATE public.stock_items SET reorder_point = 0.5 WHERE id = 'd0430863-e982-47b8-b101-fd3b09c49b1f'; -- น้ำตาลทรายขาวมิตรผล/ถุง
UPDATE public.stock_items SET reorder_point = 0.5 WHERE id = '4e8cbc35-7521-4940-8197-fc2461602033'; -- น้ำตาลทรายแดง
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = '62246d31-e170-4122-a8c8-6d70ee338cb1'; -- น้ำปลา
UPDATE public.stock_items SET min_stock_threshold = 0.9615, reorder_point = 2.8846, par_level = 5.7692 WHERE id = '386b26d9-ebb1-4c43-89c6-ccaa6aaf8a45'; -- น้ำมะขามเปียก
UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 0.5, par_level = 6.0 WHERE id = 'd0444e42-e87c-44df-8688-505da336e852'; -- น้ำมันคาโนลา/ขวด
UPDATE public.stock_items SET min_stock_threshold = 1.08, reorder_point = 1.08, par_level = 3.96 WHERE id = '1e85d0e6-6616-46f8-ac4d-b5a2a99baaa8'; -- น้ำยาล้างจานโปร
UPDATE public.stock_items SET min_stock_threshold = 0.8 WHERE id = '69f943b4-8e58-454d-9f8d-dbfaeb286c4f'; -- น้ำยาเช็ดกระจก
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = '86116224-414f-4574-8a94-f80b8b8f170b'; -- น้ำส้มสายชูอสร/แกลอน
UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 0.5 WHERE id = '078becb9-1cab-4334-ad12-5659ac93e5fa'; -- น้ำหมากเม่า100%
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = '26749e86-2a7c-4257-aa12-abc0c0403e41'; -- ผงมะนาวคนอร์ 1kg
UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 0.5, par_level = 3.0 WHERE id = '1d0940b3-f30a-4389-823e-2f09db8d8cdf'; -- ผงมัทฉะ
UPDATE public.stock_items SET reorder_point = 0.3 WHERE id = '8eedec86-c98b-46ec-b92d-d6630960ead8'; -- ผงรสดีหมู 1.5kg
UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 2.0, par_level = 3.0 WHERE id = '1e0508b7-5420-41aa-816d-52b00360a220'; -- พริกป่นเกาหลี
UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 0.2, par_level = 5.0 WHERE id = 'df7bf9a9-1a99-44b0-8249-8f6d048bc547'; -- พริกแกงมัสมั่น
UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 0.3, par_level = 5.0 WHERE id = 'b7dae0ad-734e-42b4-8fce-6e09c98f71ab'; -- พริกแกงเขียวหวาน
UPDATE public.stock_items SET reorder_point = 0.2 WHERE id = '380a695b-7c31-42e7-be07-5c6b820480b7'; -- พาร์สเลย์แห้ง
UPDATE public.stock_items SET reorder_point = 0.2 WHERE id = 'fc19cfa5-2cb0-4de5-970e-114c2e18a839'; -- ลูกกระวานแห้ง
UPDATE public.stock_items SET min_stock_threshold = 0.4167, reorder_point = 0.4167, par_level = 3.3333 WHERE id = 'acd50e08-d412-4277-9826-33c13b364f43'; -- สบู่เหลวล้างมือ
UPDATE public.stock_items SET reorder_point = 0.5 WHERE id = '58aae13e-6e6c-4adf-87e0-62df1dd2f337'; -- เนยจืด ออลคิด
UPDATE public.stock_items SET reorder_point = 0.5 WHERE id = 'e61b8b7b-10ed-44c8-b63c-e1c8cbe57ef8'; -- โชยุ/แกลอน
UPDATE public.stock_items SET reorder_point = 0.2 WHERE id = '71d4ec77-fff4-4381-9928-099644670d52'; -- โรสแมรี่แห้ง
UPDATE public.stock_items SET min_stock_threshold = 10.0645, reorder_point = 5.0323 WHERE id = '31cd6bca-70fc-4f3c-a93e-1fa5b4cd2fde'; -- ไข่ขาวพาสเจอร์ไรซ์cp (ถุง)
UPDATE public.stock_items SET min_stock_threshold = 0.4941, reorder_point = 0.4941 WHERE id = '11f1b047-aa7d-445d-98b7-4dbdcdbf4d12'; -- ไซรัปราสเบอร์รี่
COMMIT;
