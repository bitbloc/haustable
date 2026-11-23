-- Guarded Database Audit Repair (2026-11-23)
-- 1. Undoes remaining wrong unit-change conversions from 21-22 Nov 2026 (19 balances + 25 alert-level sets)
-- 2. Clears 4 negative balances caused by Bolognese prep production before stock receiving (back to 0, ledger-safe)
-- 3. Fixes inverted alert levels (min_stock_threshold > reorder_point) across stock_items
-- 4. Aligns 24 unambiguous recipe_ingredients.unit values to match stock_items.usage_unit
-- Every balance change uses post_stock_movement() and checks the exact pre-condition so recent counts are never overwritten.

DO $$
DECLARE
  n_bal INT := 0;
  n_neg INT := 0;
  n_lvl INT := 0;
  n_inv INT := 0;
  n_rec INT := 0;
  n_skip INT := 0;
  v_cnt INT := 0;
BEGIN
  -- ── 1A. Balances + Alert levels wrongly scaled by unit change (21-22 Nov 2026) ──

  -- ผักชีไทย/กก (8 -> 0.008 kg on 2026-11-22 15:10 ICT)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '209ab40a-17a0-4bdf-a6c2-0d48e72708b7') = 0.0080 THEN
    PERFORM public.post_stock_movement('209ab40a-17a0-4bdf-a6c2-0d48e72708b7'::uuid, 'set', 8.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.008 → 8.0 กก. (ยอดก่อนแปลง 22 พ.ย.)');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ผักชีไทย/กก'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 2.0, par_level = 10.0
   WHERE id = '209ab40a-17a0-4bdf-a6c2-0d48e72708b7' AND min_stock_threshold = 0.002 AND reorder_point = 0.0005 AND par_level = 0.01;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ผักชีฝรั่ง/กก (2 -> 0.002 kg on 2026-11-22 15:13 ICT)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '67fe49ab-88a3-4e3d-999c-ab0ca3f98931') = 0.0020 THEN
    PERFORM public.post_stock_movement('67fe49ab-88a3-4e3d-999c-ab0ca3f98931'::uuid, 'set', 2.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.002 → 2.0 กก. (ยอดก่อนแปลง 22 พ.ย.)');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ผักชีฝรั่ง/กก'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 1.0, par_level = 5.0
   WHERE id = '67fe49ab-88a3-4e3d-999c-ab0ca3f98931' AND min_stock_threshold = 0.001 AND reorder_point = 0.0005 AND par_level = 0.005;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- หอมแขกพม่า (2 -> 0.002 kg on 2026-11-22 15:08 ICT)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '8f998e43-776a-41ef-bcc2-a57279efdaa6') = 0.0020 THEN
    PERFORM public.post_stock_movement('8f998e43-776a-41ef-bcc2-a57279efdaa6'::uuid, 'set', 2.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.002 → 2.0 กก. (ยอดก่อนแปลง 22 พ.ย.)');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: หอมแขกพม่า'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 1.0, par_level = 5.0
   WHERE id = '8f998e43-776a-41ef-bcc2-a57279efdaa6' AND min_stock_threshold = 0.001 AND reorder_point = 0.0005 AND par_level = 0.005;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ข่า/กก (1 -> 0.1 kg on 2026-11-22 15:14 ICT)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '19bd6bcd-9d1c-4d75-af83-fe4521b9434d') = 0.1000 THEN
    PERFORM public.post_stock_movement('19bd6bcd-9d1c-4d75-af83-fe4521b9434d'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.1 → 1.0 กก. (ยอดก่อนแปลง 22 พ.ย.)');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ข่า/กก'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET min_stock_threshold = 0.3, reorder_point = 1.0, par_level = 3.0
   WHERE id = '19bd6bcd-9d1c-4d75-af83-fe4521b9434d' AND min_stock_threshold = 0.1 AND reorder_point = 0.03 AND par_level = 0.3;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงซิปใส 23*35 /แพ็ค (1.6 -> 0.016 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '1e154370-57ec-4115-ab6d-7cdf0253a98a') = 0.0160 THEN
    PERFORM public.post_stock_movement('1e154370-57ec-4115-ab6d-7cdf0253a98a'::uuid, 'set', 1.6, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.016 → 1.6 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงซิปใส 23*35 /แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET min_stock_threshold = 0.3, reorder_point = 0.5
   WHERE id = '1e154370-57ec-4115-ab6d-7cdf0253a98a' AND min_stock_threshold = 0.003 AND reorder_point = 0.005;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงซิปใส 30*45/แพ็ค (1 -> 0.01 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = 'c126424a-a915-4fba-8e88-2567172282fb') = 0.0100 THEN
    PERFORM public.post_stock_movement('c126424a-a915-4fba-8e88-2567172282fb'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.01 → 1.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงซิปใส 30*45/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 0.5
   WHERE id = 'c126424a-a915-4fba-8e88-2567172282fb' AND min_stock_threshold = 0 AND reorder_point = 0.005;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงซิปใส 9*13/แพ็ค (1 -> 0.01 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = 'bca2210c-cc83-4d59-bd25-902d4ea0c84c') = 0.0100 THEN
    PERFORM public.post_stock_movement('bca2210c-cc83-4d59-bd25-902d4ea0c84c'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.01 → 1.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงซิปใส 9*13/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET min_stock_threshold = 0.3, reorder_point = 0.5
   WHERE id = 'bca2210c-cc83-4d59-bd25-902d4ea0c84c' AND min_stock_threshold = 0.003 AND reorder_point = 0.005;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงเย็น 6*9 / แพ็ค (5 -> 0.05 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '47aca961-01bc-41c9-a313-5f2c6f95bfc2') = 0.0500 THEN
    PERFORM public.post_stock_movement('47aca961-01bc-41c9-a313-5f2c6f95bfc2'::uuid, 'set', 5.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.05 → 5.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงเย็น 6*9 / แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET min_stock_threshold = 0.3, reorder_point = 0.5
   WHERE id = '47aca961-01bc-41c9-a313-5f2c6f95bfc2' AND min_stock_threshold = 0.003 AND reorder_point = 0.005;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงซีล 15*20/แพ็ค (1 -> 0.01 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '47cae545-bb40-426b-918e-92906d82c2a5') = 0.0100 THEN
    PERFORM public.post_stock_movement('47cae545-bb40-426b-918e-92906d82c2a5'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.01 → 1.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงซีล 15*20/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 0.5
   WHERE id = '47cae545-bb40-426b-918e-92906d82c2a5' AND min_stock_threshold = 0 AND reorder_point = 0.005;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงซีล10*15cm/แพ็ค (1 -> 0.01 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = 'ec50331c-1295-438f-891b-ff3f6d50faf9') = 0.0100 THEN
    PERFORM public.post_stock_movement('ec50331c-1295-438f-891b-ff3f6d50faf9'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.01 → 1.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงซีล10*15cm/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 0.3
   WHERE id = 'ec50331c-1295-438f-891b-ff3f6d50faf9' AND min_stock_threshold = 0 AND reorder_point = 0.003;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงซีล22*32cm/แพ็ค (1 -> 0.01 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = 'b62996ae-dd3e-476b-a4d4-b3848382c1c3') = 0.0100 THEN
    PERFORM public.post_stock_movement('b62996ae-dd3e-476b-a4d4-b3848382c1c3'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.01 → 1.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงซีล22*32cm/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 0.3
   WHERE id = 'b62996ae-dd3e-476b-a4d4-b3848382c1c3' AND min_stock_threshold = 0 AND reorder_point = 0.003;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- กระดาษรองอาหาร 18*18 (6.3 -> 0.126 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '0365ce7f-4f1c-4a00-b5c2-f1268e3577e0') = 0.1260 THEN
    PERFORM public.post_stock_movement('0365ce7f-4f1c-4a00-b5c2-f1268e3577e0'::uuid, 'set', 6.3, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.126 → 6.3 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: กระดาษรองอาหาร 18*18'; n_skip := n_skip + 1; END IF;

  -- กล่องใส่อาหาร 3 ช่อง/แพ็ค (7 -> 0.28 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '3ff69bb7-6669-4bf7-96cf-a4f90dcc8735') = 0.2800 THEN
    PERFORM public.post_stock_movement('3ff69bb7-6669-4bf7-96cf-a4f90dcc8735'::uuid, 'set', 7.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.28 → 7.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: กล่องใส่อาหาร 3 ช่อง/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 3.0
   WHERE id = '3ff69bb7-6669-4bf7-96cf-a4f90dcc8735' AND min_stock_threshold = 0 AND reorder_point = 0.12;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- กล่องใส่อาหารฝาพับ 750 มล (0.2 -> 0.008 pack, then +2.24 received = 2.248 -> true 2.44 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '4c1f42c5-c67d-4960-b27f-0f7e92b1057e') = 2.2480 THEN
    PERFORM public.post_stock_movement('4c1f42c5-c67d-4960-b27f-0f7e92b1057e'::uuid, 'set', 2.44, 'opening', 'System (audit repair)', 'แก้ยอดตั้งต้นก่อนรับเข้าที่ถูกหาร 25: 2.248 → 2.44 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: กล่องใส่อาหารฝาพับ 750 มล'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 1.0
   WHERE id = '4c1f42c5-c67d-4960-b27f-0f7e92b1057e' AND min_stock_threshold = 0 AND reorder_point = 0.04;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ชุดช้อนส้อมพลาสติกสีดำ/แพ็ค (counted 3 -> 0.12 -> 0.06 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '31aecd19-8de4-49f7-b38f-c7c94baf48b1') = 0.0600 THEN
    PERFORM public.post_stock_movement('31aecd19-8de4-49f7-b38f-c7c94baf48b1'::uuid, 'set', 3.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 0.06 → 3.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ชุดช้อนส้อมพลาสติกสีดำ/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 3.0
   WHERE id = '31aecd19-8de4-49f7-b38f-c7c94baf48b1' AND min_stock_threshold = 0 AND reorder_point = 60;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถ้วยพร้อมฝา 450 มล (2 -> 80 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '3e08b05c-4bfa-46eb-a509-75313e16fa91') = 80.0000 THEN
    PERFORM public.post_stock_movement('3e08b05c-4bfa-46eb-a509-75313e16fa91'::uuid, 'set', 2.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 80 → 2.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถ้วยพร้อมฝา 450 มล'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 1.0
   WHERE id = '3e08b05c-4bfa-46eb-a509-75313e16fa91' AND min_stock_threshold = 0 AND reorder_point = 40;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงร้อน 5*8 นิ้ว (1 -> 10 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '619e3212-1157-4053-a2b3-3844b31da2bb') = 10.0000 THEN
    PERFORM public.post_stock_movement('619e3212-1157-4053-a2b3-3844b31da2bb'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 10 → 1.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงร้อน 5*8 นิ้ว'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 1.0
   WHERE id = '619e3212-1157-4053-a2b3-3844b31da2bb' AND min_stock_threshold = 0 AND reorder_point = 10;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงร้อน 7*11 นิ้ว /แพ็ค (1 -> 10 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '16e3ff62-631a-40ea-84ae-26e5718d8b58') = 10.0000 THEN
    PERFORM public.post_stock_movement('16e3ff62-631a-40ea-84ae-26e5718d8b58'::uuid, 'set', 1.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 10 → 1.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงร้อน 7*11 นิ้ว /แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 0.5
   WHERE id = '16e3ff62-631a-40ea-84ae-26e5718d8b58' AND min_stock_threshold = 0 AND reorder_point = 5;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ถุงซิปใส่ซอส6*8cm/แพ็ค (2 -> 20 pack)
  IF (SELECT current_quantity FROM public.stock_items WHERE id = '7bb66dd7-bb1d-4bff-9eca-7d83003a0808') = 20.0000 THEN
    PERFORM public.post_stock_movement('7bb66dd7-bb1d-4bff-9eca-7d83003a0808'::uuid, 'set', 2.0, 'opening', 'System (audit repair)', 'แก้ยอดที่ระบบแปลงหน่วยผิด: 20 → 2.0 แพ็ค');
    n_bal := n_bal + 1;
  ELSE RAISE NOTICE 'balance skipped: ถุงซิปใส่ซอส6*8cm/แพ็ค'; n_skip := n_skip + 1; END IF;
  UPDATE public.stock_items SET reorder_point = 1.0
   WHERE id = '7bb66dd7-bb1d-4bff-9eca-7d83003a0808' AND min_stock_threshold = 0 AND reorder_point = 10;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ── 1B. Alert levels ONLY (zero-qty or already-recounted items with scaled thresholds) ──

  UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 2.0, par_level = 10.0
   WHERE id = 'e729b663-dbd5-4aef-8cb1-97653a4719fe' AND min_stock_threshold = 0.002 AND reorder_point = 0.0005 AND par_level = 0.01;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 2.0, par_level = 10.0
   WHERE id = 'f365e3b1-7dae-4fa9-ac37-96f95d08ac1c' AND min_stock_threshold = 0.002 AND reorder_point = 0.001 AND par_level = 0.01;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 2.0, par_level = 10.0
   WHERE id = 'a6be7c42-db35-4232-932d-10fabc5f91a8' AND min_stock_threshold = 0.002 AND reorder_point = 0.0005 AND par_level = 0.01;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 2.0, par_level = 5.0
   WHERE id = '8f0602fa-5570-4994-bc68-799110b8992c' AND min_stock_threshold = 0.0013 AND reorder_point = 0.0027 AND par_level = 0.0067;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  UPDATE public.stock_items SET min_stock_threshold = 0.5, reorder_point = 1.0, par_level = 5.0
   WHERE id = '4c6992ff-b824-4eb0-b410-22f4a5ff7d95' AND min_stock_threshold = 0.01 AND reorder_point = 0.005 AND par_level = 0.05;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  UPDATE public.stock_items SET min_stock_threshold = 0.25, reorder_point = 1.0, par_level = 4.0
   WHERE id = '944c7e3f-fb39-4c9a-a56b-1a62234099ee' AND min_stock_threshold = 0.0004 AND reorder_point = 0.0001 AND par_level = 0.0016;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  UPDATE public.stock_items SET min_stock_threshold = 0.3, reorder_point = 0.5
   WHERE id = 'f81cbd52-5f6d-42e3-aec4-361109651401' AND min_stock_threshold = 0.0006 AND reorder_point = 0.001;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  UPDATE public.stock_items SET min_stock_threshold = 1.0, reorder_point = 2.0, par_level = 3.0
   WHERE id = 'e25cfb4c-b761-4d9f-b3eb-1bb052b5a990' AND min_stock_threshold = 0.0006 AND reorder_point = 0.0011 AND par_level = 0.0017;
  IF FOUND THEN n_lvl := n_lvl + 1; END IF;

  -- ── 2. Clear 4 negative stock balances (from Bolognese prep run before stock receiving) ──

  IF (SELECT current_quantity FROM public.stock_items WHERE id = '0f6c8b7c-6150-4b84-aab1-db319a3aeb1b') = -0.3072 THEN
    PERFORM public.post_stock_movement('0f6c8b7c-6150-4b84-aab1-db319a3aeb1b'::uuid, 'set', 0.0, 'opening', 'System (audit repair)', 'ล้างยอดติดลบจากการผลิตซอสโบโลเนสก่อนรับของเข้าคลัง — รอนับยอดจริง');
    n_neg := n_neg + 1;
  END IF;

  IF (SELECT current_quantity FROM public.stock_items WHERE id = '6e8edc07-2f87-4bb6-957e-4f257edb2168') = -0.0588 THEN
    PERFORM public.post_stock_movement('6e8edc07-2f87-4bb6-957e-4f257edb2168'::uuid, 'set', 0.0, 'opening', 'System (audit repair)', 'ล้างยอดติดลบจากการผลิตซอสโบโลเนสก่อนรับของเข้าคลัง — รอนับยอดจริง');
    n_neg := n_neg + 1;
  END IF;

  IF (SELECT current_quantity FROM public.stock_items WHERE id = '363662ca-238e-482b-944a-749e276cbc97') = -0.5098 THEN
    PERFORM public.post_stock_movement('363662ca-238e-482b-944a-749e276cbc97'::uuid, 'set', 0.0, 'opening', 'System (audit repair)', 'ล้างยอดติดลบจากการผลิตซอสโบโลเนสก่อนรับของเข้าคลัง — รอนับยอดจริง');
    n_neg := n_neg + 1;
  END IF;

  IF (SELECT current_quantity FROM public.stock_items WHERE id = '9481eb7a-8e80-498f-bb9d-9fa2dfcaabce') = -0.1000 THEN
    PERFORM public.post_stock_movement('9481eb7a-8e80-498f-bb9d-9fa2dfcaabce'::uuid, 'set', 0.0, 'opening', 'System (audit repair)', 'ล้างยอดติดลบจากการผลิตซอสโบโลเนสก่อนรับของเข้าคลัง — รอนับยอดจริง');
    n_neg := n_neg + 1;
  END IF;

  -- ── 3. Fix all remaining min_stock_threshold > reorder_point inversions ──

  -- 3A: Both > 0 and min > reorder => swap so min (จุดวิกฤต) <= reorder (จุดสั่งซื้อ)
  UPDATE public.stock_items
     SET min_stock_threshold = reorder_point,
         reorder_point = min_stock_threshold
   WHERE item_type <> 'recipe'
     AND COALESCE(min_stock_threshold, 0) > 0
     AND COALESCE(reorder_point, 0) > 0
     AND min_stock_threshold > reorder_point;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  n_inv := n_inv + v_cnt;

  -- 3B: min > 0 and reorder = 0 => mirror min onto reorder_point
  UPDATE public.stock_items
     SET reorder_point = min_stock_threshold
   WHERE item_type <> 'recipe'
     AND COALESCE(min_stock_threshold, 0) > 0
     AND COALESCE(reorder_point, 0) = 0;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  n_inv := n_inv + v_cnt;

  -- ── 4. Align 24 unambiguous recipe_ingredients.unit rows to stock_items.usage_unit ──

  -- 4A: หลอดแก้วพลาสติกสกรีน(สีน้ำเงิน) 21ซม ,5มม (18 menu rows: 'unit' -> 'pcs')
  UPDATE public.recipe_ingredients
     SET unit = 'pcs'
   WHERE ingredient_id = 'a6062240-127a-4f79-98c2-f7a16dad88f4'
     AND unit = 'unit';
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  n_rec := n_rec + v_cnt;

  -- 4B: รีเจนซี่ (2 menu rows: 'pcs' -> 'bottle')
  UPDATE public.recipe_ingredients
     SET unit = 'bottle'
   WHERE ingredient_id = '879d1be8-3bfc-46d0-b9d7-3637891c3bd3'
     AND unit = 'pcs';
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  n_rec := n_rec + v_cnt;

  -- 4C: พริกแกงสะตอ 15 เสิร์ฟ (1 menu row: 'shot' -> 'pcs')
  UPDATE public.recipe_ingredients
     SET unit = 'pcs'
   WHERE id = 'd4f8f6f2-2491-4045-9b86-00e3772d6e23'
     AND unit = 'shot';
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  n_rec := n_rec + v_cnt;

  -- 4D: พริกขี้หนูสวน/กก (75 g), หอมแขกพม่า (375 g), มะนาว/กก in สะตอผัดกุ้งจริตจัด (10 g)
  UPDATE public.recipe_ingredients
     SET unit = 'g'
   WHERE id IN (
     'd33c7de8-57bb-4ae2-b0f0-1b4295050a22',
     '678ce334-2d34-4337-90aa-19db3c370dfc',
     'b0801f8a-447e-4d1f-bfac-5f726e3a28cf'
   ) AND unit = 'unit';
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  n_rec := n_rec + v_cnt;

  RAISE NOTICE 'Audit repair complete: balances=%, negatives_cleared=%, scaled_levels=%, inverted_levels=%, recipe_units=%, skipped=%',
    n_bal, n_neg, n_lvl, n_inv, n_rec, n_skip;
END $$;
